"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  MapPin,
  CalendarRange,
  Plane,
  Camera,
  X,
  Images,
  Film,
  Sparkles,
  Award,
  Layers,
  Check,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { type MediaPortfolioRow } from "@/lib/media";
import { cn, photo } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

type EmbedKind = "youtube" | "vimeo" | "mp4" | "link";

export function videoEmbed(url: string): { kind: EmbedKind; src: string } {
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/
  );
  if (yt) return { kind: "youtube", src: `https://www.youtube.com/embed/${yt[1]}` };
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { kind: "vimeo", src: `https://player.vimeo.com/video/${vm[1]}` };
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url)) return { kind: "mp4", src: url };
  return { kind: "link", src: url };
}

const TABS = [
  "All",
  "Photos",
  "Videos",
  "Drone Reels",
  "Travel Projects",
  "Hotel & Resort Projects",
  "Event Projects",
  "Wedding Projects",
] as const;
type Tab = (typeof TABS)[number];

function matchTab(p: MediaPortfolioRow, tab: Tab): boolean {
  if (tab === "All") return true;
  if (tab === "Photos") return p.type === "photo";
  if (tab === "Videos") return p.type === "video";
  if (tab === "Drone Reels") return p.type === "reel";
  const c = (p.category || "").toLowerCase();
  if (tab === "Travel Projects")
    return c.includes("travel") || c.includes("tourism") || c.includes("destination") || c.includes("mountain");
  if (tab === "Hotel & Resort Projects")
    return c.includes("hotel") || c.includes("resort") || c.includes("restaurant") || c.includes("real estate");
  if (tab === "Event Projects") return c.includes("event") || c.includes("promotional");
  if (tab === "Wedding Projects") return c.includes("wedding");
  return false;
}

