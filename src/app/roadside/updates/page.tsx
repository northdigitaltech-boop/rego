import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, TriangleAlert } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { RoadUpdates } from "@/components/roadside/road-updates";
import { getPublicRoadUpdates } from "@/lib/road-updates";
import { buildMetadata } from "@/lib/seo";

/* ------------------------------------------------------------------
   Re-rendered every 5 minutes — the same cadence as the in-browser
   refresh. Road status is the one thing on Rego where a stale page is
   a safety problem, so this is never statically cached forever.
   ------------------------------------------------------------------ */
export const revalidate = 300;

/* buildMetadata, not a bare object: the old one set only title,
   description and canonical, so Open Graph and Twitter fell through to
   the root layout. Sharing this page showed the HOMEPAGE's title and
   og:url — a WhatsApp preview of "Book Your Entire Trip in One Place"
   for a link about a blocked road. */
export const metadata: Metadata = buildMetadata({
  title: "Gilgit-Baltistan Road Status & Alerts",
  description:
    "Verified road conditions for Gilgit-Baltistan — Karakoram Highway, Gilgit–Skardu, Babusar Top, Chilas, Hunza, Astore, Deosai and Khunjerab Pass. Status, blockages, safety messages and alternative routes, with the source and time of every report.",
  path: "/roadside/updates",
});

export default async function RoadUpdatesPage() {
  /* Fetched on the server so the road list is in the HTML — before this,
     a search engine saw the heading and nothing else; every status loaded
     client-side. Only VERIFIED reports, newest per road: the same rows the
     browser fetches, so what is indexed is exactly what a visitor sees.
     A failure renders the empty cards, never an error page — the client
     refresh will fill them in. */
  const initial = await getPublicRoadUpdates().catch(() => []);
  const renderedAt = Date.now();

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-gradient-forest text-white">
          <div className="container-px py-12">
            <Link
              href="/roadside"
              className="inline-flex items-center gap-1 text-sm font-medium text-white/80 hover:text-gold"
            >
              <ChevronLeft className="h-4 w-4" /> Roadside Assistance
            </Link>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <TriangleAlert className="h-4 w-4 text-gold" /> Live Road Updates
            </span>
            <h1 className="mt-3 max-w-3xl font-display text-3xl font-bold uppercase sm:text-4xl">
              Road Updates &amp; Alerts
            </h1>
            <p className="mt-3 max-w-2xl text-white/85">
              Real-time road conditions across Gilgit-Baltistan — verified status, blockages,
              safety guidance and alternative routes. Subscribe to a route to get alerted when it
              closes or reopens.
            </p>
          </div>
        </section>

        <section className="container-px py-10 sm:py-12">
          <RoadUpdates initial={initial} renderedAt={renderedAt} />
        </section>
      </main>
      <Footer />
    </>
  );
}
