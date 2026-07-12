import Link from "next/link";
import { MapPin, CalendarDays, Clock, Eye, MessageCircle, BadgeCheck } from "lucide-react";

import { StoryActions } from "@/components/safarnama/story-actions";
import { travelTypeLabel, type StoryRow } from "@/lib/safarnama";
import { photo } from "@/lib/utils";

function fmtDate(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function StoryCard({ story: s }: { story: StoryRow }) {
  const cover =
    s.cover_image ||
    (s.gallery && s.gallery[0]) ||
    "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=900&q=80";
  const avatar = s.author_avatar || "https://i.pravatar.cc/100?u=" + s.id;

  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-all duration-300 hover:-translate-y-1.5 hover:shadow-premium-lg">
      <Link href={`/safarnama/${s.id}`} className="relative block h-44 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo(cover)} alt={s.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-900/50 to-transparent" />
        {s.travel_type && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-forest-600 backdrop-blur">
            {travelTypeLabel(s.travel_type)}
          </span>
        )}
        {s.featured && (
          <span className="absolute right-3 top-3 rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold uppercase text-forest-900 shadow">
            Featured
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {/* Author */}
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo(avatar)} alt={s.author_name ?? ""} className="h-7 w-7 rounded-full object-cover" />
          <span className="flex items-center gap-1 text-xs font-semibold text-forest">
            {s.author_name || "Traveller"}
            {s.verified && <BadgeCheck className="h-3.5 w-3.5 text-gold" />}
          </span>
        </div>

        <Link href={`/safarnama/${s.id}`} className="mt-2">
          <h3 className="line-clamp-2 font-display text-base font-bold leading-snug text-forest group-hover:text-forest-600">
            {s.title}
          </h3>
        </Link>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {s.destination && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {s.destination}
            </span>
          )}
          {s.trip_date && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> {fmtDate(s.trip_date)}
            </span>
          )}
        </div>

        {(s.preview || s.story) && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {s.preview || s.story}
          </p>
        )}

        {/* Meta */}
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.reading_time} min</span>
          <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {s.views}</span>
          <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {s.comments}</span>
        </div>

        {/* Footer actions */}
        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
          <StoryActions storyId={s.id} title={s.title} initialLikes={s.likes} compact />
          <Link href={`/safarnama/${s.id}`} className="text-sm font-semibold text-forest-600 group-hover:text-gold">
            Read Story →
          </Link>
        </div>
      </div>
    </article>
  );
}
