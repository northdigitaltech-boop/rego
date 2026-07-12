"use client";

import * as React from "react";
import { UploadCloud, Loader2, X, Camera } from "lucide-react";

import { uploadToCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";

export function AvatarUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      onChange(url);
    } catch {
      /* ignore */
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative w-20">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || !isCloudinaryConfigured}
        className="grid h-20 w-20 place-items-center overflow-hidden rounded-full border border-border bg-muted text-forest-600"
        aria-label="Upload profile picture"
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <Camera className="h-6 w-6" />
        )}
      </button>
      <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-forest-600 text-white">
        <UploadCloud className="h-3 w-3" />
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

export function MultiImageUpload({
  value,
  onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      try {
        urls.push(await uploadToCloudinary(f));
      } catch {
        /* ignore */
      }
    }
    setUploading(false);
    onChange([...value, ...urls]);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div
            key={i}
            className="relative h-20 w-24 overflow-hidden rounded-lg border border-border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label="Remove"
              className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-white/90 text-forest"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || !isCloudinaryConfigured}
          className="grid h-20 w-24 place-items-center rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-forest/40 disabled:opacity-70"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-forest-600" />
          ) : (
            <UploadCloud className="h-5 w-5 text-forest-600" />
          )}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {!isCloudinaryConfigured && (
        <p className="mt-1 text-xs text-muted-foreground">
          Add Cloudinary keys to <code>.env.local</code> to enable uploads.
        </p>
      )}
    </div>
  );
}

export function ImageUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {value ? (
        <div className="relative h-44 w-full overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Hotel photo" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Remove photo"
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-forest shadow-soft hover:bg-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || !isCloudinaryConfigured}
          className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-forest/40 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-forest-600" />
          ) : (
            <UploadCloud className="h-6 w-6 text-forest-600" />
          )}
          <span className="text-sm font-medium">
            {uploading
              ? "Uploading…"
              : isCloudinaryConfigured
                ? "Click to upload a photo"
                : "Photo upload not configured"}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {!isCloudinaryConfigured && (
        <p className="mt-1 text-xs text-muted-foreground">
          Add Cloudinary keys to <code>.env.local</code> to enable uploads — or
          paste an image URL below.
        </p>
      )}
    </div>
  );
}
