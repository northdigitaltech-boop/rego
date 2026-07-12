import type { Metadata } from "next";
import { Montserrat, Dancing_Script } from "next/font/google";

import "./globals.css";
import { Providers } from "@/components/providers";
import { HelpLine } from "@/components/help/help-line";
import { RegoAiWidget } from "@/components/home/rego-ai-widget";
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

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "Rego — Book Your Entire Trip in One Place",
    template: "%s — Rego",
  },
  description:
    "The modern tourism marketplace for Gilgit-Baltistan — hotels, homestays, travel companies, tour packages, transport, guides, photographers, restaurants and activities. Discover and book trusted providers in one seamless experience.",
  applicationName: "Rego",
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
  alternates: { canonical: "/" },
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
      <body
        suppressHydrationWarning
        className={`${montserrat.variable} ${dancingScript.variable} font-sans`}
      >
        <JsonLd data={[organizationSchema(), websiteSchema()]} />
        <Providers>
          {children}
          <RegoAiWidget />
          <HelpLine />
        </Providers>
      </body>
    </html>
  );
}
