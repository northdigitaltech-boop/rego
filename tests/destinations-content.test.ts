import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SUGGESTED_ATTRACTIONS, suggestedFor } from "@/lib/attractions";

/* ============================================================
 * Nothing about a real place should reach a public page unless
 * somebody at Rego put it there.
 *
 * The suggestion presets exist to save an admin typing. They are
 * not reviewed copy: they state a fort's age, a pass's altitude,
 * the height of a waterfall, the year of a landslide. For a while
 * they were published automatically on any destination page that
 * had not been edited, which meant Rego was asserting facts
 * nobody here had checked, on pages travellers plan around.
 *
 * These tests keep that from coming back.
 * ============================================================ */

const src = (rel: string) =>
  readFileSync(join(process.cwd(), rel), "utf8");

describe("suggested attractions stay out of the public path", () => {
  it("is not imported by the module the site reads destinations through", () => {
    const destinations = src("src/lib/destinations.ts");
    expect(destinations).not.toContain("suggestedFor");
    expect(destinations).not.toContain("SUGGESTED_ATTRACTIONS");
  });

  it("is not used by any page or public component", () => {
    for (const f of [
      "src/app/destinations/[slug]/page.tsx",
      "src/components/destinations/attractions-section.tsx",
    ]) {
      expect(src(f), f).not.toContain("suggestedFor");
    }
  });

  /* The one place it belongs: an admin screen, where a person reads the
     suggestions and decides. */
  it("is still available in the admin editor", () => {
    expect(src("src/components/dashboard/attractions-editor.tsx")).toContain(
      "suggestedFor"
    );
  });

  it("tells the admin the suggestions are unverified before they save", () => {
    const editor = src("src/components/dashboard/attractions-editor.tsx");
    expect(editor.toLowerCase()).toContain("verif");
  });
});

describe("the presets themselves", () => {
  it("still exist, so the admin shortcut has something to offer", () => {
    expect(Object.keys(SUGGESTED_ATTRACTIONS).length).toBeGreaterThan(10);
    expect(suggestedFor("hunza").length).toBeGreaterThan(0);
  });

  it("returns nothing for a place with no presets", () => {
    expect(suggestedFor("a-valley-nobody-has-written-about")).toEqual([]);
  });

  it("carries no image, so a preset can never publish a photo of somewhere else", () => {
    for (const [slug, list] of Object.entries(SUGGESTED_ATTRACTIONS)) {
      for (const a of list) {
        expect(
          (a as { image?: unknown }).image,
          `${slug}: ${a.name}`
        ).toBeUndefined();
      }
    }
  });
});
