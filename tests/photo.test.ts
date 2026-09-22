import { describe, it, expect } from "vitest";

import { photo } from "@/lib/utils";

/* ============================================================
 * photo() decides the delivered size of every image on Rego, and
 * until now nothing tested it. Two real bugs came out of that:
 *
 *   1. `gallery.map(photo)` passed the ARRAY INDEX as the width,
 *      so thumbnails were requested at w_0..w_3 — one broken, the
 *      rest one to three pixels wide.
 *
 *   2. Picsum URLs were the one source it did not rewrite, so the
 *      destination tiles shipped 1200x700 images to paint at
 *      528x308. PageSpeed measured 367 KB from picsum on the home
 *      page, 274 KB of it waste, charged against LCP and FCP.
 *
 * Neither breaks a type-check or throws. Both are invisible except
 * in a Lighthouse report, which is exactly why they need tests.
 * ============================================================ */

describe("photo() — picsum", () => {
  it("scales a stored placeholder down to the size it is shown at", () => {
    expect(photo("https://picsum.photos/seed/skardu-dest/1200/700", 500)).toBe(
      "https://picsum.photos/seed/skardu-dest/500/292"
    );
  });

  it("keeps the aspect ratio", () => {
    const out = photo("https://picsum.photos/seed/x/900/600", 300);
    const [, w, h] = out.match(/\/(\d+)\/(\d+)$/)!.map(Number) as unknown as number[];
    expect(Math.abs(600 / 900 - h / w)).toBeLessThan(0.01);
  });

  it("never upscales — a small source stays small", () => {
    const small = "https://picsum.photos/seed/act/200/200";
    expect(photo(small, 900)).toBe(small);
  });

  it("handles the seedless form", () => {
    expect(photo("https://picsum.photos/200/300", 100)).toBe(
      "https://picsum.photos/100/150"
    );
  });

  it("leaves a shape it cannot parse alone rather than mangling it", () => {
    const odd = "https://picsum.photos/seed/weird";
    expect(photo(odd, 500)).toBe(odd);
  });
});

describe("photo() — the width guard", () => {
  /* array.map(photo) hands the callback (value, index, array), so the
     index lands in the width parameter. Anything below a plausible
     thumbnail falls back to the default instead of asking for w_0. */
  it("ignores an array index passed as the width", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/v1/a.jpg";
    const asMapped = ["a", "b", "c"].map(() => photo(url, 0));
    for (const out of asMapped) {
      expect(out).not.toContain("w_0");
      expect(out).toContain("w_1080");
    }
    expect(photo(url, 1)).toContain("w_1080");
    expect(photo(url, 2)).toContain("w_1080");
  });

  it("still honours a real thumbnail width", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/v1/a.jpg";
    expect(photo(url, 80)).toContain("w_80");
  });
});

describe("photo() — other sources", () => {
  it("sets a width on Cloudinary", () => {
    expect(photo("https://res.cloudinary.com/demo/image/upload/v1/a.jpg", 600)).toContain(
      "f_auto,q_auto,w_600"
    );
  });

  it("replaces an existing Cloudinary width rather than stacking one", () => {
    const out = photo(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_1080/v1/a.jpg",
      400
    );
    expect(out).toContain("w_400");
    expect(out).not.toContain("w_1080");
  });

  it("sets a width on Unsplash", () => {
    expect(photo("https://images.unsplash.com/photo-123", 500)).toContain("w=500");
  });

  it("leaves an unknown host untouched", () => {
    const url = "https://example.com/a.jpg";
    expect(photo(url, 500)).toBe(url);
  });
});