function fmtDate(d: string | null): string {
  if (!d) return "";
  const t = new Date(d);
  if (isNaN(t.getTime())) return d;
  return t.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/* stats strip                                                        */
/* ------------------------------------------------------------------ */

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border/70 bg-card px-3 py-4 text-center shadow-premium">
      <span className="text-forest-600">{icon}</span>
      <span className="mt-1.5 font-display text-2xl font-bold text-forest">{value}</span>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* card                                                               */
/* ------------------------------------------------------------------ */

function PortfolioCard({ p, onOpen }: { p: MediaPortfolioRow; onOpen: () => void }) {
  const isVideo = p.type === "video" || p.type === "reel" || !!p.video_url;
  const thumb = photo(p.url || (p.gallery && p.gallery[0]) || "");
  return (
    <motion.button
      layout
      onClick={onOpen}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card text-left shadow-premium transition-all duration-300 hover:-translate-y-1.5 hover:shadow-premium-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt={p.title || p.caption || ""}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-80" />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-forest backdrop-blur">
          {p.type === "reel" ? "Drone Reel" : p.type === "video" ? "Video" : "Photo"}
        </span>
        {isVideo && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-forest shadow-lg transition-transform duration-300 group-hover:scale-110">
              <Play className="h-5 w-5 translate-x-0.5 fill-current" />
            </span>
          </span>
        )}
        {p.category && (
          <span className="absolute bottom-2.5 left-2.5 right-2.5 truncate text-xs font-semibold text-white drop-shadow">
            {p.category}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="line-clamp-1 font-display text-base font-semibold text-forest">
          {p.title || p.caption || "Untitled project"}
        </h3>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {p.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {p.location}
            </span>
          )}
          {p.project_date && (
            <span className="inline-flex items-center gap-1">
              <CalendarRange className="h-3.5 w-3.5" /> {fmtDate(p.project_date)}
            </span>
          )}
        </div>
        {p.drone_model && (
          <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Plane className="h-3.5 w-3.5" /> {p.drone_model}
          </span>
        )}
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-forest-600 transition-colors group-hover:text-forest">
          View project <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* project viewer modal                                               */
/* ------------------------------------------------------------------ */

function ProjectViewer({
  p,
  onClose,
  onBookProvider,
  onRequestSimilar,
}: {
  p: MediaPortfolioRow;
  onClose: () => void;
  onBookProvider: () => void;
  onRequestSimilar: (p: MediaPortfolioRow) => void;
}) {
  const gallery = React.useMemo(() => {
    const g = [p.url, ...(p.gallery ?? [])].filter(Boolean) as string[];
    return Array.from(new Set(g));
  }, [p]);
  const embed = p.video_url ? videoEmbed(p.video_url) : null;
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        className="relative my-auto w-full max-w-3xl overflow-hidden rounded-3xl bg-card shadow-premium-lg"
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/70"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* media */}
        <div className="relative aspect-video w-full bg-black">
          {embed && embed.kind === "youtube" && (
            <iframe className="h-full w-full" src={embed.src} title={p.title || "video"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          )}
          {embed && embed.kind === "vimeo" && (
            <iframe className="h-full w-full" src={embed.src} title={p.title || "video"} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
          )}
          {embed && embed.kind === "mp4" && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video className="h-full w-full" src={embed.src} controls poster={photo(gallery[0] || "")} />
          )}
          {(!embed || embed.kind === "link") && gallery[active] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo(gallery[active])} alt={p.title || ""} className="h-full w-full object-contain" />
          )}
        </div>

        {/* thumbnails */}
        {!embed && gallery.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-5 pt-4">
            {gallery.map((g, i) => (
              <button
                key={g + i}
                onClick={() => setActive(i)}
                className={cn(
                  "h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition",
                  i === active ? "border-forest" : "border-transparent opacity-70 hover:opacity-100"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo(g)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* details */}
        <div className="p-5 sm:p-6">
          {p.category && (
            <span className="inline-block rounded-full bg-forest-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-forest-700">
              {p.category}
            </span>
          )}
          <h2 className="mt-2 font-display text-2xl font-bold text-forest">
            {p.title || p.caption || "Project"}
          </h2>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {p.location && <MetaCell icon={<MapPin className="h-4 w-4" />} label="Location" value={p.location} />}
            {p.project_date && <MetaCell icon={<CalendarRange className="h-4 w-4" />} label="Date" value={fmtDate(p.project_date)} />}
            {p.drone_model && <MetaCell icon={<Plane className="h-4 w-4" />} label="Drone" value={p.drone_model} />}
            {p.camera_quality && <MetaCell icon={<Camera className="h-4 w-4" />} label="Quality" value={p.camera_quality} />}
          </div>

          {p.description && (
            <p className="mt-4 whitespace-pre-line leading-relaxed text-muted-foreground">{p.description}</p>
          )}

          {p.services_included && p.services_included.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-forest">Included in this project</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.services_included.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-3 py-1 text-xs font-medium text-forest-700">
                    <Check className="h-3.5 w-3.5" /> {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* booking conversion */}
          <div className="mt-6 flex flex-col gap-2.5 border-t border-border pt-5 sm:flex-row">
            <Button
              variant="gold"
              size="lg"
              className="flex-1 rounded-lg"
              onClick={() => {
                onClose();
                onBookProvider();
              }}
            >
              Book this provider
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="flex-1 rounded-lg"
              onClick={() => {
                onClose();
                onRequestSimilar(p);
              }}
            >
              <Sparkles className="mr-1.5 h-4 w-4" /> Request similar shoot
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function MetaCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">
      <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </span>
      <span className="mt-0.5 block truncate text-sm font-semibold text-forest">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* main                                                               */
/* ------------------------------------------------------------------ */

export function PortfolioShowcase({
  portfolio,
  experienceYears,
  onBookProvider,
  onRequestSimilar,
}: {
  portfolio: MediaPortfolioRow[];
  experienceYears: number | null;
  onBookProvider: () => void;
  onRequestSimilar: (p: MediaPortfolioRow) => void;
}) {
  const [tab, setTab] = React.useState<Tab>("All");
  const [open, setOpen] = React.useState<MediaPortfolioRow | null>(null);

  if (portfolio.length === 0) return null;

  const photos = portfolio.filter((p) => p.type === "photo").length;
  const videos = portfolio.filter((p) => p.type === "video").length;
  const reels = portfolio.filter((p) => p.type === "reel").length;

  const visibleTabs = TABS.filter((t) => t === "All" || portfolio.some((p) => matchTab(p, t)));
  const filtered = portfolio.filter((p) => matchTab(p, tab));

  return (
    <section>
      <div className="flex items-center gap-2">
        <Layers className="h-5 w-5 text-forest-600" />
        <h2 className="font-display text-xl font-bold text-forest">Portfolio &amp; showcase</h2>
      </div>

      {/* statistics */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat icon={<Layers className="h-5 w-5" />} value={portfolio.length} label="Projects" />
        <Stat icon={<Images className="h-5 w-5" />} value={photos} label="Photos" />
        <Stat icon={<Film className="h-5 w-5" />} value={videos} label="Videos" />
        <Stat icon={<Play className="h-5 w-5" />} value={reels} label="Drone Reels" />
        <Stat icon={<Award className="h-5 w-5" />} value={experienceYears != null ? `${experienceYears}+` : "—"} label="Years Exp." />
      </div>

      {/* gallery tabs */}
      <div className="mt-5 flex flex-wrap gap-2">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              tab === t
                ? "bg-forest text-white shadow-premium"
                : "border border-border bg-card text-muted-foreground hover:text-forest"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* grid */}
      <motion.div layout className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((p) => (
            <PortfolioCard key={p.id} p={p} onOpen={() => setOpen(p)} />
          ))}
        </AnimatePresence>
      </motion.div>
      {filtered.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No projects in this category yet.</p>
      )}

      <AnimatePresence>
        {open && (
          <ProjectViewer
            p={open}
            onClose={() => setOpen(null)}
            onBookProvider={onBookProvider}
            onRequestSimilar={onRequestSimilar}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
