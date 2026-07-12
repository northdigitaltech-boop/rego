"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Clock,
  ShieldCheck,
  RefreshCw,
  Bell,
  BellRing,
  Megaphone,
  X,
  Loader2,
  Route as RouteIcon,
  BadgeCheck,
  Info,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { MultiImageUpload } from "@/components/ui/image-upload";
import {
  ROADS,
  ROAD_REASONS,
  REPORTER_REGIONS,
  statusLabel,
  statusTone,
  alertTone,
  bannerText,
  defaultSafetyMessage,
  getPublicRoadUpdates,
  createRoadReport,
  applyAsReporter,
  isTrustedReporter,
  subscribeToRoad,
  unsubscribeFromRoad,
  getMySubs,
  type RoadUpdateRow,
} from "@/lib/road-updates";
import { sendEmail } from "@/lib/email";
import { cn } from "@/lib/utils";

const ADMIN_EMAIL = "northdigitaltech@gmail.com";
const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function RoadUpdates() {
  const { user } = useAuth();
  const [updates, setUpdates] = React.useState<Record<string, RoadUpdateRow>>({});
  const [loading, setLoading] = React.useState(true);
  const [lastSync, setLastSync] = React.useState<Date | null>(null);
  const [subs, setSubs] = React.useState<string[]>([]);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [applyOpen, setApplyOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    const rows = await getPublicRoadUpdates();
    const map: Record<string, RoadUpdateRow> = {};
    for (const r of rows) map[r.road_key] = r;
    setUpdates(map);
    setLastSync(new Date());
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  React.useEffect(() => {
    if (user) getMySubs(user.email).then(setSubs);
    else setSubs([]);
  }, [user]);

  const toggleSub = async (roadKey: string) => {
    if (!user) return;
    if (subs.includes(roadKey)) {
      await unsubscribeFromRoad(roadKey, user.email);
      setSubs((p) => p.filter((k) => k !== roadKey));
    } else {
      await subscribeToRoad(roadKey, user.email);
      setSubs((p) => [...p, roadKey]);
    }
  };

  // Banners: show blocked/critical first, then freshly opened.
  const banners = ROADS.map((r) => updates[r.key]).filter(
    (u): u is RoadUpdateRow => !!u && (u.status === "blocked" || u.status === "open")
  );
  const blockedBanners = banners.filter((u) => u.status === "blocked");
  const openBanners = banners.filter((u) => u.status === "open");

  return (
    <div className="space-y-8">
      {/* Alert banners */}
      {(blockedBanners.length > 0 || openBanners.length > 0) && (
        <div className="space-y-3">
          {blockedBanners.map((u) => (
            <div
              key={u.id}
              className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-800 shadow-soft"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <p className="font-medium">{bannerText(u)}</p>
            </div>
          ))}
          {openBanners.map((u) => (
            <div
              key={u.id}
              className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3.5 text-sm text-green-800 shadow-soft"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              <p className="font-medium">{bannerText(u)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5" />
          Auto-refreshes every 5 min{lastSync ? ` · updated ${timeAgo(lastSync.toISOString())}` : ""}
          <button onClick={load} className="ml-1 font-semibold text-forest-600 underline">
            Refresh now
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setReportOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-forest px-4 py-2.5 text-sm font-semibold text-white shadow-soft hover:opacity-95"
          >
            <Megaphone className="h-4 w-4" /> Report a road block
          </button>
          <button
            onClick={() => setApplyOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-forest hover:bg-muted"
          >
            <BadgeCheck className="h-4 w-4" /> Become a trusted reporter
          </button>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-forest-600" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROADS.map((r) => (
            <RoadCard
              key={r.key}
              roadKey={r.key}
              roadName={r.name}
              update={updates[r.key]}
              subscribed={subs.includes(r.key)}
              canSub={!!user}
              onToggleSub={() => toggleSub(r.key)}
            />
          ))}
        </div>
      )}

      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} />}
      {applyOpen && <ReporterApplyModal onClose={() => setApplyOpen(false)} />}
    </div>
  );
}

/* ---------------- Road card ---------------- */

