import type { Metadata } from "next";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { WishlistView } from "@/components/wishlist/wishlist-view";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Your saved hotels, homestays, tours and experiences on Rego.",
  robots: { index: false, follow: true },
};

export default function WishlistPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background">
        <WishlistView />
      </main>
      <Footer />
    </>
  );
}
