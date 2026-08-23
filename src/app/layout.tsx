import type { Metadata, Viewport } from "next";
import { Montserrat, Dancing_Script } from "next/font/google";

import "./globals.css";
import { Providers } from "@/components/providers";
import { DeferredWidgets } from "@/components/layout/deferred-widgets";
import { InstallCapture } from "@/components/pwa/install-capture";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { siteConfig, IS_INDEXABLE, verification } from "@/lib/site";
import { JsonLd, organizationSchema, websiteSchema } from "@/components/seo/json-ld";

// Montserrat is the single brand font for the entire site (headings, body,
// buttons, inputs, navbar, footer — everything). Bound to --font-sans, which
// every Tailwind font family (sans/display/script/mono) resolves to.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

// Script font used ONLY for the founder's signature (About page). Everything
// else stays Montserrat.
const dancingScript = Dancing_Script({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-signature",
  display: "swap",
});

// The layout is kept stable on mobile by `touch-action: pan-x pan-y` in
// globals.css (that's what actually stops the pinch gesture, including on iOS
// Safari, which ignores the meta flags).
//
// We deliberately do NOT set `userScalable: false` / `maximumScale: 1` here:
// those meta flags are what accessibility audits penalise, and blocking zoom
// at the browser level would lock out users who genuinely need to magnify.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F4C3A",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Rego — Book Your Entire Trip in One Place",
    template: "%s — Rego",
  },
  description:
    "The modern tourism marketplace for Gilgit-Baltistan — hotels, homestays, travel companies, tour packages, transport, guides, photographers, restaurants and activities. Discover and book trusted providers in one seamless experience.",
  applicationName: "Rego",
  // PWA — the manifest is a static file in /public, so it costs nothing at runtime.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Rego",
    // "default" keeps the iOS status bar legible over the light app background.
    // "black-translucent" would push content under the notch.
    statusBarStyle: "default",
  },
  keywords: [
    "Gilgit Baltistan tourism",
    "Skardu hotels",
    "Hunza tours",
    "homestays Gilgit Baltistan",
    "travel companies Pakistan",
    "tour packages",
    "jeep safari",
    "tour guides",
    "transport rental",
    "travel marketplace",
  ],
  authors: [{ name: "Rego" }],
  creator: "Rego",
  publisher: "Rego",
  /* NO `alternates.canonical` HERE — ON PURPOSE.
   *
   * In the App Router, metadata fields from a layout are inherited by every
   * page that does not set its own. A canonical of "/" in the root layout
   * therefore made every page without an explicit canonical announce itself
   * as a duplicate of the homepage — which asks Google not to index it.
   *
   * Leaving it out means a page with no canonical emits none at all, and the
   * crawler self-canonicalises to the URL it fetched. A missing canonical is
   * recoverable; a confidently wrong one is not.
   *
   * The homepage sets its own in app/page.tsx.
   */
  // Site-wide default. Non-production hosts (preview/staging/local) are kept out
  // of the index; per-page metadata can still override this.
  robots: {
    index: IS_INDEXABLE,
    follow: IS_INDEXABLE,
    googleBot: {
      index: IS_INDEXABLE,
      follow: IS_INDEXABLE,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google: verification.google,
    other: {
      ...(verification.bing ? { "msvalidate.01": verification.bing } : {}),
      ...(verification.yandex ? { "yandex-verification": verification.yandex } : {}),
    },
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    url: siteConfig.url,
    title: "Rego — Book Your Entire Trip in One Place",
    description:
      "Hotels, homestays, travel companies, transport, guides and unforgettable experiences across Gilgit-Baltistan — all in one trusted marketplace.",
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: siteConfig.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rego — Book Your Entire Trip in One Place",
    description:
      "Hotels, homestays, travel companies, transport, guides and experiences across Gilgit-Baltistan.",
    images: [siteConfig.ogImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preload the hero (the LCP element) so it starts downloading in
            parallel with the stylesheet instead of waiting for CSS to parse. */}
        <link
          rel="preload"
          as="image"
          href="/hero-1024.webp"
          imageSrcSet="/hero-640.webp 640w, /hero-1024.webp 1024w, /hero-1536.webp 1536w"
          imageSizes="100vw"
          fetchPriority="high"
        />
        {/* Warm up connections to the image CDNs so card photos load faster. */}
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="" />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
      </head>
      {/* Captures beforeinstallprompt before hydration — Chrome fires it
          earlier than React mounts, and a missed event means no button. */}
      <InstallCapture />
      <body
        suppressHydrationWarning
        className={`${montserrat.variable} ${dancingScript.variable} font-sans`}
      >
        <JsonLd data={[organizationSchema(), websiteSchema()]} />
        <Providers>
          {children}
          <DeferredWidgets />
          {/* PWA layer. Both render nothing until the browser says they
              are relevant, so they add no visible UI by default. */}
          <ServiceWorkerRegister />
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
