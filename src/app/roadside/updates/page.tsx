import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, TriangleAlert } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { RoadUpdates } from "@/components/roadside/road-updates";

export const metadata: Metadata = {
  title: "Road Updates & Alerts",
  description:
    "Live road condition updates for Gilgit-Baltistan — Karakoram Highway, Gilgit–Skardu, Babusar Top, Chilas, Hunza, Astore, Deosai and Khunjerab Pass. Status, blockages, safety messages and alternative routes.",
  alternates: { canonical: "/roadside/updates" },
};

export default function RoadUpdatesPage() {
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
          <RoadUpdates />
        </section>
      </main>
      <Footer />
    </>
  );
}
