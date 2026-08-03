import type { Metadata } from "next";
import { Briefcase, MapPin, Building2 } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { JobsBrowser } from "@/components/jobs/jobs-browser";
import { buildMetadata } from "@/lib/seo";
import { getPublishedJobs, careerToJob } from "@/lib/jobs";
import { getJobOpenings } from "@/lib/careers";

export const revalidate = 60;

export const metadata: Metadata = buildMetadata({
  title: "Tourism Jobs in Gilgit-Baltistan",
  description:
    "Find tourism and hospitality jobs across Gilgit-Baltistan — hotel, restaurant, tour guide, driver, photographer and adventure roles from verified Rego businesses in Skardu, Gilgit, Hunza and beyond.",
  path: "/jobs",
});

export default async function JobsPage() {
  // Provider vacancies (approved) + Rego's own careers openings, in one list.
  const [providerJobs, careers] = await Promise.all([
    getPublishedJobs(),
    getJobOpenings(),
  ]);
  const jobs = [...providerJobs, ...careers.map(careerToJob)];

  const cities = Array.from(new Set(jobs.map((j) => j.city).filter(Boolean))).slice(0, 6) as string[];
  const businesses = new Set(jobs.map((j) => j.business_name)).size;

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-gradient-forest text-white">
          <div className="container-px py-14 sm:py-16">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold">
              <Briefcase className="h-3.5 w-3.5" /> Rego Jobs
            </span>
            <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold uppercase leading-tight sm:text-4xl">
              Tourism Jobs in Gilgit-Baltistan
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
              Hotels, restaurants, tour companies, transport, guides and adventure businesses across
              the north are hiring. Every employer on Rego is a registered, reviewed business.
            </p>

            <div className="mt-6 flex flex-wrap gap-5 text-sm">
              <span className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-gold" />
                <strong>{jobs.length}</strong> open {jobs.length === 1 ? "vacancy" : "vacancies"}
              </span>
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gold" />
                <strong>{businesses}</strong> hiring {businesses === 1 ? "business" : "businesses"}
              </span>
              {cities.length > 0 && (
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gold" /> {cities.join(" · ")}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Browser */}
        <section className="container-px py-10 sm:py-12">
          <JobsBrowser jobs={jobs} />
        </section>

        {/* SEO copy */}
        <section className="border-t border-border bg-muted/30">
          <div className="container-px py-10">
            <h2 className="font-display text-lg font-bold text-forest">
              Hiring across Gilgit-Baltistan
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Rego connects tourism employers with local talent across Skardu, Gilgit, Hunza, Nagar,
              Ghizer, Astore, Shigar, Khaplu and Diamer. Browse hotel jobs, restaurant jobs, tour
              guide jobs, driver and transport jobs, photography work and seasonal adventure roles —
              all posted by verified businesses on the Rego marketplace.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
