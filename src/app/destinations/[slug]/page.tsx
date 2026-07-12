import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ListingsBrowser } from "@/components/listings/listings-browser";
import { destinations } from "@/lib/data";
import { getDestinationBySlug } from "@/lib/destinations";
import { photo, cn } from "@/lib/utils";

const QUICK_FILTERS = [
  { slug: "", label: "All" },
  { slug: "hotels", label: "Hotels" },
  { slug: "homestays", label: "Homestays" },
  { slug: "tours", label: "Tours" },
  { slug: "transport", label: "Transport" },
  { slug: "guides", label: "Guides" },
  { slug: "restaurants", label: "Restaurants" },
];

// Pre-render the built-in destinations; admin-added ones render on demand.
export function generateStaticParams() {
  return destinations.map((d) => ({ slug: d.slug }));
}

// Always fetch fresh destination data from the database.
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const destination = await getDestinationBySlug(slug);
  if (!destination) return { title: "Destination not found" };
  const description = `${destination.tagline}. Find hotels, tours and more in ${destination.name}, Gilgit Baltistan.`;
  return {
    title: destination.name,
    description,
    alternates: { canonical: `/destinations/${slug}` },
    openGraph: {
      title: `${destination.name} — Rego`,
      description,
      url: `/destinations/${slug}`,
      type: "website",
      images: destination.image ? [{ url: destination.image }] : undefined,
    },
  };
}

export default async function DestinationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const activeCat = (Array.isArray(sp.category) ? sp.category[0] : sp.category) ?? "";
  const destination = await getDestinationBySlug(slug);
  if (!destination) notFound();

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url('${photo(destination.image)}')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-forest-900/90 via-forest-900/50 to-forest-900/40" />
          </div>
          <div className="container-px flex min-h-[320px] flex-col justify-end py-10">
            <span className="flex items-center gap-1.5 text-sm font-medium text-gold">
              <MapPin className="h-4 w-4" /> Gilgit Baltistan
            </span>
            <h1 className="mt-2 font-display text-4xl font-extrabold text-white sm:text-5xl">
              {destination.name}
            </h1>
            <p className="mt-2 max-w-xl text-lg text-white/85">
              {destination.tagline}
            </p>
            <p className="mt-1 text-sm font-semibold text-gold">
              {destination.stays}
            </p>

            {/* Quick service filters — set the browser's category via the URL */}
            <div className="mt-5 flex flex-wrap gap-2">
              {QUICK_FILTERS.map((f) => {
                const active = activeCat === f.slug;
                const href = f.slug
                  ? `/destinations/${slug}?category=${f.slug}`
                  : `/destinations/${slug}`;
                return (
                  <Link
                    key={f.label}
                    href={href}
                    scroll={false}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm font-semibold backdrop-blur transition-colors",
                      active
                        ? "border-gold bg-gold text-forest-900"
                        : "border-white/40 bg-white/10 text-white hover:bg-white/20"
                    )}
                  >
                    {f.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <Suspense
          fallback={
            <div className="container-px py-20 text-center text-muted-foreground">
              Loading…
            </div>
          }
        >
          <ListingsBrowser initialLocation={destination.location} hideHeader />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
