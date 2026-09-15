/* ============================================================
 * The markup engine.
 *
 * Pure: no database, no network, no clock beyond what is passed
 * in. This is the code that decides what a customer is charged,
 * so it is the code that must be exhaustively testable without a
 * running system.
 *
 * THE RULE THAT MATTERS: ONE RULE PER KIND, NOT ALL OF THEM
 *   The brief lists rules that can all match one flight at once —
 *   2% on everything, 3% on PIA, PKR 3,000 on international,
 *   PKR 5,000 on KUL→ISB, 4% on business. Applying every match
 *   turns a PKR 85,000 fare into PKR 96,000 and nobody notices
 *   until a customer compares REGO with the airline's own site.
 *
 *   So: at most ONE percentage rule and at most ONE fixed rule are
 *   applied, chosen by priority then specificity. Every rule that
 *   matched is recorded, including the ones that lost, so the
 *   audit trail explains the decision rather than just asserting
 *   the total.
 *
 * PROVIDER FARE IS NEVER MODIFIED
 *   providerBaseFare and providerTax go through untouched. REGO's
 *   addition sits in its own fields. A markup folded into a base
 *   fare cannot be audited, and the moment it cannot be audited is
 *   the moment somebody disputes it.
 * ============================================================ */

import {
  addMoney,
  zeroMoney,
  type CabinClass,
  type FlightFare,
  type FlightProviderId,
  type Money,
  type ProviderFare,
} from "./types";
import type { FareConditions, FlightBaggage } from "./types";

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

export type MarkupScope =
  | "all"
  | "airline"
  | "route"
  | "international"
  | "domestic"
  | "cabin"
  | "provider";

export type MarkupKind = "percent" | "fixed";

export interface MarkupRule {
  id: string;
  scope: MarkupScope;
  /**
   * What the scope matches on:
   *   airline  → IATA carrier code, "PK"
   *   route    → "KUL-ISB" (origin-destination, uppercase)
   *   cabin    → a CabinClass
   *   provider → a FlightProviderId
   *   all / international / domestic → null
   */
  matchValue: string | null;
  kind: MarkupKind;
  /** Percent: 2.5 means 2.5%. Fixed: MINOR UNITS, like all money here. */
  value: number;
  /** Fixed rules only. A fixed rule in another currency is not applied. */
  currency: string | null;
  /** Higher wins. Ties fall through to specificity. */
  priority: number;
  isActive: boolean;
  /** ISO dates. Null means open-ended. */
  startsAt: string | null;
  endsAt: string | null;
  label: string | null;
}

export interface MarkupContext {
  validatingCarrierCode: string;
  originCode: string;
  destinationCode: string;
  originCountryCode: string;
  destinationCountryCode: string;
  cabin: CabinClass;
  providerId: FlightProviderId;
  /** ISO timestamp used for rule validity. Passed in, never read from a clock. */
  now: string;
  /** Flat fee applied after markup. Zero when not configured. */
  serviceFee?: Money;
}

/* ------------------------------------------------------------------ */
/* Specificity                                                         */
/* ------------------------------------------------------------------ */

/**
 * How narrowly a scope targets a flight, when priorities tie.
 *
 * A route rule beats an airline rule beats a blanket rule, because that is
 * the order a human would expect: the more precisely you named the thing, the
 * more you meant it.
 */
const SPECIFICITY: Record<MarkupScope, number> = {
  route: 60,
  airline: 50,
  cabin: 40,
  international: 30,
  domestic: 30,
  provider: 20,
  all: 10,
};

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

function withinValidity(rule: MarkupRule, nowIso: string): boolean {
  if (rule.startsAt && nowIso < rule.startsAt) return false;
  if (rule.endsAt && nowIso > rule.endsAt) return false;
  return true;
}

export function ruleMatches(rule: MarkupRule, ctx: MarkupContext): boolean {
  if (!rule.isActive) return false;
  if (!withinValidity(rule, ctx.now)) return false;

  const isInternational = ctx.originCountryCode !== ctx.destinationCountryCode;

  switch (rule.scope) {
    case "all":
      return true;
    case "airline":
      return rule.matchValue?.toUpperCase() === ctx.validatingCarrierCode.toUpperCase();
    case "route": {
      if (!rule.matchValue) return false;
      /* Directional on purpose. KUL→ISB and ISB→KUL are different markets
         with different fares; a rule written for one should not silently
         govern the other. Add both rows to cover both directions. */
      const [from, to] = rule.matchValue.toUpperCase().split("-");
      return from === ctx.originCode.toUpperCase() && to === ctx.destinationCode.toUpperCase();
    }
    case "international":
      return isInternational;
    case "domestic":
      return !isInternational;
    case "cabin":
      return rule.matchValue === ctx.cabin;
    case "provider":
      return rule.matchValue === ctx.providerId;
    default:
      /* An unknown scope must not quietly become "everything". */
      return false;
  }
}

