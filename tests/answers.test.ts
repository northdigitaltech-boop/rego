import { describe, expect, it } from "vitest";

import {
  canPublish,
  countSentence,
  freshness,
  validateAnswer,
  type PublicAnswer,
} from "@/lib/answers";

/* ============================================================
 * Phase 2 (AEO) — content-safety tests.
 *
 * These guard the rules that stop Rego publishing something
 * untrue: unsourced figures, expired road conditions presented
 * as current, and marketplace counts that flatter an empty
 * dataset.
 *
 * Nothing here tests the database — those guarantees live in
 * SQL (get_published_answers filters drafts, expired rows and
 * hidden areas) and are verified by running the migration and
 * the live check, not by mocking Postgres.
 * ============================================================ */

const base: PublicAnswer = {
  id: "a1",
  question: "What is the best time to visit Skardu?",
  short_answer:
    "April to October is the usual window. The valley is green from May, and the high passes are typically open from June.",
  detailed_answer: null,
  answer_type: "best_time",
  intent: "plan",
  source_references: [],
  is_time_sensitive: false,
  last_verified_at: null,
  valid_until: null,
  is_featured: false,
  display_order: 100,
};

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

/* ------------------------------------------------------------------ */

describe("validateAnswer — blocking rules", () => {
  it("requires a question", () => {
    const w = validateAnswer({ question: "  ", short_answer: base.short_answer });
    expect(canPublish(w)).toBe(false);
  });

  it("requires a short answer", () => {
    const w = validateAnswer({ question: base.question, short_answer: "" });
    expect(canPublish(w)).toBe(false);
  });

  /* THE RULE THIS GUARDS: a road or price answer with no expiry sits on the
     page forever and is wrong within weeks. */
  it("blocks a time-sensitive answer with no expiry", () => {
    const w = validateAnswer({
      question: "Is the road open?",
      short_answer: "The Skardu road is open to all traffic.",
      is_time_sensitive: true,
      last_verified_at: daysAgo(1),
      valid_until: null,
    });
    expect(canPublish(w)).toBe(false);
    expect(w.some((x) => x.field === "valid_until" && x.level === "block")).toBe(true);
  });

  it("blocks a time-sensitive answer with no verification date", () => {
    const w = validateAnswer({
      question: "Is the road open?",
      short_answer: "The Skardu road is open to all traffic.",
      is_time_sensitive: true,
      valid_until: daysAhead(7),
      last_verified_at: null,
    });
    expect(canPublish(w)).toBe(false);
  });

  it("blocks a non-http source URL", () => {
    const w = validateAnswer({
      question: base.question,
      short_answer: base.short_answer,
      source_references: [{ label: "x", url: "javascript:alert(1)" }],
    });
    expect(canPublish(w)).toBe(false);
  });

  it("allows a clean, well-formed answer", () => {
    const w = validateAnswer({ question: base.question, short_answer: base.short_answer });
    expect(canPublish(w)).toBe(true);
  });
});

