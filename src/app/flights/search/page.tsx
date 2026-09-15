import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { FlightSearchWidget } from "@/components/flights/flight-search-widget";
import { FlightResults } from "@/components/flights/flight-results";
import { flightFlags } from "@/lib/flights/registry";

/* ============================================================
 * /flights/search
 *
 * Exists only when FLIGHTS_ENABLED is on. With the flag off this
 * 404s, which is correct here and would have been wrong on
 * /flights: nothing links to this route until the flag flips, so
 * there is no live behaviour to preserve.
 *
 * noindex, deliberately. A results page is one person's dates and
 * party size, the prices expire in minutes, and the query-string
 * space is effectively infinite — exactly the thin, duplicated
 * pages that earn a ranking penalty. The SEO lives on /flights and
 * on the city-pair pages planned for Phase 8.
 * ============================================================ */

export const metadata: Metadata = {
  title: "Flight search results",
  robots: { index: false, follow: false },
};

export default function FlightSearchPage() {
  if (!flightFlags.enabled()) notFound();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background">
        <section className="border-b border-border bg-forest-50/50">
          <div className="container-px py-5">
            {/* The widget keeps its own state, so editing a search here is a
                new search rather than a trip back to /flights. */}
            <FlightSearchWidget compact />
          </div>
        </section>

        {/* useSearchParams needs a Suspense boundary, or the whole route is
            forced to client-side rendering at build time. */}
        <Suspense fallback={<ResultsFallback />}>
          <FlightResults />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}

function ResultsFallback() {
  return (
    <div className="container-px py-16 text-center text-sm text-muted-foreground">
      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
      <p className="mt-2">Loading your search…</p>
    </div>
  );
}
