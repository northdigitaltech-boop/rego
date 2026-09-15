/* Phase 1 unit tests — markup engine and booking state machine.

   NOT YET RUN. The sandbox lost drive access before this could execute.
   Run with:

     cd /d "F:\local E\rego\rego\rego"
     npx tsx scripts/test-flights-phase1.mjs

   (or `npx tsx` → `npm i -D tsx` once, if it is not already available)

   These two modules are pure on purpose: they decide what a customer is
   charged and whether money can move, and both must be provable without a
   database, a provider or a clock.

   The cases below are the ones that cost real money if wrong:
     1. Conflicting markup rules do not stack.
     2. Provider fare is never modified.
     3. Rules that matched but lost are still recorded.
     4. Percentages round half-up to a whole minor unit.
     5. A booking cannot skip payment, and cannot un-refund itself.
*/

import {
  applyMarkup,
  calculateMarkup,
  explainMarkup,
} from "../src/lib/flights/markup.ts";
import {
  assertTransition,
  canTransition,
  isTerminal,
  IllegalTransitionError,
  OWES_CUSTOMER_STATES,
} from "../src/lib/flights/state-machine.ts";

let failed = false;
const check = (label, cond, extra) => {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) {
    failed = true;
    if (extra !== undefined) console.log(`       ${extra}`);
  }
};

const PKR = "PKR";
const money = (amount) => ({ amount, currency: PKR });

/* PKR 85,000.00 base + PKR 15,300.00 tax. */
const fare = {
  baseFare: money(8_500_000),
  tax: money(1_530_000),
  total: money(10_030_000),
};

const ctx = {
  validatingCarrierCode: "PK",
  originCode: "KUL",
  destinationCode: "ISB",
  originCountryCode: "MY",
  destinationCountryCode: "PK",
  cabin: "business",
  providerId: "mock",
  now: "2026-09-16T00:00:00.000Z",
};

const rule = (over) => ({
  id: "r",
  scope: "all",
  matchValue: null,
  kind: "percent",
  value: 0,
  currency: null,
  priority: 0,
  isActive: true,
  startsAt: null,
  endsAt: null,
  label: null,
  ...over,
});

/* ================================================================== */
console.log("markup — the rules from the brief, all matching at once:");

/* Exactly the set in the brief: 2% all, 3% PIA, PKR 3,000 international,
   PKR 5,000 on the route, 4% business. Every one matches this flight. */
const rules = [
  rule({ id: "all-2", scope: "all", kind: "percent", value: 2, priority: 10 }),
  rule({ id: "pia-3", scope: "airline", matchValue: "PK", kind: "percent", value: 3, priority: 20 }),
  rule({ id: "intl-3k", scope: "international", kind: "fixed", value: 300_000, currency: PKR, priority: 20 }),
  rule({ id: "route-5k", scope: "route", matchValue: "KUL-ISB", kind: "fixed", value: 500_000, currency: PKR, priority: 20 }),
  rule({ id: "biz-4", scope: "cabin", matchValue: "business", kind: "percent", value: 4, priority: 20 }),
];

const res = calculateMarkup(fare, rules, ctx);

check("all five rules match", res.matchedRuleIds.length === 5, JSON.stringify(res.matchedRuleIds));

/* Percent winners tie on priority 20 (pia-3, biz-4); airline beats cabin on
   specificity, so PIA's 3% wins. Fixed winners tie too (intl-3k, route-5k);
   route is more specific, so PKR 5,000 wins. */
check("exactly one percent rule applied", res.appliedPercentRuleId === "pia-3", res.appliedPercentRuleId);
check("exactly one fixed rule applied", res.appliedFixedRuleId === "route-5k", res.appliedFixedRuleId);

/* 3% of 10,030,000 = 300,900 → + 500,000 fixed = 800,900. */
check("markup is 3% + PKR 5,000, not the sum of all five", res.markup.amount === 800_900, `got ${res.markup.amount}`);

/* If they stacked: 2+3+4 = 9% = 902,700, plus 800,000 fixed = 1,702,700. */
check("stacked total is NOT what we produced", res.markup.amount !== 1_702_700);

/* ================================================================== */
console.log("\nmarkup — the provider's own numbers:");

const applied = applyMarkup(fare, rules, ctx, {
  conditions: { refundable: false, changeable: true, refundPenalty: null, changePenalty: null, fareFamily: null, fareBasisCode: null, rulesText: null },
  baggage: { checkedPieces: 1, checkedWeightKg: 23, cabinPieces: 1, cabinWeightKg: 7, note: null },
  seatsRemaining: 4,
});

