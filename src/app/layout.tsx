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
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { IosSplash } from "@/components/pwa/ios-splash";

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
  icons: {
    // iOS applies its own rounded mask, so this is the square artwork.
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
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
        {/* The hero preload used to live here. It has moved to app/page.tsx:
            the hero only appears on the homepage, so every other route was
            preloading an image it never painted — and now that the image can
            be set by an admin, the preload has to name whichever one is
            actually configured. */}
        {/* Warm up connections to the image CDNs so card photos load faster. */}
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="" />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        {/* iPhone and iPad launch screens. Android builds its own from the
            manifest; iOS needs an exact per-device match or it shows white. */}
        <IosSplash />
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
        {/* Loads after the page is interactive, so it costs nothing on the
            metric Google actually measures. Renders nothing at all when
            NEXT_PUBLIC_GA_ID is unset. */}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
