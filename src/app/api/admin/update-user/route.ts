import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { rateLimit, clientIp } from "@/lib/rate-limit";

// Admin-only endpoint to update a client's password / email / phone.
// Uses the SERVICE ROLE key (server-only, never in the browser). Every call is:
//  - same-origin
//  - rate limited
//  - authenticated + verified to be an admin (via the caller's JWT + profiles)
//  - validated (email/phone format, duplicate checks)
//  - written to admin_audit_logs
// Requires env: SUPABASE_SERVICE_ROLE_KEY (NOT NEXT_PUBLIC).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const PHONE_RE = /^[+]?[\d\s()-]{7,20}$/;

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
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json(
      { ok: false, error: "Server is not configured for admin updates." },
      { status: 500 }
    );
  }
  const rl = rateLimit(`adminupd:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfter) },
    });
  }

  const sb = adminClient();

  // 1) Authenticate the caller and confirm they are an admin.
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

  // 2) Parse + validate the request.
  let body: { userId?: string; field?: string; value?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const { userId, field, value, note } = body;
  if (!userId || !field) {
    return NextResponse.json({ ok: false, error: "Missing fields." }, { status: 400 });
  }
  if (!note || !note.trim()) {
    return NextResponse.json({ ok: false, error: "A reason note is required." }, { status: 400 });
  }

  try {
    let targetEmail: string | null = null;

    if (field === "password") {
      if (typeof value !== "string" || value.length < 6) {
        return NextResponse.json({ ok: false, error: "Password must be at least 6 characters." }, { status: 400 });
      }
      const { error } = await sb.auth.admin.updateUserById(userId, { password: value });
      if (error) throw error;
    } else if (field === "email") {
      const email = String(value ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ ok: false, error: "Invalid email format." }, { status: 400 });
      }
      const { data: dup } = await sb
        .from("profiles")
        .select("id")
        .eq("email", email)
        .neq("id", userId)
        .maybeSingle();
      if (dup) {
        return NextResponse.json({ ok: false, error: "That email is already in use." }, { status: 409 });
      }
      const { error } = await sb.auth.admin.updateUserById(userId, { email, email_confirm: true });
      if (error) throw error;
      await sb.from("profiles").update({ email }).eq("id", userId);
      targetEmail = email;
    } else if (field === "phone") {
      const phone = String(value ?? "").trim();
      if (phone && !PHONE_RE.test(phone)) {
        return NextResponse.json({ ok: false, error: "Invalid phone number." }, { status: 400 });
      }
      if (phone) {
        const { data: dup } = await sb
          .from("profiles")
          .select("id")
          .eq("phone", phone)
          .neq("id", userId)
          .maybeSingle();
        if (dup) {
          return NextResponse.json({ ok: false, error: "That phone number is already in use." }, { status: 409 });
        }
      }
      await sb.from("profiles").update({ phone: phone || null }).eq("id", userId);
    } else {
      return NextResponse.json({ ok: false, error: "Unknown field." }, { status: 400 });
    }

    // 3) Audit log (never stores the new/old secret value).
    await sb.from("admin_audit_logs").insert({
      admin_id: caller.user.id,
      admin_email: caller.user.email,
      target_user_id: userId,
      target_email: targetEmail,
      field,
      note: note.trim().slice(0, 500),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/update-user] failed:", e);
    return NextResponse.json({ ok: false, error: "Update failed. Please try again." }, { status: 502 });
  }
}
