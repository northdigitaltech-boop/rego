# REGO Flights — Architecture

Status: **proposal, pending approval.** No production code has been written.
Author's note: written after inspecting the existing codebase, not from the brief alone.

---

## 0. Read this first: three findings that change the plan

The brief assumes REGO already has the shape of an OTA. It does not, in three
specific ways. None of them is a reason not to build Flights; all three change
what "Phase 1" means.

### 0.1 REGO has no payment gateway — payment today is manual and human-verified

`phase26-payments.sql` is the whole payment system. It adds to every booking
table:

```
payment_method            text            -- pay_at_property | bank_transfer | jazzcash | easypaisa
payment_status            text default 'unpaid'
payment_screenshot_url    text            -- the customer uploads proof
admin_payment_note        text
advance_payment_required  boolean
```

There is no Stripe, no PayFast, no card capture, no webhook, no settlement.
A customer transfers money, uploads a screenshot, and **an admin looks at it
and marks it paid.**

That model cannot issue airline tickets. Ticketing is not a status flag — it
spends real money at the GDS within minutes of booking, and the fare is held
for a countdown measured in minutes to hours. A flow that waits on a human to
squint at a bank screenshot will miss every ticketing deadline it meets.

**Consequence:** a real payment gateway is a hard prerequisite for
`FLIGHT_TICKETING_ENABLED`, not a Phase 4 nicety. Everything up to and
including *search, select, reprice, passenger capture and a held order* can be
built without it. Taking money cannot.

### 0.2 REGO is a marketplace, not a merchant of record — Flights inverts that

Every existing REGO booking is an **enquiry**. `hotel_bookings`,
`activity_bookings`, `expedition_bookings` and the other nine all follow the
same shape: the traveller asks, the provider accepts, and the two of them
settle money between themselves. REGO holds the record and takes no cash. The
cancellation library says so explicitly — there is no refund engine "because
REGO currently does not process payments."

Flights cannot work that way. There is no provider to accept; there is an
airline that wants settled funds. REGO becomes the merchant: it takes the
money, owes a ticket, and owes a refund when things go wrong.

That is a different **business**, with different obligations: chargebacks,
consumer-protection rules, IATA settlement, refund timelines, and liability
when a ticket fails after payment. The architecture below is built for it, but
the decision is commercial and yours, not technical and mine.

### 0.3 Travelport access is an accreditation problem, not a credentials problem

The brief says "I may not yet have Travelport production credentials." Worth
being precise about what stands between here and there, because it drives the
timeline more than any code does:

- an **IATA or ARC accreditation**, or a contracted relationship with a
  consolidator/host agency that lets you ticket under theirs
- a **PCC / office ID** issued under that accreditation
- a **financial instrument** — deposit, bond, or bank guarantee — because
  ticketing draws real money
- a signed Travelport agreement with segment/booking commitments

The mock-provider approach in the brief is exactly right, and the reason it is
right is this: the software can be finished and sitting idle long before the
accreditation lands. Build to the interface, not to Travelport.

---

## 1. Existing REGO architecture (as inspected)

