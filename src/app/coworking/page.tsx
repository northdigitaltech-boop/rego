import type { Metadata } from "next";
import Link from "next/link";
import {
  Wifi,
  MapPin,
  Star,
  BadgeCheck,
  Briefcase,
  Users,
  Clock,
} from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { getApprovedCoworking, fromPrice, type CoworkingSpaceRow } from "@/lib/coworking";
import { photo, formatPrice } from "@/lib/utils";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Co-working Spaces",
  description:
    "Work remotely from Gilgit-Baltistan. Find co-working spaces, hot desks, private offices and day passes with fast WiFi — ideal for freelancers and remote workers.",
  alternates: { canonical: "/coworking" },
};

export default async function CoworkingPage() {
  const spaces = await getApprovedCoworking();

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <section className="bg-gradient-forest text-white">
          <div className="container-px py-14">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <Briefcase className="h-4 w-4" /> Work &amp; Stay
            </span>
            <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold uppercase sm:text-4xl">
              Co-working spaces in the mountains
            </h1>
            <p className="mt-3 max-w-2xl text-white/85">
              Spend time in Gilgit-Baltistan without pausing your work. Book a hot desk, private
              office or day pass with reliable WiFi — perfect for freelancers and remote teams.
            </p>
          </div>
        </section>

        <section className="container-px py-12">
          <h2 className="font-display text-xl font-bold uppercase text-forest sm:text-2xl">
            Available spaces
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {spaces.length} verified space{spaces.length === 1 ? "" : "s"}
          </p>

          {spaces.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-border bg-muted/40 py-20 text-center">
              <Briefcase className="mx-auto h-10 w-10 text-forest-600" />
              <p className="mt-3 font-display text-lg font-semibold text-forest">
                No co-working spaces listed yet
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Providers are joining soon. Check back to find a desk for your next remote-work trip.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {spaces.map((s) => (
                <SpaceCard key={s.id} space={s} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function SpaceCard({ space: s }: { space: CoworkingSpaceRow }) {
  const price = fromPrice(s);
  return (
    <Link
      href={`/coworking/${s.id}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-all duration-300 hover:-translate-y-1.5 hover:shadow-premium-lg"
    >
      <div className="relative h-44 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo(s.cover_image || s.logo || "https://picsum.photos/seed/cowork/900/600")}
          alt={s.name}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        {s.verified && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-forest-600 backdrop-blur">
            <BadgeCheck className="h-3 w-3 text-gold" /> Verified
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-base font-bold leading-snug text-forest">{s.name}</h3>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-gold text-gold" />
          <span className="font-semibold text-forest">{Number(s.rating).toFixed(1)}</span>
          <span>({s.reviews})</span>
          <span className="ml-auto flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {s.city || "Gilgit Baltistan"}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {s.wifi_speed && (
            <span className="flex items-center gap-1">
              <Wifi className="h-3.5 w-3.5" /> {s.wifi_speed}
            </span>
          )}
          {s.seating_capacity != null && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {s.seating_capacity} seats
            </span>
          )}
          {s.opening_hours && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {s.opening_hours}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between pt-1">
          <span className="font-display text-sm font-bold text-forest">
            {price ? (
              <>
                From {formatPrice(price.amount)}
                <span className="text-xs font-normal text-muted-foreground"> / {price.unit}</span>
              </>
            ) : (
              "Enquire for price"
            )}
          </span>
          <span className="text-sm font-semibold text-forest-600 group-hover:text-gold">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}
