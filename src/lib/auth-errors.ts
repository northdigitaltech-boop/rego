/* ============================================================
 * Human-readable auth errors.
 *
 * Supabase returns accurate but unhelpful strings — "Invalid login
 * credentials" tells someone nothing about what to do next. Each message
 * below says what happened AND what to try, because an error the user can't
 * act on is just a dead end.
 *
 * Security note: we deliberately do NOT distinguish "no such account" from
 * "wrong password". Doing so lets anyone test whether an email is registered.
 * ============================================================ */

export interface FriendlyError {
  message: string;
  /** Suggested next step, rendered as a link/button by the form. */
  action?: "reset-password" | "resend-confirmation" | "signup" | "wait";
}

export function friendlyAuthError(raw: string): FriendlyError {
  const m = raw.toLowerCase();

  if (/invalid login credentials|invalid_grant/.test(m)) {
    return {
      message:
        "That email and password don't match. Check for typos — or reset your password if you've forgotten it.",
      action: "reset-password",
    };
  }

  if (/email not confirmed|email_not_confirmed/.test(m)) {
    return {
      message:
        "Your email isn't verified yet. Open the confirmation link we sent you — check spam if it isn't in your inbox.",
      action: "resend-confirmation",
    };
  }

  if (/user already registered|already been registered|duplicate key/.test(m)) {
    return {
      message: "An account already exists for this email. Try signing in instead.",
      action: "signup",
    };
  }

  if (/password should be at least|password.*short|weak.?password/.test(m)) {
    return {
      message: "Please use a longer password — at least 8 characters is safer.",
    };
  }

  if (/rate limit|too many requests|over_email_send_rate/.test(m)) {
    return {
      message:
        "Too many attempts. Please wait a minute before trying again.",
      action: "wait",
    };
  }

  if (/token has expired|otp_expired|expired/.test(m)) {
    return {
      message:
        "That link or code has expired. Request a new one — they're only valid for a short time.",
      action: "resend-confirmation",
    };
  }

  // Provider not switched on in Supabase → don't show the raw API error.
  if (/provider is not enabled|unsupported provider/.test(m)) {
    return {
      message:
        "Google sign-in isn't available right now. Please use your email and password below.",
    };
  }

  if (/captcha/.test(m)) {
    /* ------------------------------------------------------------------
       Supabase passes Cloudflare's reason through in brackets, e.g.
       "captcha protection: request disallowed (invalid-input-secret)".
       Collapsing all of them into one message threw away the only clue
       that says whose problem it is — and sent people to refresh the
       page for a fault a refresh cannot fix.

       Three of these are worth telling apart:
         invalid-input-secret    the SECRET in Supabase does not pair with
                                 NEXT_PUBLIC_TURNSTILE_SITE_KEY. No amount
                                 of retrying will help; an admin must fix it.
         timeout-or-duplicate    the token expired (~5 min) or was already
                                 spent. Ticking the box again works.
         invalid-input-response  malformed token, or the site key is not
                                 allowed on this hostname in Cloudflare —
                                 www.rego.services and rego.services are
                                 different hostnames to Turnstile.
       ------------------------------------------------------------------ */
    if (/invalid-input-secret|invalid-secret/.test(m)) {
      return {
        message:
          "The security check is misconfigured on our side. Please contact us — retrying won't help.",
      };
    }
    if (/timeout-or-duplicate/.test(m)) {
      return {
        message: "That security check expired. Tick the box again and resubmit.",
      };
    }
    return {
      message:
        "The security check didn't pass. Tick the box again and resubmit.",
    };
  }

  if (/network|fetch failed|failed to fetch/.test(m)) {
    return {
      message:
        "We couldn't reach the server. Check your connection and try again.",
    };
  }

  if (/user not found/.test(m)) {
    // Same wording as a wrong password — don't confirm the address exists.
    return {
      message:
        "That email and password don't match. Check for typos — or reset your password if you've forgotten it.",
      action: "reset-password",
    };
  }

  // Unknown — pass it through rather than hiding a real problem.
  return { message: raw };
}
