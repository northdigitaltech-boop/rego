"use client";

/**
 * Browser-side reporter for authentication events.
 *
 * Fire-and-forget by design: this must never delay or break a sign-in.
 * Only the event types the ingest route allowlists will be stored — see
 * src/app/api/cyber/ingest/route.ts.
 *
 * NEVER pass a password, token or OTP here. Only the event name, the email
 * being attempted, and a short non-secret detail string.
 */
export function reportSecurity(
  event:
    | "login_failed"
    | "login_success"
    | "mfa_failed"
    | "mfa_success"
    | "password_reset_requested"
    | "signup_blocked_email"
    | "captcha_failed"
    | "logout",
  opts: { email?: string; detail?: string } = {}
): void {
  try {
    void fetch("/api/cyber/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        email: opts.email,
        detail: opts.detail,
      }),
      keepalive: true, // survives a page navigation right after sign-in
    }).catch(() => {});
  } catch {
    /* telemetry must never surface */
  }
}
