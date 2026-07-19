import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ScrollText, ShieldAlert } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { buildMetadata } from "@/lib/seo";
import { getLegalPolicies, LEGAL_EFFECTIVE, LEGAL_DISCLAIMER } from "@/lib/legal";

export const revalidate = 60;

export const metadata: Metadata = buildMetadata({
  title: "Legal & Policies",
  description:
    "Rego's Terms, Privacy, Booking, Cancellation, Refund, Provider, Review, Safety and Cookie policies.",
  path: "/legal",
});

export default async function LegalIndexPage() {
  const legalPolicies = await getLegalPolicies();
  return (
    <>
      <Navbar />
      <main className="bg-muted/30">
        <section className="bg-gradient-forest text-white">
          <div className="container-px py-14">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold">
              <ScrollText className="h-3.5 w-3.5" /> Legal &amp; Customer Protection
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
              Legal &amp; Policies
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80">
              These policies explain your rights and responsibilities when using
              Rego. Effective date: {LEGAL_EFFECTIVE}.
            </p>
          </div>
        </section>

        <div className="container-px py-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {legalPolicies.map((p) => (
              <Link
                key={p.slug}
                href={`/legal/${p.slug}`}
                className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
              >
                <h2 className="flex items-center justify-between font-display text-lg font-semibold text-forest">
                  {p.title}
                  <ChevronRight className="h-4 w-4 shrink-0 text-forest-600 transition-transform group-hover:translate-x-0.5" />
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.summary}
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-10 flex items-start gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-5 text-sm leading-relaxed text-forest-800">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-gold-700" />
            <p>{LEGAL_DISCLAIMER}</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
