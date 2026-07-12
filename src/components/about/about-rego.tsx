"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight, Code2, Layers, Mountain, MapPin, Network, Target, Eye,
  ShieldCheck, Users, Sparkles, Compass, Car, Package, Store, GraduationCap,
  Briefcase, BadgeCheck, Quote, MonitorSmartphone,
} from "lucide-react";

import { Reveal } from "@/components/ui/reveal";
import { aboutContent as defaultAboutContent, type AboutContent } from "@/lib/about-content";
import { cn } from "@/lib/utils";

/**
 * Content flows through context so the exact same UI renders whether the copy
 * comes from the built-in defaults or from admin-edited Supabase data. The
 * markup below is unchanged — only the data source is swappable.
 */
const AboutCtx = React.createContext<AboutContent>(defaultAboutContent);
const useAbout = () => React.useContext(AboutCtx);

const HERO_IMG = "/home-hero.jpg";

/* icon maps keyed by the content config keys */
const HL_ICON: Record<string, React.ElementType> = {
  engineer: Code2, built: Layers, gb: Mountain, vision: Network,
};
const VAL_ICON: Record<string, React.ElementType> = {
  trust: ShieldCheck, local: Users, ux: Sparkles, innovation: Code2,
};
const SVC_ICON: Record<string, React.ElementType> = {
  tourism: Compass, ride: Car, delivery: Package, buysell: Store,
};

function initials(name: string) {
  return name.replace(/^Mr\.?\s+/i, "").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/* ---- shared bits ---- */
function Label({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <span className={cn("inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider",
      light ? "bg-white/10 text-gold" : "bg-gold/15 text-gold-700")}>
      {children}
    </span>
  );
}

function PrimaryCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-forest px-5 text-sm font-semibold text-white shadow-soft transition-opacity hover:opacity-95">
      {children} <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
function GoldCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-gold px-5 text-sm font-bold text-forest-900 shadow-gold-glow transition-opacity hover:opacity-95">
      {children}
    </Link>
  );
}
function OutlineCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-forest/25 bg-white px-5 text-sm font-semibold text-forest transition-colors hover:bg-muted">
      {children}
    </Link>
  );
}

export function AboutRego({ content }: { content?: AboutContent }) {
  return (
    <AboutCtx.Provider value={content ?? defaultAboutContent}>
      <div id="about">
        <AboutIntro />
        <CeoMessage />
        <FounderHighlights />
        <MissionVision />
        <CoreValues />
        <Ecosystem />
        <DigitalGbBanner />
      </div>
    </AboutCtx.Provider>
  );
}

