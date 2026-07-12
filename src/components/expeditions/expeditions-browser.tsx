"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Search, ShieldCheck, Star, MapPin, Mountain, TriangleAlert, Building2, User as UserIcon, ChevronRight,
} from "lucide-react";

import { photo, formatPrice } from "@/lib/utils";
import {
  roleName,
  type ExpeditionCompanyRow, type ExpeditionProRow, type ExpeditionRole, type ExpeditionPeak, type ExpeditionRoute,
} from "@/lib/expeditions";

const MotionLink = motion.create(Link);

type Kind = "all" | "companies" | "individuals";

export function ExpeditionsBrowser({
  companies, pros, roles, peaks, routes,
}: {
  companies: ExpeditionCompanyRow[];
  pros: ExpeditionProRow[];
  roles: ExpeditionRole[];
  peaks: ExpeditionPeak[];
  routes: ExpeditionRoute[];
}) {
  const reduce = useReducedMotion();
  const [kind, setKind] = React.useState<Kind>("all");
  const [role, setRole] = React.useState("");
  const [peak, setPeak] = React.useState("");
  const [verifiedOnly, setVerifiedOnly] = React.useState(false);
  const [q, setQ] = React.useState("");

  const ql = q.trim().toLowerCase();
  const coShown = companies.filter((c) =>
    (!verifiedOnly || c.verified) &&
    (!peak || (c.peaks_handled ?? []).includes(peak) || (c.routes_handled ?? []).includes(peak)) &&
    (!ql || c.name.toLowerCase().includes(ql) || (c.city ?? "").toLowerCase().includes(ql))
  );
  const proShown = pros.filter((p) =>
    (!verifiedOnly || p.verified) &&
    (!role || p.role === role) &&
    (!peak || (p.available_peaks ?? []).includes(peak) || (p.peaks_summited ?? []).includes(peak) || (p.available_routes ?? []).includes(peak) || (p.routes_completed ?? []).includes(peak)) &&
    (!ql || p.full_name.toLowerCase().includes(ql) || (p.city ?? "").toLowerCase().includes(ql))
  );

  const showCo = kind === "all" || kind === "companies";
  const showPro = kind === "all" || kind === "individuals";
  const count = (showCo ? coShown.length : 0) + (showPro ? proShown.length : 0);

  return (
    <div className="container-px py-8">
      {/* Safety disclaimer */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-sm text-amber-800">
          <span className="font-semibold">Mountaineering and high-altitude trekking involve serious risks.</span> Rego does not guarantee the safety, success or summit completion of any expedition. Always review a provider&apos;s credentials, medical requirements, insurance, permits, weather conditions and official safety guidance before booking.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {([["all", "All"], ["companies", "Companies"], ["individuals", "Professionals"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k}
              className={"rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 " +
                (kind === k ? "bg-gradient-forest text-white shadow-soft" : "border border-border bg-white text-forest hover:bg-muted")}>
              {label}
            </button>
          ))}
          <span className="ml-auto text-sm text-muted-foreground"><span className="font-semibold text-forest">{count}</span> result{count === 1 ? "" : "s"}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-600/25">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search expeditions" placeholder="Search by name or city…" className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none" />
          </div>
          {showPro && (
            <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role" className="rounded-xl border border-border bg-white px-3 py-2 text-sm text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600">
              <option value="">All roles</option>
              {roles.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
            </select>
          )}
          <select value={peak} onChange={(e) => setPeak(e.target.value)} aria-label="Filter by peak" className="rounded-xl border border-border bg-white px-3 py-2 text-sm text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600">
            <option value="">All peaks & routes</option>
            <optgroup label="Peaks">{peaks.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}</optgroup>
            <optgroup label="Routes">{routes.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}</optgroup>
          </select>
          <button onClick={() => setVerifiedOnly((v) => !v)} aria-pressed={verifiedOnly}
            className={"inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 " +
              (verifiedOnly ? "bg-forest-600 text-white" : "border border-border bg-white text-forest hover:bg-muted")}>
            <ShieldCheck className="h-4 w-4" /> Verified
          </button>
        </div>
      </div>

      {count === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-20 text-center">
          <Mountain className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-display text-lg font-semibold text-forest">No expedition providers yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Check back soon, or adjust your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {showCo && coShown.map((c, i) => <CompanyCard key={c.id} c={c} i={i} reduce={!!reduce} />)}
          {showPro && proShown.map((p, i) => <ProCard key={p.id} p={p} i={i} roles={roles} reduce={!!reduce} />)}
        </div>
      )}
    </div>
  );
}

function Badges({ verified, featured }: { verified: boolean; featured: boolean }) {
  return (
    <div className="flex gap-1.5">
      {featured && <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-gold px-2 py-0.5 text-[10px] font-bold uppercase text-forest-900">Featured</span>}
      {verified && <span className="inline-flex items-center gap-0.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-forest-600 backdrop-blur"><ShieldCheck className="h-3 w-3 text-gold" /> Verified</span>}
    </div>
  );
}

function CompanyCard({ c, i, reduce }: { c: ExpeditionCompanyRow; i: number; reduce: boolean }) {
  return (
    <MotionLink href={`/expeditions/company/${c.id}`}
      initial={{ opacity: 0, y: reduce ? 0 : 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : i * 0.04 }}
      className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-all duration-300 hover:-translate-y-1.5 hover:shadow-premium-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2">
      <div className="relative h-36 overflow-hidden bg-forest-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo(c.cover_image || c.logo || "")} alt={c.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3"><span className="rounded-full bg-forest-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white"><Building2 className="mr-0.5 inline h-3 w-3" /> Company</span><Badges verified={c.verified} featured={c.featured} /></div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-base font-bold text-forest">{c.name}</h3>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {c.city || "Gilgit-Baltistan"}{c.years_experience ? ` · ${c.years_experience} yrs` : ""}</p>
        {(c.peaks_handled?.length ?? 0) > 0 && <p className="mt-2 line-clamp-1 text-xs text-forest/80">Peaks: {c.peaks_handled!.slice(0, 3).join(", ")}</p>}
        <div className="mt-3 flex items-center justify-between pt-1">
          <span className="flex items-center gap-1 text-xs"><Star className="h-3.5 w-3.5 fill-gold text-gold" /><span className="font-semibold text-forest">{c.rating.toFixed(1)}</span><span className="text-muted-foreground">({c.reviews})</span></span>
          {c.starting_price ? <span className="font-display text-sm font-bold text-forest">from {formatPrice(c.starting_price)}</span> : <span className="text-xs font-semibold text-forest-600">Request quote</span>}
        </div>
        <span className="mt-3 inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-forest px-3 py-2 text-sm font-semibold text-white">View company <ChevronRight className="h-4 w-4" /></span>
      </div>
    </MotionLink>
  );
}

function ProCard({ p, i, roles, reduce }: { p: ExpeditionProRow; i: number; roles: ExpeditionRole[]; reduce: boolean }) {
  return (
    <MotionLink href={`/expeditions/pro/${p.id}`}
      initial={{ opacity: 0, y: reduce ? 0 : 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : i * 0.04 }}
      className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-premium transition-all duration-300 hover:-translate-y-1.5 hover:shadow-premium-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2">
      <div className="relative h-36 overflow-hidden bg-forest-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo(p.cover_image || p.photo || "")} alt={p.full_name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3"><span className="rounded-full bg-forest-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white"><UserIcon className="mr-0.5 inline h-3 w-3" /> {roleName(roles, p.role)}</span><Badges verified={p.verified} featured={p.featured} /></div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-base font-bold text-forest">{p.full_name}</h3>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {p.home_village || p.city || "Gilgit-Baltistan"}{p.years_experience ? ` · ${p.years_experience} yrs` : ""}</p>
        {p.highest_peak && <p className="mt-2 text-xs text-forest/80">Highest: {p.highest_peak}{p.highest_altitude_m ? ` (${p.highest_altitude_m} m)` : ""}</p>}
        <div className="mt-3 flex items-center justify-between pt-1">
          <span className="flex items-center gap-1 text-xs"><Star className="h-3.5 w-3.5 fill-gold text-gold" /><span className="font-semibold text-forest">{p.rating.toFixed(1)}</span><span className="text-muted-foreground">({p.reviews})</span></span>
          {p.daily_rate ? <span className="font-display text-sm font-bold text-forest">{formatPrice(p.daily_rate)}/day</span> : <span className="text-xs font-semibold text-forest-600">Request quote</span>}
        </div>
        <span className="mt-3 inline-flex items-center justify-center gap-1 rounded-lg bg-gradient-forest px-3 py-2 text-sm font-semibold text-white">View profile <ChevronRight className="h-4 w-4" /></span>
      </div>
    </MotionLink>
  );
}
