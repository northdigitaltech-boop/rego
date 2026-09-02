/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "loremflickr.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
    ],
  },
  // The service worker must never be cached by the browser or the CDN.
  // A stale /sw.js is what pins users to a dead build after a deploy — the
  // one PWA failure mode with no user-side fix.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
    ];
  },
  experimental: {
    // framer-motion was removed from the project; the entry is gone with it.
    optimizePackageImports: ["lucide-react"],
    // `optimizeCss` is DISABLED on purpose, and measurement now says leaving
    // it off costs almost nothing. On the live homepage both stylesheets
    // finish at 552ms and 559ms, while first paint is at 1044ms — the CSS is
    // not what the browser is waiting for. What it waits for is ~996 KB of
    // JavaScript, the last of which lands at 836ms. Inlining critical CSS
    // would buy back a few milliseconds at best and risks the old build
    // failure (Next 15.5's pages-router prerender of /404 and /500 wants
    // `critters`, which is why it is still a dependency). Spend the effort on
    // the JavaScript instead.
    // optimizeCss: true,
  },
};

export default nextConfig;
