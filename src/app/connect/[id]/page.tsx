import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Star,
  MapPin,
  BadgeCheck,
  Compass,
  ShieldCheck,
  CalendarDays,
  Clock,
  Users,
  Wallet,
  Car,
  Home as HomeIcon,
  Languages,
  Briefcase,
  Heart,
  CheckCircle2,
  XCircle,
  IdCard,
  Phone,
  Mail,
  ScanFace,
  LifeBuoy,
  Plane,
} from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import {
  SoloHeaderActions,
  SoloConnectPanel,
  SoloSidebarActions,
} from "@/components/solo/profile-actions";
import { SoloReviews } from "@/components/solo/solo-reviews";
import { SoloCompatibility } from "@/components/solo/compatibility";
import {
  getSoloById,
  computeTrustScore,
  daysUntilDeparture,
  type SoloTravelerRow,
  type SoloPreviousTrip,
} from "@/lib/solo";
import { photo } from "@/lib/utils";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getSoloById(id);
  if (!t) return { title: "Traveller" };
  return {
    title: `${t.full_name} — Solo Traveller`,
    description: (
      t.intro ?? `${t.full_name} is looking for travel companions in Gilgit-Baltistan.`
    ).slice(0, 160),
    alternates: { canonical: `/connect/${id}` },
  };
}

