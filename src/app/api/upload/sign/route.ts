import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { clientIp } from "@/lib/rate-limit";
import { limitAndLogShared } from "@/lib/rate-limit-guard";
import { folderFor } from "@/lib/upload-folders";

/* ============================================================
 * Signs one Cloudinary upload, for one signed-in person.
 *
 * SEC-012.
 *
 * ---------------------------------------------------------------------------
 * WHAT WAS WRONG
 *
 * src/lib/cloudinary.ts uploaded with an UNSIGNED preset. Both
 * values it needs — the cloud name and the preset — are
 * NEXT_PUBLIC_, so they are in the page source of every visit.
 * Anyone who reads them can POST to your Cloudinary account from
 * anywhere: no Rego account, no session, no referer check.
 *
 * That is billable storage and bandwidth on your bill, and it is
 * arbitrary content served from your cloud — which, once a URL
 * is shared, is content your domain's reputation carries.
 *
 * ---------------------------------------------------------------------------
 * HOW SIGNING FIXES IT
 *
 * With the preset switched to SIGNED, Cloudinary rejects any
 * upload that does not carry a valid signature. Producing that
 * signature needs CLOUDINARY_API_SECRET, which lives only in the
 * server environment and never leaves it — the browser receives
 * a signature for one upload, valid for a short window, and
 * nothing it can reuse to sign a different one.
 *
 * The rules are enforced HERE, before the signature exists:
 *   • the caller must be signed in — verified against Supabase,
 *     not taken from a header they set
 *   • rate limited per user, so a valid account cannot be used
 *     as an upload farm
 *   • the folder is decided by this route, not the browser
 *
 * WHY IT RETURNS 501 RATHER THAN FALLING BACK
 *   If the secret is missing, this route says so plainly instead
 *   of pretending. The client keeps its unsigned path until the
 *   secret is set, so uploads never break mid-rollout — but that
 *   fallback is visible in one place rather than silently
 *   permanent.
 * ============================================================ */

export const dynamic = "force-dynamic";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const API_KEY = process.env.CLOUDINARY_API_KEY ?? "";
const API_SECRET = process.env.CLOUDINARY_API_SECRET ?? "";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/* The folder map lives in src/lib/upload-folders.ts and is shared with the
   client, which sends a MODULE KEY. The path is resolved here — a browser
   that could name its own folder could write anywhere in the account. */

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

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    /* 501, not 500: nothing is broken, the capability is not configured.
       The client reads this and keeps using its existing path. */
    return NextResponse.json(
      {
        ok: false,
        unconfigured: true,
        error:
          "Signed uploads are not configured. Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in the server environment.",
      },
      { status: 501 }
    );
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ ok: false, error: "Server is not configured." }, { status: 500 });
  }

  /* Who is asking — verified against Supabase, never trusted from the body. */
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "Sign in to upload." }, { status: 401 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: caller, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !caller?.user?.email) {
    return NextResponse.json({ ok: false, error: "Invalid session." }, { status: 401 });
  }
  const email = caller.user.email.toLowerCase();

  /* Per person, not per IP: a signed-in account is the thing being spent
     here, and several staff behind one office IP must not share a budget. */
  const rl = await limitAndLogShared(req, `upload-sign:${email}`, 60, 60 * 60_000, {
    endpoint: "/api/upload/sign",
    category: "upload",
    actorEmail: email,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many uploads. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  let body: { kind?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const kind = typeof body.kind === "string" ? body.kind : "";
  const folder = folderFor(kind);

  /* Cloudinary signs the alphabetically-sorted parameter string. Only the
     parameters included here are covered — anything the browser adds beyond
     them is rejected by Cloudinary as unsigned. */
  /* ------------------------------------------------------------------
     THE UPLOAD PRESET IS DELIBERATELY NOT SIGNED OR SENT.

     The preset has its own folder configured — `safarigb`, from the
     project's former name — and every unsigned upload lands there no
     matter what the code asks for. Sending the preset alongside an
     explicit `folder` puts two answers in one request and leaves the
     destination up to Cloudinary's precedence rules.

     A signed upload does not need a preset at all: the preset exists to
     let UNSIGNED uploads through. Dropping it means the folder this
     route chooses is the only folder in the request, so a photo goes
     where the module says and nowhere else.
     ------------------------------------------------------------------ */
  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string> = { folder, timestamp: String(timestamp) };

  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  const signature = createHash("sha1").update(toSign + API_SECRET).digest("hex");

  /* The secret is never in this response — only a signature derived from it,
     good for these exact parameters and this timestamp. */
  return NextResponse.json({
    ok: true,
    signature,
    timestamp,
    folder,
    apiKey: API_KEY,
    cloudName: CLOUD_NAME,
  });
}
