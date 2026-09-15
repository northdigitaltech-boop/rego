import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { clientIp } from "@/lib/rate-limit";
import { limitAndLog } from "@/lib/rate-limit-guard";
import { enforceIpBlock } from "@/lib/ip-block";
import { sendMail } from "@/lib/mailer";
import { flightFlags } from "@/lib/flights/registry";
import { formatMoney, formatDateShort, formatTime } from "@/lib/flights/format";
import type { FlightOffer } from "@/lib/flights/types";

/* ============================================================
 * POST /api/flights/request
 *
 * A traveller asks Rego to book a flight they picked. No money
 * moves, no ticket is issued, no provider is called. Rego's team
 * takes it from here.
 *
 * THE PRICE COMES FROM THE DATABASE, NOT THE REQUEST BODY
 *   The client sends an offer id and nothing about money. The
 *   quoted total is read from flight_offers. A form that posted
 *   its own price would let anyone file a request for PKR 1 and
 *   then argue Rego's own screen had promised it.
 *
 * AN EXPIRED OFFER IS STILL ACCEPTED — ON PURPOSE
 *   For a booking that would be wrong; for an enquiry it is the
 *   opposite. Somebody who found a flight an hour ago still wants
 *   that flight. The team is told the fare has expired and will
 *   requote, which is what they would do anyway.
 * ============================================================ */

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/** Where the team is told about a new request. */
const TEAM_INBOX =
  process.env.FLIGHT_REQUESTS_EMAIL || process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || "";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function sameOrigin(req: Request): boolean {
  const host = req.headers.get("host");
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!host || !origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** REGO-FL-7K2M9Q4X — quotable over the phone, hard to mistype into someone else's. */
function makeReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `REGO-FL-${out}`;
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );

/* ------------------------------------------------------------------ */

interface OfferRow {
  id: string;
  offer: FlightOffer;
  expires_at: string;
  customer_total: number;
  currency: string;
  origin: string;
  destination: string;
  cabin: string;
}

export async function POST(req: Request) {
  if (!flightFlags.enabled()) return bad("Flights are not available yet.", 503);

  const blocked = await enforceIpBlock(req);
  if (blocked) return blocked;

  if (!sameOrigin(req)) return bad("Invalid origin.", 403);

  const ip = clientIp(req);
  /* Tighter than search: this creates a row a human has to work through, so
     the abuse case is filling somebody's queue with rubbish. */
  const limited = limitAndLog(req, `flight-request:${ip}`, 5, 60_000, {
    endpoint: "/api/flights/request",
    category: "booking",
  });
  if (!limited.ok) {
    return bad("Too many requests in a short time. Wait a minute.", 429);
  }

  if (!SUPABASE_URL || !SERVICE_KEY) return bad("Server is not configured.", 503);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("Invalid request.");

  const offerId = String(body.offerId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(offerId)) return bad("Choose a flight first.");

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  const notes = String(body.notes ?? "").trim().slice(0, 2000);

  if (name.length < 2) return bad("Please enter your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad("Please enter a valid email address.");
  if (phone.replace(/[^0-9]/g, "").length < 7) return bad("Please enter a phone number we can reach you on.");

  const sb: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: offerRow } = await sb
    .from("flight_offers")
    .select("id, offer, expires_at, customer_total, currency, origin, destination, cabin")
    .eq("id", offerId)
    .maybeSingle();

  if (!offerRow) return bad("That flight is no longer available. Please search again.", 404);

  const row = offerRow as OfferRow;
  const offer = row.offer;
  const expired = new Date(row.expires_at).getTime() <= Date.now();

  /* Attach the request to an account when there is one, so it shows in their
     dashboard. Signed out is fine — the reference and the email are the
     record. */
  let userId: string | null = null;
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (token && ANON_KEY) {
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data } = await asUser.auth.getUser();
    userId = data?.user?.id ?? null;
  }

  const outbound = offer.itineraries[0];
  const inbound = offer.itineraries[1] ?? null;
  const reference = makeReference();

  const { data: created, error } = await sb
    .from("flight_requests")
    .insert({
      reference,
      user_id: userId,
      offer_id: row.id,
      itinerary_snapshot: offer as unknown as Record<string, unknown>,
      trip_type: inbound ? "round_trip" : "one_way",
      origin: row.origin,
      destination: row.destination,
      departure_date: outbound.segments[0].departureAt.slice(0, 10),
      return_date: inbound ? inbound.segments[0].departureAt.slice(0, 10) : null,
      cabin: row.cabin,
      adults: offer.passengers.adults,
      children: offer.passengers.children,
      infants: offer.passengers.infants,
      /* From the database. The client never sends a price. */
      quoted_total: row.customer_total,
      quoted_currency: row.currency,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      notes: notes || null,
    })
    .select("id, reference")
    .single();

  if (error) {
    console.warn("[flights/request] insert failed:", error.message);
    return bad("We could not save your request. Please try again.", 500);
  }

  /* ---- email ----
     Fire and forget. A request that saved but whose email failed is still a
     request the team can see; failing the whole call would lose it. */
  const route = `${row.origin} → ${row.destination}`;
  const when = formatDateShort(outbound.segments[0].departureAt);
  const price = formatMoney({ amount: row.customer_total, currency: row.currency });

  if (TEAM_INBOX) {
    void sendMail({
      to: TEAM_INBOX,
      subject: `Flight request ${reference} — ${route} ${when}`,
      html:
        `<p><strong>${escapeHtml(name)}</strong> asked Rego to book a flight.</p>` +
        `<p><strong>Reference:</strong> ${reference}<br/>` +
        `<strong>Route:</strong> ${escapeHtml(route)}<br/>` +
        `<strong>Departs:</strong> ${escapeHtml(when)}<br/>` +
        `<strong>Travellers:</strong> ${offer.passengers.adults} adult(s), ` +
        `${offer.passengers.children} child(ren), ${offer.passengers.infants} infant(s)<br/>` +
        `<strong>Cabin:</strong> ${escapeHtml(row.cabin)}<br/>` +
        `<strong>Airline:</strong> ${escapeHtml(offer.validatingCarrierName)}<br/>` +
        `<strong>Price on screen:</strong> ${price}${expired ? " <em>(fare had expired — requote)</em>" : ""}</p>` +
        `<p><strong>Contact:</strong> ${escapeHtml(email)} · ${escapeHtml(phone)}</p>` +
        (notes ? `<p><strong>Notes:</strong><br/>${escapeHtml(notes)}</p>` : "") +
        (offer.isMock
          ? `<p style="color:#92400e"><strong>NOTE:</strong> this itinerary came from MOCK data. ` +
            `Treat the route and dates as what the customer wants, not as a real fare.</p>`
          : ""),
    }).catch(() => {});
  }

  void sendMail({
    to: email,
    subject: `We have your flight request — ${reference}`,
    html:
      `<p>Thanks ${escapeHtml(name.split(" ")[0])}, we have your request.</p>` +
      `<p><strong>Reference:</strong> ${reference}<br/>` +
      `<strong>Route:</strong> ${escapeHtml(route)}<br/>` +
      `<strong>Departs:</strong> ${escapeHtml(when)}</p>` +
      /* Said plainly, because it is the thing most likely to be
         misunderstood: nothing is booked and no seat is held. */
      `<p>Nothing is booked yet and no seat is held. Our team will confirm the ` +
      `fare with the airline and come back to you — fares move, so the final ` +
      `price may differ from the ${price} shown on screen.</p>` +
      `<p>If anything changes in the meantime, reply to this email and quote ${reference}.</p>`,
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    reference: created.reference,
    expired,
  });
}
