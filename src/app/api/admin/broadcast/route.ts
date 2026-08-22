import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { clientIp } from "@/lib/rate-limit";
import { limitAndLog } from "@/lib/rate-limit-guard";
import { buildNotifyEmail, type RecItem } from "@/lib/notify-email";
import { sendMail, isSmtpConfigured } from "@/lib/mailer";

// Admin-only endpoint to send a reminder / recommendation to every registered
// user — by email (Resend) and/or as an in-site notification (notifications
// table). Uses the SERVICE ROLE key (server-only) to read the recipient list
// and send in batches, so it is NOT subject to the per-IP client email limit.
//
// Controls: same-origin · admin JWT verified via profiles.role · rate limited.
// Requires env: SUPABASE_SERVICE_ROLE_KEY (+ RESEND_API_KEY for email).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

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

export async function POST(req: Request) {
  /* NO IP BLOCK HERE — same reason as /api/email. This route sends mail,
     and a block on it fails silently: the admin sees "sent", nothing
     arrives, and there is no error to read. That is exactly how this broke
     once already. Any route that delivers email stays unblocked. */

  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json(
      { ok: false, error: "Server is not configured (missing service role key)." },
      { status: 500 }
    );
  }
  const apiKey = process.env.RESEND_API_KEY;
  // Broadcasts are heavy — allow only a few per minute.
  const rl = limitAndLog(req, `broadcast:${clientIp(req)}`, 3, 60_000, { endpoint: "/api/admin/broadcast", category: "admin" });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Too many broadcasts. Please wait a moment." }, {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfter) },
    });
  }

  const sb = adminClient();

  // Authenticate the caller and confirm they are an admin.
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const { data: caller, error: cErr } = await sb.auth.getUser(token);
  if (cErr || !caller.user) {
    return NextResponse.json({ ok: false, error: "Invalid session." }, { status: 401 });
  }
  const { data: callerProfile } = await sb
    .from("profiles")
    .select("role")
    .eq("id", caller.user.id)
    .maybeSingle();
  if (!callerProfile || (callerProfile as { role?: string }).role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin permission required." }, { status: 403 });
  }

  // Parse + validate.
  let body: {
    subject?: string;
    heading?: string;
    message?: string;
    includeAdmins?: boolean;
    testTo?: string;
    /** all | travelers | partners | category | custom */
    audience?: string;
    /** business_category slug, when audience === "category" */
    category?: string;
    /** explicit addresses, when audience === "custom" */
    emails?: string[];
    items?: RecItem[];
    sendEmail?: boolean;
    sendInApp?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const subject = (body.subject ?? "").trim();
  const heading = (body.heading ?? subject).trim();
  const message = (body.message ?? "").trim();
  const items = Array.isArray(body.items) ? body.items.slice(0, 6) : [];
  // Default to sending both channels unless the caller opts out.
  const wantEmail = body.sendEmail !== false;
  const wantInApp = body.sendInApp !== false;
  const audience = (body.audience ?? "all").trim();
  const category = (body.category ?? "").trim();
  if (audience === "category" && !category) {
    return NextResponse.json(
      { ok: false, error: "Choose a partner category." },
      { status: 400 }
    );
  }
  if (!subject || subject.length > 200) {
    return NextResponse.json({ ok: false, error: "Subject is required." }, { status: 400 });
  }
  if (!message || message.length > 5000) {
    return NextResponse.json({ ok: false, error: "Message is required." }, { status: 400 });
  }
  if (!wantEmail && !wantInApp) {
    return NextResponse.json({ ok: false, error: "Choose at least email or in-site." }, { status: 400 });
  }
  // Either transport is fine — SMTP (Hostinger/Gmail) or Resend.
  if (wantEmail && !isSmtpConfigured && !apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Email is not configured. Add SMTP_HOST / SMTP_USER / SMTP_PASSWORD (or RESEND_API_KEY) to your server environment, or uncheck email.",
      },
      { status: 500 }
    );
  }

  const origin = req.headers.get("origin") || `https://${req.headers.get("host")}`;
  const base = origin.replace(/\/$/, "");
  const safeSubject = subject.replace(/[\r\n]+/g, " ");

  // Test send — deliver only to one address so admins can preview.
  const testTo = (body.testTo ?? "").trim();
  let recipients: { email: string; name: string }[];
  if (testTo) {
    if (!EMAIL_RE.test(testTo)) {
      return NextResponse.json({ ok: false, error: "Invalid test email." }, { status: 400 });
    }
    recipients = [{ email: testTo, name: "" }];
  } else if (audience === "custom") {
    /* Hand-picked addresses — used for proposals and one-to-one outreach.
       These are typed by an admin, so they may not be registered users;
       we send anyway but skip in-app notifications for unknown accounts. */
    const seen = new Set<string>();
    recipients = (body.emails ?? [])
      .map((e) => (e ?? "").trim())
      .filter((e) => {
        const k = e.toLowerCase();
        if (!e || !EMAIL_RE.test(e) || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 200)
      .map((email) => ({ email, name: "" }));

    if (recipients.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Add at least one valid email address." },
        { status: 400 }
      );
    }
  } else {
    const { data: profiles, error: pErr } = await sb
      .from("profiles")
      .select("email,full_name,role,business_category");
    if (pErr) {
      return NextResponse.json({ ok: false, error: "Could not load recipients." }, { status: 500 });
    }
    const seen = new Set<string>();
    recipients = ((profiles as {
      email: string | null;
      full_name: string | null;
      role: string | null;
      business_category: string | null;
    }[]) ?? [])
      .filter((p) => {
        const e = (p.email ?? "").trim().toLowerCase();
        if (!e || !EMAIL_RE.test(e) || seen.has(e)) return false;
        if (!body.includeAdmins && p.role === "admin") return false;

        // Audience filter.
        if (audience === "travelers" && p.role === "partner") return false;
        if (audience === "partners" && p.role !== "partner") return false;
        if (audience === "category") {
          if (p.role !== "partner") return false;
          if ((p.business_category ?? "") !== category) return false;
        }

        seen.add(e);
        return true;
      })
      .map((p) => ({ email: (p.email as string).trim(), name: (p.full_name ?? "").trim() }));
  }

  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, error: "No recipients found." }, { status: 400 });
  }

  const from = process.env.EMAIL_FROM || "Rego <onboarding@resend.dev>";
  const firstItem = items[0];
  const actionUrl = firstItem?.href ?? "/listings";
  let sent = 0;
  let inApp = 0;

  // 1) In-site notifications — one row per recipient (skip on test sends,
  //    which are just email previews). Chunked bulk inserts.
  if (wantInApp && !testTo) {
    for (let i = 0; i < recipients.length; i += 500) {
      const chunk = recipients.slice(i, i + 500);
      const rows = chunk.map((r) => ({
        user_email: r.email.toLowerCase(),
        type: "recommendation",
        title: subject,
        message,
        image_url: firstItem?.image ?? null,
        priority: "promotional",
        action_url: actionUrl,
        action_label: "View",
      }));
      const { error } = await sb.from("notifications").insert(rows);
      if (!error) inApp += chunk.length;
      else console.error("[broadcast] notifications insert error:", error.message);
    }
  }

  // 2) Email via Resend batch endpoint (up to 100 messages per call).
  if (wantEmail && isSmtpConfigured) {
    /* SMTP has no batch endpoint — send one at a time. Deliberately
       sequential: Hostinger and Gmail both drop connections when a burst
       arrives in parallel, which loses messages silently. A broadcast is
       not time-critical, so slow and complete beats fast and lossy. */
    for (const r of recipients) {
      const res = await sendMail({
        to: r.email,
        subject: safeSubject,
        html: buildNotifyEmail({ name: r.name, heading, message, items, base }),
      });
      if (res.ok) sent += 1;
      else console.error("[broadcast] smtp error for", r.email, res.error);
    }
  } else if (wantEmail && apiKey) {
    for (let i = 0; i < recipients.length; i += 100) {
      const chunk = recipients.slice(i, i + 100);
      const payload = chunk.map((r) => ({
        from,
        to: r.email,
        subject: safeSubject,
        html: buildNotifyEmail({ name: r.name, heading, message, items, base }),
      }));
      try {
        const res = await fetch("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) sent += chunk.length;
        else console.error("[broadcast] resend batch error:", res.status, await res.text().catch(() => ""));
      } catch (e) {
        console.error("[broadcast] send failed:", e);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    inApp,
    total: recipients.length,
    audience,
    category: audience === "category" ? category : undefined,
    test: !!testTo,
  });
}
