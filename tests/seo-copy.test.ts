import { describe, expect, it } from "vitest";

import {
  categoryDescription,
  categoryTitle,
  destinationDescription,
  destinationTitle,
  tidyName,
} from "@/lib/seo-copy";
import { categoryHasOwnPage, categoryIsEmpty, categoryRedirect } from "@/lib/category-routing";
import { allCategories } from "@/lib/data";

/* ============================================================
 * These pages were titling themselves with nothing but their own
 * name — "SKARDU — Rego" — which gave a search engine no reason
 * to show them for anything a traveller types. These tests hold
 * the replacement copy to the two rules that matter: it carries
 * the words people search for, and it fits in a search result.
 * ============================================================ */

/* Google truncates around 60 characters and the root layout appends
   " — Rego" (7 more). */
const TITLE_LIMIT = 60 - " — Rego".length;
const DESC_LIMIT = 160;

describe("tidyName", () => {
  it("fixes names typed in capitals", () => {
    expect(tidyName("SKARDU")).toBe("Skardu");
    expect(tidyName("HUNZA VALLEY")).toBe("Hunza Valley");
  });

  it("leaves a deliberately-cased name alone", () => {
    expect(tidyName("Fairy Meadows")).toBe("Fairy Meadows");
    expect(tidyName("McDonald Peak")).toBe("McDonald Peak");
  });

  it("keeps short forms and codes intact", () => {
    expect(tidyName("K2 BASE CAMP")).toBe("K2 Base Camp");
    expect(tidyName("GB")).toBe("GB");
  });

  it("survives empty and whitespace input", () => {
    expect(tidyName("")).toBe("");
    expect(tidyName("   ")).toBe("");
  });
});

describe("destination titles", () => {
  const names = ["SKARDU", "Hunza", "Fairy Meadows", "Deosai", "Khaplu", "Shigar"];

  it("names the place and what can be booked there", () => {
    const t = destinationTitle("SKARDU");
    expect(t).toContain("Skardu");
    expect(t.toLowerCase()).toContain("hotels");
  });

  it("fits a search result once the site suffix is added", () => {
    for (const n of names) {
      expect(destinationTitle(n).length, n).toBeLessThanOrEqual(TITLE_LIMIT);
    }
  });

  it("never ends mid-word", () => {
    for (const n of [...names, "A Very Long Destination Name In The North"]) {
      expect(destinationTitle(n), n).not.toMatch(/[\s,:—-]$/);
    }
  });

  it("describes the page without asserting a fact about the place", () => {
    const d = destinationDescription("SKARDU", "The heaven on earth");
    expect(d).toContain("Skardu");
    expect(d.length).toBeLessThanOrEqual(DESC_LIMIT);
  });

  it("works when a destination has no tagline", () => {
    const d = destinationDescription("Shigar", null);
    expect(d).toContain("Shigar");
    expect(d.length).toBeGreaterThan(50);
    expect(d.length).toBeLessThanOrEqual(DESC_LIMIT);
  });

  it("does not double up punctuation from a tagline that ends in a full stop", () => {
    expect(destinationDescription("Hunza", "Apricot valleys.")).not.toContain("..");
  });
});

describe("category titles", () => {
  it("puts the region in the title — that is the whole point of the page", () => {
    expect(categoryTitle("Hotels & Resorts")).toContain("Gilgit-Baltistan");
  });

  it("fits a search result for every real category", () => {
    for (const c of allCategories) {
      expect(categoryTitle(c.name).length, c.name).toBeLessThanOrEqual(TITLE_LIMIT);
    }
  });

  it("keeps every description within what Google will show", () => {
    for (const c of allCategories) {
      const d = categoryDescription(c.name, c.tagline);
      expect(d.length, c.name).toBeLessThanOrEqual(DESC_LIMIT);
      expect(d.length, c.name).toBeGreaterThan(40);
    }
  });
});

describe("category routing", () => {
  it("recognises the categories that only redirect", () => {
    expect(categoryRedirect("fishing")).toBe("/activities?category=fishing");
    expect(categoryRedirect("festivals")).toBe("/events?category=festivals");
    expect(categoryRedirect("fuel-delivery")).toBe("/roadside/fuel-delivery");
    expect(categoryRedirect("mountaineering")).toBe("/expeditions");
  });

  it("leaves real pages alone", () => {
    for (const slug of ["hotels", "homestays", "hostels", "tours", "restaurants"]) {
      expect(categoryRedirect(slug), slug).toBeNull();
      expect(categoryHasOwnPage(slug), slug).toBe(true);
    }
  });

  it("keeps a redirect out of the sitemap", () => {
    const listed = allCategories.filter((c) => categoryHasOwnPage(c.slug));
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.length).toBeLessThan(allCategories.length);
    for (const c of listed) {
      expect(categoryRedirect(c.slug), c.slug).toBeNull();
    }
  });
});

describe("empty category pages", () => {
  it("hides a catch-all category with nothing in it", async () => {
    expect(await categoryIsEmpty("visa", async () => [])).toBe(true);
    expect(await categoryIsEmpty("more", async () => [{ category: "hotels" }])).toBe(true);
  });

  it("shows it again the moment something is listed", async () => {
    expect(await categoryIsEmpty("visa", async () => [{ category: "visa" }])).toBe(false);
  });

  /* The important guard: hotels and homestays are fetched by their own
     components, so a count taken from the shared feed does not see them.
     Reading zero there must never hide the page. */
  it("never hides a category served by its own view, even on a zero count", async () => {
    for (const slug of ["hotels", "homestays", "hostels", "tours", "guides", "restaurants"]) {
      expect(await categoryIsEmpty(slug, async () => []), slug).toBe(false);
    }
  });

  it("stays indexed when the count could not be taken", async () => {
    expect(await categoryIsEmpty("visa", async () => null)).toBe(false);
  });

  /* The whole point of taking a loader rather than a list. Thirty-eight of
     the forty-one categories answer without the data, and each avoided call
     is eleven Supabase queries that used to run at build time and on every
     regeneration. If this ever regresses, the cost is invisible — nothing
     breaks, the build just gets slower again. */
  it("does not fetch the feed for a category that cannot be empty", async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      return [];
    };
    await categoryIsEmpty("hotels", load);
    await categoryIsEmpty("transport", load);
    await categoryIsEmpty("guides", load);
    expect(calls).toBe(0);
  });

  it("does fetch for the three that can be empty", async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      return [];
    };
    await categoryIsEmpty("visa", load);
    await categoryIsEmpty("more", load);
    await categoryIsEmpty("drone-pilots", load);
    expect(calls).toBe(3);
  });
});
