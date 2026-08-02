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
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
    // `optimizeCss` is DISABLED on purpose. It would inline critical CSS and
    // remove the ~510ms render-blocking stylesheet, but on Next 15.5 the
    // pages-router runtime (used to prerender /404 and /500) still requires
    // the old `critters` module — installing `beasties` alone fails the build
    // with "Cannot find module 'critters'". Re-enable only after verifying a
    // full `npm run build` passes locally.
    // optimizeCss: true,
  },
};

export default nextConfig;
