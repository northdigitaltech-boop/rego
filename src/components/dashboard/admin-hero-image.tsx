"use client";

import * as React from "react";
import { ImagePlus, Loader2, RotateCcw, TriangleAlert } from "lucide-react";

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { uploadToCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";
import { setHeroImage, heroFromUrl, DEFAULT_HERO } from "@/lib/hero-image";

/* ============================================================
 * Homepage hero image.
 *
 * The hero was a file in the repo, so changing it for a season
 * or a campaign needed a developer and a deploy. This sets it
 * from the dashboard.
 *
 * The warning about file size is not boilerplate. The hero is
 * the Largest Contentful Paint element on the homepage — the
 * measurement Google weighs most heavily — and a phone photo
 * dropped in here can be several megabytes. Cloudinary resizes
 * and re-encodes it, which covers most of the damage, but the
 * number is shown before upload because it is the one decision
 * on this screen that can quietly cost the site its score.
 * ============================================================ */

const RECOMMENDED_BYTES = 1_500_000; // 1.5 MB before Cloudinary gets to it

export function AdminHeroImage() {
  const [url, setUrl] = React.useState("");
  const [mobileUrl, setMobileUrl] = React.useState("");
  const [alt, setAlt] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [err, setErr] = React.useState("");
  const [warn, setWarn] = React.useState("");
  /* Columns missing means phase89 has not been run. Worth saying plainly
     rather than showing a screen whose Save button silently fails. */
  const [needsMigration, setNeedsMigration] = React.useState(false);

  React.useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    void (async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("hero_image_url, hero_image_alt, hero_image_mobile_url")
        .eq("id", 1)
        .maybeSingle();
      if (error) setNeedsMigration(true);
      else if (data) {
        const row = data as {
          hero_image_url?: string | null;
          hero_image_alt?: string | null;
          hero_image_mobile_url?: string | null;
        };
        setUrl(row.hero_image_url ?? "");
        setAlt(row.hero_image_alt ?? "");
        setMobileUrl(row.hero_image_mobile_url ?? "");
      }
      setLoading(false);
    })();
  }, []);

  const pick = async (file: File, slot: "desktop" | "mobile") => {
    setErr("");
    setMsg("");
    setWarn(
      file.size > RECOMMENDED_BYTES
        ? `That file is ${(file.size / 1_000_000).toFixed(1)} MB. It will be resized on upload, but a smaller original gives a faster homepage — aim for a wide photo under 1.5 MB.`
        : ""
    );
    setBusy(true);
    try {
      const uploaded = await uploadToCloudinary(file);
      if (slot === "mobile") setMobileUrl(uploaded);
      else setUrl(uploaded);
      setMsg("Uploaded. Press Save to put it live.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    }
    setBusy(false);
  };

  const save = async (next: string | null, nextMobile: string | null) => {
    setBusy(true);
    setErr("");
    setMsg("");
    const { error } = await setHeroImage(next, alt, nextMobile);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setUrl(next ?? "");
    setMobileUrl(nextMobile ?? "");
    /* revalidate is 60s on the homepage, so say so rather than letting
       someone refresh and think it did not work. */
    setMsg(
      next
        ? "Saved. The homepage picks it up within a minute."
        : "Reset to the built-in hero. Live within a minute."
    );
  };

  const preview = url.trim() ? heroFromUrl(url, alt, mobileUrl) : DEFAULT_HERO;

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-forest">Homepage hero</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The photograph behind the headline and search box. Leave it empty to
          use the one built into the site.
        </p>
      </div>

      {needsMigration && (
        <p className="flex items-start gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-forest">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" />
          Run <code className="font-mono">phase89-hero-image.sql</code> and <code className="font-mono">phase90-hero-mobile.sql</code> in
          Supabase first — the columns this screen writes to do not exist yet.
        </p>
      )}

      {/* Both shapes, at the proportions each one is actually painted at, so a
          badly cropped photo is obvious here rather than after it is live.
          The phone pane shows the desktop image when no separate one is set —
          which is exactly what a phone would get. */}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="relative aspect-[16/7] w-full bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.src}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-forest-900/55 via-forest-900/15 to-transparent" />
            <p className="absolute bottom-3 left-4 font-display text-xl font-bold text-white drop-shadow">
              Gilgit Baltistan Tourism Marketplace
            </p>
          </div>
          <p className="bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
            Desktop —{" "}
            {preview.isDefault ? "built-in hero" : "your uploaded image"}
          </p>
        </div>

        <div className="w-full overflow-hidden rounded-2xl border border-border sm:w-[200px]">
          <div className="relative aspect-[4/5] w-full bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.mobile?.src ?? preview.src}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-forest-900/55 via-forest-900/15 to-transparent" />
            <p className="absolute bottom-3 left-3 font-display text-sm font-bold leading-tight text-white drop-shadow">
              Gilgit Baltistan Tourism Marketplace
            </p>
          </div>
          <p className="bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Phone —{" "}
            {preview.mobile
              ? "your phone image"
              : "the desktop image, cropped"}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block rounded-xl border border-border px-3 py-2">
          <span className="block text-xs font-semibold text-forest">
            Desktop image URL
          </span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none"
          />
        </label>
        <label className="block rounded-xl border border-border px-3 py-2">
          <span className="block text-xs font-semibold text-forest">
            Phone image URL{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <input
            value={mobileUrl}
            onChange={(e) => setMobileUrl(e.target.value)}
            placeholder="Leave empty to crop the desktop one"
            className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none"
          />
        </label>
        <label className="block rounded-xl border border-border px-3 py-2">
          <span className="block text-xs font-semibold text-forest">
            Alt text <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Leave empty — the headline carries the meaning"
            className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isCloudinaryConfigured && (
          <>
            <UploadButton
              label="Upload desktop image"
              busy={busy}
              onFile={(f) => void pick(f, "desktop")}
            />
            <UploadButton
              label="Upload phone image"
              busy={busy}
              onFile={(f) => void pick(f, "mobile")}
            />
          </>
        )}

        <button
          type="button"
          onClick={() => void save(url.trim() || null, mobileUrl.trim() || null)}
          disabled={busy || needsMigration}
          className="inline-flex items-center gap-2 rounded-lg bg-forest-700 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-800 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
        </button>

        <button
          type="button"
          onClick={() => void save(null, null)}
          disabled={busy || needsMigration}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-forest hover:bg-muted disabled:opacity-60"
        >
          <RotateCcw className="h-4 w-4" /> Use built-in hero
        </button>
      </div>

      {warn && (
        <p className="flex items-start gap-2 rounded-lg bg-gold/10 px-3 py-2 text-sm text-forest">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" />
          {warn}
        </p>
      )}
      {msg && <p className="text-sm font-medium text-forest-700">{msg}</p>}
      {err && <p className="text-sm font-medium text-red-600">{err}</p>}

      <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        Use a wide landscape photo for desktop and an upright one for the phone
        — a phone screen can only show a narrow vertical slice of a wide
        picture, so most of it, usually the part that made it worth choosing,
        is cropped away. Leave the phone image empty and that is exactly what
        happens. Both are served at several sizes, and the crop is chosen
        automatically around the subject rather than the centre of the frame.
        The hero is the largest thing on the homepage and the main thing Google
        times when it measures the site&apos;s speed, so prefer a
        well-compressed file over a very large one.
      </p>
    </section>
  );
}

function UploadButton({
  label,
  busy,
  onFile,
}: {
  label: string;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-forest hover:bg-muted">
      <ImagePlus className="h-4 w-4" />
      {label}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          /* Cleared so choosing the same file twice still fires a change. */
          e.target.value = "";
        }}
      />
    </label>
  );
}
