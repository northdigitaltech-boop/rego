#!/usr/bin/env node
/**
 * Regenerates the app icons and the iOS launch screens from one logo file.
 *
 *   node scripts/make-splash.mjs [path/to/logo.png]
 *
 * Defaults to assets/logo-mark.png — the logo with its background keyed out.
 * That file lives outside public/ on purpose: nothing should ever download it,
 * and everything in public/icons and public/splash is derived from it. Replace
 * the source and re-run rather than editing the outputs.
 *
 * WHY A TRANSPARENT SOURCE.
 * The original artwork's dark-green field is not perfectly flat — it ranges
 * over roughly rgb(0-3, 28-33, 14-20). Pasting that square onto a flat canvas
 * of one colour left a visible lighter rectangle around the mark on every
 * splash screen. Keying the field out and compositing only the mark removes
 * the seam entirely.
 *
 * WHY IT IS TRIMMED.
 * The mark occupies about 60% of its own canvas and sits off-centre in it.
 * Trimming to the artwork and re-centring is what makes the icon fill its
 * tile properly instead of floating small and slightly left.
 *
 * The device list must stay in step with src/components/pwa/ios-splash.tsx.
 * iOS matches a launch screen on exact CSS size and pixel ratio, so a size in
 * one and missing from the other means a blank white launch on that device.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const SRC = process.argv[2] ?? "assets/logo-mark.png";

/** The brand's dark field. Must match manifest background_color, or the
 *  Android splash shows the icon as a square of a slightly different shade. */
const BG = { r: 1, g: 30, b: 17 };

/** [css width, css height, dpr] — mirrors ios-splash.tsx exactly. */
const DEVICES = [
  [320, 568, 2], [375, 667, 2], [375, 812, 3], [390, 844, 3],
  [393, 852, 3], [414, 736, 3], [414, 896, 2], [414, 896, 3],
  [428, 926, 3], [430, 932, 3], [744, 1133, 2], [768, 1024, 2],
  [810, 1080, 2], [820, 1180, 2], [834, 1112, 2], [834, 1194, 2],
  [1024, 1366, 2],
];

/** The mark alone, cropped to its own edges. */
const mark = await sharp(SRC).trim().toBuffer();

/**
 * Centre the mark on a flat field.
 *
 * `fit: "inside"` keeps the mark's proportions — it is wider than it is tall,
 * so forcing it square would stretch the R.
 */
async function tile(w, h, coverage, out) {
  const box = Math.round(Math.min(w, h) * coverage);
  const scaled = await sharp(mark)
    .resize(box, box, { fit: "inside", withoutEnlargement: false })
    .toBuffer();
  await sharp({ create: { width: w, height: h, channels: 3, background: BG } })
    .composite([{ input: scaled, gravity: "centre" }])
    .png({ palette: true, quality: 90 })
    .toFile(out);
}

await mkdir("public/splash", { recursive: true });
await mkdir("public/icons", { recursive: true });

/* Home-screen icons. 0.78 leaves a margin without looking lost in the tile. */
await tile(192, 192, 0.78, "public/icons/icon-192.png");
await tile(512, 512, 0.78, "public/icons/icon-512.png");
await tile(180, 180, 0.78, "public/icons/apple-touch-icon.png");

/* Android crops a maskable icon to a circle and can shave off up to 20% per
   edge, so this one sits well inside the safe zone or the R loses its ends. */
await tile(512, 512, 0.58, "public/icons/icon-maskable-512.png");

/* Launch screens. A third of the narrow edge keeps the mark the same visual
   size on a small phone and a large tablet. */
for (const [w, h, dpr] of DEVICES) {
  const W = w * dpr;
  const H = h * dpr;
  await tile(W, H, 0.36, path.join("public/splash", `splash-${W}x${H}.png`));
}

console.log(`Icons and ${DEVICES.length} launch screens rebuilt from ${SRC}`);
