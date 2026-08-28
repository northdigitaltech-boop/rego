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

  it("asks Cloudinary for a modern format and a lower quality target", () => {
    const h = heroFromUrl(CLOUD);
    expect(h.src).toContain("f_auto");
    /* Not plain q_auto. The hero sits under a dark wash with text over it, so
       the detail q_auto pays for is detail nobody can see — Lighthouse found
       67 KiB of an 87 KiB hero recoverable this way. */
    expect(h.src).toContain("q_auto:eco");
  });

  it("crops to the interesting part, not the middle", () => {
    /* Only a slice of a wide photo is visible on a phone. */
    expect(heroFromUrl(CLOUD).src).toContain("g_auto");
  });

  it("leaves a URL that already carries a transformation alone", () => {
    const tuned =
      "https://res.cloudinary.com/demo/image/upload/e_sharpen,q_90/v1/hero.jpg";
    /* Someone set that deliberately; overwriting it would undo their work. */
    expect(heroFromUrl(tuned).src).not.toContain("q_auto:eco");
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

describe("a separate hero for phones", () => {
  const WIDE = "https://res.cloudinary.com/demo/image/upload/v1/wide.jpg";
  const TALL = "https://res.cloudinary.com/demo/image/upload/v1/tall.jpg";

  it("is null unless one is set, so phones keep getting the desktop image", () => {
    expect(heroFromUrl(WIDE).mobile).toBeNull();
    expect(heroFromUrl(WIDE, null, "").mobile).toBeNull();
    expect(heroFromUrl(WIDE, null, "   ").mobile).toBeNull();
    expect(DEFAULT_HERO.mobile).toBeNull();
  });

  it("is refused when it is not https — it goes into an img src", () => {
    expect(heroFromUrl(WIDE, null, "http://insecure.example/x.jpg").mobile).toBeNull();
    expect(heroFromUrl(WIDE, null, "/relative.jpg").mobile).toBeNull();
    expect(heroFromUrl(WIDE, null, "javascript:alert(1)").mobile).toBeNull();
  });

  it("is cropped upright, not wide like the desktop one", () => {
    const m = heroFromUrl(WIDE, null, TALL).mobile;
    expect(m).not.toBeNull();
    /* 4:5 — taller than it is wide. The desktop crop is 3:2, the other way. */
    expect(m!.src).toContain("w_640,h_800");
    expect(heroFromUrl(WIDE).src).toContain("w_1024,h_683");
  });

  it("offers phone-sized widths and nothing larger", () => {
    const m = heroFromUrl(WIDE, null, TALL).mobile!;
    for (const w of [430, 640, 828]) expect(m.srcSet).toContain(`${w}w`);
    /* 1536 belongs to a desktop; sending it to a phone wastes the download. */
    expect(m.srcSet).not.toContain("1536w");
  });

  it("keeps the two images separate", () => {
    const h = heroFromUrl(WIDE, null, TALL);
    expect(h.src).toContain("wide.jpg");
    expect(h.mobile!.src).toContain("tall.jpg");
  });
});
