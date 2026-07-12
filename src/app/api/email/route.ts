import { NextResponse } from "next/server";

import { rateLimit, clientIp } from "@/lib/rate-limit";

// Server-side email sender via Resend. The API key stays on the server
// (no NEXT_PUBLIC prefix), so it is never exposed to the browser.
//
// Security controls (no real auth session exists yet, so these are the
// effective protections against abuse of this endpoint):
//  - same-origin enforcement (blocks cross-site / external callers)
//  - per-IP rate limiting (blocks spam / quota exhaustion)
//  - strict input validation incl. email-header-injection guards
//  - generic error responses (no raw provider/system errors leaked)

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const MAX_SUBJECT = 200;
const MAX_HTML = 100_000;

function allowedHost(req: Request): boolean {
  const host = req.headers.get("host");
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!host || !origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  // 1) Same-origin only.
  if (!allowedHost(req)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // 2) Rate limit: 5 emails per IP per minute.
  const rl = rateLimit(`email:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Not configured yet — succeed quietly so the app keeps working.
    return NextResponse.json({ ok: false, skipped: true });
  }

  // 3) Validate input.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const { to, subject, html } = (body ?? {}) as {
    to?: unknown;
    subject?: unknown;
    html?: unknown;
  };

  if (typeof to !== "string" || !EMAIL_RE.test(to.trim())) {
    return NextResponse.json({ ok: false, error: "Invalid recipient" }, { status: 400 });
  }
  if (typeof subject !== "string" || subject.length === 0 || subject.length > MAX_SUBJECT) {
    return NextResponse.json({ ok: false, error: "Invalid subject" }, { status: 400 });
  }
  if (typeof html !== "string" || html.length === 0 || html.length > MAX_HTML) {
    return NextResponse.json({ ok: false, error: "Invalid content" }, { status: 400 });
  }
  // Strip CR/LF from subject to prevent email-header injection.
  const safeSubject = subject.replace(/[\r\n]+/g, " ").trim();

  // 4) Send — never leak provider/system errors to the client.
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Rego <onboarding@resend.dev>",
        to: to.trim(),
        subject: safeSubject,
        html,
      }),
    });

    if (!res.ok) {
      console.error("[email] resend error:", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ ok: false, error: "Email could not be sent." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[email] send failed:", e);
    return NextResponse.json({ ok: false, error: "Email could not be sent." }, { status: 502 });
  }
}
