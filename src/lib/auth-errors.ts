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
    return {
      message:
        "The security check didn't pass. Refresh the page and try once more.",
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
