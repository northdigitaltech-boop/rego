import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck, Star, MapPin, Phone, TriangleAlert, Check, Mountain } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ProfileGallery } from "@/components/listings/profile-gallery";
import { getProById, getRoles, roleName } from "@/lib/expeditions";
import { buildMetadata } from "@/lib/seo";
import { formatPrice } from "@/lib/utils";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await getProById(id);
  if (!p) return { title: "Professional not found" };
  return buildMetadata({
    title: `${p.full_name} — ${p.title || "Expedition Professional"} in Gilgit-Baltistan`,
    description: p.short_bio?.slice(0, 155) || `Verified expedition professional on Rego.`,
    path: `/expeditions/pro/${id}`,
    image: p.cover_image || p.photo,
    type: "profile",
  });
}

function Chips({ items }: { items: string[] | null }) {
  if (!items || items.length === 0) return null;
  return <div className="flex flex-wrap gap-2">{items.map((s) => <span key={s} className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold text-forest"><Check className="h-3.5 w-3.5 text-forest-600" /> {s}</span>)}</div>;
}

export default async function ProDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, roles] = await Promise.all([getProById(id), getRoles(false)]);
  if (!p || p.status !== "approved") notFound();

  const stats = [
    ["Years experience", p.years_experience],
    ["Total expeditions", p.total_expeditions],
    ["Total treks", p.total_treks],
    ["Highest altitude (m)", p.highest_altitude_m],
  ].filter(([, v]) => v != null) as [string, number][];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-muted/30">
        <div className="container-px py-6">
          <ProfileGallery images={[p.cover_image, p.photo, ...(p.gallery ?? [])].filter(Boolean) as string[]} title={p.full_name} />

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-forest-600 px-2.5 py-1 text-xs font-bold uppercase text-white">{roleName(roles, p.role)}</span>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold text-forest sm:text-3xl">{p.full_name}</h1>
                  {p.verified && <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-1 text-xs font-semibold text-forest-600"><ShieldCheck className="h-4 w-4 text-gold" /> Verified</span>}
                </div>
                {p.title && <p className="text-sm font-medium text-forest-600">{p.title}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {p.home_village || p.city || "Gilgit-Baltistan"}
                  <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-gold text-gold" /> {p.rating.toFixed(1)} ({p.reviews})</span>
                  {p.highest_peak && <span className="inline-flex items-center gap-1"><Mountain className="h-4 w-4 text-forest-600" /> {p.highest_peak}</span>}
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

              {(p.bio || p.short_bio) && <section><h2 className="mb-2 font-display text-lg font-bold text-forest">About</h2><p className="text-[15px] leading-relaxed text-muted-foreground">{p.bio || p.short_bio}</p></section>}
              {(p.specializations?.length ?? 0) > 0 && <section><h2 className="mb-2 font-display text-lg font-bold text-forest">Specializations</h2><Chips items={p.specializations} /></section>}
              {(p.skills?.length ?? 0) > 0 && <section><h2 className="mb-2 font-display text-lg font-bold text-forest">Skills</h2><Chips items={p.skills} /></section>}
              {(p.peaks_summited?.length ?? 0) > 0 && <section><h2 className="mb-2 font-display text-lg font-bold text-forest">Peaks summited</h2><Chips items={p.peaks_summited} /></section>}
              {(p.available_peaks?.length ?? 0) > 0 && <section><h2 className="mb-2 font-display text-lg font-bold text-forest">Available for peaks</h2><Chips items={p.available_peaks} /></section>}
              {(p.public_certs?.length ?? 0) > 0 && <section><h2 className="mb-2 font-display text-lg font-bold text-forest">Verified certificates</h2><Chips items={p.public_certs} /></section>}
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
                {p.daily_rate ? (
                  <p className="font-display text-xl font-bold text-forest">{formatPrice(p.daily_rate)}<span className="text-sm font-medium text-muted-foreground"> / day</span></p>
                ) : (
                  <p className="font-display text-lg font-bold text-forest">Custom quotation</p>
                )}
                {p.package_rate ? <p className="text-sm text-muted-foreground">Package: {formatPrice(p.package_rate)}</p> : null}
                <p className="mt-1 text-xs font-semibold capitalize text-forest-600">{p.availability_status || "available"}</p>
                <p className="mt-2 text-xs text-muted-foreground">Contact to plan your expedition. In-platform hiring &amp; quotations are coming soon.</p>
                <div className="mt-4 space-y-2">
                  {p.phone && <a href={`tel:${p.phone}`} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-forest hover:bg-muted"><Phone className="h-4 w-4 text-forest-600" /> {p.phone}</a>}
                  {p.whatsapp && <a href={`https://wa.me/${p.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-gradient-forest px-3 py-2.5 text-sm font-semibold text-white">WhatsApp</a>}
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  Mountaineering involves serious risk. Verify credentials, insurance and permits before committing.
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
