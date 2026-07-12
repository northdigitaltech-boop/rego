import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Star,
  MapPin,
  BadgeCheck,
  Clock,
  Users,
  Phone,
  MessageCircle,
  Mail,
  Navigation,
  CheckCircle2,
  XCircle,
  Languages,
  Gauge,
} from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ActivityBookingButton } from "@/components/activities/inquiry-modal";
import { ActivityReviews } from "@/components/activities/activity-reviews";
import { ViewTracker } from "@/components/crm/view-tracker";
import { getActivityById, activityCategoryName } from "@/lib/activities";
import { photo, formatPrice } from "@/lib/utils";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const a = await getActivityById(id);
  if (!a) return { title: "Activity" };
  return {
    title: a.title,
    description: (a.description ?? `${a.title} in ${a.location || "Gilgit-Baltistan"}`).slice(0, 160),
    alternates: { canonical: `/activities/${id}` },
  };
}

function waLink(n?: string | null) {
  const d = (n ?? "").replace(/[^\d]/g, "");
  return d ? `https://wa.me/${d}` : "";
}

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getActivityById(id);
  if (!a || a.status !== "approved") notFound();

  const mapQuery = encodeURIComponent([a.meeting_point, a.location, a.city, "Gilgit Baltistan"].filter(Boolean).join(" "));

  return (
    <>
      <Navbar />
      <ViewTracker ownerEmail={a.owner_email} listingId={a.id} serviceType="activities" eventType="listing_view" />
      <main className="min-h-screen pb-16">
        <div className="relative h-64 w-full overflow-hidden sm:h-80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo(a.image || "https://picsum.photos/seed/activity/1600/700")} alt={a.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="container-px absolute inset-x-0 bottom-0 pb-6">
            <span className="inline-block rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-forest-600">
              {activityCategoryName(a.category)}
            </span>
            <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold text-white sm:text-4xl">{a.title}</h1>
            {a.business_name && <p className="mt-1 text-sm text-white/85">by {a.business_name}</p>}
          </div>
        </div>

        <div className="container-px pt-6">
          <Link href="/activities" className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600 hover:text-gold">
            <ChevronLeft className="h-4 w-4" /> All activities
          </Link>
        </div>

        <div className="container-px mt-6 grid gap-10 lg:grid-cols-[1fr_340px]">
          <div className="order-2 min-w-0 space-y-8 lg:order-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1 font-semibold text-forest">
                <Star className="h-4 w-4 fill-gold text-gold" /> {Number(a.rating).toFixed(1)}
                <span className="font-normal text-muted-foreground">({a.reviews} reviews)</span>
              </span>
              {a.verified && <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold text-forest-600"><BadgeCheck className="h-3.5 w-3.5" /> Verified</span>}
              <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" /> {a.location || a.city || "Gilgit Baltistan"}</span>
              {a.duration && <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock className="h-4 w-4" /> {a.duration}</span>}
              {a.difficulty && <span className="inline-flex items-center gap-1 capitalize text-muted-foreground"><Gauge className="h-4 w-4" /> {a.difficulty}</span>}
            </div>

            {a.description && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">About this activity</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{a.description}</p>
              </section>
            )}

            {(a.highlights?.length ?? 0) > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Highlights</h2>
                <ul className="mt-3 space-y-2">
                  {a.highlights!.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" /> {h}</li>
                  ))}
                </ul>
              </section>
            )}

            {((a.includes?.length ?? 0) > 0 || (a.excludes?.length ?? 0) > 0) && (
              <section className="grid gap-6 sm:grid-cols-2">
                {(a.includes?.length ?? 0) > 0 && (
                  <div>
                    <h3 className="font-display text-base font-bold text-forest">What&apos;s included</h3>
                    <ul className="mt-2 space-y-1.5">
                      {a.includes!.map((x, i) => <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> {x}</li>)}
                    </ul>
                  </div>
                )}
                {(a.excludes?.length ?? 0) > 0 && (
                  <div>
                    <h3 className="font-display text-base font-bold text-forest">Not included</h3>
                    <ul className="mt-2 space-y-1.5">
                      {a.excludes!.map((x, i) => <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> {x}</li>)}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {(a.gallery?.length ?? 0) > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Gallery</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {a.gallery!.map((g, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={photo(g)} alt="" className="h-32 w-full rounded-xl object-cover" />
                  ))}
                </div>
              </section>
            )}

            {mapQuery && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Meeting point</h2>
                {(a.meeting_point || a.location) && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {[a.meeting_point, a.location, a.city].filter(Boolean).join(", ")}</p>
                )}
                <div className="mt-3 overflow-hidden rounded-2xl border border-border">
                  <iframe title="Activity location" className="h-64 w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${mapQuery}&output=embed`} />
                </div>
              </section>
            )}

            <ActivityReviews activityId={a.id} ownerEmail={a.owner_email} title={a.title} />
          </div>

          <aside className="order-1 lg:order-2">
            <div className="space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-premium-lg lg:sticky lg:top-28">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Price</span>
                <span className="font-display text-2xl font-bold text-forest">
                  {a.price > 0 ? <>{formatPrice(a.price)}<span className="text-xs font-normal text-muted-foreground"> / {a.price_unit}</span></> : "Enquire"}
                </span>
              </div>

              <ActivityBookingButton activityId={a.id} activityTitle={a.title} ownerEmail={a.owner_email} ownerContactEmail={a.email} />

              <div className="grid grid-cols-2 gap-2">
                {a.phone ? (
                  <a href={`tel:${a.phone}`} className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold text-forest hover:bg-muted"><Phone className="h-4 w-4" /> Call</a>
                ) : (
                  <span className="rounded-lg border border-border px-3 py-2.5 text-center text-sm text-muted-foreground">No phone</span>
                )}
                {waLink(a.whatsapp) ? (
                  <a href={waLink(a.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-100"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
                ) : (
                  <span className="rounded-lg border border-border px-3 py-2.5 text-center text-sm text-muted-foreground">No WhatsApp</span>
                )}
              </div>

              <div className="space-y-2 border-t border-border pt-4 text-sm">
                {a.opening_hours && <Row icon={Clock} label="Opening hours" value={a.opening_hours} />}
                {(a.group_size_min || a.group_size_max) && <Row icon={Users} label="Group size" value={`${a.group_size_min ?? 1}–${a.group_size_max ?? "∞"}`} />}
                {a.age_limit && <Row icon={Users} label="Age" value={a.age_limit} />}
                {a.season && <Row icon={Clock} label="Season" value={a.season} />}
                {(a.languages?.length ?? 0) > 0 && <Row icon={Languages} label="Languages" value={a.languages!.join(", ")} />}
                {a.email && <Row icon={Mail} label="Email" value={a.email} />}
                {mapQuery && (
                  <a href={`https://www.google.com/maps?q=${mapQuery}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 pt-1 text-sm font-semibold text-forest-600 hover:text-gold"><Navigation className="h-4 w-4" /> Get directions</a>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-4 w-4" /> {label}</span>
      <span className="text-right font-medium text-forest">{value}</span>
    </div>
  );
}
