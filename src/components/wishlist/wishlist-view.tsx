"use client";

import Link from "next/link";
import { Heart } from "lucide-react";

import { ListingCard } from "@/components/home/listing-card";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/lib/wishlist";

export function WishlistView() {
  const { items } = useWishlist();

  return (
    <div className="container-px py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-forest text-gold shadow-premium">
          <Heart className="h-5 w-5 fill-gold" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold text-forest">
            Your wishlist
          </h1>
          <p className="text-sm text-muted-foreground">
            {items.length} saved {items.length === 1 ? "item" : "items"}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-border bg-muted/40 py-20 text-center">
          <Heart className="mx-auto h-12 w-12 text-forest-600" />
          <h2 className="mt-3 font-display text-lg font-bold text-forest">
            No saved items yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-muted-foreground">
            Tap the heart on any listing to save it here for later.
          </p>
          <Button asChild variant="gold" className="mt-6 rounded-lg">
            <Link href="/listings">Explore listings</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((listing, i) => (
            <ListingCard key={listing.id} listing={listing} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