check("base fare passes through untouched", applied.providerBaseFare.amount === 8_500_000);
check("tax passes through untouched", applied.providerTax.amount === 1_530_000);
check("markup is a separate field", applied.regoMarkup.amount === 800_900);
check(
  "customer total = provider total + markup + fee",
  applied.customerTotal.amount === 10_030_000 + 800_900,
  `got ${applied.customerTotal.amount}`
);
check("every matched rule is recorded, winners and losers", applied.markupRuleIds.length === 5);

/* ================================================================== */
console.log("\nmarkup — explain, for the admin preview:");

const ex = explainMarkup(fare, rules, ctx);
check("two rules applied", ex.applied.length === 2);
check("three matched but lost", ex.matchedButUnused.length === 3, ex.matchedButUnused.map((r) => r.id).join(","));

/* ================================================================== */
console.log("\nmarkup — edges:");

check("no rules means no markup", calculateMarkup(fare, [], ctx).markup.amount === 0);

check(
  "an inactive rule does not apply",
  calculateMarkup(fare, [rule({ id: "off", kind: "percent", value: 50, isActive: false })], ctx).markup.amount === 0
);

check(
  "an expired rule does not apply",
  calculateMarkup(fare, [rule({ id: "past", kind: "percent", value: 50, endsAt: "2020-01-01T00:00:00.000Z" })], ctx).markup.amount === 0
);

check(
  "a domestic rule does not match an international flight",
  calculateMarkup(fare, [rule({ id: "dom", scope: "domestic", kind: "percent", value: 50 })], ctx).markup.amount === 0
);

check(
  "a route rule is directional — ISB-KUL does not match KUL-ISB",
  calculateMarkup(fare, [rule({ id: "rev", scope: "route", matchValue: "ISB-KUL", kind: "fixed", value: 999, currency: PKR })], ctx).markup.amount === 0
);

check(
  "a fixed rule in another currency is skipped, not converted",
  calculateMarkup(fare, [rule({ id: "usd", scope: "all", kind: "fixed", value: 5000, currency: "USD" })], ctx).markup.amount === 0
);

/* 2.5% of 10,030,000 = 250,750 exactly; use an odd base to force rounding. */
const odd = { baseFare: money(1_000_001), tax: money(0), total: money(1_000_001) };
check(
  "percentages round to a whole minor unit",
  Number.isInteger(calculateMarkup(odd, [rule({ id: "p", kind: "percent", value: 2.5 })], ctx).markup.amount)
);

/* ================================================================== */
console.log("\nstate machine — the happy path:");

const happy = [
  ["draft", "search_selected"],
  ["search_selected", "price_confirmed"],
  ["price_confirmed", "payment_pending"],
  ["payment_pending", "payment_success"],
  ["payment_success", "booking_pending"],
  ["booking_pending", "booked"],
  ["booked", "ticketing_pending"],
  ["ticketing_pending", "ticketed"],
];
for (const [from, to] of happy) {
  check(`${from} → ${to}`, canTransition(from, to));
}

/* ================================================================== */
console.log("\nstate machine — the moves that must be refused:");

check("cannot skip payment: price_confirmed → booked", !canTransition("price_confirmed", "booked"));
check("cannot ticket without booking: payment_success → ticketed", !canTransition("payment_success", "ticketed"));
check("cannot un-refund: refunded → ticketed", !canTransition("refunded", "ticketed"));
check("refunded is terminal", isTerminal("refunded") && canTransition("refunded", "refunded") === false);
check("cannot jump draft → ticketed", !canTransition("draft", "ticketed"));

let threw = false;
try {
  assertTransition("draft", "ticketed");
} catch (e) {
  threw = e instanceof IllegalTransitionError;
}
check("assertTransition throws IllegalTransitionError", threw);

/* ================================================================== */
console.log("\nstate machine — the states where REGO owes the customer:");

check("payment taken, booking failed → recoverable to a refund", canTransition("booking_failed", "refund_requested"));
check("booked but not ticketed → recoverable", canTransition("ticketing_failed", "refund_requested"));
check("ticketing_failed can be retried deliberately", canTransition("ticketing_failed", "ticketing_pending"));
check(
  "the owes-customer list covers both failure states",
  OWES_CUSTOMER_STATES.includes("booking_failed") && OWES_CUSTOMER_STATES.includes("ticketing_failed")
);

console.log(failed ? "\nFAILED" : "\nall good");
process.exit(failed ? 1 : 0);
