import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { siteConfig } from "@/lib/site";
import { buildNotifyEmail, type RecItem } from "@/lib/notify-email";
import {
  feedHotels,
  feedPackages,
  feedGuides,
  feedRestaurants,
} from "@/lib/home-feed";
import { type Listing } from "@/lib/data";
import { sendMail, isSmtpConfigured } from "@/lib/mailer";

// Daily cron (see vercel.json). Emails users ~7 days after they registered —
// once each — with a friendly reminder + top recommendations, and drops the
// same note into their in-site notifications. Marks them so they're never
// reminded twice.
//
// Secured by CRON_SECRET: Vercel Cron sends "Authorization: Bearer <secret>".
// Requires env: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

const REMINDER_SUBJECT = "Your Gilgit-Baltistan trip is waiting on Rego ✨";
const REMINDER_MESSAGE =
  "Thanks for joining Rego! Whenever you're ready, you can book verified hotels, jeeps, guides and tour packages across Gilgit-Baltistan — all in one place. Here are a few top-rated picks to get you started.";

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function toRec(l: Listing): RecItem {
  return {
    title: l.title,
    location: l.location,
    price: l.price,
    unit: l.unit,
    image: l.image,
    href: `/listings/${l.id}`,
  };
}

async function handle(req: Request) {
  // Authorize the cron caller.
  const secret = process.env.CRON_SECRET;
  const authz = req.headers.get("authorization") ?? "";
  if (!secret || authz !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ ok: false, error: "Not configured." }, { status: 500 });
  }
  const apiKey = process.env.RESEND_API_KEY;

  const sb = admin();
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 864e5).toISOString();
  const fourteenDaysAgo = new Date(now - 14 * 864e5).toISOString();

  // Users registered 7–14 days ago who haven't been reminded yet.
  const { data: rows, error } = await sb
    .from("profiles")
    .select("id,email,full_name,role")
    .eq("signup_reminder_sent", false)
    .lte("created_at", sevenDaysAgo)
    .gte("created_at", fourteenDaysAgo)
    .limit(200);
  if (error) {
    return NextResponse.json({ ok: false, error: "Query failed." }, { status: 500 });
  }

  const recipients = ((rows as { id: string; email: string | null; full_name: string | null; role: string | null }[]) ?? [])
    .filter((p) => p.email && EMAIL_RE.test(p.email) && p.role !== "admin")
    .map((p) => ({ id: p.id, email: (p.email as string).trim(), name: (p.full_name ?? "").trim() }));

  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  // Recommendations to attach (same for everyone this run).
  let items: RecItem[] = [];
  try {
    const [h, p, g, r] = await Promise.all([
      feedHotels(3),
      feedPackages(1),
      feedGuides(1),
      feedRestaurants(1),
    ]);
    items = [...h, ...p, ...g, ...r].slice(0, 6).map(toRec);
  } catch {
    /* recommendations optional */
  }

  const base = siteConfig.url;
  const from = process.env.EMAIL_FROM || "Rego <onboarding@resend.dev>";
  const actionUrl = items[0]?.href ?? "/listings";

  let emailed = 0;

  // In-site notifications (bulk).
  const notifRows = recipients.map((r) => ({
    user_email: r.email.toLowerCase(),
    type: "recommendation",
    title: REMINDER_SUBJECT,
    message: REMINDER_MESSAGE,
    image_url: items[0]?.image ?? null,
    priority: "promotional",
    action_url: actionUrl,
    action_label: "Explore",
  }));
  await sb.from("notifications").insert(notifRows);

  // Emails — SMTP first (Hostinger/Gmail), Resend batch as a fallback.
  if (isSmtpConfigured) {
    // Sequential: shared SMTP hosts drop parallel bursts.
    for (const r of recipients) {
      const res = await sendMail({
        to: r.email,
        subject: REMINDER_SUBJECT,
        html: buildNotifyEmail({
          name: r.name,
          heading: REMINDER_SUBJECT,
          message: REMINDER_MESSAGE,
          items,
          base,
        }),
      });
      if (res.ok) emailed += 1;
    }
  } else if (apiKey) {
    for (let i = 0; i < recipients.length; i += 100) {
      const chunk = recipients.slice(i, i + 100);
      const payload = chunk.map((r) => ({
        from,
        to: r.email,
        subject: REMINDER_SUBJECT,
        html: buildNotifyEmail({ name: r.name, heading: REMINDER_SUBJECT, message: REMINDER_MESSAGE, items, base }),
      }));
      try {
        const res = await fetch("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) emailed += chunk.length;
      } catch {
        /* keep going */
      }
    }
  }

  // Mark everyone reminded so they're never nudged twice.
  await sb
    .from("profiles")
    .update({ signup_reminder_sent: true })
    .in("id", recipients.map((r) => r.id));

  return NextResponse.json({ ok: true, processed: recipients.length, emailed });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
