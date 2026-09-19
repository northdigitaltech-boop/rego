import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { limitAndLogShared } from "@/lib/rate-limit-guard";

/* ============================================================
 * Hands out a short-lived link to one payment proof.
 *
 * SEC-007.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS ROUTE EXISTS
 *
 * The proof lives in a private bucket, and phase135 just closed
 * direct reads on it to everyone but admins. Customers and
 * providers still legitimately need to see their own — so the
 * signed URL is minted here, after checking they are on the
 * booking that references the file.
 *
 * Before phase135 the browser called createSignedUrl() itself,
 * which required the bucket to be readable by any signed-in
 * account. That is what made every bank slip on Rego readable by
 * anyone who registered.
 *
 * THE ORDER MATTERS
 *   1. verify the bearer token against Supabase — the email
 *      comes from the token, never from the request body
 *   2. ask can_view_payment_proof() whether that email is on a
 *      booking referencing this path
 *   3. only then mint a URL, and only for two minutes
 *
 * A caller who guesses a real path still gets nothing: step 2
 * fails for a file that is not theirs.
 *
 * LEGACY PUBLIC URLS ARE PASSED STRAIGHT BACK
 *   Older rows store an http… URL rather than an object path.
 *   Those are already public — signing them is meaningless and
 *   refusing them would break viewing for historical bookings.
 *   They are returned as-is, and phase135 has a query for
 *   counting how many remain.
 * ============================================================ */

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const EXPIRES_SEC = 120;
const MAX_PATH = 500;

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
    return NextResponse.json({ ok: false, error: "Server is not configured." }, { status: 500 });
  }

  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "Sign in to view this." }, { status: 401 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: caller, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !caller?.user?.email) {
    return NextResponse.json({ ok: false, error: "Invalid session." }, { status: 401 });
  }
  const email = caller.user.email.toLowerCase();

  /* Guessing paths is the obvious attack on this route, so the budget is per
     person and deliberately small — nobody legitimately opens sixty proofs an
     hour, and a denial here is worth logging. */
  const rl = await limitAndLogShared(req, `proof:${email}`, 60, 60 * 60_000, {
    endpoint: "/api/booking/proof",
    category: "api",
    actorEmail: email,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  let body: { path?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  const path = typeof body.path === "string" ? body.path.trim() : "";
  if (!path || path.length > MAX_PATH) {
    return NextResponse.json({ ok: false, error: "No proof specified." }, { status: 400 });
  }

  // Already public — nothing to sign, and refusing would break old bookings.
  if (/^https?:\/\//i.test(path)) {
    return NextResponse.json({ ok: true, url: path, legacy: true });
  }

  const { data: allowed, error: checkErr } = await sb.rpc("can_view_payment_proof", {
    p_path: path,
    p_email: email,
  });

  if (checkErr) {
    return NextResponse.json({ ok: false, error: "Could not verify access." }, { status: 500 });
  }

  /* Same answer for "not yours" and "does not exist". Telling them apart
     turns this into a way to test which proof paths are real. */
  if (allowed !== true) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  const { data: signed, error: signErr } = await sb.storage
    .from("payment-proofs")
    .createSignedUrl(path, EXPIRES_SEC);

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, url: signed.signedUrl, expiresIn: EXPIRES_SEC });
}