function fmtDate(d: string | null): string {
  if (!d) return "Flexible";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function fmtMonthYear(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}
function lastActiveLabel(d: string | null): string {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return "Active now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function TravelerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getSoloById(id);
  if (!t || t.status !== "approved") notFound();

  const trust = computeTrustScore(t);
  const days = daysUntilDeparture(t.departure_date);
  const cover =
    t.cover_image ||
    "https://images.unsplash.com/photo-1626621341517-bbf3d33990ef?w=1600&q=80";
  const avatar = t.profile_photo || "https://i.pravatar.cc/300?u=" + t.id;

  return (
    <>
      <Navbar />
      <main className="min-h-screen pb-16">
        {/* Cover */}
        <div className="relative h-56 w-full overflow-hidden sm:h-72">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo(cover)} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-forest-900/80 via-forest-900/20 to-transparent" />
          <div className="container-px absolute inset-x-0 top-0 pt-5">
            <Link
              href="/connect"
              className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-forest-600 backdrop-blur hover:text-gold"
            >
              <ChevronLeft className="h-4 w-4" /> All travellers
            </Link>
          </div>
        </div>

        {/* Header card */}
        <div className="container-px">
          <div className="relative -mt-16 rounded-3xl border border-border/70 bg-card p-6 shadow-premium-lg sm:-mt-20">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
              <span className="relative block h-28 w-28 shrink-0 overflow-hidden rounded-3xl border-4 border-card bg-forest-100 shadow-premium sm:h-32 sm:w-32">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo(avatar)}
                  alt={t.full_name}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
              </span>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-extrabold text-forest sm:text-3xl">
                    {t.full_name}
                    {t.age ? (
                      <span className="font-semibold text-muted-foreground">, {t.age}</span>
                    ) : null}
                  </h1>
                  {t.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-semibold text-forest-600">
                      <BadgeCheck className="h-3.5 w-3.5 text-gold" /> Verified
                    </span>
                  )}
                  {t.solo_badge && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-gold-700">
                      <Compass className="h-3.5 w-3.5" /> Solo Traveller
                    </span>
                  )}
                  {t.online && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Online
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-semibold text-forest">
                    <Star className="h-4 w-4 fill-gold text-gold" /> {Number(t.rating).toFixed(1)}
                    <span className="font-normal text-muted-foreground">({t.reviews})</span>
                  </span>
                  {t.nationality && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-4 w-4" /> {t.nationality}
                    </span>
                  )}
                  {t.current_city && (
                    <span className="inline-flex items-center gap-1">
                      <HomeIcon className="h-4 w-4" /> {t.current_city}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4" /> {lastActiveLabel(t.last_active)}
                  </span>
                </div>

                {/* Travel score + member since */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-forest-50 px-3 py-1.5 text-xs font-semibold text-forest">
                    <Compass className="h-4 w-4 text-forest-600" /> Travel score {t.travel_score}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-forest-50 px-3 py-1.5 text-xs font-semibold text-forest">
                    <CalendarDays className="h-4 w-4 text-forest-600" /> Member since{" "}
                    {fmtMonthYear(t.created_at)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                    <ShieldCheck className="h-4 w-4" /> {trust}% trust
                  </span>
                </div>
              </div>
            </div>

            {/* Header actions */}
            <div className="mt-5 border-t border-border pt-5">
              <SoloHeaderActions traveler={t} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="container-px mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* Main */}
          <div className="order-2 min-w-0 space-y-8 lg:order-1">
            {/* About me */}
            {(t.intro || t.why_visiting || t.travel_experience || t.occupation ||
              (t.languages?.length ?? 0) > 0 || (t.interests?.length ?? 0) > 0) && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">About me</h2>
                {t.intro && (
                  <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">
                    {t.intro}
                  </p>
                )}
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {t.why_visiting && (
                    <InfoBlock icon={Compass} label="Why I'm visiting GB" value={t.why_visiting} />
                  )}
                  {t.travel_experience && (
                    <InfoBlock icon={Plane} label="Travel experience" value={t.travel_experience} />
                  )}
                  {t.occupation && (
                    <InfoBlock icon={Briefcase} label="Occupation" value={t.occupation} />
                  )}
                  {(t.languages?.length ?? 0) > 0 && (
                    <InfoBlock
                      icon={Languages}
                      label="Languages"
                      value={t.languages!.join(", ")}
                    />
                  )}
                </div>
                {(t.interests?.length ?? 0) > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-forest">
                      <Heart className="h-4 w-4 text-gold" /> Interests
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {t.interests!.map((i) => (
                        <Badge key={i}>{i}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Current travel plan */}
            <section className="rounded-3xl border border-border/70 bg-gradient-to-br from-forest-50/50 to-transparent p-6">
              <h2 className="font-display text-xl font-bold text-forest">Current travel plan</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {(t.destinations?.length ?? 0) > 0 && (
                  <PlanRow icon={MapPin} label="Destinations" value={t.destinations!.join(", ")} />
                )}
                <PlanRow icon={CalendarDays} label="Departure" value={fmtDate(t.departure_date)} />
                <PlanRow icon={CalendarDays} label="Return" value={fmtDate(t.return_date)} />
                {t.duration && <PlanRow icon={Clock} label="Duration" value={t.duration} />}
                {t.budget && <PlanRow icon={Wallet} label="Budget" value={t.budget} />}
                {t.transportation_type && (
                  <PlanRow icon={Car} label="Transport" value={t.transportation_type} />
                )}
                {t.accommodation_preference && (
                  <PlanRow icon={HomeIcon} label="Accommodation" value={t.accommodation_preference} />
                )}
                {t.available_seats != null && (
                  <PlanRow icon={Users} label="Available seats" value={String(t.available_seats)} />
                )}
                {t.gender_preference && (
                  <PlanRow icon={Users} label="Gender preference" value={t.gender_preference} />
                )}
                {t.age_preference && (
                  <PlanRow icon={Users} label="Age preference" value={t.age_preference} />
                )}
              </div>
              {(t.looking_for?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-semibold text-forest">Looking for</p>
                  <div className="flex flex-wrap gap-2">
                    {t.looking_for!.map((l) => (
                      <span
                        key={l}
                        className="rounded-full bg-gradient-forest px-3 py-1 text-xs font-semibold text-white"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Travel preferences */}
            {(t.travel_preferences?.length ?? 0) > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Travel preferences</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.travel_preferences!.map((p) => (
                    <span
                      key={p}
                      className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm font-semibold text-gold-700"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Gallery */}
            {((t.gallery?.length ?? 0) > 0 ||
              (t.drone_shots?.length ?? 0) > 0 ||
              (t.videos?.length ?? 0) > 0) && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Travel gallery</h2>
                {((t.gallery?.length ?? 0) > 0 || (t.drone_shots?.length ?? 0) > 0) && (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[...(t.gallery ?? []), ...(t.drone_shots ?? [])].map((g, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={photo(g)} alt="" className="h-32 w-full rounded-xl object-cover" />
                    ))}
                  </div>
                )}
                {(t.videos?.length ?? 0) > 0 && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {t.videos!.map((v, i) => (
                      <video key={i} src={v} controls className="w-full rounded-xl" />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Previous trips */}
            {(t.previous_trips?.length ?? 0) > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-forest">Previous trips</h2>
                <div className="mt-4 space-y-4">
                  {t.previous_trips!.map((trip, i) => (
                    <PreviousTripCard key={i} trip={trip} />
                  ))}
                </div>
              </section>
            )}

            {/* Safety & verification */}
            <section>
              <h2 className="font-display text-xl font-bold text-forest">Safety &amp; verification</h2>
              <div className="mt-4 rounded-3xl border border-border/70 bg-card p-6 shadow-premium">
                <div className="flex items-center gap-4">
                  <TrustRing value={trust} />
                  <div>
                    <p className="font-display text-lg font-bold text-forest">Trust score</p>
                    <p className="text-sm text-muted-foreground">
                      Based on completed verifications. Higher is safer.
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <VerifyRow icon={IdCard} label="Government ID" ok={t.id_verified} />
                  <VerifyRow icon={Phone} label="Phone" ok={t.phone_verified} />
                  <VerifyRow icon={Mail} label="Email" ok={t.email_verified} />
                  <VerifyRow icon={ScanFace} label="Face" ok={t.face_verified} />
                  <VerifyRow icon={LifeBuoy} label="Emergency contact" ok={t.emergency_verified} />
                </div>
              </div>
            </section>

            {/* Connect section */}
            <SoloConnectPanel traveler={t} />

            {/* Reviews */}
            <SoloReviews travelerId={t.id} ownerEmail={t.owner_email} travelerName={t.full_name} />
          </div>

          {/* Sidebar */}
          <aside className="order-1 lg:order-2">
            <div className="space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-premium-lg lg:sticky lg:top-28">
              <p className="font-display text-base font-bold text-forest">Quick information</p>

              <div className="space-y-2.5 text-sm">
                <Quick label="Destination" value={(t.destinations ?? []).join(", ") || "—"} icon={MapPin} />
                <Quick
                  label="Travel dates"
                  value={`${fmtDate(t.departure_date)} → ${fmtDate(t.return_date)}`}
                  icon={CalendarDays}
                />
                {days != null && days >= 0 && (
                  <Quick label="Departs in" value={`${days} day${days === 1 ? "" : "s"}`} icon={Clock} />
                )}
                {t.budget && <Quick label="Budget" value={t.budget} icon={Wallet} />}
                {t.available_seats != null && (
                  <Quick label="Available seats" value={String(t.available_seats)} icon={Users} />
                )}
                {(t.languages?.length ?? 0) > 0 && (
                  <Quick label="Languages" value={t.languages!.join(", ")} icon={Languages} />
                )}
                <Quick
                  label="Emergency contact"
                  value={t.emergency_verified ? "Verified" : t.emergency_contact_status || "Not provided"}
                  icon={LifeBuoy}
                />
                <Quick
                  label="Status"
                  value={t.online ? "Online now" : lastActiveLabel(t.last_active)}
                  icon={Clock}
                />
                <SoloCompatibility target={t} />
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <SoloSidebarActions traveler={t} />
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}

/* ---------------- Presentational helpers ---------------- */

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-forest-50 px-3 py-1 text-sm font-medium text-forest-600">
      {children}
    </span>
  );
}

function InfoBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4 text-forest-600" /> {label}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-forest">{value}</p>
    </div>
  );
}

function PlanRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-600">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-forest">{value}</p>
      </div>
    </div>
  );
}

function Quick({
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

function VerifyRow({
  icon: Icon,
  label,
  ok,
}: {
  icon: React.ElementType;
  label: string;
  ok: boolean;
}) {
  return (
    <div
      className={
        "flex items-center justify-between rounded-xl border px-3 py-2.5 " +
        (ok ? "border-green-200 bg-green-50" : "border-border bg-muted/40")
      }
    >
      <span className="flex items-center gap-2 text-sm font-medium text-forest">
        <Icon className="h-4 w-4 text-forest-600" /> {label}
      </span>
      {ok ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
          <CheckCircle2 className="h-4 w-4" /> Verified
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          <XCircle className="h-4 w-4" /> Not yet
        </span>
      )}
    </div>
  );
}

function TrustRing({ value }: { value: number }) {
  const color = value >= 80 ? "#16a34a" : value >= 50 ? "#d4a017" : "#9ca3af";
  return (
    <div
      className="grid h-20 w-20 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(${color} ${value * 3.6}deg, #e5e7eb 0deg)` }}
    >
      <div className="grid place-items-center rounded-full bg-card" style={{ height: 60, width: 60 }}>
        <span className="font-display text-lg font-bold text-forest">{value}%</span>
      </div>
    </div>
  );
}

function PreviousTripCard({ trip }: { trip: SoloPreviousTrip }) {
  return (
    <div className="flex gap-4 rounded-3xl border border-border/70 bg-card p-4 shadow-premium">
      {trip.photos?.[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo(trip.photos[0])}
          alt={trip.destination}
          className="h-24 w-24 shrink-0 rounded-2xl object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-base font-bold text-forest">{trip.destination}</p>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-forest">
            <Star className="h-3.5 w-3.5 fill-gold text-gold" /> {Number(trip.rating || 0).toFixed(1)}
          </span>
        </div>
        {trip.date && <p className="text-xs text-muted-foreground">{trip.date}</p>}
        {trip.story && (
          <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{trip.story}</p>
        )}
      </div>
    </div>
  );
}
