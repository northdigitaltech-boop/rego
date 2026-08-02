import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { rateLimit, clientIp } from "@/lib/rate-limit";

// Admin-only endpoint to PERMANENTLY delete a user account so the email is
// freed up and the person can register again (e.g. they picked the wrong
// business category at signup).
//
// Deletes: the auth user, their profile row, their provider_services rows and
// (optionally) every listing they own. Uses the SERVICE ROLE key (server-only).
//
// Controls: same-origin · admin JWT verified via profiles.role · rate limited
// · self-delete blocked · every action written to admin_audit_logs.
// Requires env: SUPABASE_SERVICE_ROLE_KEY (NOT NEXT_PUBLIC).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Owner-scoped tables cleared when "also delete their listings" is chosen. */
const OWNER_TABLES = [
  "hotels",
  "homestays",
  "hostels",
  "tour_companies",
  "tour_packages",
  "tour_guides",
  "transport_providers",
  "transport_services",
  "transport_rentals",
  "media_providers",
  "restaurants",
  "activities",
  "coworking_spaces",
  "roadside_providers",
  "expedition_companies",
];

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
      { ok: false, error: "Server is not configured for admin deletes (missing service role key)." },
      { status: 500 }
    );
  }
  const rl = rateLimit(`admindel:${clientIp(req)}`, 10, 60_000);
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

  // 2) Parse + validate.
  let body: { userId?: string; deleteListings?: boolean; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const { userId, deleteListings, note } = body;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Missing user." }, { status: 400 });
  }
  if (userId === caller.user.id) {
    return NextResponse.json(
      { ok: false, error: "You can't delete your own admin account." },
      { status: 400 }
    );
  }
  if (!note || !note.trim()) {
    return NextResponse.json({ ok: false, error: "A reason note is required." }, { status: 400 });
  }

  try {
    // Look up the target so we can clean up email-scoped rows.
    const { data: target } = await sb
      .from("profiles")
      .select("email, role")
      .eq("id", userId)
      .maybeSingle();
    const targetEmail = ((target as { email?: string } | null)?.email ?? "").toLowerCase();

    // Never allow deleting another admin by accident.
    if ((target as { role?: string } | null)?.role === "admin") {
      return NextResponse.json(
        { ok: false, error: "Admin accounts can't be deleted from here." },
        { status: 400 }
      );
    }

    let removedListings = 0;
    if (targetEmail) {
      // Their multi-service records always go.
      await sb.from("provider_services").delete().eq("owner_email", targetEmail);

      if (deleteListings) {
        for (const t of OWNER_TABLES) {
          const { count } = await sb
            .from(t)
            .delete({ count: "exact" })
            .eq("owner_email", targetEmail);
          removedListings += count ?? 0;
        }
      }
    }

    // Profile row (the auth delete usually cascades, but be explicit).
    await sb.from("profiles").delete().eq("id", userId);

    // 3) Finally remove the auth user — this frees the email for re-signup.
    const { error: delErr } = await sb.auth.admin.deleteUser(userId);
    if (delErr) throw delErr;

    // 4) Audit log.
    await sb.from("admin_audit_logs").insert({
      admin_id: caller.user.id,
      admin_email: caller.user.email,
      target_user_id: userId,
      target_email: targetEmail || null,
      field: deleteListings ? "delete_account_and_listings" : "delete_account",
      note: note.trim().slice(0, 500),
    });

    return NextResponse.json({ ok: true, email: targetEmail, removedListings });
  } catch (e) {
    console.error("[admin/delete-user] failed:", e);
    return NextResponse.json(
      { ok: false, error: "Could not delete this account." },
      { status: 500 }
    );
  }
}
