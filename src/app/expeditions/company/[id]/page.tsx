import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck, Star, MapPin, Phone, Mail, Globe, TriangleAlert, Check, Award, Users, Mountain, CalendarDays, UserRound } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ProfileGallery } from "@/components/listings/profile-gallery";
import { getCompanyById, getTeamMembers, getActivePackages, packagePriceLabel } from "@/lib/expeditions";
import { buildMetadata } from "@/lib/seo";
import { formatPrice, photo } from "@/lib/utils";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = await getCompanyById(id);
  if (!c) return { title: "Expedition company not found" };
  return buildMetadata({
    title: `${c.name} — Expedition Company in ${c.city || "Gilgit-Baltistan"}`,
    description: c.description?.slice(0, 155) || `Verified expedition company on Rego.`,
    path: `/expeditions/company/${id}`,
    image: c.cover_image || c.logo,
  });
}

function Chips({ items }: { items: string[] | null }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => (
        <span key={s} className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold text-forest"><Check className="h-3.5 w-3.5 text-forest-600" /> {s}</span>
      ))}
    </div>
  );
}

export default async function CompanyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCompanyById(id);
  if (!c || c.status !== "approved") notFound();

  const [team, packages] = await Promise.all([getTeamMembers(c.id), getActivePackages(c.id)]);

  const stats = [
    ["Years experience", c.years_experience],
    ["Expeditions organised", c.expeditions_organized],
    ["Successful expeditions", c.successful_count],
    ["Treks organised", c.treks_organized],
  ].filter(([, v]) => v != null) as [string, number][];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-muted/30">
        <div className="container-px py-6">
          <ProfileGallery images={[c.cover_image, c.logo, ...(c.gallery ?? [])].filter(Boolean) as string[]} title={c.name} />

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold text-forest sm:text-3xl">{c.name}</h1>
                  {c.verified && <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-600"><ShieldCheck className="h-4 w-4 text-gold" /> Verified</span>}
                </div>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {c.city || "Gilgit-Baltistan"}{c.district ? `, ${c.district}` : ""}
                  <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-gold text-gold" /> {c.rating.toFixed(1)} ({c.reviews})</span>
                </p>
              </div>

              {stats.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {stats.map(([label, v]) => (
                    <div key={label} className="rounded-2xl border border-border/70 bg-card p-4 text-center shadow-soft">
                      <p className="font-display text-2xl font-bold text-forest">{v}</p>
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {c.description && <section><h2 className="mb-2 font-display text-lg font-bold text-forest">About</h2><p className="text-[15px] leading-relaxed text-muted-foreground">{c.description}</p></section>}

              {/* Expedition packages — availability & pricing */}
              {packages.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-forest"><Mountain className="h-5 w-5 text-forest-600" /> Expedition Packages</h2>
                  <div className="space-y-4">
                    {packages.map((p) => (
                      <article key={p.id} className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
                        {p.image && (
                          <div className="h-40 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo(p.image, 900)} alt={p.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                          </div>
                        )}
                        <div className="p-4 sm:p-5">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h3 className="font-display text-base font-semibold text-forest">{p.title}</h3>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {[p.peak, p.route, p.duration_days ? `${p.duration_days} days` : null,
                                  p.group_max ? `${p.group_min}–${p.group_max} people` : `min ${p.group_min}`]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>
                            <p className="rounded-full bg-gradient-gold px-3 py-1 text-sm font-bold text-forest-900">{packagePriceLabel(p)}</p>
                          </div>
                          {(p.season_months?.length ?? 0) > 0 && (
                            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-forest-600">
                              <CalendarDays className="h-3.5 w-3.5" /> Season: {p.season_months!.join(", ")}
                              {p.next_departure ? ` · Next departure ${p.next_departure}` : ""}
                            </p>
                          )}
                          {p.group_tiers.length > 0 && (
                            <div className="mt-3 overflow-x-auto">
                              <table className="w-full min-w-[300px] text-left text-xs">
                                <thead><tr className="border-b border-border text-muted-foreground"><th className="py-1.5 pr-3 font-semibold">Group size</th><th className="py-1.5 font-semibold">Price / person</th></tr></thead>
                                <tbody>
                                  {p.group_tiers.map((t, i) => (
                                    <tr key={i} className="border-b border-border/50">
                                      <td className="py-1.5 pr-3 text-forest">{t.min}{t.max ? `–${t.max}` : "+"} people</td>
                                      <td className="py-1.5 font-semibold text-forest">{p.currency} {Number(t.price_per_person).toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {p.description && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.description}</p>}
                          {(p.includes?.length ?? 0) > 0 && (
                            <div className="mt-3">
                              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-forest">Included</p>
                              <Chips items={p.includes} />
                            </div>
                          )}
                          {(p.excludes?.length ?? 0) > 0 && (
                            <div className="mt-3">
                              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-forest">Not included</p>
                              <div className="flex flex-wrap gap-2">
                                {p.excludes!.map((s) => (
                                  <span key={s} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">{s}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* Team */}
              {team.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-forest"><Users className="h-5 w-5 text-forest-600" /> Meet the Team</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {team.map((m) => (
                      <div key={m.id} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
                        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-muted">
                          {m.photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={photo(m.photo, 200)} alt={m.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                          ) : (
                            <UserRound className="h-6 w-6 text-forest-600" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-forest">{m.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.role ?? "Team member"}
                            {m.years_experience ? ` · ${m.years_experience} yrs experience` : ""}
                          </p>
                          {m.peaks_summited && m.peaks_summited.length > 0 && (
                            <p className="mt-1 text-xs text-forest-600">Summits: {m.peaks_summited.join(", ")}</p>
                          )}
                          {m.bio && <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{m.bio}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {(c.services?.length ?? 0) > 0 && <section><h2 className="mb-2 font-display text-lg font-bold text-forest">Services</h2><Chips items={c.services} /></section>}
              {(c.peaks_handled?.length ?? 0) > 0 && <section><h2 className="mb-2 font-display text-lg font-bold text-forest">Peaks handled</h2><Chips items={c.peaks_handled} /></section>}
              {(c.routes_handled?.length ?? 0) > 0 && <section><h2 className="mb-2 font-display text-lg font-bold text-forest">Trekking routes</h2><Chips items={c.routes_handled} /></section>}
              {(c.certifications?.length ?? 0) > 0 && <section><h2 className="mb-2 font-display text-lg font-bold text-forest">Certifications &amp; licenses</h2><Chips items={[...(c.certifications ?? []), ...(c.licenses ?? []), ...(c.awards ?? [])]} /></section>}
              {c.safety_policy && (
                <section className="rounded-2xl border border-forest-100 bg-forest-50/60 p-4">
                  <h2 className="mb-1 flex items-center gap-2 font-display text-sm font-bold text-forest"><Award className="h-4 w-4 text-gold" /> Safety policy</h2>
                  <p className="text-sm text-muted-foreground">{c.safety_policy}</p>
                  {c.rescue_capability && <p className="mt-1 text-xs font-semibold text-forest-600">✓ Rescue support available</p>}
                </section>
              )}
            </div>

            {/* Sidebar */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
                {c.starting_price ? (
                  <p className="font-display text-xl font-bold text-forest">from {formatPrice(c.starting_price)}<span className="text-sm font-medium text-muted-foreground"> / expedition</span></p>
                ) : (
                  <p className="font-display text-lg font-bold text-forest">Custom quotation</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">Contact the company to plan your expedition. In-platform quotations are coming soon.</p>
                <div className="mt-4 space-y-2">
                  {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-forest hover:bg-muted"><Phone className="h-4 w-4 text-forest-600" /> {c.phone}</a>}
                  {c.whatsapp && <a href={`https://wa.me/${c.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-gradient-forest px-3 py-2.5 text-sm font-semibold text-white">WhatsApp</a>}
                  {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-forest hover:bg-muted"><Mail className="h-4 w-4 text-forest-600" /> Email</a>}
                  {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-forest hover:bg-muted"><Globe className="h-4 w-4 text-forest-600" /> Website</a>}
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  Mountaineering involves serious risk. Verify credentials, insurance, permits and weather before committing.
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
