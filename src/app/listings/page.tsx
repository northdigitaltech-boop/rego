import { Suspense } from "react";
import type { Metadata } from "next";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ListingsBrowser } from "@/components/listings/listings-browser";
import { feedAllListings } from "@/lib/home-feed";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Explore Listings",
  description:
    "Browse hotels, homestays, tours, transport, guides, photographers and activities across Gilgit Baltistan.",
};

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
