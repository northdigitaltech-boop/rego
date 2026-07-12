import type { Metadata } from "next";
import Link from "next/link";
import { Mountain, MapPin, Star, BadgeCheck, Clock, Users, Building2 } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import {
  getApprovedActivities,
  activityCategoryName,
  isActivityCategory,
  isIndoorActivity,
  ACTIVITY_CATEGORIES,
  INDOOR_ACTIVITY_CATEGORIES,
  type ActivityRow,
} from "@/lib/activities";
import { photo, formatPrice, cn } from "@/lib/utils";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Activities & Adventures",
  description:
    "Book activities across Gilgit-Baltistan — camping, trekking, hiking, jeep safari, horse riding, fishing, boating and cultural tours from trusted local operators.",
  alternates: { canonical: "/activities" },
};

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const rawCat = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const rawKind = Array.isArray(sp.kind) ? sp.kind[0] : sp.kind;
  const kind: "outdoor" | "indoor" = rawKind === "indoor" ? "indoor" : "outdoor";

  // Fetch all approved once, then partition by kind + category in-page.
  const all = await getApprovedActivities();
  const inKind = all.filter((a) => (kind === "indoor" ? isIndoorActivity(a.category) : !isIndoorActivity(a.category)));

  // Category valid only within the active kind.
  const cats = kind === "indoor" ? INDOOR_ACTIVITY_CATEGORIES : ACTIVITY_CATEGORIES;
  const category = rawCat && isActivityCategory(rawCat) && cats.some((c) => c.slug === rawCat) ? rawCat : "";

  const activities = category ? inKind.filter((a) => a.category === category) : inKind;
  const countFor = (slug: string) => inKind.filter((a) => a.category === slug).length;

  const outdoorCount = all.filter((a) => !isIndoorActivity(a.category)).length;
  const indoorCount = all.filter((a) => isIndoorActivity(a.category)).length;

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <section className="bg-gradient-forest text-white">
          <div className="container-px py-14">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <Mountain className="h-4 w-4" /> Activities &amp; Adventures
            </span>
            <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold uppercase sm:text-4xl">
              Adventures across Gilgit-Baltistan
            </h1>
            <p className="mt-3 max-w-2xl text-white/85">
              Explore the outdoors — camping, trekking, jeep safaris and more — or discover indoor
              experiences like studios, gaming zones, pools and workshops.
            </p>
          </div>
        </section>

        {/* Outdoor / Indoor tabs */}
        <section className="container-px pt-8">
          <div className="inline-flex rounded-2xl border border-border bg-card p-1 shadow-premium">
            <Tab href="/activities" active={kind === "outdoor"} icon={Mountain} label={`Outdoor Activities (${outdoorCount})`} />
            <Tab href="/activities?kind=indoor" active={kind === "indoor"} icon={Building2} label={`Indoor Activities & Experiences (${indoorCount})`} />
          </div>
        </section>

        {/* Category chips for the active kind */}
        <section className="container-px pt-5">
          <div className="flex flex-wrap gap-2">
            <Chip href={kind === "indoor" ? "/activities?kind=indoor" : "/activities"} active={!category} label={`All (${inKind.length})`} />
            {cats.map((c) => (
              <Chip
                key={c.slug}
                href={kind === "indoor" ? `/activities?kind=indoor&category=${c.slug}` : `/activities?category=${c.slug}`}
                active={category === c.slug}
                label={`${c.name} (${countFor(c.slug)})`}
              />
            ))}
          </div>
        </section>

        <section className="container-px pb-16 pt-6">
          <h2 className="font-display text-xl font-bold uppercase text-forest sm:text-2xl">
            {category
              ? activityCategoryName(category)
              : kind === "indoor"
                ? "Indoor activities & experiences"
                : "Outdoor activities"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{activities.length} {kind === "indoor" ? "experience" : "activit"}{kind === "indoor" ? (activities.length === 1 ? "" : "s") : (activities.length === 1 ? "y" : "ies")}</p>

          {activities.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-border bg-muted/40 py-20 text-center">
              {kind === "indoor" ? <Building2 className="mx-auto h-10 w-10 text-forest-600" /> : <Mountain className="mx-auto h-10 w-10 text-forest-600" />}
              <p className="mt-3 font-display text-lg font-semibold text-forest">
                No {kind === "indoor" ? "indoor experiences" : "activities"} listed yet
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {kind === "indoor"
                  ? "Studios, clubs, pools and workshops are being added soon. Check back shortly."
                  : "Adventure operators and guides are adding experiences soon. Check back shortly."}
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {activities.map((a) => <Card key={a.id} activity={a} />)}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function Tab({ href, active, icon: Icon, label }: { href: string; active: boolean; icon: typeof Mountain; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
        active ? "bg-gradient-forest text-white shadow-soft" : "text-forest hover:bg-muted"
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}

function Chip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
        active ? "border-forest-600 bg-gradient-forest text-white" : "border-border bg-card text-forest hover:bg-muted"
      )}
    >
      {label}
    </Link>
  );
}

function waLink(n?: string | null) {
  const d = (n ?? "").replace(/[^\d]/g, "");
  return d ? `https://wa.me/${d}` : "";
}

function Card({ activity: a }: { activity: ActivityRow }) {
  const wa = waLink(a.whatsapp);
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-all duration-300 hover:-translate-y-1.5 hover:shadow-premium-lg">
      <Link href={`/activities/${a.id}`} className="block">
        <div className="relative h-44 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo(a.image || "https://picsum.photos/seed/activity/900/600")}
            alt={a.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-forest-600 backdrop-blur">
            {activityCategoryName(a.category)}
          </span>
          {a.verified && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-forest-600 backdrop-blur">
              <BadgeCheck className="h-3 w-3 text-gold" /> Verified
            </span>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link href={`/activities/${a.id}`}>
          <h3 className="font-display text-base font-bold leading-snug text-forest group-hover:text-forest-600">{a.title}</h3>
        </Link>
        {a.business_name && <p className="text-xs font-medium text-forest-600">by {a.business_name}</p>}
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-gold text-gold" />
          <span className="font-semibold text-forest">{Number(a.rating).toFixed(1)}</span>
          <span>({a.reviews})</span>
          <span className="ml-auto flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {a.location || a.city || "Gilgit Baltistan"}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {isIndoorActivity(a.category) ? (
            <>
              {a.opening_hours && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {a.opening_hours}</span>}
              {a.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {a.city}</span>}
            </>
          ) : (
            <>
              {a.duration && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {a.duration}</span>}
              {a.difficulty && <span className="capitalize">· {a.difficulty}</span>}
              {(a.group_size_max || a.group_size_min) && (
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {a.group_size_min ?? 1}–{a.group_size_max ?? "∞"}</span>
              )}
            </>
          )}
        </div>
        {a.description && (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{a.description}</p>
        )}
        <div className="mt-3 flex items-center justify-between pt-1">
          <span className="font-display text-sm font-bold text-forest">
            {a.price > 0 ? <>{formatPrice(a.price)}<span className="text-xs font-normal text-muted-foreground"> / {a.price_unit}</span></> : "Enquire"}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Link
            href={`/activities/${a.id}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-forest px-3 py-2 text-sm font-semibold text-white shadow-soft hover:opacity-95"
          >
            View Details
          </Link>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Book on WhatsApp"
              className="flex items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-100"
            >
              WhatsApp
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
