import { Briefcase, Laptop, LifeBuoy, type LucideIcon } from "lucide-react";

import { categories, type CategorySlug } from "@/lib/data";

/* ============================================================
 * What a provider can register as.
 *
 * ONE LIST, BECAUSE THERE WERE TWO
 *   auth-form.tsx and role-setup-gate.tsx each built their own
 *   version of this, each filtering `categories` and each
 *   appending Roadside and Co-working by hand. Two lists that
 *   have to agree and nothing making them — add a category to
 *   one and a provider can register through one screen and not
 *   the other, which is the kind of bug nobody reports because
 *   it looks like the site just does not offer that.
 *
 * THE DESCRIPTIONS ARE NOT THE ONES IN data.ts
 *   Those are written for travellers — "Comfortable stays with
 *   mountain views" is what a guest wants to read. A provider
 *   is answering a different question: is this me? So these
 *   describe the business, not the experience, and name the
 *   near neighbours ("guest house", "resort") so someone whose
 *   own word is not the one Rego uses still recognises
 *   themselves.
 *
 * SLUGS ARE ROUTING, NOT LABELS
 *   dashboard.tsx switches on these exact strings to decide
 *   which provider dashboard to show. Renaming one silently
 *   sends that provider to the generic dashboard instead of
 *   theirs. A test asserts every slug here still matches.
 * ============================================================ */

export interface PartnerCategory {
  slug: CategorySlug | "roadside" | "coworking";
  name: string;
  icon: LucideIcon;
  /** Written to answer "is this me?", not "what will I get?". */
  description: string;
}

/** Categories a traveller browses but nobody registers under. */
const NOT_REGISTERABLE = new Set<string>([
  "more",    // a catch-all bucket, not a business
  "tours",   // tour packages are created by a travel company, not registered for
]);

/** Provider-facing wording, keyed by slug. */
const DESCRIPTIONS: Record<string, string> = {
  hotels: "You run a hotel, guest house or resort",
  homestays: "You host guests in your own home",
  hostels: "You run a hostel or dormitory",
  mountaineering: "You organise expeditions, or work as a porter or high-altitude guide",
  transport: "You have jeeps, cars or vans — with a driver or for rent",
  "travel-companies": "You are a travel company or tour operator putting whole trips together",
  guides: "You guide travellers yourself, on treks or around the valleys",
  photographers: "You shoot photos or video, or fly a drone",
  restaurants: "You run a restaurant, café or dhaba",
  activities: "You run activities — trekking, camping, safari, boating, fishing",
  visa: "You handle visas, permits or travel paperwork",
  roadside: "You help on the road — punctures, batteries, fuel, recovery",
  coworking: "You have a co-working space or desks to rent",
};

/* Two that are not in data.ts because no traveller browses to them as a
   category — they have their own modules — but which providers do register
   under. They were being appended by hand in two separate files. */
const EXTRA: PartnerCategory[] = [
  {
    slug: "roadside",
    name: "Roadside Assistance",
    icon: LifeBuoy,
    description: DESCRIPTIONS.roadside,
  },
  {
    slug: "coworking",
    name: "Co-working Space",
    icon: Laptop,
    description: DESCRIPTIONS.coworking,
  },
];

/**
 * The full list, in the order it is shown.
 *
 * Built from `categories` rather than retyped, so a category added there
 * appears here automatically — with a fallback description, because a
 * missing one should mean plain wording, not a blank card.
 */
export const PARTNER_CATEGORIES: PartnerCategory[] = [
  ...categories
    .filter((c) => !NOT_REGISTERABLE.has(c.slug))
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      icon: c.icon,
      description: DESCRIPTIONS[c.slug] ?? `You offer ${c.name.toLowerCase()}`,
    })),
  ...EXTRA,
];

/** Lookup by slug, for showing what someone already chose. */
export function partnerCategory(slug: string | null | undefined) {
  return PARTNER_CATEGORIES.find((c) => c.slug === slug) ?? null;
}

/** Whether a string is a category someone may register under. */
export function isPartnerCategory(slug: string): boolean {
  return PARTNER_CATEGORIES.some((c) => c.slug === slug);
}

/** The icon to show when nothing is chosen yet. */
export const FALLBACK_CATEGORY_ICON = Briefcase;

/**
 * Where a category chosen on the signup form is kept across the Google
 * redirect.
 *
 * OAuth leaves the page, so anything typed or tapped is gone by the time the
 * user comes back — including the card they picked. Without this they are
 * asked the same question again on the role-setup screen, one minute after
 * answering it, which reads as the site not having listened.
 *
 * sessionStorage rather than localStorage: it belongs to this one signup, and
 * a category left behind for a future visit would be worse than no memory at
 * all. Read once and removed.
 */
export const STASHED_CATEGORY_KEY = "rego_partner_category";
