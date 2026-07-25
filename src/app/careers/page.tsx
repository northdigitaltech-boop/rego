import type { Metadata } from "next";
import { Briefcase, MapPin, Clock, ArrowRight, Sparkles, HeartHandshake, Mountain } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { buildMetadata } from "@/lib/seo";
import { jobsByDepartment, CAREERS_EMAIL } from "@/lib/careers";

export const metadata: Metadata = buildMetadata({
  title: "Careers — Join the Rego Team",
  description:
    "We're hiring across Gilgit-Baltistan. Explore open roles at Rego and help build the region's leading travel marketplace.",
  path: "/careers",
});

const perks = [
  { icon: Mountain, title: "Build for GB", desc: "Grow tourism and digital opportunity across your own region." },
  { icon: HeartHandshake, title: "Real impact", desc: "Directly connect local businesses to travelers from day one." },
  { icon: Sparkles, title: "Grow with us", desc: "Join early and grow as Rego expands across the north." },
];

export default function CareersPage() {
  const groups = jobsByDepartment();

  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="bg-gradient-forest text-white">
          <div className="container-px py-16 sm:py-20">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold">
              <Briefcase className="h-3.5 w-3.5" /> We're hiring
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold sm:text-5xl">Join the Rego Team</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
              We're building the leading travel marketplace for Gilgit-Baltistan — and we need passionate people
              across the region to help local tourism businesses reach the world. Find your role below.
            </p>
          </div>
        </section>

        {/* Perks */}
        <section className="border-b border-border bg-background">
          <div className="container-px grid gap-6 py-10 sm:grid-cols-3">
            {perks.map((p) => (
              <div key={p.title} className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-forest-50 text-forest-600">
                  <p.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-base font-semibold text-forest">{p.title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Open positions */}
        <section className="bg-muted/30">
          <div className="container-px py-12 sm:py-16">
            <h2 className="font-display text-2xl font-bold text-forest">Open Positions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {jobsByDepartment().reduce((n, g) => n + g.jobs.length, 0)} roles open. Apply by email — we read every application.
            </p>

            <div className="mt-8 space-y-10">
              {groups.map((g) => (
                <div key={g.department}>
                  <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-forest">
                    <span className="rounded-full bg-gold/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gold-700">
                      {g.department}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">{g.jobs.length} open</span>
                  </h3>

                  <div className="grid gap-4 lg:grid-cols-2">
                    {g.jobs.map((job) => {
                      const mailto = `mailto:${CAREERS_EMAIL}?subject=${encodeURIComponent(
                        `Application: ${job.title}`
                      )}&body=${encodeURIComponent(
                        `Hi Rego team,\n\nI'd like to apply for the ${job.title} role.\n\nName:\nLocation:\nPhone / WhatsApp:\nRelevant experience:\n\n(Please attach your CV.)\n\nThank you.`
                      )}`;
                      return (
                        <article
                          key={job.id}
                          className="flex flex-col rounded-3xl border border-border/70 bg-card p-5 shadow-soft transition-shadow hover:shadow-premium"
                        >
                          <h4 className="font-display text-lg font-semibold text-forest">{job.title}</h4>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2.5 py-1 font-semibold text-forest-700">
                              <MapPin className="h-3.5 w-3.5" /> {job.location}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-semibold text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" /> {job.type}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{job.summary}</p>
                          <ul className="mt-3 space-y-1.5">
                            {job.responsibilities.map((r) => (
                              <li key={r} className="flex items-start gap-2 text-sm text-forest-800">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                                {r}
                              </li>
                            ))}
                          </ul>
                          <a
                            href={mailto}
                            className="mt-4 inline-flex items-center gap-1.5 self-start rounded-lg bg-gradient-forest px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
                          >
                            Apply now <ArrowRight className="h-4 w-4" />
                          </a>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Open application */}
            <div className="mt-12 rounded-3xl border border-gold/40 bg-gold/10 p-6 text-center">
              <h3 className="font-display text-lg font-bold text-forest">Don't see your role?</h3>
              <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
                We're always looking for great people who love travel and Gilgit-Baltistan. Send us your CV and tell us how you'd like to contribute.
              </p>
              <a
                href={`mailto:${CAREERS_EMAIL}?subject=${encodeURIComponent("Open application — Rego")}`}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-forest-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-700"
              >
                Send an open application <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
