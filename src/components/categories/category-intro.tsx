import { getCategoryIntro } from "@/lib/category-intro";
import { JsonLd } from "@/components/seo/json-ld";

/* ============================================================
 * Written copy under a category's card grid.
 *
 * BELOW THE LISTINGS, NOT ABOVE
 *   Someone arriving on /categories/hotels wants hotels, and
 *   putting three paragraphs between them and the first card
 *   would cost more in people leaving than it could earn in
 *   ranking. Search engines read the whole document either
 *   way, so there is nothing to gain by pushing it up.
 *
 * ONE INSERTION POINT
 *   Six different components render these pages depending on
 *   the category. This sits in page.tsx after whichever one
 *   was chosen, so none of them had to be touched.
 *
 * Renders nothing when there is nothing filled in — see the
 * {{ }} rule in lib/category-intro.ts.
 * ============================================================ */

export function CategoryIntro({ slug }: { slug: string }) {
  const intro = getCategoryIntro(slug);
  if (!intro) return null;

  return (
    <section className="border-t border-border bg-muted/30">
      <div className="container-px mx-auto max-w-3xl py-12 sm:py-16">
        <h2 className="font-display text-2xl font-bold text-forest sm:text-3xl">
          {intro.heading}
        </h2>

        <div className="mt-5 space-y-4">
          {intro.paragraphs.map((p, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-foreground/80">
              {p}
            </p>
          ))}
        </div>

        {intro.faqs.length > 0 && (
          <>
            <h3 className="mt-10 font-display text-xl font-bold text-forest">
              Common questions
            </h3>
            <dl className="mt-4 space-y-5">
              {intro.faqs.map((f, i) => (
                <div key={i}>
                  <dt className="font-semibold text-forest">{f.q}</dt>
                  <dd className="mt-1 text-[15px] leading-relaxed text-foreground/80">
                    {f.a}
                  </dd>
                </div>
              ))}
            </dl>

            {/* FAQPage structured data, from the same answers shown above.
                Emitted only for questions that are actually on the page —
                Google treats schema describing invisible content as a
                violation, and it would also be a lie. */}
            {/* Through the shared helper, which escapes "<" so text can never
                close the <script> early. This block wrote raw JSON; the FAQs
                are hardcoded today so it was not exploitable, but the
                location SEO panel already makes similar copy admin-editable,
                and this is the one place that would not have survived it. */}
            <JsonLd
              data={{
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: intro.faqs.map((f) => ({
                  "@type": "Question",
                  name: f.q,
                  acceptedAnswer: { "@type": "Answer", text: f.a },
                })),
              }}
            />
          </>
        )}
      </div>
    </section>
  );
}
