"use client";

import { supabase } from "@/lib/supabase";

/* ============================================================
 * Two-step verification (TOTP) built on Supabase Auth MFA.
 *
 * Supabase stores the shared secret and does the code checking, so there is
 * nothing to add to the database and no secret of ours to protect. A session
 * that has passed the second step is marked "aal2"; one that has only passed
 * the password step is "aal1".
 *
 *   currentLevel  nextLevel   meaning
 *   aal1          aal1        no second factor set up
 *   aal1          aal2        second factor set up, not yet entered this session
 *   aal2          aal2        fully verified
 * ============================================================ */

export type MfaStatus =
  | "loading"
  | "not-enrolled" // needs to set up an authenticator app
  | "needs-code" // enrolled, must enter a code for this session
  | "verified" // good to go
  | "error";

export interface TotpFactor {
  id: string;
  friendlyName: string;
  status: "verified" | "unverified";
}

/** Where this session stands. */
export async function getMfaStatus(): Promise<{
  status: MfaStatus;
  message?: string;
}> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return { status: "error", message: error.message };

    const { currentLevel, nextLevel } = data;

    if (currentLevel === "aal2") return { status: "verified" };
    if (nextLevel === "aal2") return { status: "needs-code" };
    return { status: "not-enrolled" };
  } catch (e) {
    return {
      status: "error",
      message: e instanceof Error ? e.message : "Could not check verification.",
    };
  }
}

/** Every TOTP factor on the account, verified or not. */
export async function listTotpFactors(): Promise<TotpFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return [];
  return (data.totp ?? []).map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name ?? "Authenticator",
    status: f.status as "verified" | "unverified",
  }));
}

export interface EnrollResult {
  factorId: string;
  /** SVG data URL — render directly in an <img>. */
  qrCode: string;
  /** Plain secret, for people who can't scan the QR code. */
  secret: string;
}

/**
 * Start enrolment. Any half-finished factor from a previous attempt is
 * removed first, otherwise Supabase rejects the new one as a duplicate.
 */
export async function enrollTotp(
  friendlyName = "Rego Admin"
): Promise<{ data?: EnrollResult; error?: string }> {
  try {
    for (const f of await listTotpFactors()) {
      if (f.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `${friendlyName} ${Date.now().toString(36)}`,
    });
    if (error || !data) return { error: error?.message ?? "Could not start setup." };

    return {
      data: {
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not start setup." };
  }
}

/**
 * Check a 6-digit code. Used both to finish enrolment and to unlock a session.
 * On success Supabase refreshes the session to aal2 automatically.
 */
export async function verifyTotp(
  factorId: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return { ok: false, error: "Enter the 6-digit code." };

  try {
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: clean,
    });
    if (error) {
      // Supabase's wording here is technical; make it human.
      const msg = /invalid|incorrect|expired/i.test(error.message)
        ? "That code isn't right. Check your app and try the current code."
        : error.message;
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not verify the code.",
    };
  }
}

/** Remove a factor. Requires an aal2 session. */
export async function unenrollTotp(factorId: string) {
  return supabase.auth.mfa.unenroll({ factorId });
}

/** The first verified factor, which is the one we challenge against. */
export async function primaryFactorId(): Promise<string | null> {
  const factors = await listTotpFactors();
  return factors.find((f) => f.status === "verified")?.id ?? null;
}