| Area | What is actually there |
|---|---|
| Framework | Next.js App Router, `src/app`, React server components by default, `"use client"` where needed |
| Language | TypeScript. `next.config.mjs` sets `eslint.ignoreDuringBuilds: true` but **not** `typescript.ignoreBuildErrors` — a type error fails the Vercel build. That is the only automated gate in CI. |
| Styling | Tailwind + a project design language: `font-display`, `text-forest`, `bg-gradient-forest`, `bg-gold`, `rounded-3xl`, `shadow-premium`, `container-px`, `auth-input` |
| Auth | Supabase Auth → `public.profiles` (`id`, `email`, `full_name`, `role`). `public.is_admin()` is a SECURITY DEFINER function checking `role = 'admin'` |
| Staff permissions | `phase104`–`phase115`: `staff_members`, `staff_roles`, `staff_permissions`, `staff_scopes`, and `public.staff_can(permission, location)`. Server routes authorise via `src/lib/staff-guard.ts` → `callerCan()` |
| Customer dashboard | `src/components/dashboard/dashboard.tsx`, tab state, `/dashboard` |
| Provider dashboards | One component per category, shared shell: `lg:grid-cols-[240px_1fr]`, sticky `<aside>`, icon nav, `useDashboardDrill` + `DashboardBack`, `ContactAdminButton` |
| Admin | `src/components/dashboard/admin-dashboard.tsx` — a single ~2,700-line client component with a `Tab` union and a `nav` array |
| Bookings | **Eleven** tables, registered in `src/lib/booking-cancellation.ts` `BOOKING_TABLES`. Cancellation columns added to all by `phase93`. Server-side cancel at `/api/booking/cancel` |
| API routes | `src/app/api/**/route.ts`. House pattern (see `api/admin/markets`): IP block → same-origin check → rate limit → bearer token → DB-read authorisation → field whitelist → audit log. Service-role key server-only |
| Email | `src/lib/email.ts` → `POST /api/email` → `src/lib/mailer.ts` (nodemailer, SMTP) |
| PDF | `src/lib/voucher-pdf.ts`, served by `/api/booking/voucher` — **reusable for e-tickets** |
| Notifications | `phase50`: `notifications`, `notification_preferences`, `notification_delivery_logs`, `price_alerts` |
| Media | Cloudinary via `ImageUpload` |
| Migrations | Numbered `supabase/phaseNN-*.sql`, each with a rollback block. Tested against PGlite in `scripts/test-phaseNN.mjs` before shipping |

### Conventions worth not breaking

1. **RLS policies that call a SECURITY DEFINER function must be `TO authenticated`.**
   `staff_can()` is revoked from `anon`; a policy with no `TO` clause is
   evaluated for `anon` too, where it does not return false — it *raises*, and
   the whole SELECT fails. `phase113` had to repair ~48 tables for this.
2. **Row policies decide rows, never columns.** Column-level control is done
   with `revoke update … grant update (col) to authenticated`, or a
   `BEFORE UPDATE` trigger.
3. **An UPDATE with no permitting policy affects zero rows and raises nothing.**
   Tests must assert on data read back, never on the absence of an exception.
4. Every migration ships with a rollback and a PGlite test.

---

## 2. Proposed Flights architecture

```
Browser  ──►  /flights/*  (RSC + client widgets)
                  │
                  ▼
          /api/flights/*        ← rate limited, same-origin, auth'd
                  │
                  ▼
          FlightService          ← markup, idempotency, state machine, audit
                  │
                  ▼
          FlightProvider         ← interface, one implementation selected by env
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
  MockFlightProvider   TravelportProvider   (Amadeus / Duffel / Sabre later)
                              │
                              ▼
                        GDS / NDC / airline
```

**The browser never sees a provider response.** Adapters map provider payloads
into REGO's normalized models; nothing outside `src/lib/flights/providers/`
imports a provider type. If that rule holds, swapping Travelport for Duffel is
one file and a config change. If it leaks once, it is a rewrite.

### 2.1 Directory layout

```
src/lib/flights/
  types.ts                     normalized domain models (no provider types)
  provider.ts                  FlightProvider interface + FlightProviderError
  registry.ts                  getFlightProvider() — env-driven selection
  service.ts                   orchestration: markup, state, idempotency, audit
  markup.ts                    pure rule engine (unit-testable, no I/O)
  state-machine.ts             legal transitions, pure
  airports.ts                  autocomplete queries
  providers/
    mock/                      MockFlightProvider + fixtures
    travelport/                adapter + request/response mappers (scaffold)

src/app/api/flights/
  airports/route.ts            GET  autocomplete
  search/route.ts              POST search
  price/route.ts               POST reprice a selected offer
  order/route.ts               POST create internal order (idempotent)
  book/route.ts                POST create provider booking (idempotent)
  ticket/route.ts              POST issue ticket (idempotent)
  cancel/route.ts              POST request cancellation

src/app/flights/               public search + results + detail + checkout
src/app/dashboard/flights/     My Trips
src/app/admin/flights/         admin (new routes — see §7)
src/components/flights/        UI
```

