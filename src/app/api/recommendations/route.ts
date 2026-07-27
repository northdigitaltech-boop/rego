import { NextResponse } from "next/server";

import {
  feedHotels,
  feedPackages,
  feedGuides,
  feedRestaurants,
  feedPhotographers,
  feedCompanies,
} from "@/lib/home-feed";
import { type Listing } from "@/lib/data";

// Recommendations are the same for everyone (top-rated + featured verified
// listings), so they can be cached and shared. Refreshed every 5 minutes.
export const revalidate = 300;

export interface RecItem {
  id: string;
  title: string;
  categoryLabel: string;
  location: string;
  rating: number;
  price: number;
  unit: string;
  image: string;
  href: string;
}

function toRec(l: Listing): RecItem {
  return {
    id: l.id,
    title: l.title,
    categoryLabel: l.categoryLabel,
    location: l.location,
    rating: Number(l.rating) || 0,
    price: Number(l.price) || 0,
    unit: l.unit,
    image: l.image,
    href: `/listings/${l.id}`,
  };
}

export async function GET() {
  try {
    const [hotels, packages, guides, restaurants, photographers, companies] =
      await Promise.all([
        feedHotels(3),
        feedPackages(2),
        feedGuides(2),
        feedRestaurants(2),
        feedPhotographers(2),
        feedCompanies(2),
      ]);

    // Interleave categories so the list feels varied, then keep the best 8.
    const pools = [hotels, packages, companies, guides, photographers, restaurants];
    const mixed: Listing[] = [];
    for (let i = 0; i < 4; i++) {
      for (const pool of pools) {
        if (pool[i]) mixed.push(pool[i]);
      }
    }

    const seen = new Set<string>();
    const items = mixed
      .filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)))
      .slice(0, 8)
      .map(toRec);

    return NextResponse.json({ ok: true, items });
  } catch {
    return NextResponse.json({ ok: false, items: [] as RecItem[] });
  }
}
