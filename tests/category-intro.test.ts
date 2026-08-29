import { describe, expect, it } from "vitest";

import {
  CATEGORIES_WITH_INTRO,
  getCategoryIntro,
  introCompleteness,
} from "@/lib/category-intro";

/* ============================================================
 * The point of these tests is one guarantee: a half-written
 * sentence cannot reach the live site.
 *
 * The copy in category-intro.ts is meant to be edited by hand,
 * by someone who is not going to run a type-check first. The
 * {{ }} convention only helps if it is enforced somewhere that
 * fails loudly, so it is enforced here.
 * ============================================================ */

describe("category intro copy", () => {
  it("never renders an unfilled blank", () => {
    for (const slug of CATEGORIES_WITH_INTRO) {
      const intro = getCategoryIntro(slug);
      if (!intro) continue;

      for (const p of intro.paragraphs) {
        expect(p, `${slug}: paragraph still has a blank`).not.toContain("{{");
        expect(p, `${slug}: paragraph still has a blank`).not.toContain("}}");
      }
      for (const f of intro.faqs ?? []) {
        expect(f.q + f.a, `${slug}: FAQ still has a blank`).not.toContain("{{");
        expect(f.q + f.a, `${slug}: FAQ still has a blank`).not.toContain("}}");
      }
    }
  });

  it("has copy for the three categories it was written for", () => {
    for (const slug of ["hotels", "tours", "guides"]) {
      const intro = getCategoryIntro(slug);
      expect(intro, `${slug} should have copy`).not.toBeNull();
      expect(intro!.paragraphs.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("returns null for a category with nothing written", () => {
    expect(getCategoryIntro("restaurants")).toBeNull();
    expect(getCategoryIntro("not-a-real-category")).toBeNull();
  });

  it("gives every page enough words to be worth reading", () => {
    /* A heading over two sentences is worse than no section: it looks like
       something failed to load. Three paragraphs is the floor. */
    for (const slug of CATEGORIES_WITH_INTRO) {
      const intro = getCategoryIntro(slug);
      if (!intro) continue;
      const words = intro.paragraphs.join(" ").split(/\s+/).length;
      expect(words, `${slug} is too thin to publish`).toBeGreaterThan(120);
    }
  });

  it("makes no claim about a price, a distance or a month", () => {
    /* Everything that survives the filter is published as fact under Rego's
       name. Facts of this kind were deliberately left as blanks for someone
       who knows the region; this catches one being written in by accident.
       Month names are allowed inside a blank — that is the point of blanks —
       so only the rendered text is checked. */
    const forbidden = [
      /\bPKR\s*[\d,]/i,
      /\bRs\.?\s*[\d,]/i,
      /\b\d[\d,]*\s*(km|kilometres|kilometers|miles)\b/i,
      /\b\d+\s*(hours?|hrs?)\s+(drive|from|to)\b/i,
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/,
    ];

    for (const slug of CATEGORIES_WITH_INTRO) {
      const intro = getCategoryIntro(slug);
      if (!intro) continue;
      const text = [
        ...intro.paragraphs,
        ...(intro.faqs ?? []).flatMap((f) => [f.q, f.a]),
      ].join("\n");

      for (const re of forbidden) {
        expect(re.test(text), `${slug} states something unverified: ${re}`).toBe(
          false
        );
      }
    }
  });

  it("still has blanks waiting to be filled", () => {
    /* Not a failure — a reminder. If this ever fails, every blank has been
       filled in and the assertion can be deleted along with it. */
    const pending = CATEGORIES_WITH_INTRO.map((s) => introCompleteness(s)!)
      .reduce((n, c) => n + c.unfilled, 0);
    expect(pending).toBeGreaterThan(0);
  });
});
