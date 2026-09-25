import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { clientIp } from "@/lib/rate-limit";
import { limitAndLogShared } from "@/lib/rate-limit-guard";
import { enforceIpBlock } from "@/lib/ip-block";

/* ============================================================
 * Setting the role on an account that arrived via Google.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS ROUTE HAD TO EXIST
 *
 * RoleSetupGate asks a Google signup whether they are a traveller or a
 * partner, and chooseRole() used to answer it with a browser-side
 *
 *     supabase.from("profiles").update({ role })
 *
 * That stopped working the moment phase130 added guard_profile_role_change(),
 * which raises insufficient_privilege on ANY role change made by a
 * non-admin — correctly, because that trigger is the thing standing between
 * a signup payload and profiles.role = 'admin'.
 *
 * The failure was silent and permanent. The update's error was discarded,
 * while the auth.updateUser() call beside it succeeded — so roleChosen
 * flipped to true, the gate never asked again, and profiles.role stayed
 * 'customer'. hydrate() prefers the profiles row over metadata, so the
 * person was shown as a traveller for good: no partner dashboard, no way to
 * list anything, and nothing on screen to explain why.
 *
 * The trigger exempts a caller with no JWT — the service role — precisely so
 * that a trusted server route can do this. That is what this is.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT WILL NOT DO
 *
 *   * It will not set 'admin', or 'staff', or anything else. Two values are
 *     accepted and the rest are refused, so this cannot become the
 *     escalation path phase130 closed.
 *   * It will not take the caller's identity from the request body. The row
 *     updated is the one belonging to the bearer token, full stop.
 *   * It will not change the role of an account that already has one. This
 *     is a first-run setup step; a later switch is an admin's decision.
 * ============================================================ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** The only two roles a person may give themselves, stored as the DB spells them. */
const SELF_ASSIGNABLE: Record<string, string> = {
  traveler: "customer",
  partner: "partner",
};

/** Roles that mean "this account has not been set up yet". */
const UNSET_ROLES = new Set(["customer", "traveler", "", "null"]);

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

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  const blocked = await enforceIpBlock(req);
  if (blocked) return blocked;

  if (!sameOrigin(req)) return bad("Forbidden", 403);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return bad("Account setup is not configured on this server.", 500);
  }

  /* Generous, because this is a once-per-account action and a person
     retrying after a dropped connection must not be locked out of finishing
     their own signup. */
  const ip = clientIp(req);
  const limited = await limitAndLogShared(req, `choose-role:${ip}`, 10, 10 * 60_000, {
    endpoint: "/api/auth/choose-role",
    category: "auth",
  });
  if (!limited.ok) return bad("Too many attempts. Please wait a few minutes.", 429);

  /* ---- authenticate: the account is the token's, never the body's ---- */
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) return bad("Sign in required.", 401);

  const sb = adminClient();
  const { data: caller, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !caller?.user) return bad("Session expired. Sign in again.", 401);
  const userId = caller.user.id;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("Malformed request.");
  }

  const wanted = String(body.role ?? "");
  const dbRole = SELF_ASSIGNABLE[wanted];
  if (!dbRole) return bad("Choose either a traveller or a partner account.");

  /* A partner without a category cannot be routed to a dashboard, and the
     admin queue has nothing to file them under. Mirrors the client check so
     the rule holds even if the form is bypassed. */
  const rawCategory = body.businessCategory;
  const businessCategory =
    typeof rawCategory === "string" && rawCategory.trim() ? rawCategory.trim() : null;
  if (wanted === "partner" && !businessCategory) {
    return bad("Choose the category you want to register under.");
  }

  /* ---- refuse to overwrite a role that is already set ---- */
  const { data: existing } = await sb
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const current = ((existing as { role?: string } | null)?.role ?? "").toLowerCase();
  if (current && !UNSET_ROLES.has(current)) {
    /* Already a partner and asking to be a partner: nothing to do, and
       answering ok keeps a double-submit from looking like a failure. */
    if (current === dbRole) {
      return NextResponse.json({ ok: true, role: wanted, unchanged: true });
    }
    return bad(
      "This account already has a role. Contact support to change it.",
      409
    );
  }

  /* ---- the write the browser is not allowed to make ---- */
  const { error: upErr } = await sb
    .from("profiles")
    .update({ role: dbRole, business_category: businessCategory })
    .eq("id", userId);

  /* Reported, not swallowed. Swallowing this exact error is what produced
     the silent traveller accounts in the first place. */
  if (upErr) return bad("Could not save your account type. Please try again.", 500);

  /* Metadata too, so roleChosen stops the gate reappearing — and so the two
     copies of the role agree. Done AFTER the profiles write: if this one
     fails the person is asked again, which is recoverable; the other way
     round leaves them stuck exactly as before. */
  const { error: metaErr } = await sb.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...(caller.user.user_metadata ?? {}),
      role: wanted,
      business_category: businessCategory,
    },
  });
  if (metaErr) return bad("Could not finish setting up your account. Try again.", 500);

  return NextResponse.json({ ok: true, role: wanted });
}
