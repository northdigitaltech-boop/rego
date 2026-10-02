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
  /* /destinations/hunza was linked from the footer on every page and from the
     homepage, but the live slug is hunza-valley — so it 404'd. Permanent, so
     any equity those links earned moves across. Only a slug with a real
     equivalent is redirected; deosai, fairy-meadows, naran, shigar and
     khaplu have no destination page and are left to 404 honestly rather
     than sent somewhere they are not. */
  async redirects() {
    return [
      {
        source: "/destinations/hunza",
        destination: "/destinations/hunza-valley",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      /* ================================================================
         SECURITY HEADERS — SEC-010.

         The site had none. `headers()` existed but only set cache
         control, so REGO shipped with no clickjacking defence, no
         MIME-sniffing defence, no HSTS and no CSP.

         WHY THE CSP IS REPORT-ONLY AND THE REST ARE ENFORCED
           The five headers below CSP cannot break a working page —
           they refuse things REGO never does. They are enforced now.

           A Content-Security-Policy CAN break a page, silently and
           completely: one missing origin and the map stops loading,
           or Cloudinary images vanish, and it fails for visitors
           rather than in a build. REGO pulls from a lot of origins —
           Leaflet from cdnjs, five tile servers, Cloudinary,
           Turnstile, Google Analytics, Supabase — and a policy
           written from a grep is a policy with something missing.

           So it ships as Report-Only: browsers evaluate it, report
           violations to the console, and block nothing. Watch the
           console for a few days of real traffic, add whatever
           legitimate origin shows up, and only then rename the
           header to Content-Security-Policy to enforce it. That is
           the difference between a CSP that protects the site and
           one that takes it down on a Friday.
         ================================================================ */
      {
        source: "/:path*",
        headers: [
          /* Stops a browser from guessing a file is JavaScript when the
             server said it was an image — the trick behind several
             upload-based XSS chains. */
          { key: "X-Content-Type-Options", value: "nosniff" },

          /* Nothing on REGO is meant to be framed. Both headers are set:
             frame-ancestors is the modern rule, X-Frame-Options is what
             older browsers actually obey. */
          { key: "X-Frame-Options", value: "DENY" },

          /* Send the full URL to ourselves, only the origin to others.
             A booking or listing URL should not leak its path to an
             external image host in a Referer header. */
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

          /* REGO asks for geolocation on the map, and nothing else.
             Camera, microphone and payment are denied outright so a
             compromised third-party script cannot request them. */
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), payment=(), usb=(), magnetometer=(), geolocation=(self)",
          },

          /* Two years, subdomains included. Vercel already redirects to
             HTTPS; this removes the first unencrypted request, which is
             the one a network attacker gets to intercept.
             `preload` is deliberately omitted — it is effectively
             irreversible and should be a separate, considered decision. */
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },

          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              /* 'unsafe-inline' and 'unsafe-eval' are required by Next's
                 runtime and by the inline GA bootstrap. Removing them
                 needs nonces, which is a later, larger change. */
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://www.googletagmanager.com https://challenges.cloudflare.com https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
              "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://plus.unsplash.com https://picsum.photos https://loremflickr.com https://i.pravatar.cc https://server.arcgisonline.com https://*.basemaps.cartocdn.com https://*.tile.opentopomap.org https://api.maptiler.com https://api.mapbox.com https://www.google-analytics.com https://unpkg.com https://cdnjs.cloudflare.com",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.cloudinary.com https://api.open-meteo.com https://api.maptiler.com https://api.mapbox.com https://www.google-analytics.com https://challenges.cloudflare.com https://vitals.vercel-insights.com",
              "frame-src https://challenges.cloudflare.com https://www.google.com https://www.youtube.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
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
