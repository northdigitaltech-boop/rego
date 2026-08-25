import { describe, expect, it } from "vitest";

import { DEFAULT_HERO, HERO_WIDTHS, heroFromUrl } from "@/lib/hero-image";

/* ============================================================
 * The hero is the first thing a visitor sees and the largest
 * element on the homepage — the one Google times when it
 * measures the site. These tests hold it to the two things that
 * matter: it is always responsive, and a bad value in the
 * database can never put something dangerous in an <img src>.
 * ============================================================ */

describe("the built-in hero", () => {
  it("offers all three widths", () => {
    for (const w of HERO_WIDTHS) {
      expect(DEFAULT_HERO.srcSet).toContain(`${w}w`);
    }
  });

  it("is a local file, so it is served straight from the CDN", () => {
    expect(DEFAULT_HERO.src.startsWith("/")).toBe(true);
    expect(DEFAULT_HERO.isDefault).toBe(true);
  });

  /* The headline sits beside it and carries the meaning, so the hero is
     decorative — an empty alt is correct, and inventing a description would
     make it worse for a screen reader, not better. */
  it("has an empty alt", () => {
    expect(DEFAULT_HERO.alt).toBe("");
  });
});

describe("an admin-set hero", () => {
  const CLOUD =
    "https://res.cloudinary.com/demo/image/upload/v1/hero.jpg";

  it("is served at every width, not one size for all screens", () => {
    const h = heroFromUrl(CLOUD);
    for (const w of HERO_WIDTHS) {
      expect(h.srcSet).toContain(`${w}w`);
      expect(h.srcSet).toContain(`w_${w}`);
    }
  });

  it("asks Cloudinary for a modern format and automatic quality", () => {
    const h = heroFromUrl(CLOUD);
    expect(h.src).toContain("f_auto");
    expect(h.src).toContain("q_auto");
  });

  it("is marked as not the default, so the admin preview can say so", () => {
    expect(heroFromUrl(CLOUD).isDefault).toBe(false);
  });

  it("keeps alt text when given, and stays empty when not", () => {
    expect(heroFromUrl(CLOUD, "Sunrise over Skardu").alt).toBe("Sunrise over Skardu");
    expect(heroFromUrl(CLOUD, "   ").alt).toBe("");
    expect(heroFromUrl(CLOUD, null).alt).toBe("");
    expect(heroFromUrl(CLOUD).alt).toBe("");
  });

  /* A URL from somewhere other than Cloudinary cannot be resized, but it must
     still produce a usable image rather than a broken one. */
  it("still works for a plain https image elsewhere", () => {
    const h = heroFromUrl("https://example.com/photo.jpg");
    expect(h.src).toBe("https://example.com/photo.jpg");
    expect(h.srcSet).toContain("640w");
  });
});