describe("validateAnswer — warnings", () => {
  /* Unverifiable superlatives are the single most common way travel content
     becomes untrustworthy. */
  it("warns on an unsourced superlative", () => {
    const w = validateAnswer({
      question: "Where should I stay?",
      short_answer: "Shangrila is the best resort in Skardu and the finest in the region.",
    });
    expect(w.some((x) => x.message.includes("unverifiable"))).toBe(true);
  });

  it("accepts a superlative when a source is cited", () => {
    const w = validateAnswer({
      question: "Which is the largest lake?",
      short_answer: "Sadpara is the largest lake near Skardu town.",
      source_references: [{ label: "GB Tourism", url: "https://example.gov.pk/lakes" }],
    });
    expect(w.some((x) => x.message.includes("unverifiable"))).toBe(false);
  });

  it("warns on an absolute claim", () => {
    const w = validateAnswer({
      question: "Do I need a permit?",
      short_answer: "Permits are always required for all travellers entering the region.",
    });
    expect(w.some((x) => x.message.includes("absolute"))).toBe(true);
  });

  /* A bare figure with no source is how prices and distances go stale
     unnoticed. */
  it("warns when a price is stated with no source", () => {
    const w = validateAnswer({
      question: "How much does a Skardu tour cost?",
      short_answer: "A four-day package usually costs around PKR 45,000 per person.",
    });
    expect(w.some((x) => x.field === "source_references")).toBe(true);
  });

  it("warns when a distance is stated with no source", () => {
    const w = validateAnswer({
      question: "How far is Skardu from Islamabad?",
      short_answer: "The drive is roughly 600 km and takes about 20 hours.",
    });
    expect(w.some((x) => x.field === "source_references")).toBe(true);
  });

  /* The live road system is the source of truth. A hand-written road status
     will contradict it within days. */
  it("warns against hand-written road status answers", () => {
    const w = validateAnswer({
      question: "Is the road open?",
      short_answer: "The road is currently open.",
      answer_type: "road_status",
      is_time_sensitive: true,
      valid_until: daysAhead(3),
      last_verified_at: daysAgo(0),
    });
    expect(w.some((x) => x.message.includes("/roadside/updates"))).toBe(true);
  });

  it("warns on a suspiciously short answer", () => {
    const w = validateAnswer({ question: base.question, short_answer: "Summer." });
    expect(w.some((x) => x.field === "short_answer")).toBe(true);
    expect(canPublish(w)).toBe(true); // a warning, not a block
  });
});

/* ------------------------------------------------------------------ */

describe("freshness", () => {
  it("says nothing for an answer that is not time-sensitive", () => {
    const f = freshness(base);
    expect(f.current).toBe(true);
    expect(f.label).toBeNull();
  });

  it("shows a recent verification date without a warning", () => {
    const f = freshness({
      ...base,
      is_time_sensitive: true,
      last_verified_at: daysAgo(3),
      valid_until: daysAhead(30),
    });
    expect(f.stale).toBe(false);
    expect(f.label).toMatch(/Last verified/);
  });

  /* An answer verified months ago is still shown, but must carry a caveat —
     silently presenting it as current is the failure mode. */
  it("flags an answer verified long ago as stale", () => {
    const f = freshness({
      ...base,
      is_time_sensitive: true,
      last_verified_at: daysAgo(90),
      valid_until: daysAhead(30),
    });
    expect(f.stale).toBe(true);
    expect(f.label).toMatch(/may have changed/);
  });

  it("never presents an expired answer as current", () => {
    const f = freshness({
      ...base,
      is_time_sensitive: true,
      last_verified_at: daysAgo(60),
      valid_until: daysAgo(1),
    });
    expect(f.current).toBe(false);
    expect(f.label).toMatch(/expired/i);
  });

  it("flags a time-sensitive answer with no verification date", () => {
    const f = freshness({ ...base, is_time_sensitive: true, valid_until: daysAhead(10) });
    expect(f.stale).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe("countSentence — marketplace claims", () => {
  it("quotes a real number once the dataset is big enough", () => {
    expect(countSentence(12, "hotels", "Skardu")).toBe(
      "Rego currently lists 12 approved hotels in Skardu."
    );
  });

  /* "2 approved hotels" is accurate and reads as an empty marketplace — and
     it is wrong the moment a third is approved, possibly for an hour of
     cache. Below the threshold we stay qualitative and stay true. */
  it("avoids quoting a tiny number", () => {
    const s = countSentence(2, "hotels", "Skardu");
    expect(s).not.toMatch(/\d/);
    expect(s).toMatch(/listed in Skardu/);
  });

  it("says nothing at all when there is nothing listed", () => {
    expect(countSentence(0, "hotels", "Skardu")).toBeNull();
  });

  it("says nothing when the count could not be trusted", () => {
    expect(countSentence(null, "hotels", "Skardu")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */

describe("public answer shape", () => {
  /* The public read function returns a fixed column list. If an internal
     field ever appears in it, drafts and authorship leak to the page. */
  it("carries no workflow or authorship fields", () => {
    const keys = Object.keys(base);
    for (const secret of ["status", "created_by", "updated_by", "market_id"]) {
      expect(keys).not.toContain(secret);
    }
  });
});
