import type { Metadata } from "next";
import Link from "next/link";
import { PenLine, BookOpenText, TrendingUp, ChevronRight } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { StoryCard } from "@/components/safarnama/story-card";
import { SafarnamaBrowser } from "@/components/safarnama/safarnama-browser";
import { getApprovedStories, type StoryRow } from "@/lib/safarnama";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Safarnama — Traveler Stories",
  description:
    "Real travel stories from Gilgit-Baltistan. Read honest experiences, road trips, budgets, tips and hidden gems shared by fellow travellers — and share your own Safarnama.",
  alternates: { canonical: "/safarnama" },
};

export default async function SafarnamaPage() {
  const stories = await getApprovedStories();
  const featured = stories.filter((s) => s.featured).slice(0, 3);
  const mostViewed = [...stories].sort((a, b) => b.views - a.views).slice(0, 3);

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div
              className="h-full w-full bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1591793442532-2f4a9d9f9f0b?w=1600&q=80')",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-forest-900 via-forest-900/80 to-forest-900/50" />
          </div>
          <div className="container-px py-16 sm:py-20">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              <BookOpenText className="h-4 w-4 text-gold" /> Safarnama
            </span>
            <h1 className="mt-4 max-w-3xl font-display text-3xl font-extrabold text-white sm:text-5xl">
              Traveler stories from Gilgit-Baltistan
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-white/85">
              Honest journeys, real budgets, road conditions and hidden gems — shared by travellers
              who&apos;ve been there. Get inspired, then tell your own Safarnama.
            </p>
            <Link
              href="/safarnama/create"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-5 py-3 font-semibold text-forest-900 shadow-soft transition-transform hover:-translate-y-0.5"
            >
              <PenLine className="h-5 w-5" /> Share your story
            </Link>
          </div>
        </section>

        {/* Featured */}
        {featured.length > 0 && (
          <Section title="Featured Safarnama" subtitle="Hand-picked journeys worth reading.">
            <Grid stories={featured} />
          </Section>
        )}

        {/* Most viewed */}
        {mostViewed.length > 0 && (
          <Section
            title="Most Viewed Stories"
            subtitle="What fellow travellers are reading right now."
            icon
          >
            <Grid stories={mostViewed} />
          </Section>
        )}

        {/* Browser with filters */}
        <section className="container-px py-10 sm:py-12">
          <h2 className="font-display text-xl font-bold uppercase text-forest sm:text-2xl">
            All stories
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search and filter by city or travel type.
          </p>
          <div className="mt-6">
            {stories.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-20 text-center">
                <BookOpenText className="mx-auto h-10 w-10 text-forest-600" />
                <p className="mt-3 font-display text-lg font-semibold text-forest">
                  No stories published yet
                </p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Be the first to share your Gilgit-Baltistan journey.
                </p>
                <Link
                  href="/safarnama/create"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-forest px-5 py-3 text-sm font-semibold text-white shadow-soft hover:opacity-95"
                >
                  <PenLine className="h-4 w-4" /> Write your story
                </Link>
              </div>
            ) : (
              <SafarnamaBrowser stories={stories} />
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="container-px py-10 sm:py-12">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase text-forest sm:text-2xl">
            {icon && <TrendingUp className="h-5 w-5 text-gold" />} {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <Link href="/safarnama" className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-forest-600 hover:text-gold sm:flex">
          View all <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function Grid({ stories }: { stories: StoryRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {stories.map((s) => (
        <StoryCard key={s.id} story={s} />
      ))}
    </div>
  );
}
