import { Suspense } from "react";
import type { Metadata } from "next";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ListingsBrowser } from "@/components/listings/listings-browser";
import { feedAllListings } from "@/lib/home-feed";
import { buildMetadata } from "@/lib/seo";

export const revalidate = 60;

/* Query parameters that turn this page into an internal SEARCH RESULT rather
 * than a browse page. Any of these present → noindex.
 *
 * WHY: /listings?q=hunza+hotel&sort=price&page=3 is one of an unbounded number
 * of permutations with no unique content of its own. Indexing them competes
 * with the real category and destination pages for the same queries, and it
 * is the classic way a marketplace fills the index with near-duplicates.
 *
 * `follow` stays ON so crawlers still walk through to the listings themselves.
 * The canonical always points at the clean /listings, so link equity from any
 * shared filtered URL consolidates back here. */
const SEARCH_PARAMS = ["q", "sort", "min", "max", "rating", "page"];

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = SEARCH_PARAMS.some((k) => {
    const v = sp[k];
    return typeof v === "string" ? v.trim() !== "" : Array.isArray(v) && v.length > 0;
  });

  return buildMetadata({
    title: "Explore Listings",
    description:
      "Browse hotels, homestays, tours, transport, guides, photographers and activities across Gilgit Baltistan.",
    // Self-referencing and always clean — never carries the query string.
    path: "/listings",
    noindex: filtered,
  });
}

export default async function ListingsPage() {
  const items = await feedAllListings();

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <Suspense
          fallback={
            <div className="container-px py-20 text-center text-muted-foreground">
              Loading listings…
            </div>
          }
        >
          <ListingsBrowser items={items} />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
