import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  MapPin,
  CalendarDays,
  Clock,
  Eye,
  Star,
  BadgeCheck,
  Wallet,
  Car,
  Hotel,
  Utensils,
  Route as RouteIcon,
  Lightbulb,
  Heart as HeartIcon,
  TriangleAlert,
  Sparkles,
  MapPinned,
} from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { StoryActions } from "@/components/safarnama/story-actions";
import { StoryComments } from "@/components/safarnama/story-comments";
import { StoryViewBump } from "@/components/safarnama/view-bump";
import { StoryCard } from "@/components/safarnama/story-card";
import {
  getStoryById,
  getRelatedStories,
  travelTypeLabel,
} from "@/lib/safarnama";
import { photo } from "@/lib/utils";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const s = await getStoryById(id);
  if (!s) return { title: "Safarnama story" };
  return {
    title: `${s.title} — Safarnama`,
    description: (s.preview || s.story || s.title).slice(0, 160),
    alternates: { canonical: `/safarnama/${id}` },
  };
}

function fmtDate(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export default async function StoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await getStoryById(id);
  if (!s || s.status !== "approved") notFound();

  const related = await getRelatedStories(s);
  const cover = s.cover_image || (s.gallery && s.gallery[0]) || "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=1600&q=80";
  const avatar = s.author_avatar || "https://i.pravatar.cc/150?u=" + s.id;

  return (
    <>
      <Navbar />
      <StoryViewBump storyId={s.id} />
      <main className="min-h-screen pb-16">
        {/* Cover */}
        <div className="relative h-72 w-full overflow-hidden sm:h-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo(cover)} alt={s.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-forest-900/90 via-forest-900/30 to-transparent" />
          <div className="container-px absolute inset-x-0 top-0 pt-5">
            <Link href="/safarnama" className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-forest-600 backdrop-blur hover:text-gold">
              <ChevronLeft className="h-4 w-4" /> All stories
            </Link>
          </div>
          <div className="container-px absolute inset-x-0 bottom-0 pb-6">
            {s.travel_type && (
              <span className="inline-block rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-forest-600">
                {travelTypeLabel(s.travel_type)}
              </span>
            )}
            <h1 className="mt-2 max-w-4xl font-display text-3xl font-extrabold text-white sm:text-5xl">
              {s.title}
            </h1>
          </div>
        </div>

        <div className="container-px mt-6 grid gap-10 lg:grid-cols-[1fr_320px]">
          {/* Main */}
          <div className="order-2 min-w-0 space-y-8 lg:order-1">
            {/* Author + meta */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo(avatar)} alt={s.author_name ?? ""} className="h-12 w-12 rounded-full object-cover" />
                <div>
                  <p className="flex items-center gap-1.5 font-display text-base font-bold text-forest">
                    {s.author_name || "Traveller"}
                    {s.verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-semibold text-forest-600">
                        <BadgeCheck className="h-3 w-3 text-gold" /> Verified Traveller
                      </span>
                    )}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {s.destination && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {s.destination}</span>}
                    {s.trip_date && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {fmtDate(s.trip_date)}</span>}
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.reading_time} min read</span>
                    <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {s.views} views</span>
                  </div>
                </div>
              </div>
              {s.rating > 0 && (
                <span className="inline-flex items-center gap-1 rounded-xl bg-gold/15 px-3 py-1.5 text-sm font-bold text-gold-700">
                  <Star className="h-4 w-4 fill-gold text-gold" /> {Number(s.rating).toFixed(1)} / 5
                </span>
              )}
            </div>

            <StoryActions storyId={s.id} title={s.title} initialLikes={s.likes} />

            {/* Full story */}
            {s.story && (
              <section>
                <p className="whitespace-pre-line text-[15px] leading-relaxed text-forest/90">{s.story}</p>
              </section>
            )}

            {/* Best experience / problems */}
            {(s.best_experience || s.problems_faced) && (
              <section className="grid gap-4 sm:grid-cols-2">
                {s.best_experience && (
                  <Callout icon={Sparkles} tone="gold" title="Best experience">{s.best_experience}</Callout>
                )}
                {s.problems_faced && (
                  <Callout icon={TriangleAlert} tone="amber" title="Problems faced">{s.problems_faced}</Callout>
                )}
              </section>
            )}

            {/* Trip timeline */}
            {(s.timeline?.length ?? 0) > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Trip timeline</h2>
                <ol className="mt-4 space-y-4 border-l-2 border-forest-100 pl-5">
                  {s.timeline!.map((t, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-card bg-forest-600" />
                      <p className="font-semibold text-forest">{t.title}</p>
                      {t.date && <p className="text-xs text-gold-700">{t.date}</p>}
                      {t.note && <p className="mt-0.5 text-sm text-muted-foreground">{t.note}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Places visited */}
            {(s.places_visited?.length ?? 0) > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Places visited</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.places_visited!.map((p) => (
                    <span key={p} className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-3 py-1 text-sm font-medium text-forest-600">
                      <MapPinned className="h-3.5 w-3.5" /> {p}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Budget breakdown */}
            {(s.budget_breakdown?.length ?? 0) > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Budget breakdown</h2>
                <div className="mt-3 overflow-hidden rounded-2xl border border-border">
                  <table className="w-full text-sm">
                    <tbody>
                      {s.budget_breakdown!.map((b, i) => (
                        <tr key={i} className="border-b border-border/60 last:border-0">
                          <td className="px-4 py-2.5 text-muted-foreground">{b.label}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-forest">{b.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Gallery */}
            {(s.gallery?.length ?? 0) > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Photo gallery</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {s.gallery!.map((g, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={photo(g)} alt="" className="h-36 w-full rounded-2xl object-cover" />
                  ))}
                </div>
              </section>
            )}

            {/* Videos */}
            {(s.videos?.length ?? 0) > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Video</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {s.videos!.map((v, i) => (
                    <video key={i} src={v} controls className="w-full rounded-2xl" />
                  ))}
                </div>
              </section>
            )}

            {/* Recommendations */}
            {((s.hotels?.length ?? 0) > 0 || (s.restaurants?.length ?? 0) > 0) && (
              <section className="grid gap-6 sm:grid-cols-2">
                {(s.hotels?.length ?? 0) > 0 && (
                  <RecoList icon={Hotel} title="Recommended hotels" items={s.hotels!} />
                )}
                {(s.restaurants?.length ?? 0) > 0 && (
                  <RecoList icon={Utensils} title="Recommended restaurants" items={s.restaurants!} />
                )}
              </section>
            )}

            {/* Road + tips + food */}
            {s.road_condition && (
              <Callout icon={RouteIcon} tone="forest" title="Road condition notes">{s.road_condition}</Callout>
            )}
            {s.food_recommendations && (
              <Callout icon={Utensils} tone="forest" title="Food recommendations">{s.food_recommendations}</Callout>
            )}
            {s.travel_tips && (
              <Callout icon={Lightbulb} tone="gold" title="Travel tips">{s.travel_tips}</Callout>
            )}

            {/* Comments */}
            <StoryComments storyId={s.id} />
          </div>

          {/* Sidebar */}
          <aside className="order-1 lg:order-2">
            <div className="space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-premium-lg lg:sticky lg:top-28">
              <p className="font-display text-base font-bold text-forest">Trip facts</p>
              <div className="space-y-2.5 text-sm">
                {s.destination && <Fact icon={MapPin} label="Destination" value={s.destination} />}
                {s.city && <Fact icon={MapPinned} label="City" value={s.city} />}
                {s.trip_date && <Fact icon={CalendarDays} label="Trip date" value={fmtDate(s.trip_date)} />}
                {s.duration && <Fact icon={Clock} label="Duration" value={s.duration} />}
                {s.travel_type && <Fact icon={Sparkles} label="Travel type" value={travelTypeLabel(s.travel_type)} />}
                {s.budget && <Fact icon={Wallet} label="Budget" value={s.budget} />}
                {s.transportation && <Fact icon={Car} label="Transport" value={s.transportation} />}
                <div className="flex items-center gap-4 border-t border-border pt-3 text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><HeartIcon className="h-4 w-4" /> {s.likes}</span>
                  <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" /> {s.views}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {s.reading_time} min</span>
                </div>
              </div>
              <Link
                href="/safarnama/create"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-forest px-4 py-3 text-sm font-semibold text-white shadow-soft hover:opacity-95"
              >
                Share your own story
              </Link>
            </div>
          </aside>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="container-px mt-14">
            <h2 className="font-display text-xl font-bold uppercase text-forest sm:text-2xl">Related stories</h2>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <StoryCard key={r.id} story={r} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}

/* ---------------- helpers ---------------- */

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <span className="max-w-[60%] text-right font-medium text-forest">{value}</span>
    </div>
  );
}

function Callout({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: React.ElementType;
  title: string;
  tone: "gold" | "amber" | "forest";
  children: React.ReactNode;
}) {
  const map = {
    gold: "border-gold/30 bg-gold/5",
    amber: "border-amber-200 bg-amber-50",
    forest: "border-forest-100 bg-forest-50/60",
  } as const;
  return (
    <div className={`rounded-2xl border p-5 ${map[tone]}`}>
      <p className="flex items-center gap-2 font-display text-base font-bold text-forest">
        <Icon className="h-4 w-4 text-forest-600" /> {title}
      </p>
      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function RecoList({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ElementType;
  title: string;
  items: string[];
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 font-display text-base font-bold text-forest">
        <Icon className="h-4 w-4 text-forest-600" /> {title}
      </h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((x, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" /> {x}
          </li>
        ))}
      </ul>
    </div>
  );
}
