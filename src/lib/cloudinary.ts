import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

export const isCloudinaryConfigured =
  CLOUD_NAME.length > 0 && UPLOAD_PRESET.length > 0;

/* ============================================================
 * Cloudinary uploads — signed where possible (SEC-012).
 *
 * WHY THIS CHANGED
 *   Uploads went up with an UNSIGNED preset. The cloud name and
 *   the preset are both NEXT_PUBLIC_, so they sit in the page
 *   source of every visit — and together they are everything
 *   needed to POST into the account from anywhere, with no Rego
 *   session and no origin check. Billable storage and bandwidth,
 *   and arbitrary files served from your cloud.
 *
 * HOW IT WORKS NOW
 *   1. Ask /api/upload/sign for a signature. That route checks
 *      the caller is signed in, rate limits them, and chooses the
 *      folder — then signs with CLOUDINARY_API_SECRET, which
 *      never leaves the server.
 *   2. Upload with the signature attached.
 *
 * WHY THE UNSIGNED PATH IS STILL HERE
 *   Signing needs two env vars and a preset flipped to Signed in
 *   the Cloudinary dashboard. Until all three are done the route
 *   answers 501, and this falls back so uploads keep working
 *   during the rollout. Once they are done, Cloudinary itself
 *   rejects the unsigned path and the fallback becomes dead
 *   weight to delete.
 *
 *   Shipping the fallback is a deliberate trade: a hard cutover
 *   would have broken every upload form the moment this deployed
 *   and before anyone could set a variable.
 * ============================================================ */

interface SignedUpload {
  signature: string;
  timestamp: number;
  folder: string;
  apiKey: string;
  cloudName: string;
  uploadPreset?: string;
}

/** null when signing is not configured — the caller then uses the old path. */
async function getSignature(kind: string): Promise<SignedUpload | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    // Signing requires a signed-in caller by design; anonymous uploads
    // (if any remain) fall through to the unsigned preset.
    if (!token) return null;

    const res = await fetch("/api/upload/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind }),
    });
    if (!res.ok) return null; // 501 unconfigured, 429 limited, 401 stale session
    const json = (await res.json()) as { ok?: boolean } & SignedUpload;
    return json?.ok && json.signature ? json : null;
  } catch {
    return null;
  }
}

async function post(url: string, form: FormData): Promise<string> {
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    let detail = "";
    try {
      const err = await res.json();
      detail = err?.error?.message ? ` (${err.error.message})` : "";
    } catch {
      /* ignore */
    }
    throw new Error(`Upload failed${detail}. Check your Cloudinary settings.`);
  }
  const data = await res.json();
  return data.secure_url as string;
}

async function upload(file: File, resource: "image" | "auto", kind: string): Promise<string> {
  if (!isCloudinaryConfigured) {
    throw new Error(
      resource === "image" ? "Image uploads aren't set up yet." : "File uploads aren't set up yet."
    );
  }

  const form = new FormData();
  form.append("file", file);

  const signed = await getSignature(kind);
  if (signed) {
    /* Order does not matter to Cloudinary, but the SET of parameters does:
       it re-signs exactly what the server signed, so nothing extra may be
       added here. */
    form.append("api_key", signed.apiKey);
    form.append("timestamp", String(signed.timestamp));
    form.append("folder", signed.folder);
    if (signed.uploadPreset) form.append("upload_preset", signed.uploadPreset);
    form.append("signature", signed.signature);
    return post(
      `https://api.cloudinary.com/v1_1/${signed.cloudName}/${resource}/upload`,
      form
    );
  }

  form.append("upload_preset", UPLOAD_PRESET);
  return post(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resource}/upload`, form);
}

/** Upload an image and return its secure URL. */
export async function uploadToCloudinary(file: File): Promise<string> {
  return upload(file, "image", "listing");
}

/**
 * Upload a NON-image document (PDF / DOC / DOCX — e.g. a CV) and return its
 * secure URL. Uses Cloudinary's `auto` resource type so the same preset works
 * for documents as well as images.
 */
export async function uploadFileToCloudinary(file: File): Promise<string> {
  return upload(file, "auto", "document");
}
