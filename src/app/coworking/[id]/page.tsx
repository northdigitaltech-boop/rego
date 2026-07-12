import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Star,
  MapPin,
  BadgeCheck,
  Wifi,
  Users,
  Clock,
  Phone,
  MessageCircle,
  Mail,
  Navigation,
  CheckCircle2,
  Briefcase,
} from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { CoworkingInquiryButton } from "@/components/coworking/inquiry-modal";
import { CoworkingReviews } from "@/components/coworking/coworking-reviews";
import { ViewTracker } from "@/components/crm/view-tracker";
import { getCoworkingById, planName } from "@/lib/coworking";
import { photo, formatPrice } from "@/lib/utils";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const s = await getCoworkingById(id);
  if (!s) return { title: "Co-working space" };
  return {
    title: s.name,
    description: (s.description ?? `${s.name} — co-working space in ${s.city || "Gilgit-Baltistan"}`).slice(0, 160),
    alternates: { canonical: `/coworking/${id}` },
  };
}

function waLink(num?: string | null) {
  const d = (num ?? "").replace(/[^\d]/g, "");
  return d ? `https://wa.me/${d}` : "";
}

export default async function CoworkingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await getCoworkingById(id);
  if (!s || s.status !== "approved") notFound();

  const mapQuery = encodeURIComponent(
    [s.address, s.location, s.city, "Gilgit Baltistan"].filter(Boolean).join(" ")
  );

  const plans = [
    { slug: "hot-desk", price: s.hot_desk_price, unit: "day" },
    { slug: "dedicated-desk", price: s.dedicated_desk_price, unit: "month" },
    { slug: "private-office", price: s.private_office_price, unit: "month" },
    { slug: "meeting-room", price: s.meeting_room_price, unit: "hour" },
  ].filter((p) => p.price != null && Number(p.price) > 0);

  return (
    <>
      <Navbar />
      <ViewTracker ownerEmail={s.owner_email} listingId={s.id} serviceType="coworking" eventType="profile_view" />
      <main className="min-h-screen pb-16">
        {/* Cover + header */}
        <div className="container-px mt-4">
          <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium">
            <div className="relative h-44 sm:h-60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo(s.cover_image || s.logo || "https://picsum.photos/seed/cowork/1600/700")}
                alt={s.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
              <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-3xl border-4 border-card bg-forest-50 text-forest-600 shadow-premium">
                {s.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo(s.logo)} alt={s.name} className="h-full w-full object-cover" />
                ) : (
                  <Briefcase className="h-9 w-9" />
                )}
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold text-forest sm:text-3xl">{s.name}</h1>
                  {s.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold text-forest-600">
                      <BadgeCheck className="h-3.5 w-3.5" /> Verified
                    </span>
                  )}
                  {s.ranking_badge && (
                    <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold-700">
                      {s.ranking_badge}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="flex items-center gap-1 font-semibold text-forest">
                    <Star className="h-4 w-4 fill-gold text-gold" /> {Number(s.rating).toFixed(1)}
                    <span className="font-normal text-muted-foreground">({s.reviews} reviews)</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" /> {s.city || "Gilgit Baltistan"}
                  </span>
                  {s.wifi_speed && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Wifi className="h-4 w-4" /> {s.wifi_speed}
                    </span>
                  )}
                  {s.seating_capacity != null && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Users className="h-4 w-4" /> {s.seating_capacity} seats
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container-px pt-6">
          <Link href="/coworking" className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600 hover:text-gold">
            <ChevronLeft className="h-4 w-4" /> All co-working spaces
          </Link>
        </div>

        <div className="container-px mt-6 grid gap-10 lg:grid-cols-[1fr_340px]">
          {/* Main */}
          <div className="order-2 min-w-0 space-y-8 lg:order-1">
            {s.description && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">About</h2>
                <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{s.description}</p>
              </section>
            )}

            {plans.length > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Plans &amp; pricing</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {plans.map((p) => (
                    <div key={p.slug} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-premium">
                      <span className="font-semibold text-forest">{planName(p.slug)}</span>
                      <span className="font-display text-sm font-bold text-forest">
                        {formatPrice(Number(p.price))}
                        <span className="text-xs font-normal text-muted-foreground"> / {p.unit}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {(s.amenities?.length ?? 0) > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Amenities</h2>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {s.amenities!.map((a) => (
                    <span key={a} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-forest-600" /> {a}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {(s.gallery?.length ?? 0) > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Gallery</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {s.gallery!.map((g, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={photo(g)} alt="" className="h-32 w-full rounded-xl object-cover" />
                  ))}
                </div>
              </section>
            )}

            {mapQuery && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Location</h2>
                {(s.address || s.location) && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" /> {[s.address, s.location, s.city].filter(Boolean).join(", ")}
                  </p>
                )}
                <div className="mt-3 overflow-hidden rounded-2xl border border-border">
                  <iframe
                    title="Space location"
                    className="h-64 w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                  />
                </div>
              </section>
            )}

            {/* Reviews (shared table + owner replies) */}
            <CoworkingReviews spaceId={s.id} ownerEmail={s.owner_email} spaceName={s.name} />
          </div>

          {/* Sidebar */}
          <aside className="order-1 lg:order-2">
            <div className="space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-premium-lg lg:sticky lg:top-28">
              <CoworkingInquiryButton
                spaceId={s.id}
                spaceName={s.name}
                ownerEmail={s.owner_email}
                ownerContactEmail={s.email}
              />
              <div className="grid grid-cols-2 gap-2">
                {s.phone ? (
                  <a href={`tel:${s.phone}`} className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold text-forest hover:bg-muted">
                    <Phone className="h-4 w-4" /> Call
                  </a>
                ) : (
                  <span className="rounded-lg border border-border px-3 py-2.5 text-center text-sm text-muted-foreground">No phone</span>
                )}
                {waLink(s.whatsapp) ? (
                  <a href={waLink(s.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-100">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                ) : (
                  <span className="rounded-lg border border-border px-3 py-2.5 text-center text-sm text-muted-foreground">No WhatsApp</span>
                )}
              </div>

              <div className="space-y-2 border-t border-border pt-4 text-sm">
                {s.opening_hours && <Row icon={Clock} label="Hours" value={s.opening_hours} />}
                {s.email && <Row icon={Mail} label="Email" value={s.email} />}
                {s.address && <Row icon={MapPin} label="Address" value={s.address} />}
                {mapQuery && (
                  <a href={`https://www.google.com/maps?q=${mapQuery}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 pt-1 text-sm font-semibold text-forest-600 hover:text-gold">
                    <Navigation className="h-4 w-4" /> Get directions
                  </a>
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

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <span className="text-right font-medium text-forest">{value}</span>
    </div>
  );
}
