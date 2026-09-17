/**
 * Central site configuration — the single source of truth for the canonical
 * domain, brand strings and default SEO/social values. Import `siteConfig`
 * everywhere instead of hardcoding "https://rego.services" across the codebase.
 */

const PROD_URL = "https://rego.services";

// Preferred (canonical) origin. Falls back to the production domain. We strip a
// trailing slash so `absoluteUrl("/x")` never produces a double slash.
const rawUrl = (process.env.NEXT_PUBLIC_SITE_URL || PROD_URL).replace(/\/+$/, "");

export const siteConfig = {
  name: "Rego",
  shortName: "Rego",
  url: rawUrl,
  prodUrl: PROD_URL,
  description:
    "Book, explore and experience tourism across Gilgit-Baltistan — hotels, homestays, tour packages, guides, transport, car rentals, activities, restaurants, attractions and more, all in one trusted marketplace.",
  // A real, always-present asset in /public so Open Graph / Twitter cards and
  // JSON-LD never reference a broken image.
  // Branded 1200x630 share card shown when the link is posted to WhatsApp,
  // Facebook, X, LinkedIn etc. (was the hero photo, which read as a stock
  // landscape rather than as Rego).
  ogImage: "/og-image.png",
  locale: "en_US",
  twitter: "@rego",

  /* ----------------------------------------------------------------
   * CONTACT DETAILS — change them here and they update everywhere:
   * the footer, the help-line button, the contact page, the Rego Map
   * panel, the AI support answers and the JSON-LD for Google.
   * ---------------------------------------------------------------- */

  /** Dialled number. Keep the country code, no spaces. */
  contactPhone: "+923173045038",
  /** Same number, spaced for display. */
  contactPhoneDisplay: "+92 317 3045038",
  /** WhatsApp number — digits only, no "+" and no spaces. */
  whatsapp: "923173045038",
  /** Shown publicly — footer, contact page, structured data. */
  contactEmail: "info@rego.services",
  address: "Skardu, Gilgit Baltistan, Pakistan",
} as const;

/**
 * Company registration.
 *
 * Every value is copied verbatim from the SECP Certificate of Incorporation.
 * Nothing here is rounded, abbreviated or inferred — misstating a company
 * registration is a legal matter, not a copy decision.
 *
 * Kept beside siteConfig so the legal identity lives in one place and can be
 * reused later (footer, invoices, JSON-LD Organization) without anyone
 * retyping the number.
 */
export const companyRegistration = {
  /** Exactly as it appears on the certificate. */
  legalName: "REGO. (SMC-PRIVATE) LIMITED",
  /** Shorter form for tight spaces like the footer. */
  shortLegalName: "REGO. (SMC-PVT) LTD.",
  regulator: "SECP",
  regulatorFull: "Securities and Exchange Commission of Pakistan",
  /** Corporate Unique Identification Number. */
  cuin: "0345252",
  incorporatedOn: "13 July 2026",
  /** Public SECP record — this is the part that makes the claim checkable. */
  verifyUrl: "https://leap.secp.gov.pk/#/verify-company-info/0345252",
} as const;

/**
 * Where contact-form messages are actually delivered.
 *
 * Deliberately separate from `contactEmail`. If the public address is a
 * FORWARDER (e.g. info@ → your Gmail), sending to it means the message is
 * relayed onward — and relayed mail is frequently blocked by spam filters,
 * especially when the sender and recipient are the same address.
 *
 * Point this at a real mailbox and the forward never happens.
 * Set NEXT_PUBLIC_CONTACT_INBOX in Vercel to override.
 */
export const contactInbox =
  process.env.NEXT_PUBLIC_CONTACT_INBOX || siteConfig.contactEmail;

/** Ready-made links so components don't rebuild these by hand. */
export const contactLinks = {
  tel: `tel:${siteConfig.contactPhone}`,
  mail: `mailto:${siteConfig.contactEmail}`,
  whatsapp: `https://wa.me/${siteConfig.whatsapp}`,
};

/**
 * Whether this deployment may be indexed by search engines.
 * Only the real production domain is indexable; preview / staging / local
 * builds are kept out of the index. Overridable via env for edge cases.
 */
export const IS_INDEXABLE: boolean = (() => {
  if (process.env.NEXT_PUBLIC_SEO_NOINDEX === "true") return false;
  if (process.env.NEXT_PUBLIC_SEO_FORCE_INDEX === "true") return true;
  // Must be a production build AND served from the canonical domain. This keeps
  // local dev (NODE_ENV=development) and preview/staging (different host) out of
  // the index automatically, with no per-environment config required.
  if (process.env.NODE_ENV !== "production") return false;
  try {
    return /(^|\.)rego\.services$/.test(new URL(siteConfig.url).host);
  } catch {
    return false;
  }
})();

/** Build an absolute URL against the canonical origin. */
export function absoluteUrl(path: string = ""): string {
  if (!path) return siteConfig.url;
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Search-engine verification tokens (added to <head> when present). */
export const verification = {
  google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  bing: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || undefined,
  yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || undefined,
};
