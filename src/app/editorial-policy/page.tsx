import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { buildMetadata } from "@/lib/seo";
import { editorialPolicy, EDITORIAL_LAST_UPDATED } from "@/lib/editorial";
import { aboutContent } from "@/lib/about-content";
import { companyRegistration, siteConfig } from "@/lib/site";

/* ============================================================
 * Editorial policy.
 *
 * A page a reader — or a reviewer — can check. It exists to
 * answer "why should I believe this site about a road in
 * Baltistan", and it only works while every claim on it stays
 * true of how Rego actually operates.
 * ============================================================ */

export const metadata: Metadata = buildMetadata({
  title: editorialPolicy.title,
  description: editorialPolicy.summary,
  path: "/editorial-policy",
});

export default function EditorialPolicyPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Editorial policy", path: "/editorial-policy" },
        ]}
      />
      <Navbar />
      <main className="min-h-screen">
        <section className="border-b border-border bg-muted/40">
          <div className="container-px py-12 sm:py-16">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest-600">
                <ShieldCheck className="h-3.5 w-3.5" />
                Editorial standards
              </span>
              <h1 className="mt-3 font-display text-3xl font-extrabold text-forest sm:text-4xl">
                {editorialPolicy.title}
              </h1>
              <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
                {editorialPolicy.summary}
              </p>
              <p className="mt-4 text-xs text-muted-foreground">
                Last updated {EDITORIAL_LAST_UPDATED}
              </p>
            </div>
          </div>
        </section>

        <article className="container-px py-12">
          <div className="max-w-3xl space-y-10">
            {editorialPolicy.sections.map((s) => (
              <section key={s.heading}>
                <h2 className="font-display text-xl font-bold text-forest sm:text-2xl">
                  {s.heading}
                </h2>
                <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">
                  {s.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>
            ))}

            {/* Attribution block — the concrete "who", not a claim about
                expertise. A name, a place and a checkable registration. */}
            <aside className="rounded-2xl border border-border bg-muted/30 p-5">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Responsible for this site
              </h2>
              <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                <Fact label="Founder" value={aboutContent.founder.name} />
                <Fact label="Role" value={aboutContent.founder.position} />
                <Fact label="From" value={aboutContent.founder.hometown} />
                <Fact label="Background" value={aboutContent.founder.background} />
                <Fact label="Registered entity" value={companyRegistration.legalName} />
                <Fact label="CUIN" value={companyRegistration.cuin} />
              </dl>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <a
                  href={companyRegistration.verifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-forest hover:text-gold"
                >
                  Verify on the SECP portal →
                </a>
                <Link href="/about" className="font-semibold text-forest hover:text-gold">
                  About Rego →
                </Link>
                <Link href="/contact" className="font-semibold text-forest hover:text-gold">
                  Report a correction →
                </Link>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Corrections: {siteConfig.contactEmail}
              </p>
            </aside>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold text-forest">{value}</dd>
    </div>
  );
}