### 2.2 Route structure

| Route | Purpose |
|---|---|
| `/flights` | Search landing. Premium hero + search widget |
| `/flights/search` | Results, filters, sort |
| `/flights/offer/[offerId]` | Detail. *(Brief says `/flights/[offerId]`; that collides with the SEO routes below — see §9)* |
| `/flights/checkout/passengers` | Passenger + document capture |
| `/flights/checkout/review` | Review, fare rules, consent |
| `/flights/checkout/payment` | Payment (gated by `FLIGHT_PAYMENT_ENABLED`) |
| `/flights/checkout/confirmation/[orderId]` | Outcome |
| `/dashboard/flights` | My Trips |
| `/dashboard/flights/[bookingId]` | Booking detail |
| `/admin/flights/*` | Admin |

---

## 3. Normalized domain models

Defined in `src/lib/flights/types.ts`. Strict TypeScript, no `any`, no provider
fields. Money is never a float:

```ts
/** Minor units (paisa, cents) + ISO-4217. A float here is a rounding bug
    waiting for a 3-passenger international fare. */
export interface Money { amount: number; currency: string }
```

Core types: `FlightSearchRequest`, `FlightOffer`, `FlightItinerary`,
`FlightSegment`, `FlightPassenger`, `FlightFare`, `FlightBaggage`,
`FlightOrder`, `FlightTicket`, `FlightPayment`, `FlightRefund`,
`FlightProviderError`.

`FlightFare` carries the full price breakdown so the audit trail is structural,
not reconstructed:

```ts
export interface FlightFare {
  providerBaseFare: Money;
  providerTax: Money;
  regoMarkup: Money;
  regoServiceFee: Money;
  customerTotal: Money;
  markupRuleIds: string[];   // which rules fired, for the audit trail
  refundable: boolean;
  changeable: boolean;
  fareFamily: string | null;
}
```

---

## 4. Provider abstraction

```ts
export interface FlightProvider {
  readonly id: "mock" | "travelport" | "amadeus" | "duffel" | "sabre";
  searchFlights(req: FlightSearchRequest, ctx: ProviderContext): Promise<FlightOffer[]>;
  priceOffer(offerId: string, ctx: ProviderContext): Promise<FlightOffer>;
  createBooking(input: CreateBookingInput, ctx: ProviderContext): Promise<ProviderBooking>;
  addPayment(input: AddPaymentInput, ctx: ProviderContext): Promise<ProviderPaymentResult>;
  issueTicket(input: IssueTicketInput, ctx: ProviderContext): Promise<FlightTicket[]>;
  retrieveBooking(ref: string, ctx: ProviderContext): Promise<ProviderBooking>;
  cancelBooking(ref: string, ctx: ProviderContext): Promise<ProviderCancellation>;
  refundBooking(input: RefundInput, ctx: ProviderContext): Promise<FlightRefund>;
  exchangeBooking(input: ExchangeInput, ctx: ProviderContext): Promise<ProviderBooking>;
  getSeatMap(offerId: string, ctx: ProviderContext): Promise<SeatMap | null>;
  getAncillaries(offerId: string, ctx: ProviderContext): Promise<Ancillary[]>;
}
```

`ProviderContext` carries `correlationId`, `idempotencyKey` and an
`AbortSignal`. Every provider call is logged to `flight_provider_logs` with the
correlation id — **request and response bodies redacted** of passport numbers,
card data and credentials.

Selection is a single env var, read server-side only:

```
FLIGHT_PROVIDER=mock   # later: travelport
```

