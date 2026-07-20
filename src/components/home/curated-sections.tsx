import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { getPlatformStats } from "@/lib/platform-stats";
import {
  ChevronRight,
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

export function RentalsSection() {
  return (
    <CuratedRow
      title="Rentals"
      subtitle="Rent what you need for the trip."
      viewAllHref="/categories/transport"
      viewAllLabel="View All Rentals"
      tinted
      items={[
        { title: "House Rental", desc: "Self-catering homes & villas", href: "/categories/homestays", icon: Home },
        { title: "Jeep Rental", desc: "4x4 vehicles with/without driver", href: "/categories/transport", icon: Car },
        { title: "Camera Rental", desc: "Pro cameras & gear", href: "/categories/photographers", icon: Camera },
        { title: "Camping Kit", desc: "Tents, sleeping bags & more", href: "/categories/transport", icon: Backpack },
      ]}
    />
  );
}

export function RoadsideSection() {
  return (
    <CuratedRow
      title="Roadside Assistance"
      subtitle="Help on the road, when you need it."
      viewAllHref="/categories/transport"
      viewAllLabel="View All Services"
      items={[
        { title: "Bike Puncture", desc: "On-spot bike tyre repair", href: "/categories/transport", icon: Bike },
        { title: "Car Puncture", desc: "Tyre repair & replacement", href: "/categories/transport", icon: Car },
        { title: "Fuel Delivery", desc: "Petrol/diesel to your location", href: "/categories/transport", icon: Fuel },
        { title: "Vehicle Recovery", desc: "Towing & breakdown recovery", href: "/categories/transport", icon: Truck },
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