function RoadCard({
  roadKey,
  roadName,
  update: u,
  subscribed,
  canSub,
  onToggleSub,
}: {
  roadKey: string;
  roadName: string;
  update?: RoadUpdateRow;
  subscribed: boolean;
  canSub: boolean;
  onToggleSub: () => void;
}) {
  const status = u?.status ?? "unknown";
  const tone = statusTone(status);
  const level = alertTone(u?.alert_level ?? "low");
  const safety = u?.safety_message || (u ? defaultSafetyMessage(status) : "");

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-3xl border bg-card shadow-premium",
        u ? tone.border : "border-border/70"
      )}
    >
      {/* Header strip */}
      <div className={cn("flex items-center justify-between px-5 py-3", u ? tone.bg : "bg-muted/50")}>
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", u ? tone.dot : "bg-gray-400")} />
          <h3 className="font-display text-base font-bold text-forest">{roadName}</h3>
        </div>
        {u && (
          <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase", level.bg, level.text)}>
            {level.label}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold", u ? tone.bg : "bg-muted", u ? tone.text : "text-muted-foreground")}>
            {u ? statusLabel(status) : "No recent update"}
          </span>
          {u?.verified && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-forest-600">
              <BadgeCheck className="h-3.5 w-3.5 text-gold" /> Verified
            </span>
          )}
        </div>

        {!u ? (
          <p className="text-sm text-muted-foreground">
            No verified reports right now. Conditions may change — check back or report an update.
          </p>
        ) : (
          <>
            {u.location && (
              <Row icon={MapPin} label="Location">{u.location}</Row>
            )}
            {u.reason && <Row icon={AlertTriangle} label="Reason">{u.reason}</Row>}
            {u.description && <p className="text-sm text-muted-foreground">{u.description}</p>}
            {u.expected_opening_time && (
              <Row icon={Clock} label="Expected opening">{u.expected_opening_time}</Row>
            )}
            {u.alternative_route && (
              <Row icon={RouteIcon} label="Alternative route">{u.alternative_route}</Row>
            )}
            {safety && (
              <div className="flex items-start gap-2 rounded-xl bg-forest-50/70 px-3 py-2 text-xs text-forest">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />
                <span>{safety}</span>
              </div>
            )}
            <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                {u.source_name ? (
                  u.source_link ? (
                    <a href={u.source_link} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-600 underline">
                      {u.source_name}
                    </a>
                  ) : (
                    <span className="font-semibold text-forest">{u.source_name}</span>
                  )
                ) : (
                  "Rego verified"
                )}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {timeAgo(u.updated_at)}
              </span>
            </div>
          </>
        )}

        {/* Subscribe */}
        <button
          onClick={onToggleSub}
          disabled={!canSub}
          title={canSub ? "" : "Sign in to get alerts"}
          className={cn(
            "mt-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60",
            subscribed
              ? "bg-gold/15 text-gold-700"
              : "border border-border bg-card text-forest hover:bg-muted"
          )}
        >
          {subscribed ? <><BellRing className="h-4 w-4" /> Alerts on</> : <><Bell className="h-4 w-4" /> Alert me for this route</>}
        </button>
        {!canSub && (
          <p className="text-center text-[11px] text-muted-foreground">
            <Link href="/signin" className="font-semibold underline">Sign in</Link> to get route alerts
          </p>
        )}
      </div>
    </article>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />
      <span className="text-muted-foreground">
        <span className="font-semibold text-forest">{label}:</span> {children}
      </span>
    </div>
  );
}

/* ---------------- Community report modal ---------------- */

function ReportModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [roadKey, setRoadKey] = React.useState<string>(ROADS[0].key);
  const [location, setLocation] = React.useState("");
  const [reason, setReason] = React.useState<string>(ROAD_REASONS[0]);
  const [description, setDescription] = React.useState("");
  const [media, setMedia] = React.useState<string[]>([]);
  const [phone, setPhone] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user) {
      setError("Please sign in to submit a report.");
      return;
    }
    if (!location.trim()) {
      setError("Please add the block location.");
      return;
    }
    setBusy(true);
    try {
      const trusted = await isTrustedReporter(user.email);
      const road = ROADS.find((r) => r.key === roadKey)!;
      const { error: dbErr } = await createRoadReport({
        road_key: roadKey,
        road_name: road.name,
        location: location.trim(),
        reason,
        description: description.trim() || null,
        media: media.length ? media : null,
        reporter_email: user.email,
        reporter_name: user.name,
        reporter_phone: phone.trim() || null,
        trusted,
      });
      if (dbErr) throw dbErr;
      void sendEmail(
        ADMIN_EMAIL,
        `New road report — ${road.name}${trusted ? " (trusted)" : ""}`,
        `<p>A new road report was submitted for <strong>${road.name}</strong>.</p>` +
          `<p><strong>Location:</strong> ${location}<br/><strong>Reason:</strong> ${reason}<br/>` +
          `<strong>By:</strong> ${user.name} (${user.email})${trusted ? " — trusted reporter" : ""}</p>` +
          (description ? `<p>${description}</p>` : "") +
          `<p>Review it in Admin → Road Updates → Reports.</p>`
      ).catch(() => {});
      setDone(true);
    } catch {
      setError("Could not submit your report. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Report a road block" onClose={onClose}>
      {done ? (
        <div className="px-6 py-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-forest-600" />
          <h3 className="mt-3 font-display text-xl font-bold text-forest">Report submitted</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Thank you! Your report is pending verification and will appear publicly once approved.
          </p>
          <button onClick={onClose} className="mt-5 w-full rounded-lg bg-gradient-gold px-4 py-3 text-sm font-semibold text-forest-900">
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 px-5 py-5">
          {!user && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              Please <Link href="/signin" className="font-semibold underline">sign in</Link> to submit a report.
            </div>
          )}
          <Field label="Road" required>
            <select className="auth-input" value={roadKey} onChange={(e) => setRoadKey(e.target.value)}>
              {ROADS.map((r) => (
                <option key={r.key} value={r.key}>{r.name}</option>
              ))}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Block location" required>
              <input className="auth-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. near Chilas" />
            </Field>
            <Field label="Reason">
              <select className="auth-input" value={reason} onChange={(e) => setReason(e.target.value)}>
                {ROAD_REASONS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea rows={3} className="auth-input resize-none" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's happening on the road?" />
          </Field>
          <Field label="Photo / video">
            <MultiImageUpload value={media} onChange={setMedia} />
          </Field>
          <Field label="Your phone (optional)">
            <input className="auth-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 3xx xxxxxxx" />
          </Field>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !user}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-forest px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <><Megaphone className="h-4 w-4" /> Submit for verification</>}
          </button>
        </form>
      )}
    </Modal>
  );
}

/* ---------------- Trusted reporter apply modal ---------------- */

function ReporterApplyModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [region, setRegion] = React.useState<string>(REPORTER_REGIONS[0]);
  const [phone, setPhone] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user) {
      setError("Please sign in to apply.");
      return;
    }
    setBusy(true);
    try {
      const { error: dbErr } = await applyAsReporter({
        email: user.email,
        name: user.name,
        region,
        phone: phone.trim() || null,
      });
      if (dbErr) throw dbErr;
      void sendEmail(
        ADMIN_EMAIL,
        `New trusted-reporter application — ${region}`,
        `<p><strong>${user.name}</strong> (${user.email}) applied to be a trusted road reporter for <strong>${region}</strong>.</p>` +
          `<p>Approve them in Admin → Road Updates → Reporters.</p>`
      ).catch(() => {});
      setDone(true);
    } catch {
      setError("Could not submit your application. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Become a trusted reporter" onClose={onClose}>
      {done ? (
        <div className="px-6 py-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-forest-600" />
          <h3 className="mt-3 font-display text-xl font-bold text-forest">Application sent</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Thanks! Our team will review and approve trusted local reporters. Verified reporters&apos; updates are prioritised.
          </p>
          <button onClick={onClose} className="mt-5 w-full rounded-lg bg-gradient-gold px-4 py-3 text-sm font-semibold text-forest-900">
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 px-5 py-5">
          <p className="text-sm text-muted-foreground">
            Trusted local reporters from GB help keep road alerts accurate. Tell us where you&apos;re based.
          </p>
          {!user && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              Please <Link href="/signin" className="font-semibold underline">sign in</Link> to apply.
            </div>
          )}
          <Field label="Your region" required>
            <select className="auth-input" value={region} onChange={(e) => setRegion(e.target.value)}>
              {REPORTER_REGIONS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Phone / WhatsApp">
            <input className="auth-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 3xx xxxxxxx" />
          </Field>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !user}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-forest px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><BadgeCheck className="h-4 w-4" /> Apply</>}
          </button>
        </form>
      )}
    </Modal>
  );
}

/* ---------------- Shared modal shell ---------------- */

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card shadow-premium-lg sm:rounded-3xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
          <p className="font-display text-base font-bold text-forest">{title}</p>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-forest">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-forest">
        {label} {required && <span className="text-gold-600">*</span>}
      </span>
      {children}
    </label>
  );
}
