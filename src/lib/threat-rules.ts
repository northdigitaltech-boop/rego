/* ============================================================
 * Threat detection rules.
 *
 * DESIGN DECISIONS, and why:
 *
 * 1. Rules live in code, not the database. They are version
 *    controlled, diffable, and require a deploy to change. An
 *    admin cannot quietly raise a threshold from inside the
 *    portal to make a dashboard look calm.
 *
 * 2. Every finding carries its evidence and its arithmetic. A
 *    detection you cannot audit is a detection you cannot trust,
 *    so each one states the rule, the threshold, the observed
 *    value and the event IDs behind it.
 *
 * 3. Nothing here is machine learning, anomaly scoring or
 *    behavioural baselining. These are threshold rules over
 *    recorded events. Calling them anything grander would
 *    misrepresent what they actually do.
 *
 * 4. Rules only see what was logged. A quiet result means "no
 *    matching recorded events", never "no attack". The UI must
 *    keep saying so.
 * ============================================================ */

export const RULES_VERSION = 1;

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface DetectionEvent {
  id: string;
  detected_at: string;
  event_type: string;
  category: string;
  severity: string;
  risk_score: number | null;
  actor_email: string | null;
  actor_role: string | null;
  ip_address: string | null;
  endpoint: string | null;
  status: string | null;
  description: string | null;
}

export interface Finding {
  ruleId: string;
  ruleTitle: string;
  severity: Severity;
  /** What matched — an IP, an email, an endpoint. */
  subject: string;
  subjectKind: "ip" | "account" | "endpoint" | "global";
  /** Plain-language statement of what was observed. */
  headline: string;
  /** The arithmetic, spelled out. */
  reasons: string[];
  observed: number;
  threshold: number;
  windowMinutes: number;
  firstSeen: string;
  lastSeen: string;
  eventIds: string[];
  /** What an analyst should check before acting. */
  nextSteps: string[];
  /** Known ways this rule produces false positives. */
  falsePositives: string[];
}

interface Rule {
  id: string;
  title: string;
  severity: Severity;
  windowMinutes: number;
  threshold: number;
  description: string;
  falsePositives: string[];
  nextSteps: string[];
  /** Which events this rule cares about. */
  matches: (e: DetectionEvent) => boolean;
  /** How matched events are grouped into findings. */
  groupBy: (e: DetectionEvent) => string | null;
  subjectKind: Finding["subjectKind"];
  headline: (subject: string, count: number) => string;
}

const RULES: Rule[] = [
  {
    id: "burst-failed-logins-ip",
    title: "Repeated failed logins from one address",
    severity: "high",
    windowMinutes: 15,
    threshold: 10,
    description:
      "Ten or more failed sign-ins from a single IP within fifteen minutes.",
    subjectKind: "ip",
    matches: (e) => e.event_type === "login_failed",
    groupBy: (e) => e.ip_address,
    headline: (s, n) => `${n} failed sign-ins from ${s}`,
    falsePositives: [
      "A shared office, campus or mobile-carrier NAT puts many users behind one address.",
      "One person repeatedly mistyping a password after a manager change.",
    ],
    nextSteps: [
      "Check whether the attempts target one account or many — many accounts suggests credential stuffing.",
      "Look for a login_success from the same IP shortly after; that would indicate a successful break-in.",
    ],
  },
  {
    id: "spray-across-accounts",
    title: "One address attempting many different accounts",
    severity: "critical",
    windowMinutes: 60,
    threshold: 5,
    description:
      "A single IP attempting sign-in against five or more distinct accounts within an hour — the signature of password spraying.",
    subjectKind: "ip",
    matches: (e) => e.event_type === "login_failed" && !!e.actor_email,
    groupBy: (e) => e.ip_address,
    headline: (s, n) => `${s} attempted ${n} different accounts`,
    falsePositives: [
      "A shared network where several colleagues sign in around the same time.",
      "An automated test suite running against production.",
    ],
    nextSteps: [
      "Compare the targeted addresses against your real user list — a list of guesses is decisive.",
      "If the accounts are real and sequential, treat as an active attack and open an incident.",
    ],
  },
  {
    id: "mfa-failures-admin",
    title: "Repeated admin two-step failures",
    severity: "critical",
    windowMinutes: 30,
    threshold: 3,
    description:
      "Three or more failed admin MFA challenges in thirty minutes. Reaching the MFA step means the password already worked.",
    subjectKind: "account",
    matches: (e) => e.event_type === "mfa_failed",
    groupBy: (e) => e.actor_email,
    headline: (s, n) => `${n} failed two-step attempts on ${s}`,
    falsePositives: [
      "A phone with an out-of-sync clock — TOTP codes drift and fail legitimately.",
      "The admin re-enrolling on a new device.",
    ],
    nextSteps: [
      "Confirm with the account holder out of band, not by replying to email from that account.",
      "If they were not attempting to sign in, the password is compromised. Rotate it and open an incident.",
    ],
  },
  {
    id: "authz-probing",
    title: "Repeated authorisation refusals",
    severity: "high",
    windowMinutes: 60,
    threshold: 5,
    description:
      "Five or more authorisation denials from one account in an hour, which looks like someone mapping what they can reach.",
    subjectKind: "account",
    matches: (e) => e.event_type === "authz_violation",
    groupBy: (e) => e.actor_email,
    headline: (s, n) => `${s} was refused ${n} times`,
    falsePositives: [
      "A stale browser tab retrying an endpoint after the account's role changed.",
      "A genuine permissions bug sending users somewhere they cannot go.",
    ],
    nextSteps: [
      "Check which endpoints were refused. A spread across unrelated areas suggests probing rather than a bug.",
      "Verify the account's current role is what it should be.",
    ],
  },
  {
    id: "sustained-rate-limiting",
    title: "Sustained rate limiting on one endpoint",
    severity: "medium",
    windowMinutes: 60,
    threshold: 20,
    description:
      "One endpoint refusing twenty or more requests in an hour, suggesting scripted abuse.",
    subjectKind: "endpoint",
    matches: (e) => e.event_type === "rate_limited",
    groupBy: (e) => e.endpoint,
    headline: (s, n) => `${n} requests refused on ${s}`,
    falsePositives: [
      "A limit set too tight for normal traffic.",
      "A retry loop in the app itself hammering its own API.",
    ],
    nextSteps: [
      "Check the IP breakdown on the API Security page — one address is abuse, many is a limit that is too low.",
      "Remember the limiter is per instance, so the real figure is likely higher than this.",
    ],
  },
  {
    id: "privilege-change",
    title: "Administrative privilege change",
    severity: "critical",
    windowMinutes: 1440,
    threshold: 1,
    description:
      "Any role promotion or admin account creation. Rare by nature, so every occurrence is worth a look.",
    subjectKind: "account",
    matches: (e) =>
      e.event_type === "admin_role_changed" || e.event_type === "admin_created",
    groupBy: (e) => e.actor_email,
    headline: (s, n) =>
      `${n} privilege change${n === 1 ? "" : "s"} involving ${s}`,
    falsePositives: [
      "You legitimately promoted someone and simply have not noted it yet.",
    ],
    nextSteps: [
      "Confirm the change was intentional and that you know who made it.",
      "Verify the new admin is on the CYBER_ADMINS allowlist only if they genuinely need the security portal.",
    ],
  },
];

