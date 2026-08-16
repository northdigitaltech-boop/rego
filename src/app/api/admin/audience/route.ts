import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ============================================================
 * Recipient counts for the admin composer.
 *
 * Lets an admin see "this will reach 47 people" BEFORE sending, rather than
 * finding out afterwards. Returns counts only — never addresses — so it
 * can't be used to harvest the user list even if the guard were bypassed.
 * ============================================================ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ ok: false, error: "Not configured." }, { status: 500 });
  }

  const sb = adminClient();

  // Admin only.
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });
  const { data: caller } = await sb.auth.getUser(token);
  if (!caller?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const { data: profile } = await sb
    .from("profiles")
    .select("role")
    .eq("id", caller.user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { data, error } = await sb
    .from("profiles")
    .select("email,role,business_category");
  if (error) {
    return NextResponse.json({ ok: false, error: "Query failed." }, { status: 500 });
  }

  const rows = (data as {
    email: string | null;
    role: string | null;
    business_category: string | null;
  }[]) ?? [];

  const seen = new Set<string>();
  let all = 0;
  let travelers = 0;
  let partners = 0;
  const byCategory: Record<string, number> = {};

  for (const p of rows) {
    const e = (p.email ?? "").trim().toLowerCase();
    if (!e || !EMAIL_RE.test(e) || seen.has(e)) continue;
    if (p.role === "admin") continue; // matches the broadcast default
    seen.add(e);

    all += 1;
    if (p.role === "partner") {
      partners += 1;
      const c = (p.business_category ?? "").trim();
      if (c) byCategory[c] = (byCategory[c] ?? 0) + 1;
    } else {
      travelers += 1;
    }
  }

  return NextResponse.json({ ok: true, all, travelers, partners, byCategory });
}
