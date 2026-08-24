import { describe, expect, it } from "vitest";

import { readingTime, slugifyTitle, formatPostDate, CATEGORY_LABEL } from "@/lib/blog";

/* ============================================================
 * Blog & News — pure-function tests.
 *
 * The database guarantees (only published posts are readable,
 * a scheduled post is invisible until its time) live in the RLS
 * policy and are verified by running the migration, not by
 * mocking Postgres here.
 * ============================================================ */

describe("readingTime", () => {
  it("never returns zero", () => {
    // "0 min read" is nonsense on a page that has words on it.
    expect(readingTime("Hi")).toBe(1);
    expect(readingTime("")).toBe(1);
  });

  it("uses 200 words per minute", () => {
    expect(readingTime(Array(400).fill("word").join(" "))).toBe(2);
  });

  /* A heavily linked article should not read as longer than it is — markdown
     syntax is not something anyone reads. */
  it("ignores markdown syntax and link URLs", () => {
    const plain = Array(200).fill("word").join(" ");
    const marked = Array(200)
      .fill("[word](https://example.com/a/very/long/url/that/nobody/reads)")
      .join(" ");
    expect(readingTime(marked)).toBe(readingTime(plain));
  });

  it("ignores fenced code blocks", () => {
    const withCode = "word ".repeat(200) + "\n```\n" + "x ".repeat(500) + "\n```";
    expect(readingTime(withCode)).toBe(1);
  });
});

describe("slugifyTitle", () => {
  it("produces a URL-safe slug", () => {
    expect(slugifyTitle("Hunza in Autumn")).toBe("hunza-in-autumn");
  });

  it("drops apostrophes rather than turning them into hyphens", () => {
    expect(slugifyTitle("Skardu's Best Season")).toBe("skardus-best-season");
  });

  it("collapses punctuation and trims stray hyphens", () => {
    expect(slugifyTitle("  K2: The Approach!  ")).toBe("k2-the-approach");
  });

  /* Must satisfy the DB CHECK constraint, or the insert fails with a raw
     Postgres error instead of a readable message. */
  it("always matches the database slug pattern", () => {
    for (const t of ["A B", "Ünïcødé Test", "many---hyphens", "2026 Review"]) {
      const s = slugifyTitle(t);
      if (s) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

describe("formatPostDate", () => {
  it("formats a real date", () => {
    expect(formatPostDate("2026-08-24T10:00:00Z")).toBe("24 August 2026");
  });

  it("returns an empty string for null or rubbish", () => {
    expect(formatPostDate(null)).toBe("");
    expect(formatPostDate("not a date")).toBe("");
  });
});

describe("categories", () => {
  it("labels every category the database allows", () => {
    // These must match the blog_category_valid CHECK constraint exactly.
    for (const slug of [
      "travel-guides",
      "destinations",
      "tourism-news",
      "safety-updates",
      "events",
      "rego-updates",
    ]) {
      expect(CATEGORY_LABEL[slug]).toBeTruthy();
    }
  });
});
