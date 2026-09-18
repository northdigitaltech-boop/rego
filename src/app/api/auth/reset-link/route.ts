import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { clientIp } from "@/lib/rate-limit";
import { limitAndLog } from "@/lib/rate-limit-guard";
import { enforceIpBlock } from "@/lib/ip-block";
import { emailLayout, emailButton } from "@/lib/email-layout";
import { sendMail, isSmtpConfigured } from "@/lib/mailer";
import { esc } from "@/lib/notify-email";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { isTurnstileVerifiable, verifyTurnstile } from "@/lib/turnstile-verify";

/* ============================================================
 * "I forgot my password" — sent by Rego, not by Supabase.
 *
 * WHY THIS ROUTE EXISTS
 *   supabase.auth.resetPasswordForEmail() asks SUPABASE to send the mail,
 *   and that returned "Error sending recovery email" — the built-in service
 *   is rate-limited to a handful of messages an hour and, without custom
 *   SMTP, unreliable to addresses outside the project team.
 *
 *   generateLink({ type: 'recovery' }) produces exactly the same one-time
 *   link and sends nothing, so the mail can go out through the SMTP that
 *   already sends Rego's booking confirmations. Same auth system, same
 *   /reset-password screen, different postman.
 *
 * ---------------------------------------------------------------------------
 * IT NEVER SAYS WHETHER AN ACCOUNT EXISTS
 *
 * Every path returns the same answer. A route that says "no account for that
 * address" is a way to test whether somebody is a Rego user, one address at
 * a time, and that is worth more to the person asking than it is to the
 * person who forgot their password.
 *
 * ---------------------------------------------------------------------------
 * THE LINK IS A CREDENTIAL
 *
 * Opening it signs the recipient in. It is never logged, never returned in
 * the response, and only ever emailed to the address on the account.
 * ============================================================ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* RFC 5321's limit for a forward path. Nothing longer is a deliverable
   address, so anything longer is someone probing — and a bounded length is
   what keeps a quadratic address parser bounded. Dependabot has an open
   O(n²) advisory against nodemailer's addressparser; this endpoint is
   unauthenticated and passes its input to sendMail, so it caps the input
   rather than relying on the library being fixed. */
const MAX_EMAIL_LEN = 254;

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function sameOrigin(req: Request): boolean {
  const host = req.headers.get("host");
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!host || !origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/* One answer for every outcome that is not a configuration fault. Written
   once so no branch can accidentally say something more specific. */
const SAME_ANSWER = {
  ok: true,
  message:
    "If an account exists for that address, we have emailed a link to set a new password. It works once and expires.",
};

export async function POST(req: Request) {
  const blocked = await enforceIpBlock(req);
  if (blocked) return blocked;

  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  if (!SUPABASE_URL || !SERVICE_KEY || !isSmtpConfigured) {
    return NextResponse.json(
      { ok: false, error: "Password reset is not configured on this server." },
      { status: 500 }
    );
  }

  const ip = clientIp(req);
  /* Tight on purpose. This is an unauthenticated endpoint that causes email
     to be sent to an address in the request body; the limiter is the second
     line after the captcha, not the first. */
  const limited = limitAndLog(req, `reset-link:${ip}`, 5, 15 * 60_000, {
    endpoint: "/api/auth/reset-link",
    category: "auth",
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  let body: { email?: unknown; captchaToken?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    /* A malformed address is the one thing worth saying plainly — it cannot
       be used to probe for accounts, because no account has it. */
    return NextResponse.json(
      { ok: false, error: "That does not look like an email address." },
      { status: 400 }
    );
  }

  /* Bot check. Refused rather than skipped when the secret is missing:
     Supabase used to run this verification, and dropping it silently would
     leave an open relay behind a route that looks protected. */
  if (!isTurnstileVerifiable) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Bot protection is not configured on this server, so password reset is switched off. Set TURNSTILE_SECRET_KEY.",
      },
      { status: 503 }
    );
  }

  const human = await verifyTurnstile(String(body.captchaToken ?? ""), ip);
  if (!human.ok) {
    return NextResponse.json({ ok: false, error: human.error }, { status: 400 });
  }

  const sb = adminClient();

  const { data: link, error: linkErr } = await sb.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: absoluteUrl("/reset-password") },
  });

  /* No such user is the commonest reason this fails, and it is exactly the
     thing not to reveal. Same answer as success. */
  if (linkErr || !link?.properties?.action_link) {
    return NextResponse.json(SAME_ANSWER);
  }

  const name = (link.user?.user_metadata?.full_name as string | undefined) ?? "";
  const actionLink = link.properties.action_link;

  const inner = `
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0F4C3A;">
      Set a new password
    </h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
      Hello ${esc(name.trim() || email)},
    </p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
      Somebody asked to reset the password for this Rego account. Choose a new
      one using the button below.
    </p>
    ${/* Escaped because the action link carries several &-separated
          parameters and a raw & in an HTML attribute is at the mercy of
          whatever sanitiser the mail client runs. */ ""}
    ${emailButton("Set a new password", actionLink.replace(/&/g, "&amp;"))}
    <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#6b7c75;">
      If the button does not work, copy this address into your browser:<br />
      <span style="word-break:break-all;color:#0F4C3A;">${esc(actionLink)}</span>
    </p>
    <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#6b7c75;">
      This link works once and expires. If you did not ask for it you can
      ignore this email — your password has not changed, and nothing happens
      until the link is opened. Questions:
      <a href="mailto:${esc(siteConfig.contactEmail)}" style="color:#0F4C3A;">${esc(siteConfig.contactEmail)}</a>.
    </p>
  `;

  const sent = await sendMail({
    to: email,
    subject: "Set a new password for your Rego account",
    html: emailLayout(inner, {
      preheader: "A link to set a new password",
      transactional: true,
    }),
  });

  /* A send failure IS reported, unlike a missing account. It is Rego's fault
     rather than a fact about the person, and telling them to keep waiting
     for an email that never left would be the unkind kind of vague. */
  if (!sent.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "We could not send the email just now. Please try again in a few minutes, or contact us.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json(SAME_ANSWER);
}