/**
 * Run every rule over a set of events.
 *
 * Pure and deterministic — same events in, same findings out. That
 * matters: a detection engine whose output shifts between runs cannot
 * be used as evidence.
 */
export function detect(events: DetectionEvent[], now = Date.now()): Finding[] {
  const findings: Finding[] = [];

  for (const rule of RULES) {
    const cutoff = now - rule.windowMinutes * 60_000;
    const relevant = events.filter(
      (e) => rule.matches(e) && new Date(e.detected_at).getTime() >= cutoff
    );
    if (!relevant.length) continue;

    const groups = new Map<string, DetectionEvent[]>();
    for (const e of relevant) {
      const key = rule.groupBy(e);
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }

    for (const [subject, group] of groups) {
      /* The spray rule counts distinct accounts, not raw attempts —
         30 attempts on one account is a different thing from 6
         attempts across 6 accounts, and only the latter is spraying. */
      const observed =
        rule.id === "spray-across-accounts"
          ? new Set(group.map((e) => e.actor_email)).size
          : group.length;

      if (observed < rule.threshold) continue;

      const times = group
        .map((e) => e.detected_at)
        .sort((a, b) => a.localeCompare(b));

      findings.push({
        ruleId: rule.id,
        ruleTitle: rule.title,
        severity: rule.severity,
        subject,
        subjectKind: rule.subjectKind,
        headline: rule.headline(subject, observed),
        reasons: [
          rule.description,
          `Observed ${observed} against a threshold of ${rule.threshold} in a ${rule.windowMinutes}-minute window.`,
          `Based on ${group.length} recorded event${group.length === 1 ? "" : "s"}.`,
        ],
        observed,
        threshold: rule.threshold,
        windowMinutes: rule.windowMinutes,
        firstSeen: times[0],
        lastSeen: times[times.length - 1],
        eventIds: group.map((e) => e.id).slice(0, 200),
        nextSteps: rule.nextSteps,
        falsePositives: rule.falsePositives,
      });
    }
  }

  const order: Severity[] = ["critical", "high", "medium", "low", "info"];
  return findings.sort(
    (a, b) =>
      order.indexOf(a.severity) - order.indexOf(b.severity) ||
      b.observed - a.observed
  );
}

/** Rule catalogue, for the "how detection works" panel in the UI. */
export function ruleCatalogue() {
  return RULES.map((r) => ({
    id: r.id,
    title: r.title,
    severity: r.severity,
    threshold: r.threshold,
    windowMinutes: r.windowMinutes,
    description: r.description,
    falsePositives: r.falsePositives,
  }));
}
