/* ============================================================
 * Server-side Turnstile verification.
 *
 * WHY THIS FILE EXISTS AT ALL
 *   Everywhere else in Rego, the Turnstile token is handed to Supabase and
 *   SUPABASE calls Cloudflare's siteverify — which is why the secret key
 *   lives in the Supabase dashboard and not here.
 *
 *   The password-reset route bypasses Supabase's mailer, so it also bypasses
 *   that check. An endpoint that sends email to an address in the request
 *   body, with no bot check, is a spam relay with a Rego return address. So
 *   the check has to be done here instead, and that needs the secret in this
 *   app: TURNSTILE_SECRET_KEY.
 *
 * SERVER ONLY. No NEXT_PUBLIC_ prefix, so it is never bundled for a browser.
 * ============================================================ */

const SECRET = process.env.TURNSTILE_SECRET_KEY ?? "";
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const isTurnstileVerifiable = SECRET.length > 0;

export interface VerifyResult {
  ok: boolean;
  /** Safe to show a person. Never contains the token or the secret. */
  error?: string;
}

/**
 * Ask Cloudflare whether this token is real, unspent, and from this site.
 *
 * Fails CLOSED. A network problem reaching Cloudflare returns not-ok, because
 * the alternative is that an outage turns the endpoint into an open relay.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  ip?: string | null
): Promise<VerifyResult> {
  if (!SECRET) {
    return {
      ok: false,
      error: "Bot protection is not configured on this server.",
    };
  }
  if (!token) {
    return { ok: false, error: "Please complete the human check." };
  }

  const body = new URLSearchParams({ secret: SECRET, response: token });
  /* Cloudflare uses it to spot a token replayed from somewhere else. Optional,
     and omitted rather than guessed when the header is absent. */
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      /* Longer than this and the person is staring at a spinner; Cloudflare
         answers in well under a second normally. */
      signal: AbortSignal.timeout(8000),
    });

    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    if (data.success) return { ok: true };

    const codes = data["error-codes"] ?? [];
    /* Two of these are worth telling apart, because one is the person's
       problem and the rest are ours. */
    if (codes.includes("timeout-or-duplicate")) {
      return {
        ok: false,
        error: "That check has already been used. Tick the box again.",
      };
    }
    if (codes.includes("invalid-input-response")) {
      return { ok: false, error: "The human check did not pass. Please try again." };
    }
    return { ok: false, error: "Could not complete the human check. Please try again." };
  } catch {
    return { ok: false, error: "Could not reach the human check. Please try again." };
  }
}
