/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Optimised image delivery (AVIF/WebP + a 1-day cache) for any <Image>,
  // and the hosts our data uses so they're allowed + cached.
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
  // Tree-shake big icon / animation packages so pages compile & ship less code.
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
