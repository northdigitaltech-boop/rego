import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Award,
  Briefcase,
  MapPin,
  Mountain,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { getTeamMemberById } from "@/lib/expeditions";
import { buildMetadata } from "@/lib/seo";
import { photo } from "@/lib/utils";
import { ExpeditionQuoteButton } from "@/components/expeditions/expedition-booking-modal";

/* ============================================================
 * An expedition company's staff member.
 *
 * WHY THIS PAGE EXISTS
 *   They appear in the Tour Guides grid, and every other card
 *   there opens a profile. Without one, their card was the only
 *   card in the grid that behaved differently.
 *
 * WHAT IT DOES NOT CLAIM
 *   No rate, no rating, no reviews — a staff member has none of
 *   those, and inventing them to match the other cards would make
 *   the page a lie. The enquiry goes to the company that employs
 *   them, which is stated plainly rather than hidden behind a
 *   button that implies a direct booking.
 * ============================================================ */

/* ISR window. Marketplace content changes when a provider lists or an
   admin approves — a few times a day, not every minute. At 60s every
   path regenerated up to 60 times an hour whether anything had changed
   or not, which was the main driver of Vercel Fluid Active CPU.

   This is ISR, not static: the first request after the window still
   serves instantly from cache and refreshes behind it, so nobody waits.
   The visible cost is that a newly approved listing can take this long
   to appear. */
export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const found = await getTeamMemberById(id);
  if (!found) return { title: "Team member not found" };

  const { member, company } = found;
  const role = member.role || "Expedition staff";
  return buildMetadata({
    title: `${member.name} — ${role} at ${company.name}`,
    description:
      member.bio?.slice(0, 155) ||
      `${role} with ${company.name}${company.city ? ` in ${company.city}` : ""}.`,
    path: `/expeditions/staff/${id}`,
    image: member.photo || company.cover_image || company.logo,
  });
}

export default async function StaffProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = await getTeamMemberById(id);
  if (!found) notFound();

  const { member, company } = found;
  const role = member.role || "Expedition staff";

  return (
    <>
      <Navbar />
      <main className="bg-background">
        <div className="container-px py-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <div className="flex flex-wrap items-start gap-5">
                <span className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-3xl bg-muted">
                  {member.photo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={photo(member.photo, 400)}
                      alt={member.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound className="h-10 w-10 text-forest-600" />
                  )}
                </span>

                <div className="min-w-0">
                  <span className="inline-block rounded-full bg-gradient-forest px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    {role}
                  </span>
                  <h1 className="mt-2 font-display text-3xl font-bold text-forest">
                    {member.name}
                  </h1>

                  <Link
                    href={`/expeditions/company/${company.id}`}
                    className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-forest-600 hover:underline"
                  >
                    <Briefcase className="h-4 w-4" />
                    {company.name}
                    {company.verified && (
                      <ShieldCheck className="h-4 w-4 text-gold" />
                    )}
                  </Link>

                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    {member.years_experience != null && (
                      <span className="inline-flex items-center gap-1.5">
                        <Award className="h-4 w-4 text-forest-600" />
                        {member.years_experience} yrs experience
                      </span>
                    )}
                    {company.city && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-forest-600" />
                        {company.city}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {member.bio && (
                <section>
                  <h2 className="mb-2 font-display text-lg font-bold text-forest">
                    About {member.name.split(" ")[0]}
                  </h2>
                  {/* In full, and with the line breaks they typed. */}
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {member.bio}
                  </p>
                </section>
              )}

              {member.peaks_summited && member.peaks_summited.length > 0 && (
                <section>
                  <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-forest">
                    <Mountain className="h-5 w-5 text-forest-600" /> Summits
                  </h2>
                  <Chips items={member.peaks_summited} />
                </section>
              )}

              {member.certifications && member.certifications.length > 0 && (
                <section>
                  <h2 className="mb-2 font-display text-lg font-bold text-forest">
                    Certifications
                  </h2>
                  <Chips items={member.certifications} />
                </section>
              )}
            </div>

            <aside id="book" className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
                <p className="font-display text-lg font-bold text-forest">
                  Custom quotation
                </p>
                {/* Said plainly. They are staff, not an independent guide, and
                    a button that implied otherwise would send the traveller
                    somewhere nothing arrives. */}
                <p className="mt-1 text-xs text-muted-foreground">
                  {member.name} works with {company.name}. Your request goes to
                  the company, naming {member.name.split(" ")[0]}. Nothing is
                  booked until you agree terms with them directly.
                </p>

                <div className="mt-4">
                  <ExpeditionQuoteButton
                    subjectKind="company"
                    subjectId={company.id}
                    subjectTitle={`${member.name} (${role}) — ${company.name}`}
                    ownerEmail={company.owner_email}
                    label="Request a quote"
                  />
                </div>

                <Link
                  href={`/expeditions/company/${company.id}`}
                  className="mt-2 block rounded-xl border border-border px-3 py-2.5 text-center text-sm font-semibold text-forest hover:bg-muted"
                >
                  View {company.name}
                </Link>

                <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  Mountaineering involves serious risk. Verify credentials,
                  insurance, permits and weather before committing.
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

function Chips({ items }: { items: string[] | null }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => (
        <span
          key={s}
          className="rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-600"
        >
          {s}
        </span>
      ))}
    </div>
  );
}
