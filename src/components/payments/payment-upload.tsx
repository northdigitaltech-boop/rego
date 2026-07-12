"use client";

import * as React from "react";
import { UploadCloud, Loader2, X } from "lucide-react";

import { uploadPaymentProof } from "@/lib/payments";

/** Uploads a payment screenshot to the private Supabase Storage bucket. */
export function PaymentUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState("");
  // Local preview (object URL). The bucket is private, so we can't show the
  // stored path directly — we preview the file the user just picked.
  const [preview, setPreview] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const path = await uploadPaymentProof(file);
      setPreview(URL.createObjectURL(file));
      onChange(path); // store the private object path, not a public URL
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {value ? (
        <div className="relative h-40 w-full overflow-hidden rounded-xl border border-border">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Payment proof" className="h-full w-full object-contain bg-muted" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-sm font-medium text-forest-600">
              Screenshot uploaded ✓
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (preview) URL.revokeObjectURL(preview);
              setPreview("");
              onChange("");
            }}
            aria-label="Remove screenshot"
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-forest shadow-soft hover:bg-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-forest/40 disabled:opacity-70"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-forest-600" />
          ) : (
            <UploadCloud className="h-6 w-6 text-forest-600" />
          )}
          <span className="text-sm font-medium">
            {uploading ? "Uploading…" : "Upload payment screenshot"}
          </span>
          <span className="text-[11px] text-muted-foreground">PNG / JPG / WEBP · max 5 MB</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
