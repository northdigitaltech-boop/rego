import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MapPin,
  Briefcase,
  Clock,
  CalendarDays,
  Users2,
  BadgeCheck,
  ChevronRight,
  Building2,
  Mail,
  Phone,
  Wallet,
  GraduationCap,
} from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { JobCard } from "@/components/jobs/jobs-browser";
import { ApplyJobButton } from "@/components/jobs/apply-job";
import { JsonLd } from "@/components/seo/json-ld";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";
import { getJobBySlug, getSimilarJobs, salaryLabel, jobLocation, type JobRow } from "@/lib/jobs";
import { photo } from "@/lib/utils";

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
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) return buildMetadata({ title: "Job not found", path: `/jobs/${slug}`, noindex: true });

  return buildMetadata({
    title: `${job.title} at ${job.business_name} — ${jobLocation(job)}`,
    description:
      (job.description ?? "").slice(0, 155) ||
      `${job.employment_type} ${job.title} vacancy at ${job.business_name} in ${jobLocation(job)}. Apply on Rego.`,
    path: `/jobs/${slug}`,
    type: "article",
    // Unpublished jobs must never be indexed.
    noindex: job.status !== "published",
  });
}

/** schema.org JobPosting — powers Google Jobs rich results. */
function jobPostingSchema(job: JobRow) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: [job.description, job.responsibilities, job.skills].filter(Boolean).join("<br/>"),
    datePosted: job.published_at ?? job.created_at,
    validThrough: job.deadline ?? undefined,
    employmentType: job.employment_type?.toUpperCase().replace("-", "_"),
    hiringOrganization: {
      "@type": "Organization",
      name: job.business_name,
      logo: job.business_logo ?? undefined,
    },
    jobLocationType: job.workplace_type === "Remote" ? "TELECOMMUTE" : undefined,
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.city ?? undefined,
        addressRegion: job.district ?? "Gilgit-Baltistan",
        addressCountry: "PK",
      },
    },
    baseSalary:
      job.salary_disclosed && (job.salary_min || job.salary_max)
        ? {
            "@type": "MonetaryAmount",
            currency: "PKR",
            value: {
              "@type": "QuantitativeValue",
              minValue: job.salary_min ?? undefined,
              maxValue: job.salary_max ?? undefined,
              unitText: (job.salary_period ?? "month").toUpperCase(),
            },
          }
        : undefined,
    totalJobOpenings: job.vacancies,
    url: `${siteConfig.url}/jobs/${job.slug}`,
  };
}

function breadcrumbSchema(job: JobRow) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Jobs", item: `${siteConfig.url}/jobs` },
      { "@type": "ListItem", position: 3, name: job.title, item: `${siteConfig.url}/jobs/${job.slug}` },
    ],
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) notFound();

  const similar = await getSimilarJobs(job, 3);
  const lines = (text?: string | null) =>
    (text ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

  return (
    <>
      <JsonLd data={[jobPostingSchema(job), breadcrumbSchema(job)]} />
      <Navbar />
      <main className="min-h-screen bg-muted/20">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="border-b border-border bg-card">
          <div className="container-px flex items-center gap-1.5 py-3 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-forest">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/jobs" className="hover:text-forest">Jobs</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="truncate font-semibold text-forest">{job.title}</span>
          </div>
        </nav>

        <div className="container-px grid gap-6 py-8 lg:grid-cols-[1fr_340px]">
          {/* Main */}
          <div className="space-y-6">
            <header className="rounded-3xl border border-border bg-card p-6 shadow-premium">
              <div className="flex items-start gap-4">
                {job.business_logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo(job.business_logo, 160)} alt="" className="h-16 w-16 shrink-0 rounded-2xl border border-border object-cover" />
                ) : (
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-forest font-display text-2xl font-bold text-gold">
                    {job.business_name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-2xl font-bold leading-tight text-forest">{job.title}</h1>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                    <Building2 className="h-4 w-4 text-forest-600" />
                    {job.business_name}
                    {job.business_verified && <BadgeCheck className="h-4 w-4 fill-gold text-white" />}
                  </p>
                </div>
                {job.urgent && (
                  <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase text-red-600">
                    Urgent
                  </span>
                )}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Fact icon={MapPin} label="Location" value={jobLocation(job)} />
                <Fact icon={Briefcase} label="Employment" value={job.employment_type} />
                <Fact icon={Clock} label="Workplace" value={job.workplace_type} />
                <Fact icon={Wallet} label="Salary" value={salaryLabel(job)} />
                <Fact icon={Users2} label="Vacancies" value={String(job.vacancies)} />
                {job.experience_level && (
                  <Fact icon={GraduationCap} label="Experience" value={job.experience_level} />
                )}
                {job.deadline && (
                  <Fact
                    icon={CalendarDays}
                    label="Apply before"
                    value={new Date(job.deadline).toLocaleDateString()}
                  />
                )}
              </div>
            </header>

            {job.description && (
              <Section title="Job description">
                <p className="whitespace-pre-line text-sm leading-relaxed text-forest-800">{job.description}</p>
              </Section>
            )}

            {lines(job.responsibilities).length > 0 && (
              <Section title="Responsibilities">
                <ul className="space-y-2">
                  {lines(job.responsibilities).map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-forest-800">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                      {r}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {job.skills && (
              <Section title="Required skills">
                <p className="whitespace-pre-line text-sm leading-relaxed text-forest-800">{job.skills}</p>
              </Section>
            )}

            <Section title={`About ${job.business_name}`}>
              <p className="text-sm text-muted-foreground">
                {job.business_name} is a registered {job.business_category ?? "tourism"} business on
                Rego{job.city ? `, based in ${job.city}` : ""}.
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                {job.contact_email && (
                  <a href={`mailto:${job.contact_email}`} className="inline-flex items-center gap-1.5 font-semibold text-forest-600 hover:text-gold">
                    <Mail className="h-4 w-4" /> {job.contact_email}
                  </a>
                )}
                {job.contact_phone && (
                  <a href={`tel:${job.contact_phone}`} className="inline-flex items-center gap-1.5 font-semibold text-forest-600 hover:text-gold">
                    <Phone className="h-4 w-4" /> {job.contact_phone}
                  </a>
                )}
              </div>
            </Section>
          </div>

          {/* Sticky apply rail */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-premium">
              <p className="font-display text-lg font-bold text-forest">{salaryLabel(job)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {job.employment_type} · {job.workplace_type} · {jobLocation(job)}
              </p>
              <div className="mt-4">
                <ApplyJobButton job={job} />
              </div>
              {job.deadline && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Applications close {new Date(job.deadline).toLocaleDateString()}
                </p>
              )}
            </div>
          </aside>
        </div>

        {/* Similar jobs */}
        {similar.length > 0 && (
          <section className="container-px pb-12">
            <h2 className="mb-4 font-display text-lg font-bold text-forest">Similar jobs</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((j) => <JobCard key={j.id} job={j} />)}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-600">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold text-forest">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-premium">
      <h2 className="font-display text-lg font-bold text-forest">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
