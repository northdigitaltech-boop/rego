import Link from "next/link";
import {
  Star,
  MapPin,
  BadgeCheck,
  Compass,
  ShieldCheck,
  CalendarDays,
  Users,
} from "lucide-react";

import { SoloConnectButton } from "@/components/solo/profile-actions";
import { computeTrustScore, type SoloTravelerRow } from "@/lib/solo";
import { photo } from "@/lib/utils";

function fmtDate(d: string | null): string {
  if (!d) return "Flexible";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Premium traveller card for the /connect browse grid and home section. */
export function TravelerCard({ t }: { t: SoloTravelerRow }) {
  const trust = computeTrustScore(t);
  const dest = (t.destinations ?? []).slice(0, 2);
  const cover =
    t.cover_image ||
    "https://images.unsplash.com/photo-1626621341517-bbf3d33990ef?w=900&q=80";
  const avatar = t.profile_photo || "https://i.pravatar.cc/200?u=" + t.id;

  return (
    <Link
      href={`/connect/${t.id}`}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-all duration-300 hover:-translate-y-1.5 hover:shadow-premium-lg"
    >
      {/* Cover */}
      <div className="relative h-28 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo(cover)}
          alt=""
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-900/60 to-transparent" />
        {t.solo_badge && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-forest-600 backdrop-blur">
            <Compass className="h-3 w-3 text-gold" /> Solo
          </span>
        )}
        {t.online && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-green-500/90 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-white" /> Online
          </span>
        )}
      </div>

      {/* Avatar + identity */}
      <div className="flex flex-1 flex-col px-4 pb-4">
        <div className="-mt-8 flex items-end gap-3">
          <span className="relative z-10 block h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-forest-100 shadow-premium">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo(avatar)}
              alt={t.full_name}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </span>
          <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-xs font-bold text-forest shadow-sm">
            <Star className="h-3.5 w-3.5 fill-gold text-gold" />
            {Number(t.rating).toFixed(1)}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <h3 className="line-clamp-1 font-display text-base font-bold text-forest">
            {t.full_name}
            {t.age ? <span className="font-normal text-muted-foreground">, {t.age}</span> : null}
          </h3>
          {t.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-gold" />}
        </div>
        <p className="text-xs text-muted-foreground">
          {[t.nationality, t.current_city].filter(Boolean).join(" · ") || "Traveller"}
        </p>

        {/* Destinations */}
        {dest.length > 0 && (
          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-forest">
            <MapPin className="h-3.5 w-3.5 text-forest-600" /> {dest.join(", ")}
            {(t.destinations?.length ?? 0) > 2 && (
              <span className="text-muted-foreground"> +{(t.destinations!.length) - 2}</span>
            )}
          </p>
        )}

        {/* Dates + seats */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" /> {fmtDate(t.departure_date)}
          </span>
          {t.available_seats != null && t.available_seats > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {t.available_seats} seat
              {t.available_seats === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {/* Looking for */}
        {(t.looking_for?.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {t.looking_for!.slice(0, 2).map((l) => (
              <span
                key={l}
                className="rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-semibold text-forest-600"
              >
                {l}
              </span>
            ))}
          </div>
        )}

        {/* Trust score footer */}
        <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-forest">
            <ShieldCheck className="h-3.5 w-3.5 text-green-600" /> {trust}% trust
          </span>
          <span className="text-sm font-semibold text-forest-600 group-hover:text-gold">
            View →
          </span>
        </div>

        {/* Connect / Travel Partner */}
        <div className="mt-3">
          <SoloConnectButton traveler={t} className="w-full py-2 text-sm" />
        </div>
      </div>
    </Link>
  );
}
