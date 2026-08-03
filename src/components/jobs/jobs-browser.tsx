"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  MapPin,
  Briefcase,
  Clock,
  CalendarDays,
  SlidersHorizontal,
  X,
  Sparkles,
  ArrowRight,
  BadgeCheck,
} from "lucide-react";

import {
  EMPLOYMENT_TYPES,
  JOB_CATEGORIES,
  salaryLabel,
  jobLocation,
  type JobRow,
} from "@/lib/jobs";
import { cn, photo } from "@/lib/utils";

const PAGE_SIZE = 9;

/** Rego's own careers roles are synthesised with this id prefix. */
export const REGO_CAREER_PREFIX = "rego-career-";

/** Careers roles apply on /careers; provider jobs use their own detail page. */
function hrefFor(job: JobRow): string | undefined {
  return job.id.startsWith(REGO_CAREER_PREFIX) ? "/careers" : undefined;
}

/** Public job card — business identity, location, type, salary, deadline. */
export function JobCard({ job, href }: { job: JobRow; href?: string }) {
  const deadline = job.deadline ? new Date(job.deadline) : null;
  const daysLeft = deadline
    ? Math.ceil((deadline.getTime() - Date.now()) / 86400000)
    : null;

  return (
    <article className="group relative flex flex-col rounded-3xl border border-border/70 bg-card p-5 shadow-premium transition-all hover:-translate-y-1 hover:shadow-premium-lg">
      {/* `href` lets Rego's own careers roles point at /careers instead. */}
      <Link href={href ?? `/jobs/${job.slug}`} className="absolute inset-0 z-10" aria-label={job.title} />

      <div className="flex items-start gap-3">
        {job.business_logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo(job.business_logo, 120)}
            alt=""
            loading="lazy"
            className="h-12 w-12 shrink-0 rounded-xl border border-border object-cover"
          />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-forest font-display text-lg font-bold text-gold">
            {job.business_name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-display text-base font-bold leading-snug text-forest group-hover:text-forest-600">
            {job.title}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-semibold text-muted-foreground">
            {job.business_name}
            {job.business_verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-gold text-white" />}
          </p>
        </div>
        {job.urgent && (
          <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">
            Urgent
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip icon={MapPin}>{jobLocation(job)}</Chip>
        <Chip icon={Briefcase}>{job.employment_type}</Chip>
        {job.workplace_type !== "On-site" && <Chip icon={Clock}>{job.workplace_type}</Chip>}
      </div>

      <p className="mt-3 font-display text-sm font-bold text-forest">{salaryLabel(job)}</p>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {daysLeft === null
            ? "Open"
            : daysLeft < 0
              ? "Closed"
              : daysLeft === 0
                ? "Last day"
                : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
        </span>
        <span className="relative z-20 inline-flex items-center gap-1 rounded-lg bg-gradient-forest px-3 py-1.5 text-xs font-semibold text-white">
          View Job <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </article>
  );
}

function Chip({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2 py-0.5 text-[11px] font-semibold text-forest-700">
      <Icon className="h-3 w-3" /> {children}
    </span>
  );
}

/** Search + filters + featured/latest + pagination. */
export function JobsBrowser({ jobs }: { jobs: JobRow[] }) {
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [city, setCity] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const cities = React.useMemo(
    () => Array.from(new Set(jobs.map((j) => j.city).filter(Boolean))).sort() as string[],
    [jobs]
  );

  const results = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    return jobs.filter((j) => {
      if (category !== "all" && j.category !== category) return false;
      if (city !== "all" && j.city !== city) return false;
      if (type !== "all" && j.employment_type !== type) return false;
      if (!t) return true;
      return `${j.title} ${j.business_name} ${j.category ?? ""} ${j.city ?? ""} ${j.skills ?? ""}`
        .toLowerCase()
        .includes(t);
    });
  }, [jobs, q, category, city, type]);

  React.useEffect(() => setPage(1), [q, category, city, type]);

  const featured = results.filter((j) => j.featured);
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const shown = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const reset = () => {
    setQ("");
    setCategory("all");
    setCity("all");
    setType("all");
  };
  const activeFilters = [category, city, type].filter((v) => v !== "all").length;

  const filterControls = (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">Category</span>
        <select className="auth-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {JOB_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">Location</span>
        <select className="auth-input" value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="all">All locations</option>
          {cities.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">Employment type</span>
        <select className="auth-input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All types</option>
          {EMPLOYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </label>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-soft focus-within:border-forest-600">
          <Search className="h-5 w-5 shrink-0 text-forest-600" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search jobs, businesses or skills…"
            className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none"
          />
        </label>
        {/* Mobile filter toggle */}
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-forest sm:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters
          {activeFilters > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-forest-600 px-1 text-[11px] font-bold text-white">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* Filters — always visible from sm up, toggled on mobile */}
      <div className={cn("rounded-2xl border border-border bg-card p-4", !filtersOpen && "hidden sm:block")}>
        {filterControls}
        {(activeFilters > 0 || q) && (
          <button onClick={reset} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-forest-600 hover:text-gold">
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
      </div>

      {/* Featured */}
      {featured.length > 0 && page === 1 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-forest">
            <Sparkles className="h-5 w-5 text-gold" /> Featured Jobs
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.slice(0, 3).map((j) => <JobCard key={j.id} job={j} href={hrefFor(j)} />)}
          </div>
        </section>
      )}

      {/* Latest / results */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-forest">
          {q || activeFilters > 0 ? `${results.length} job${results.length === 1 ? "" : "s"} found` : "Latest Jobs"}
        </h2>

        {shown.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/30 p-12 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 font-display text-base font-bold text-forest">No jobs match your search</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try clearing the filters, or check back soon — new vacancies are posted regularly.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((j) => <JobCard key={j.id} job={j} href={hrefFor(j)} />)}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-forest disabled:opacity-40 hover:bg-muted"
            >
              Previous
            </button>
            {Array.from({ length: pages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={cn(
                  "h-9 w-9 rounded-lg text-sm font-semibold transition-colors",
                  page === i + 1 ? "bg-gradient-forest text-white" : "border border-border text-forest hover:bg-muted"
                )}
              >
                {i + 1}
              </button>
            ))}
            <button
              disabled={page === pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-forest disabled:opacity-40 hover:bg-muted"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
