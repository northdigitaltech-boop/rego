const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

export const isCloudinaryConfigured =
  CLOUD_NAME.length > 0 && UPLOAD_PRESET.length > 0;

/** Upload an image file to Cloudinary (unsigned) and return its secure URL. */
export async function uploadToCloudinary(file: File): Promise<string> {
  if (!isCloudinaryConfigured) {
    throw new Error("Image uploads aren't set up yet.");
  }
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: form }
  );

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