/* ============================ 1. ABOUT REGO ============================ */
function AboutIntro() {
  const { intro } = useAbout();
  return (
    <section className="bg-background py-16 sm:py-20">
      <div className="container-px grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <Reveal>
          <Label>{intro.label}</Label>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-forest sm:text-4xl">
            {intro.heading}
          </h2>
          <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
            {intro.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <p className="mt-6 font-display text-lg font-bold tracking-wide text-forest">
            {intro.tagline.split("•").map((w, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="mx-1 text-gold">•</span>}
                {w.trim()}
              </React.Fragment>
            ))}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <PrimaryCta href={intro.ctas[0].href}>{intro.ctas[0].label}</PrimaryCta>
            <OutlineCta href={intro.ctas[1].href}>{intro.ctas[1].label}</OutlineCta>
          </div>
        </Reveal>

        {/* Visual */}
        <Reveal index={1} className="relative">
          <div className="relative overflow-hidden rounded-[24px] border-4 border-white shadow-premium ring-1 ring-gold/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HERO_IMG} alt="Mountains and valleys of Gilgit-Baltistan" loading="lazy" decoding="async"
              className="h-[420px] w-full object-cover" />
            <span className="pointer-events-none absolute right-4 top-4 h-10 w-10 rounded-tr-2xl border-r-2 border-t-2 border-gold/70" />
            <span className="pointer-events-none absolute bottom-4 left-4 h-10 w-10 rounded-bl-2xl border-b-2 border-l-2 border-gold/70" />
          </div>
          {/* floating info cards */}
          <div className="pointer-events-none absolute -left-3 top-8 hidden sm:block">
            <FloatCard>{intro.floatingCards[0]}</FloatCard>
          </div>
          <div className="pointer-events-none absolute -right-3 bottom-16 hidden sm:block">
            <FloatCard>{intro.floatingCards[3]}</FloatCard>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:hidden">
            {intro.floatingCards.map((c) => <FloatCard key={c}>{c}</FloatCard>)}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
function FloatCard({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 rounded-2xl border border-border/70 bg-white/95 px-3.5 py-2.5 text-xs font-semibold text-forest shadow-premium backdrop-blur">
      <BadgeCheck className="h-4 w-4 shrink-0 text-gold" /> {children}
    </span>
  );
}

/* ==================== 2. CEO MESSAGE + 3. FOUNDER CARD ==================== */
function CeoMessage() {
  const { ceo } = useAbout();
  return (
    <section className="bg-muted/40 py-16 sm:py-20">
      <div className="container-px">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Label>Message from the Founder</Label>
          <h2 className="mt-4 font-display text-3xl font-bold text-forest sm:text-4xl">
            {ceo.sectionTitle}
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
          {/* Founder card — first in DOM so it appears first on mobile */}
          <div className="lg:order-2">
            <FounderCard />
          </div>

          {/* CEO message */}
          <Reveal index={1} className="lg:order-1">
            <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft sm:p-8">
              <Quote className="h-8 w-8 text-gold/70" />
              <p className="mt-3 font-display text-lg font-bold text-forest">{ceo.name}</p>
              <p className="text-sm text-muted-foreground">{ceo.title}</p>

              <div className="mt-6 space-y-6">
                {ceo.blocks.map((b) => (
                  <div key={b.heading}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gold-700">{b.heading}</h3>
                    <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
                      {b.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Achievement highlight */}
              <div className="mt-7 flex items-start gap-3 rounded-2xl border-l-4 border-gold bg-gold/5 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold-700">
                  <MonitorSmartphone className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gold-700">{ceo.achievement.label}</p>
                  <p className="mt-1 text-sm text-forest">{ceo.achievement.description}</p>
                </div>
              </div>

              {/* Signature */}
              <div className="mt-7 border-t border-border pt-5">
                <p className="font-signature text-3xl text-forest">{ceo.signature.name}</p>
                <div className="mt-1 text-xs text-muted-foreground">
                  {ceo.signature.lines.map((l) => <p key={l}>{l}</p>)}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function FounderCard() {
  const { founder } = useAbout();
  const [imgOk, setImgOk] = React.useState(true);
  const rows = [
    { icon: Briefcase, label: founder.background },
    { icon: GraduationCap, label: founder.education },
    { icon: MapPin, label: founder.hometown },
    { icon: Code2, label: founder.role },
  ];
  return (
    <Reveal className="lg:sticky lg:top-28">
      <div className="group relative overflow-hidden rounded-3xl bg-gradient-forest-deep p-6 text-white shadow-premium ring-1 ring-gold/20 transition-transform duration-300 hover:-translate-y-1">
        {/* subtle mountain + tech pattern */}
        <svg viewBox="0 0 400 120" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-[0.12]" aria-hidden>
          <path d="M0 120 L80 40 L140 90 L220 20 L300 80 L400 30 L400 120 Z" fill="#E5B94B" />
        </svg>
        <div className="pointer-events-none absolute right-4 top-4 h-16 w-16 rounded-tr-3xl border-r-2 border-t-2 border-gold/40" />

        <div className="relative">
          <div className="mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-2xl bg-white/10 ring-2 ring-gold/50">
            {imgOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={founder.photo} alt={`${founder.name}, ${founder.position} of Rego`} loading="lazy"
                onError={() => setImgOk(false)} className="h-full w-full object-cover" />
            ) : (
              <span className="font-display text-3xl font-bold text-gold">{initials(founder.name)}</span>
            )}
          </div>

          <div className="mt-4 text-center">
            <p className="font-display text-lg font-bold">{founder.name}</p>
            <p className="text-sm text-gold">{founder.position}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold">
              <BadgeCheck className="h-3.5 w-3.5" /> {founder.badge}
            </span>
          </div>

          <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
            {rows.map((r, i) => {
              const Icon = r.icon;
              return (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-gold">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-white/85">{r.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* ======================= 4. FOUNDER HIGHLIGHTS ======================= */
function FounderHighlights() {
  const C = useAbout();
  return (
    <section className="bg-background py-14 sm:py-16">
      <div className="container-px grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {C.highlights.map((h, i) => {
          const Icon = HL_ICON[h.key] ?? Code2;
          return (
            <Reveal key={h.key} index={i}>
              <div className="group h-full rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-all hover:-translate-y-1 hover:shadow-premium">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-gold/15 text-gold-700 transition-transform group-hover:scale-110">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-display text-sm font-bold uppercase tracking-wide text-forest">{h.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{h.description}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/* ======================= 5. MISSION & VISION ======================= */
function MissionVision() {
  const C = useAbout();
  const cards = [
    { d: C.mission, icon: Target, tone: "forest" as const },
    { d: C.vision, icon: Eye, tone: "gold" as const },
  ];
  return (
    <section className="bg-muted/40 py-16 sm:py-20">
      <div className="container-px grid gap-6 lg:grid-cols-2">
        {cards.map(({ d, icon: Icon, tone }, i) => (
          <Reveal key={d.label} index={i}>
            <div className={cn("h-full rounded-3xl p-8 shadow-premium",
              tone === "forest" ? "bg-gradient-forest-deep text-white" : "border border-border/70 bg-card")}>
              <span className={cn("grid h-14 w-14 place-items-center rounded-2xl",
                tone === "forest" ? "bg-white/10 text-gold" : "bg-gold/15 text-gold-700")}>
                <Icon className="h-7 w-7" />
              </span>
              <p className={cn("mt-5 text-xs font-bold uppercase tracking-wider", tone === "forest" ? "text-gold" : "text-gold-700")}>{d.label}</p>
              <h3 className={cn("mt-2 font-display text-2xl font-bold", tone === "forest" ? "text-white" : "text-forest")}>{d.heading}</h3>
              <p className={cn("mt-3 text-[15px] leading-relaxed", tone === "forest" ? "text-white/80" : "text-muted-foreground")}>{d.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ========================= 6. CORE VALUES ========================= */
function CoreValues() {
  return (
    <section className="bg-background py-16 sm:py-20">
      <div className="container-px">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Label>The Values Behind Rego</Label>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Our values guide how we develop technology, support local businesses and create meaningful digital experiences for travelers, residents and communities.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {useAbout().values.map((v, i) => {
            const Icon = VAL_ICON[v.key] ?? ShieldCheck;
            return (
              <Reveal key={v.key} index={i}>
                <div className="group h-full rounded-2xl border border-border/70 bg-card p-6 text-center shadow-soft transition-all hover:-translate-y-1 hover:shadow-premium">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gold/15 text-gold-700 transition-transform group-hover:scale-110">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 font-display text-sm font-bold uppercase tracking-wide text-forest">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.description}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ========================= 7. REGO ECOSYSTEM ========================= */
function Ecosystem() {
  const { ecosystem } = useAbout();
  return (
    <section className="bg-muted/40 py-16 sm:py-20">
      <div className="container-px">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Label>{ecosystem.label}</Label>
          <h2 className="mt-4 font-display text-3xl font-bold text-forest sm:text-4xl">{ecosystem.heading}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{ecosystem.description}</p>
        </Reveal>

        <div className="relative mt-12">
          {/* connection line (desktop) */}
          <span className="pointer-events-none absolute left-0 right-0 top-1/2 hidden h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-gold/40 to-transparent lg:block" aria-hidden />
          <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ecosystem.services.map((s, i) => {
              const Icon = SVC_ICON[s.key] ?? Compass;
              const active = s.status === "active";
              const inner = (
                <div className={cn(
                  "flex h-full flex-col rounded-2xl border p-6 shadow-soft transition-all hover:-translate-y-1.5 hover:shadow-premium",
                  active ? "border-gold/50 bg-gradient-forest-deep text-white ring-1 ring-gold/30" : "border-border/70 bg-card")}>
                  <div className="flex items-center justify-between">
                    <span className={cn("grid h-12 w-12 place-items-center rounded-xl", active ? "bg-white/10 text-gold" : "bg-forest-50 text-forest-600")}>
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                      active ? "bg-gold text-forest-900" : "bg-muted text-muted-foreground")}>
                      {s.statusLabel}
                    </span>
                  </div>
                  <h3 className={cn("mt-4 font-display text-lg font-bold", active ? "text-white" : "text-forest")}>{s.name}</h3>
                  <p className={cn("mt-2 flex-1 text-sm leading-relaxed", active ? "text-white/80" : "text-muted-foreground")}>{s.description}</p>
                  {active ? (
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold">Explore now <ArrowRight className="h-4 w-4" /></span>
                  ) : (
                    <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">In development</span>
                  )}
                </div>
              );
              return (
                <Reveal key={s.key} index={i}>
                  {active && s.href ? <Link href={s.href} className="block h-full">{inner}</Link> : inner}
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================== 8. BUILDING A DIGITAL GILGIT-BALTISTAN ================== */
function DigitalGbBanner() {
  const { banner } = useAbout();
  return (
    <section className="bg-background py-16 sm:py-20">
      <div className="container-px">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-forest-deep px-6 py-14 text-center shadow-premium sm:px-12">
          {/* subtle network / map background */}
          <svg viewBox="0 0 600 300" className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]" aria-hidden preserveAspectRatio="xMidYMid slice">
            <g stroke="#E5B94B" strokeWidth="1" fill="none">
              <path d="M60 220 L180 120 L300 200 L420 90 L540 180" />
              <path d="M60 220 L200 250 L360 210 L520 250" />
            </g>
            <g fill="#E5B94B">
              {[[60,220],[180,120],[300,200],[420,90],[540,180],[200,250],[360,210],[520,250]].map(([x,y],i)=>(
                <circle key={i} cx={x} cy={y} r="4" />
              ))}
            </g>
          </svg>
          <div className="relative mx-auto max-w-2xl">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-gold">
              <Mountain className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-display text-2xl font-bold text-white sm:text-3xl">{banner.heading}</h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-white/80">{banner.description}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <GoldCta href={banner.ctas[0].href}>{banner.ctas[0].label}</GoldCta>
              <Link href={banner.ctas[1].href} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/5 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                {banner.ctas[1].label}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
