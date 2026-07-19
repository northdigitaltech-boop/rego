import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { buildMetadata } from "@/lib/seo";
import { getPolicyContent, getLegalPolicies, legalPolicies, LEGAL_EFFECTIVE } from "@/lib/legal";

export const revalidate = 60;

export function generateStaticParams() {
  return legalPolicies.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const policy = await getPolicyContent(slug);
  if (!policy) return { title: "Policy not found" };
  return buildMetadata({
    title: policy.title,
    description: policy.summary,
    path: `/legal/${policy.slug}`,
  });
}

export default async function LegalPolicyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [policy, allPolicies] = await Promise.all([
    getPolicyContent(slug),
    getLegalPolicies(),
  ]);
  if (!policy) notFound();

  return (
    <>
      <Navbar />
      <main className="bg-muted/30">
        <div className="container-px py-10 lg:py-14">
          <Link
            href="/legal"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-600 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 rounded"
          >
            <ChevronLeft className="h-4 w-4" /> All policies
          </Link>

          <article className="mt-5 rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-9">
            <header className="border-b border-border pb-6">
              <h1 className="font-display text-3xl font-bold text-forest">
                {policy.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Effective date: {LEGAL_EFFECTIVE}
              </p>
            </header>

            <div className="mt-6 space-y-4">
              {policy.intro.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-forest-800">
                  {p}
                </p>
              ))}
            </div>

            <div className="mt-8 space-y-8">
              {policy.sections.map((section, si) => (
                <section key={si}>
                  {section.heading && (
                    <h2 className="font-display text-lg font-semibold text-forest">
                      {section.heading}
                    </h2>
                  )}
                  <div className="mt-2 space-y-3">
                    {section.body.map((para, pi) => (
                      <p
                        key={pi}
                        className="text-sm leading-relaxed text-forest-800"
                      >
                        {para}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>

          <nav className="mt-8">
            <h3 className="mb-3 text-sm font-semibold text-forest">
              Other policies
            </h3>
            <div className="flex flex-wrap gap-2">
              {allPolicies
                .filter((p) => p.slug !== policy.slug)
                .map((p) => (
                  <Link
                    key={p.slug}
                    href={`/legal/${p.slug}`}
                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-forest transition-colors hover:border-forest-600 hover:text-forest-600"
                  >
                    {p.title}
                  </Link>
                ))}
            </div>
          </nav>
        </div>
      </main>
      <Footer />
    </>
  );
}