### MockFlightProvider

Returns realistic itineraries for the routes in the brief (KUL→ISB, ISB→KDU,
ISB→DXB, KHI→JED, ISB→LHR, DXB→KUL), with direct, 1-stop and 2-stop options.

Two non-negotiables:

1. Every mock offer carries `isMock: true`, surfaced as a visible **MOCK DATA**
   badge in non-production. A screenshot of a mock result must never be
   mistakable for a real ticket.
2. `issueTicket()` on the mock provider **throws** unless
   `FLIGHT_ALLOW_MOCK_TICKETING=true`. A mock ticket number that reaches a
   customer is worse than no module at all.

The mock also simulates the failure modes the real world will produce: price
change on reprice, fare expiry, seat gone, provider timeout. Those paths must
be exercised before Travelport, not after.

---

## 5. Database schema

New tables, all prefixed `flight_`. No existing table is altered. One
migration per logical group, each with a rollback and a PGlite test.

| Table | Notes |
|---|---|
| `airports` | `iata_code` unique, `icao_code`, name, city, country, `country_code`, timezone, lat/lon, `is_active`. Trigram index on name/city for autocomplete |
| `airlines` | `iata_code`, `icao_code`, name, logo URL, country |
| `flight_searches` | Audit + analytics. Search params, result count, provider, duration, `correlation_id` |
| `flight_offers` | Cached offers with `expires_at`. Provider payload in `jsonb`, redacted |
| `flight_orders` | The spine. Internal state, provider state, PNR, `idempotency_key` unique, price snapshot, `user_id` |
| `flight_order_passengers` | Names, DOB, nationality. **Passport handling — see §10** |
| `flight_segments` | Per-segment itinerary, denormalized so a booking still renders when an offer expires |
| `flight_fare_details` | `provider_base_fare`, `provider_tax`, `rego_markup`, `rego_service_fee`, `customer_total`, currency, `markup_rule_ids[]` |
| `flight_tickets` | Ticket numbers, status, per passenger |
| `flight_payments` | Payment state, gateway, gateway reference. **Never card data** |
| `flight_refunds` / `flight_cancellations` | Request, approval, provider result, amounts |
| `flight_markup_rules` | Rule engine rows — see §6 |
| `flight_provider_logs` | Redacted request/response, latency, error |
| `flight_webhook_events` | Raw inbound events, dedup key, processed flag |
| `flight_audit_logs` | Append-only. No update or delete policy, same as `market_audit_logs` |

RLS: a customer reads their own orders; staff read per `staff_can('view_flight_bookings')`
scoped where sensible; admin reads all. **All write policies `TO authenticated`** (§1).
`flight_audit_logs` gets a select policy and no write policy — the service-role
key writes it, which is what makes it evidence rather than a note.

**`BOOKING_TABLES` in `booking-cancellation.ts` is deliberately NOT extended.**
That registry drives a cancel route built for enquiry-shaped bookings with no
money in them. Flights need their own cancellation path with real refund
arithmetic. Reusing the registry would put a refund-less cancel button on a
paid ticket.

---

## 6. Markup engine

`src/lib/flights/markup.ts` — a pure function over rules. No I/O, so it is
fully unit-testable, which matters because this is the code that decides what
a customer is charged.

```ts
export function applyMarkup(fare: ProviderFare, rules: MarkupRule[], ctx: MarkupContext): FlightFare
```

Rule dimensions: scope (`all` | `airline` | `route` | `international` |
`domestic` | `cabin` | `provider`), match value, `kind` (`percent` | `fixed`),
`value`, `currency`, `priority`, `is_active`, validity dates.

Conflict resolution, stated once so it cannot drift:

1. Collect every rule whose scope matches.
2. Sort by `priority` descending, then by specificity
   (route > airline > cabin > international/domestic > provider > all).