/** Highest priority, then most specific, then oldest id for determinism. */
function bestOf(rules: MarkupRule[]): MarkupRule | null {
  if (rules.length === 0) return null;
  return [...rules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const s = SPECIFICITY[b.scope] - SPECIFICITY[a.scope];
    if (s !== 0) return s;
    return a.id.localeCompare(b.id);
  })[0];
}

/* ------------------------------------------------------------------ */
/* Calculation                                                         */
/* ------------------------------------------------------------------ */

/**
 * Percentage of the fare, rounded HALF UP to a whole minor unit.
 *
 * Applied to base fare + tax, matching what the customer sees as the
 * provider total. Math.round is half-up for positives, which is what a
 * customer expects and what an invoice can be reconciled against.
 */
function percentOf(total: Money, percent: number): Money {
  return {
    amount: Math.round((total.amount * percent) / 100),
    currency: total.currency,
  };
}

export interface MarkupResult {
  markup: Money;
  serviceFee: Money;
  /** Every rule that matched, winners and losers alike. */
  matchedRuleIds: string[];
  /** The rules actually applied — at most one per kind. */
  appliedPercentRuleId: string | null;
  appliedFixedRuleId: string | null;
}

export function calculateMarkup(
  providerFare: ProviderFare,
  rules: MarkupRule[],
  ctx: MarkupContext
): MarkupResult {
  const currency = providerFare.total.currency;
  const matched = rules.filter((r) => ruleMatches(r, ctx));

  const percentWinner = bestOf(matched.filter((r) => r.kind === "percent"));

  /* A fixed rule priced in another currency is skipped rather than converted.
     Converting here would need a rate, and a rate belongs nowhere near a pure
     function — it would make this untestable and the total unreproducible. */
  const fixedWinner = bestOf(
    matched.filter((r) => r.kind === "fixed" && (r.currency ?? currency) === currency)
  );

  let markup = zeroMoney(currency);
  if (percentWinner) {
    markup = addMoney(markup, percentOf(providerFare.total, percentWinner.value));
  }
  if (fixedWinner) {
    markup = addMoney(markup, { amount: Math.round(fixedWinner.value), currency });
  }

  const serviceFee =
    ctx.serviceFee && ctx.serviceFee.currency === currency
      ? ctx.serviceFee
      : zeroMoney(currency);

  return {
    markup,
    serviceFee,
    matchedRuleIds: matched.map((r) => r.id),
    appliedPercentRuleId: percentWinner?.id ?? null,
    appliedFixedRuleId: fixedWinner?.id ?? null,
  };
}

/**
 * Build the fare a customer sees.
 *
 * Provider figures are copied through unchanged; REGO's addition is separate
 * and the matched rule ids ride along so the total can always be explained.
 */
export function applyMarkup(
  providerFare: ProviderFare,
  rules: MarkupRule[],
  ctx: MarkupContext,
  extras: { conditions: FareConditions; baggage: FlightBaggage; seatsRemaining: number | null }
): FlightFare {
  const result = calculateMarkup(providerFare, rules, ctx);

  const customerTotal = addMoney(
    addMoney(providerFare.total, result.markup),
    result.serviceFee
  );

  return {
    providerBaseFare: providerFare.baseFare,
    providerTax: providerFare.tax,
    regoMarkup: result.markup,
    regoServiceFee: result.serviceFee,
    customerTotal,
    markupRuleIds: result.matchedRuleIds,
    conditions: extras.conditions,
    baggage: extras.baggage,
    seatsRemaining: extras.seatsRemaining,
  };
}

/**
 * For the admin preview: what would these rules do to this fare?
 *
 * Returns the losers too, so an admin can see that their new 5% rule is being
 * beaten by an existing priority-100 rule instead of wondering why nothing
 * changed.
 */
export function explainMarkup(
  providerFare: ProviderFare,
  rules: MarkupRule[],
  ctx: MarkupContext
): {
  result: MarkupResult;
  applied: MarkupRule[];
  matchedButUnused: MarkupRule[];
  customerTotal: Money;
} {
  const result = calculateMarkup(providerFare, rules, ctx);
  const appliedIds = new Set(
    [result.appliedPercentRuleId, result.appliedFixedRuleId].filter(
      (x): x is string => x !== null
    )
  );
  const matchedRules = rules.filter((r) => result.matchedRuleIds.includes(r.id));

  return {
    result,
    applied: matchedRules.filter((r) => appliedIds.has(r.id)),
    matchedButUnused: matchedRules.filter((r) => !appliedIds.has(r.id)),
    customerTotal: addMoney(
      addMoney(providerFare.total, result.markup),
      result.serviceFee
    ),
  };
}
