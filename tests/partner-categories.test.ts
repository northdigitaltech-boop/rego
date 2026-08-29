import { describe, expect, it } from "vitest";

import { categories } from "@/lib/data";
import {
  PARTNER_CATEGORIES,
  isPartnerCategory,
  partnerCategory,
} from "@/lib/partner-categories";

/* ============================================================
 * The slugs in this list are routing, not labels.
 *
 * dashboard.tsx decides which provider dashboard to render by
 * comparing user.businessCategory against these exact strings.
 * A renamed slug does not throw — it falls through to the
 * generic dashboard, so a hotel owner registers and lands on a
 * screen with none of their tools. Nothing errors and nobody
 * reports it as a bug; it just looks like the site is missing
 * something.
 *
 * Hence the routing test below, which is the one worth keeping
 * if the rest are ever cut.
 * ============================================================ */

/** The slugs dashboard.tsx branches on, copied deliberately rather than
 *  imported. Importing would let both sides be renamed together and the
 *  test would still pass while the app broke. */
const ROUTED = [
  "hotels",
  "homestays",
  "hostels",
  "travel-companies",
  "transport",
  "guides",
  "photographers",
  "restaurants",
  "roadside",
  "coworking",
  "activities",
  "mountaineering",
];

describe("partner categories", () => {
  it("offers the thirteen a provider can register under", () => {
    expect(PARTNER_CATEGORIES).toHaveLength(13);
  });

  it("has no duplicate slugs", () => {
    const slugs = PARTNER_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every slug still routes to a provider dashboard, or knowingly does not", () => {
    for (const c of PARTNER_CATEGORIES) {
      const routes = ROUTED.includes(c.slug);
      /* visa is the one that deliberately has no dashboard of its own and
         falls through to the generic partner view. If another category ever
         joins it, that is a decision someone should make on purpose. */
      const knownFallthrough = c.slug === "visa";
      expect(
        routes || knownFallthrough,
        `${c.slug} would land on the generic dashboard — was it renamed?`
      ).toBe(true);
    }
  });

  it("excludes the two nobody registers as", () => {
    /* 'more' is a browsing bucket; tour packages are created by a travel
       company rather than registered for. */
    expect(isPartnerCategory("more")).toBe(false);
    expect(isPartnerCategory("tours")).toBe(false);
  });

  it("includes the two that are not in data.ts", () => {
    /* Roadside and Co-working have their own modules, so no traveller
       browses to them as a category — but providers do register as them.
       They used to be appended by hand in two separate files. */
    expect(isPartnerCategory("roadside")).toBe(true);
    expect(isPartnerCategory("coworking")).toBe(true);
  });

  it("carries every registerable category from data.ts", () => {
    const skip = new Set(["more", "tours"]);
    for (const c of categories) {
      if (skip.has(c.slug)) continue;
      expect(
        isPartnerCategory(c.slug),
        `${c.slug} is in data.ts but cannot be registered for`
      ).toBe(true);
    }
  });

  it("gives every card an icon and a sentence", () => {
    for (const c of PARTNER_CATEGORIES) {
      expect(c.icon, `${c.slug} has no icon`).toBeTruthy();
      expect(c.name.length, `${c.slug} has no name`).toBeGreaterThan(2);
      /* The sentence is what tells someone "this is me". A card with only a
         name is the dropdown this replaced. */
      expect(
        c.description.length,
        `${c.slug} needs a line describing the business`
      ).toBeGreaterThan(15);
    }
  });

  it("describes the business, not the trip", () => {
    /* data.ts taglines are written for travellers — "Comfortable stays with
       mountain views". A provider is answering a different question, so
       these must not be the same strings. */
    for (const c of PARTNER_CATEGORIES) {
      const original = categories.find((x) => x.slug === c.slug);
      if (original) expect(c.description).not.toBe(original.tagline);
    }
  });

  it("looks up by slug, and returns null rather than throwing", () => {
    expect(partnerCategory("hotels")?.name).toBe("Hotels & Resorts");
    expect(partnerCategory("nope")).toBeNull();
    expect(partnerCategory(null)).toBeNull();
    expect(partnerCategory(undefined)).toBeNull();
  });
});