3. **Apply the single highest-priority matching rule per kind** — at most one
   percentage and at most one fixed amount. Stacking every matching rule is how
   a 2% platform rule plus a 3% airline rule plus a PKR 5,000 route rule
   silently becomes an unsellable fare.
4. Record every rule that *matched* in `markup_rule_ids`, including the ones
   that lost, so the audit trail explains the decision.

Provider fare and tax are stored untouched, always. Markup is additive and
recorded separately — never folded into the base fare.

An admin preview ("what would this rule do to a PKR 85,000 KUL→ISB business
fare?") is part of the markup screen, not an afterthought.

---

## 7. Booking state machine

Internal state and provider state are separate columns, because they genuinely
diverge — the most expensive case being *payment taken, provider booking
failed*.

```
draft → search_selected → price_confirmed → payment_pending
  → payment_success → booking_pending → booked
  → ticketing_pending → ticketed
```

Failure branches: `booking_failed`, `ticketing_failed`.
Post-issue: `cancel_requested → cancelled`,
`refund_requested → refund_pending → refunded | partially_refunded`.

Transitions are validated by a pure function; an illegal transition throws and
is logged. The table stores the current state, and `flight_audit_logs` stores
every transition with actor, timestamp and correlation id.

### Failure handling — the part that actually matters

| Failure | Response |
|---|---|
| Payment succeeded, provider booking failed | Order → `booking_failed`. **Automatic refund initiation**, admin alerted immediately, customer told plainly. This is the one that must never be silent. |
| Provider booked, ticketing failed | Order → `ticketing_failed`. PNR held. Admin queue with the provider error. Retry is manual — a retry loop against ticketing can double-issue. |
| Fare expired at reprice | Back to results with the new price. Never book at a price the customer did not see. |
| Provider timeout on book | **Do not retry.** Call `retrieveBooking` with the idempotency key to find out whether it actually worked. A blind retry is how duplicate PNRs happen. |
| Duplicate submit / refresh | `idempotency_key` is UNIQUE on `flight_orders`. Second request returns the first result. |

Idempotency key = hash of (user, offer, passengers, client-supplied UUID),
generated client-side at checkout entry and sent with every mutating call.

---

## 8. Payment

`PaymentProvider` interface mirroring the flight abstraction:
`authorize`, `capture`, `refund`, `void`, `getStatus`, `handleWebhook`.

States: `pending`, `authorized`, `paid`, `failed`, `refunded`,
`partially_refunded` — stored on `flight_payments`, **never** conflated with
booking state.

Preferred flow is **authorize → book → ticket → capture**, so a failed booking
voids an authorization instead of requiring a refund. Whether that is available
depends on the gateway; if it only supports immediate capture, the
payment-succeeded-booking-failed path above becomes routine rather than rare,
and the refund automation has to be built before launch rather than after.

Given §0.1, Phase 4 begins with a decision I cannot make for you: **which
gateway, and are you the merchant of record.** Everything else in Phase 4
follows from the answer.

---

## 9. SEO

`/flights`, `/flights/pakistan`, `/flights/international` as real pages.

City-pair routes (`/flights/islamabad-to-skardu`) are **architecturally
supported, not generated.** A slug resolver maps pair → airport codes, and
pages render only for pairs with real inventory. Mass-generating thin city-pair
pages is the doorway-page pattern your SEO rules already forbid, and it is what
gets a domain penalised.

Note the collision: the brief asks for `/flights/[offerId]` *and*
`/flights/kuala-lumpur-to-islamabad`. Both are one dynamic segment under
`/flights`, so offers move to `/flights/offer/[offerId]` to keep the city-pair
namespace clean.

---

## 10. Security & data protection

- Provider secrets, PCC, office ID, tokens: server-side env only. Never
  `NEXT_PUBLIC_*`. **This repo is public.**
- Never logged: card number, CVV, full passport number, access tokens.
  `flight_provider_logs` redacts on write, not on read.
- Rate limit search hard — it is the expensive endpoint and the obvious abuse
  target. Existing `limitAndLog` is in-memory and therefore per-Vercel-instance;
  flights need a shared store (Upstash/Redis) to be a real cap.
- All mutating endpoints: same-origin + bearer token + DB-read authorisation,
  following the `api/admin/markets` pattern.

### Passport data

Airlines require passport details for international itineraries, so this cannot
be avoided entirely. The position:

- Capture passport data **only** when the itinerary requires it.
- Store `passport_last_four` and expiry for customer-facing display; hold the
  full number only as long as ticketing needs it, then null it on a scheduled
  job once the order is `ticketed`.
- Never select it in list queries. Admin list pages read a view that excludes it.
- Full number never appears in logs, audit rows, PDFs stored at rest, or email.
- Column-level revoke so even a row-readable order does not expose it.

The earlier staff-CV work deferred identity documents pending an evidence
storage decision (Cloudinary signed delivery vs Supabase private bucket).
**That decision blocks this too**, and should be made once for both.

---

## 11. Implementation phases

| Phase | Contents | Blocked by |
|---|---|---|
| 1 | Types, provider interface, mock provider, markup engine (pure), state machine (pure), airports + airlines migration + seed | — |
| 2 | `/flights`, autocomplete, results, filters, sort, offer detail | 1 |
| 3 | Passenger capture, review, internal order creation | 1, passport storage decision |
| 4 | Payment abstraction + gateway, booking workflow, idempotency, failure recovery | **Gateway + merchant-of-record decision (§0.1, §0.2)** |
| 5 | Travelport adapter | **Accreditation + PCC (§0.3)** |
| 6 | My Trips, e-ticket PDF (extends `voucher-pdf.ts`), email, notifications | 4 |
| 7 | Admin: bookings, airlines, airports, markup, providers, refunds, settings | 4 |
| 8 | Hardening, tests, monitoring, load | all |

Phases 1–3 are genuinely unblocked and can ship behind `FLIGHTS_ENABLED=false`
without touching a line of existing REGO functionality.

### Admin integration note

`admin-dashboard.tsx` is ~2,700 lines in one client component. Flights must
**not** become eight more tabs in it. The eight `/admin/flights/*` routes are
separate pages reusing the existing shell and `staff_can()` guards. Existing
admin behaviour is untouched.

---

## 12. Feature flags

```
FLIGHTS_ENABLED=false            # module visible at all
FLIGHT_PROVIDER=mock             # mock | travelport | …
FLIGHT_BOOKING_ENABLED=false     # create orders
FLIGHT_PAYMENT_ENABLED=false     # take money
FLIGHT_TICKETING_ENABLED=false   # issue tickets
FLIGHT_ALLOW_MOCK_TICKETING=false
```

Each flag is checked **server-side**. A hidden button is not a control — the
same rule the staff permission system already follows.

---

## 13. Testing

Pure units first, because they are where the money is:
markup calculation (incl. conflicting rules), state transitions, passenger
validation, refund arithmetic, idempotency key generation.

Then mocked-provider integration: search → price change → reprice → book →
ticket; and each failure path in §7 as its own test.

Migrations: PGlite, apply + rollback, asserting on **data read back** — never
on the absence of an exception.

---

## 14. Open questions for you

1. **Merchant of record** — does REGO take the money and owe the ticket? (§0.2)
2. **Payment gateway** — which, and does it support authorize-then-capture? (§0.1)
3. **Accreditation** — IATA/ARC directly, or ticket under a consolidator? (§0.3)
4. **Passport retention** — confirm the minimise-and-purge policy in §10, and
   settle the shared document-storage decision.
5. **Currency** — is PKR the only settlement currency at launch, or is
   multi-currency display needed from day one? (This one is cheap now and
   expensive later.)
6. **Scope of Phase 1–3** — approve building search-only, behind flags, while
   1–4 are resolved?
