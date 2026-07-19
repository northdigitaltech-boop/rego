import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText, ChevronRight } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AboutRego } from "@/components/about/about-rego";
import { getAboutContent } from "@/lib/about";
import { buildMetadata } from "@/lib/seo";
import { legalPolicies } from "@/lib/legal";

export const revalidate = 60;

export const metadata: Metadata = buildMetadata({
  title: "About Rego — Digitally Connecting Gilgit-Baltistan",
  description:
    "Rego is a complete digital tourism marketplace for Gilgit-Baltistan, founded and developed by Shabbir Hussain. Discover our mission, vision and the future Rego digital ecosystem.",
  path: "/about",
});

export default async function AboutPage() {
  const about = await getAboutContent();
  return (
    <>
      <Navbar />
      <main>
        <AboutRego content={about} />

        {/* Legal & Policies */}
        <section className="border-t border-border bg-muted/30">
          <div className="container-px py-12">
            <div className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-forest-600" />
              <h2 className="font-display text-2xl font-bold text-forest">
                Legal &amp; Policies
              </h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Your rights and responsibilities when using Rego — our Terms,
              Privacy, Booking, Cancellation, Refund, Provider, Review, Safety
              and Cookie policies.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {legalPolicies.map((p) => (
                <Link
                  key={p.slug}
                  href={`/legal/${p.slug}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-forest shadow-soft transition-shadow hover:shadow-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
                >
                  {p.title}
                  <ChevronRight className="h-4 w-4 shrink-0 text-forest-600 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
            <Link
              href="/legal"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-forest-600 hover:text-gold"
            >
              View all policies <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
