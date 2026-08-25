/* ============================================================
 * iPhone and iPad launch screens.
 *
 * Android builds its splash from the manifest — background_color
 * plus the icon — and needs nothing here. iOS ignores the
 * manifest entirely and shows a blank white screen unless it
 * finds a startup image whose media query matches the device
 * exactly. Before this, launching the installed app on an
 * iPhone flashed white.
 *
 * "Exactly" is why this is a list of seventeen rather than one
 * file: iOS matches on CSS width, CSS height AND pixel ratio,
 * and falls back to the white screen if nothing matches. Every
 * entry is a real device size; the images are generated from
 * assets/logo-source.png by scripts/make-splash.mjs.
 *
 * Portrait only — the manifest locks the app to portrait, so
 * landscape images would never be shown.
 * ============================================================ */

/** [css width, css height, device pixel ratio] */
const DEVICES: [number, number, number][] = [
  [320, 568, 2],   // iPhone SE (1st gen)
  [375, 667, 2],   // iPhone SE (2nd/3rd), 8
  [375, 812, 3],   // iPhone X, XS, 11 Pro, 12/13 mini
  [390, 844, 3],   // iPhone 12, 13, 14
  [393, 852, 3],   // iPhone 14 Pro, 15, 16
  [414, 736, 3],   // iPhone 8 Plus
  [414, 896, 2],   // iPhone XR, 11
  [414, 896, 3],   // iPhone XS Max, 11 Pro Max
  [428, 926, 3],   // iPhone 12/13/14 Pro Max
  [430, 932, 3],   // iPhone 14 Pro Max, 15/16 Pro Max
  [744, 1133, 2],  // iPad mini 6
  [768, 1024, 2],  // iPad 9.7"
  [810, 1080, 2],  // iPad 10.2"
  [820, 1180, 2],  // iPad Air 10.9"
  [834, 1112, 2],  // iPad Pro 10.5"
  [834, 1194, 2],  // iPad Pro 11"
  [1024, 1366, 2], // iPad Pro 12.9"
];

export function IosSplash() {
  return (
    <>
      {DEVICES.map(([w, h, dpr]) => (
        <link
          key={`${w}x${h}@${dpr}`}
          rel="apple-touch-startup-image"
          href={`/splash/splash-${w * dpr}x${h * dpr}.png`}
          media={
            `(device-width: ${w}px) and (device-height: ${h}px) ` +
            `and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`
          }
        />
      ))}
    </>
  );
}
