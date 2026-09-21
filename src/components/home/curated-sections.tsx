import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { getPlatformStats } from "@/lib/platform-stats";
import { getRentalCounts, rentalTypeSlug, type RentalType } from "@/lib/rentals";
import {
  ChevronRight,
  Building2,
  Mountain,
  Tent,
  Car,
  Sailboat,
  Home,
  Camera,
  Backpack,
  Bike,
  Fuel,
  Truck,
  CalendarDays,
  Music,
  Sparkles,
  Flag,
  type LucideIcon,
} from "lucide-react";

interface Item {
  title: string;
  desc: string;
  href: string;
  icon: LucideIcon;
}

function CuratedRow({
  title,
  subtitle,
  items,
  viewAllHref,
  viewAllLabel,
  tinted,
}: {
  title: string;
  subtitle?: string;
  items: Item[];
  viewAllHref: string;
  viewAllLabel: string;
  tinted?: boolean;
}) {
  return (
    <section className={tinted ? "bg-forest-50/40 py-12 sm:py-16" : "bg-background py-12 sm:py-16"}>
      <div className="container-px">
        <Reveal className="mb-6 flex flex-col items-start gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold uppercase leading-tight text-forest sm:text-2xl lg:text-3xl">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <Link
            href={viewAllHref}
            className="group inline-flex shrink-0 items-center gap-1 rounded-lg py-1 text-sm font-semibold text-forest-600 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            {viewAllLabel}
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <Link
                key={it.title}
                href={it.href}
                className="group flex flex-col rounded-3xl border border-border/70 bg-card p-5 shadow-premium transition-all duration-300 hover:-translate-y-1.5 hover:shadow-premium-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-forest text-gold transition-transform duration-300 group-hover:scale-110">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-3 font-display text-base font-bold text-forest">{it.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{it.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ActivitiesSection() {
  return (
    <CuratedRow
      title="Activities"
      subtitle="Adventures across Gilgit-Baltistan."
      viewAllHref="/categories/activities"
      viewAllLabel="View All Activities"
      items={[
        { title: "Trekking", desc: "Multi-day Karakoram treks", href: "/categories/trekking", icon: Mountain },
        { title: "Camping", desc: "Overnight camps under the stars", href: "/categories/camping", icon: Tent },
        { title: "Jeep Safari", desc: "4x4 to remote valleys", href: "/categories/jeep-safari", icon: Car },
        { title: "Boating", desc: "Rides on turquoise lakes", href: "/categories/boating", icon: Sailboat },
      ]}
    />
  );
}

/* ------------------------------------------------------------------
   Homepage Rentals row.

   Every tile used to point at a category page that was only roughly
   related — Camera Rental went to the photographers list, Camping Kit
   went to Transport — because there was nowhere better to send them.
   They now go to the matching /rentals filter.

   The four shown are the four with the most listings, so the row
   follows what providers have actually listed instead of a fixed
   guess. Counts are real or absent: a tile with nothing behind it
   says what it is and nothing more, rather than "0 listings" or an
   invented number.
   ------------------------------------------------------------------ */
const RENTAL_TILES: { type: RentalType; title: string; desc: string; icon: LucideIcon }[] = [
  { type: "jeep_4x4", title: "Jeep & 4x4", desc: "High-clearance vehicles for rough roads", icon: Car },
  { type: "car", title: "Car Rental", desc: "Self-drive and chauffeured cars", icon: Car },
  { type: "bike", title: "Bike Rental", desc: "Motorbikes for the valleys", icon: Bike },
  { type: "camera", title: "Camera Rental", desc: "Bodies, lenses and drones", icon: Camera },
  { type: "camping_equipment", title: "Camping Kit", desc: "Tents, bags and trekking gear", icon: Backpack },
  { type: "house", title: "House Rental", desc: "Whole homes and holiday lets", icon: Home },
  { type: "coworking_space", title: "Co-working Space", desc: "Desks, offices and meeting rooms", icon: Building2 },
];

export async function RentalsSection() {
  const counts = await getRentalCounts().catch(() => ({} as Record<string, number>));

  const ranked = [...RENTAL_TILES].sort(
    (a, b) => (counts[b.type] ?? 0) - (counts[a.type] ?? 0)
  );

  const items: Item[] = ranked.slice(0, 4).map((t) => {
    const n = counts[t.type] ?? 0;
    return {
      title: t.title,
      desc: n > 0 ? `${n} listing${n === 1 ? "" : "s"} · ${t.desc}` : t.desc,
      href: `/rentals?type=${rentalTypeSlug(t.type)}`,
      icon: t.icon,
    };
  });

  return (
    <CuratedRow
      title="Rentals"
      subtitle="Rent what you need for the trip."
      viewAllHref="/rentals"
      viewAllLabel="View All Rentals"
      tinted
      items={items}
    />
  );
}

export function RoadsideSection() {
  return (
    <CuratedRow
      title="Roadside Assistance"
      subtitle="Help on the road, when you need it."
      viewAllHref="/roadside"
      viewAllLabel="View All Services"
      items={[
        { title: "Bike Puncture", desc: "On-spot bike tyre repair", href: "/roadside/bike-puncture", icon: Bike },
        { title: "Car Puncture", desc: "Tyre repair & replacement", href: "/roadside/car-puncture", icon: Car },
        { title: "Fuel Delivery", desc: "Petrol/diesel to your location", href: "/roadside/fuel-delivery", icon: Fuel },
        { title: "Vehicle Recovery", desc: "Towing & breakdown recovery", href: "/roadside/vehicle-recovery", icon: Truck },
      ]}
    />
  );
}

export function EventsSection() {
  return (
    <CuratedRow
      title="Events & Festivals"
      subtitle="Experience GB's culture and celebrations."
      viewAllHref="/destinations"
      viewAllLabel="View All Events"
      tinted
      items={[
        { title: "Shandur Polo Festival", desc: "The world's highest polo ground", href: "/destinations", icon: Flag },
        { title: "Silk Route Festival", desc: "Culture along the Karakoram", href: "/destinations", icon: Sparkles },
        { title: "Spring Blossom", desc: "Cherry & apricot blossoms", href: "/destinations", icon: CalendarDays },
        { title: "Local Music Nights", desc: "Traditional GB performances", href: "/destinations", icon: Music },
      ]}
    />
  );
}

export async function PlatformStats() {
  // Real, live counts from the database — auto-updates as providers register
  // and bookings happen. Stats at 0 are hidden; if everything is 0 the band
  // is hidden entirely (never show fake or empty numbers).
  const stats = (await getPlatformStats()).filter((s) => s.value > 0);
  if (stats.length === 0) return null;

  const cols =
    stats.length >= 4 ? "lg:grid-cols-4" : stats.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";

  return (
    <section className="bg-gradient-forest py-12 text-white sm:py-16">
      <div className="container-px">
        <Reveal className={`grid grid-cols-2 gap-6 ${cols}`}>
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-display text-3xl font-bold text-gold sm:text-4xl">
                {s.value.toLocaleString()}
              </p>
              <p className="mt-1 text-sm font-medium text-white/80">{s.label}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
