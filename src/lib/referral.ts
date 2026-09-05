import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Referral capture: link → storage → registration → database.
 *
 * A provider clicks rego.services/partner?ref=MKT-001, reads for a
 * while, signs up, verifies an email, comes back, and finishes a
 * four-step wizard. That is several page loads and possibly a
 * different day. The code has to survive all of it, so it is
 * stashed the moment it is seen.
 *
 * NOTHING HERE IS TRUSTED.
 *   This file carries a string from a URL to a database function.
 *   attach_referral() resolves it, checks the listing belongs to
 *   the caller, and refuses if a referral already exists. Anyone
 *   can put anything in localStorage; the worst they achieve is
 *   crediting a real employee for their own registration, which
 *   is not an attack worth defending against beyond that.
 * ============================================================ */

const KEY = "rego_referral";

/* Long enough that a provider can think it over for a fortnight, short
   enough that a code from months ago does not credit someone for a
   registration they had nothing to do with. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface Stashed {
  code: string;
  at: number;
  source: "referral_link" | "referral_code";
}

/**
 * Codes are `MKT-001` or `ALI-REGO-01` shaped. Checked before storing so a
 * junk query string never reaches the database, and so a link carrying
 * something long and strange is dropped rather than kept for a month.
 */
export function looksLikeReferralCode(raw: string): boolean {
  return /^[A-Z0-9][A-Z0-9-]{2,31}$/i.test(raw.trim());
}

/** Read `?ref=` and remember it. Called once, on any page. */
export function captureReferral(search: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const code = new URLSearchParams(search).get("ref");
    if (!code || !looksLikeReferralCode(code)) return null;

    /* First link wins, matching the database: whoever actually brought them
       here did that once, and a later link should not overwrite it. */
    const existing = readReferral();
    if (existing) return existing;

    const stash: Stashed = {
      code: code.trim().toUpperCase(),
      at: Date.now(),
      source: "referral_link",
    };
    window.localStorage.setItem(KEY, JSON.stringify(stash));
    return stash.code;
  } catch {
    /* Private browsing, a full quota, a disabled store. A referral is worth
       having and not worth breaking a page for. */
    return null;
  }
}

/** Someone typed a code into a form rather than following a link. */
export function rememberTypedReferral(raw: string): string | null {
  if (typeof window === "undefined") return null;
  if (!looksLikeReferralCode(raw)) return null;
  try {
    const stash: Stashed = {
      code: raw.trim().toUpperCase(),
      at: Date.now(),
      source: "referral_code",
    };
    window.localStorage.setItem(KEY, JSON.stringify(stash));
    return stash.code;
  } catch {
    return null;
  }
}

/** The stashed code, or null if there is none or it has aged out. */
export function readReferral(): string | null {
  return readStash()?.code ?? null;
}

function readStash(): Stashed | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stashed;
    if (!s?.code || !looksLikeReferralCode(s.code)) return null;
    if (typeof s.at !== "number" || Date.now() - s.at > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearReferral(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export type AttachResult =
  | "attached"
  | "already"
  | "unknown_code"
  | "inactive"
  | "not_yours"
  | "bad_table"
  | "none"
  | "failed";

/**
 * Attach the stashed referral to a listing that was just created.
 *
 * Call it AFTER the listing exists, with the table it went into. Never
 * blocks registration: a referral that cannot be attached is a lost
 * attribution, and a registration that fails because of one is a lost
 * provider.
 *
 * The code is cleared only when it was genuinely used or genuinely
 * unusable. A network failure leaves it stashed, so the next listing they
 * create still carries it.
 */
export async function attachStashedReferral(
  listingTable: string,
  listingId: string
): Promise<AttachResult> {
  if (!isSupabaseConfigured || !listingId) return "none";

  const stash = readStash();
  if (!stash) return "none";

  try {
    const { data, error } = await supabase.rpc("attach_referral", {
      p_table: listingTable,
      p_id: listingId,
      p_code: stash.code,
      p_source: stash.source,
    });

    if (error) {
      /* phase105 has not been run, or the call failed. Keep the code — the
         migration may land tomorrow and their next listing should still
         carry it. */
      return "failed";
    }

    const result = String(data) as AttachResult;

    /* Cleared when it has done its job or never will. `failed` and
       `not_yours` keep it: the first is transient, and the second means this
       particular listing was not theirs, which says nothing about the next
       one. */
    if (result === "attached" || result === "already" || result === "unknown_code") {
      clearReferral();
    }

    return result;
  } catch {
    return "failed";
  }
}

/** What to tell the provider, if anything. Silence is usually right. */
export function referralMessage(result: AttachResult): string | null {
  switch (result) {
    case "attached":
      return null; // Worked. Internal bookkeeping is not the provider's news.
    case "unknown_code":
      return "The referral code you used was not recognised, so no team member was credited. Everything else was saved.";
    case "inactive":
      return "That referral code is no longer active, so no team member was credited. Everything else was saved.";
    default:
      return null;
  }
}
