"use client";

import * as React from "react";
import {
  ChevronRight,
  ChevronDown,
  Globe,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  TriangleAlert,
} from "lucide-react";

import {
  AREA_FLAGS,
  SERVICE_FLAGS,
  FLAG_LABELS,
  FLAG_HELP,
  FLAG_STATUS,
  FLAG_EFFECT,
  FLAG_NOT_YET,
  PUBLIC_IS_NOT_INHERITED,
  applyToChildren,
  bulkSetFlag,
  childrenOf,
  descendantIds,
  getAuditLog,
  getLocationCounts,
  getLocations,
  getLocationServices,
  getMarkets,
  getServiceCategories,
  resolveFlag,
  setLocationFlag,
  setServiceFlag,
  type AreaFlag,
  type AuditRow,
  type LocationRow,
  type LocationServiceRow,
  type MarketRow,
  type ServiceCategoryRow,
  type ServiceFlag,
} from "@/lib/markets";
import { SeoEditor } from "@/components/dashboard/seo-editor";
import { AddLocation } from "@/components/dashboard/add-location";
import { AnswersManager } from "@/components/dashboard/answers-manager";
import { cn } from "@/lib/utils";

/* ============================================================
 * Market & Area Management.
 *
 * The hard part of this screen is not the tree — it is making
 * INHERITED versus OVERRIDDEN visible at a glance. An admin who
 * cannot tell the difference will set a value at the wrong
 * level and be surprised months later, so every control shows
 * its resolved value AND where that value came from.
 *
 * Nothing here is authorisation. Hiding a control is a
 * courtesy; /api/admin/markets re-checks everything.
 * ============================================================ */

type Tab = "overview" | "availability" | "services" | "seo" | "answers" | "audit";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "availability", label: "Availability" },
  { id: "services", label: "Services" },
  { id: "seo", label: "SEO" },
  { id: "answers", label: "Answers" },
  { id: "audit", label: "Audit History" },
];

export function MarketAreas() {
  const [markets, setMarkets] = React.useState<MarketRow[]>([]);
  const [marketId, setMarketId] = React.useState("");
  const [locations, setLocations] = React.useState<LocationRow[]>([]);
  const [services, setServices] = React.useState<ServiceCategoryRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState("");
  const [tab, setTab] = React.useState<Tab>("overview");

  /* ---- initial load ---- */
  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [m, s] = await Promise.all([getMarkets(), getServiceCategories()]);
        if (!alive) return;
        setMarkets(m);
        setServices(s);
        if (m.length > 0) setMarketId((cur) => cur || m[0].id);
      } catch {
        if (alive) setError("Could not load markets.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const reloadLocations = React.useCallback(async (id: string) => {
    if (!id) return;
    const rows = await getLocations(id);
    setLocations(rows);
    // Open the top two levels so the screen is never a single collapsed row.
    setExpanded((prev) => {
      if (prev.size > 0) return prev;
      return new Set(rows.filter((l) => l.depth <= 1).map((l) => l.id));
    });
  }, []);

  React.useEffect(() => {
    if (marketId) void reloadLocations(marketId);
  }, [marketId, reloadLocations]);

  const selected = React.useMemo(
    () => locations.find((l) => l.id === selectedId) ?? null,
    [locations, selectedId]
  );

  /* ---- search filters the tree but keeps ancestors visible ---- */
  const visibleIds = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const hits = locations.filter((l) => l.name.toLowerCase().includes(q));
    const keep = new Set<string>();
    for (const h of hits) {
      keep.add(h.id);
      for (const a of h.ancestors ?? []) keep.add(a);
    }
    return keep;
  }, [locations, query]);

  const refresh = React.useCallback(async () => {
    if (marketId) await reloadLocations(marketId);
  }, [marketId, reloadLocations]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading markets…
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-10 text-center">
        <Globe className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-3 font-semibold text-forest">No markets yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Run <code className="rounded bg-muted px-1">phase72-market-areas.sql</code> in Supabase to
          create the first market.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ---- header ---- */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={marketId}
          onChange={(e) => {
            setMarketId(e.target.value);
            setSelectedId(null);
            setExpanded(new Set());
            setChecked(new Set());
          }}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-forest"
        >
          {markets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.country_code}) {m.is_active ? "" : "— inactive"}
            </option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search areas…"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <BulkBar
        checked={checked}
        locations={locations}
        onDone={async () => {
          setChecked(new Set());
          await refresh();
        }}
        onError={setError}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
        {/* ---- tree ---- */}
        <div className="rounded-2xl border border-border bg-card p-2">
          <Tree
            locations={locations}
            parentId={null}
            expanded={expanded}
            toggleExpand={(id) =>
              setExpanded((p) => {
                const n = new Set(p);
                n.has(id) ? n.delete(id) : n.add(id);
                return n;
              })
            }
            selectedId={selectedId}
            onSelect={setSelectedId}
            checked={checked}
            onCheck={(id) =>
              setChecked((p) => {
                const n = new Set(p);
                n.has(id) ? n.delete(id) : n.add(id);
                return n;
              })
            }
            visibleIds={visibleIds}
          />

          {/* Adds INSIDE the selected area, or at the top of the market when
              nothing is selected. Placed under the tree so the parent it will
              attach to is visible while you fill the form. */}
          <AddLocation
            marketId={marketId}
            parent={selected}
            onCreated={async (id) => {
              await refresh();
              if (id) setSelectedId(id);
            }}
          />
        </div>

        {/* ---- detail ---- */}
        <div className="rounded-2xl border border-border bg-card">
          {!selected ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <MapPin className="mx-auto mb-2 h-8 w-8 text-forest-600/50" />
              Select an area to see its settings.
            </div>
          ) : (
            <>
              <div className="border-b border-border px-4 pt-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {(selected.path_slugs ?? []).slice(0, -1).join(" / ") || "root"}
                </p>
                <h3 className="font-display text-xl font-bold text-forest">
                  {selected.name}
                </h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  {selected.location_type} · /{selected.slug}
                </p>
                <div className="flex flex-wrap gap-1">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={cn(
                        "rounded-t-lg px-3 py-2 text-sm font-medium transition-colors",
                        tab === t.id
                          ? "bg-forest-50 text-forest"
                          : "text-muted-foreground hover:text-forest"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4">
                {tab === "overview" && (
                  <Overview location={selected} locations={locations} />
                )}
                {tab === "availability" && (
                  <Availability
                    location={selected}
                    locations={locations}
                    onChanged={refresh}
                    onError={setError}
                  />
                )}
                {tab === "services" && (
                  <Services
                    location={selected}
                    locations={locations}
                    services={services}
                    onError={setError}
                  />
                )}
                {tab === "seo" && (
                  <SeoEditor
                    location={selected}
                    services={services}
                    resolved={{
                      isActive: resolveFlag(selected, "is_active", locations).value,
                      isPublic: resolveFlag(selected, "is_public", locations).value,
                      seoEnabled: resolveFlag(selected, "seo_enabled", locations).value,
                      comingSoon: resolveFlag(selected, "coming_soon", locations).value,
                    }}
                  />
                )}
                {tab === "answers" && (
                  <AnswersManager location={selected} services={services} />
                )}
                {tab === "audit" && <AuditHistory locationId={selected.id} />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tree                                                                */
/* ------------------------------------------------------------------ */

function Tree({
  locations,
  parentId,
  expanded,
  toggleExpand,
  selectedId,
  onSelect,
  checked,
  onCheck,
  visibleIds,
}: {
  locations: LocationRow[];
  parentId: string | null;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  checked: Set<string>;
  onCheck: (id: string) => void;
  visibleIds: Set<string> | null;
}) {
  const kids = childrenOf(locations, parentId).filter(
    (k) => !visibleIds || visibleIds.has(k.id)
  );
  if (kids.length === 0) return null;

  return (
    <ul className={parentId ? "ml-3 border-l border-border pl-2" : ""}>
      {kids.map((l) => {
        const hasKids = locations.some((x) => x.parent_id === l.id);
        const open = expanded.has(l.id) || Boolean(visibleIds);
        const live = resolveFlag(l, "is_public", locations).value;

        return (
          <li key={l.id}>
            <div
              className={cn(
                "group flex items-center gap-1 rounded-lg px-1 py-1.5 text-sm",
                selectedId === l.id ? "bg-forest-50" : "hover:bg-muted/60"
              )}
            >
              <input
                type="checkbox"
                checked={checked.has(l.id)}
                onChange={() => onCheck(l.id)}
                className="h-3.5 w-3.5 shrink-0 accent-forest-600"
                aria-label={`Select ${l.name}`}
              />
              <button
                onClick={() => hasKids && toggleExpand(l.id)}
                className={cn("shrink-0 p-0.5", !hasKids && "invisible")}
                aria-label={open ? "Collapse" : "Expand"}
              >
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
              <button
                onClick={() => onSelect(l.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span
                  className={cn(
                    "truncate",
                    selectedId === l.id ? "font-semibold text-forest" : "text-foreground"
                  )}
                >
                  {l.name}
                </span>
                <span
                  className={cn(
                    "ml-auto h-2 w-2 shrink-0 rounded-full",
                    live ? "bg-forest-600" : "bg-muted-foreground/30"
                  )}
                  title={live ? "Visible on website" : "Hidden"}
                />
              </button>
            </div>
            {open && (
              <Tree
                locations={locations}
                parentId={l.id}
                expanded={expanded}
                toggleExpand={toggleExpand}
                selectedId={selectedId}
                onSelect={onSelect}
                checked={checked}
                onCheck={onCheck}
                visibleIds={visibleIds}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

function Overview({
  location,
  locations,
}: {
  location: LocationRow;
  locations: LocationRow[];
}) {
  const [counts, setCounts] = React.useState<{ total: number; byTable: Record<string, number> } | null>(null);
  const [loading, setLoading] = React.useState(true);

  const kids = React.useMemo(
    () => descendantIds(locations, location.id),
    [locations, location.id]
  );

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    getLocationCounts(location.id, kids)
      .then((c) => alive && setCounts(c))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [location.id, kids]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Sub-areas" value={String(kids.length)} />
        <Stat
          label="Listings"
          value={loading ? "…" : String(counts?.total ?? 0)}
        />
        <Stat label="Level" value={location.location_type} />
      </div>

      {/* This caveat is not decoration. Until phase75 runs, every count on
          this screen reads zero even where listings exist, and an admin who
          does not know that will think the area is empty and disable it. */}
      {!loading && counts?.total === 0 && (
        <div className="flex gap-2 rounded-lg bg-gold/10 px-3 py-2.5 text-xs text-forest">
          <TriangleAlert className="h-4 w-4 shrink-0 text-gold-700" />
          <p>
            Listings are counted by their linked area. If the location backfill
            (<code>phase75</code>) has not run yet, this reads zero even where
            listings exist — it does not mean the area is empty.
          </p>
        </div>
      )}

      {counts && counts.total > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            By type
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {Object.entries(counts.byTable).map(([t, n]) => (
              <li key={t} className="flex justify-between px-3 py-2 text-sm">
                <span className="capitalize">{t.replace(/_/g, " ")}</span>
                <span className="font-semibold text-forest">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <Field label="Slug" value={location.slug} />
        <Field label="Country" value={location.country_code} />
        <Field
          label="Coordinates"
          value={
            location.latitude != null && location.longitude != null
              ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
              : "—"
          }
        />
        <Field
          label="Path"
          value={(location.path_slugs ?? []).join(" / ")}
        />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold text-forest">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value || "—"}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Availability                                                        */
/* ------------------------------------------------------------------ */

function Availability({
  location,
  locations,
  onChanged,
  onError,
}: {
  location: LocationRow;
  locations: LocationRow[];
  onChanged: () => Promise<void>;
  onError: (s: string) => void;
}) {
  const [busy, setBusy] = React.useState<string>("");
  const [confirm, setConfirm] = React.useState<{
    flag: AreaFlag;
    value: boolean | null;
    count: number;
  } | null>(null);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, key: string) => {
    setBusy(key);
    onError("");
    const r = await fn();
    if (!r.ok) onError(r.error || "Change failed.");
    await onChanged();
    setBusy("");
  };

  return (
    <div className="space-y-3">
      {AREA_FLAGS.map((flag) => {
        const { value, origin } = resolveFlag(location, flag, locations);
        const local = location[flag];
        const isOverride = local !== null && local !== undefined;

        return (
          <div
            key={flag}
            className="rounded-xl border border-border p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-forest">
                  {FLAG_LABELS[flag]}
                  <OriginBadge origin={isOverride ? "override_location" : origin} />
                  <EffectBadge flag={flag} />
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {FLAG_HELP[flag]}
                </p>
                {/* What this switch does, or does not do, right now. Without
                    this an admin can turn off Bookings and reasonably believe
                    bookings have stopped. They have not. */}
                <p
                  className={cn(
                    "mt-1 text-xs leading-relaxed",
                    FLAG_STATUS[flag] === "live"
                      ? "text-muted-foreground"
                      : "text-amber-700"
                  )}
                >
                  {FLAG_STATUS[flag] === "live"
                    ? FLAG_EFFECT[flag]
                    : FLAG_NOT_YET[flag]}
                </p>
                {flag === "is_public" && (
                  <p className="mt-1 rounded-lg bg-amber-50 p-2 text-xs leading-relaxed text-amber-900">
                    {PUBLIC_IS_NOT_INHERITED}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Segmented
                  value={local === null || local === undefined ? "inherit" : local ? "on" : "off"}
                  disabled={busy === flag}
                  onChange={(v) =>
                    run(
                      () =>
                        setLocationFlag(
                          location.id,
                          flag,
                          v === "inherit" ? null : v === "on"
                        ),
                      flag
                    )
                  }
                />
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-border pt-2 text-xs">
              <span className="text-muted-foreground">
                Resolved:{" "}
                <strong className={value ? "text-forest-600" : "text-red-600"}>
                  {value ? "Enabled" : "Disabled"}
                </strong>
              </span>

              {isOverride && (
                <button
                  onClick={() => run(() => setLocationFlag(location.id, flag, null), flag)}
                  disabled={busy === flag}
                  className="inline-flex items-center gap-1 font-medium text-forest hover:text-gold disabled:opacity-60"
                >
                  <RotateCcw className="h-3 w-3" /> Reset to inherited
                </button>
              )}

              <button
                onClick={() =>
                  setConfirm({
                    flag,
                    value: local ?? value,
                    count: descendantIds(locations, location.id).length,
                  })
                }
                className="ml-auto font-medium text-forest hover:text-gold"
              >
                Apply to all sub-areas
              </button>
            </div>
          </div>
        );
      })}

      {confirm && (
        <ConfirmDialog
          title={`Apply "${FLAG_LABELS[confirm.flag]}" to ${confirm.count} sub-area${confirm.count === 1 ? "" : "s"}?`}
          body={
            <>
              <p>
                Every area beneath <strong>{location.name}</strong> will be set to{" "}
                <strong>{confirm.value ? "Enabled" : "Disabled"}</strong>, replacing any
                override they currently have.
              </p>
              <p className="mt-2 text-muted-foreground">
                Existing listings and confirmed bookings are not affected. This
                controls what happens next, not what already happened.
              </p>
            </>
          }
          confirmLabel="Apply to sub-areas"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            const c = confirm;
            setConfirm(null);
            await run(
              () => applyToChildren(location.id, c.flag, c.value),
              c.flag
            );
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Services                                                            */
/* ------------------------------------------------------------------ */

function Services({
  location,
  locations,
  services,
  onError,
}: {
  location: LocationRow;
  locations: LocationRow[];
  services: ServiceCategoryRow[];
  onError: (s: string) => void;
}) {
  const [rows, setRows] = React.useState<LocationServiceRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setRows(await getLocationServices(location.id));
    setLoading(false);
  }, [location.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const byService = React.useMemo(() => {
    const m = new Map<string, LocationServiceRow>();
    for (const r of rows) m.set(`${r.location_id}:${r.service_slug}`, r);
    return m;
  }, [rows]);

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading services…
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Blank means the service follows this area&apos;s own setting, which in turn may be
        inherited from a parent. Set a value here only when this service should differ
        from the rest of the area.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-2 font-semibold text-forest">Service</th>
              {SERVICE_FLAGS.map((f) => (
                <th
                  key={f}
                  className="px-1 py-2 text-center text-[11px] font-medium text-muted-foreground"
                >
                  {FLAG_LABELS[f]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {services.map((s) => (
              <tr key={s.slug}>
                <td className="py-2 pr-2 font-medium">{s.name}</td>
                {SERVICE_FLAGS.map((f) => {
                  const row = byService.get(`${location.id}:${s.slug}`);
                  const local = row?.[f as ServiceFlag];
                  const resolved = resolveFlag(
                    location,
                    f as AreaFlag,
                    locations,
                    byService,
                    s.slug
                  );
                  const key = `${s.slug}:${f}`;
                  return (
                    <td key={f} className="px-1 py-2 text-center">
                      <select
                        value={
                          local === null || local === undefined
                            ? "inherit"
                            : local
                              ? "on"
                              : "off"
                        }
                        disabled={busy === key}
                        onChange={async (e) => {
                          const v = e.target.value;
                          setBusy(key);
                          onError("");
                          const r = await setServiceFlag(
                            location.id,
                            s.slug,
                            f as ServiceFlag,
                            v === "inherit" ? null : v === "on"
                          );
                          if (!r.ok) onError(r.error || "Change failed.");
                          await load();
                          setBusy("");
                        }}
                        className={cn(
                          "rounded border px-1 py-0.5 text-xs",
                          local === null || local === undefined
                            ? "border-dashed border-border text-muted-foreground"
                            : local
                              ? "border-forest-600 text-forest-600"
                              : "border-red-300 text-red-600"
                        )}
                        title={
                          local === null || local === undefined
                            ? `Inherited — currently ${resolved.value ? "enabled" : "disabled"}`
                            : "Explicit override"
                        }
                      >
                        <option value="inherit">
                          — ({resolved.value ? "on" : "off"})
                        </option>
                        <option value="on">On</option>
                        <option value="off">Off</option>
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

function AuditHistory({ locationId }: { locationId: string }) {
  const [rows, setRows] = React.useState<AuditRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    getAuditLog(locationId, 50)
      .then((r) => alive && setRows(r))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [locationId]);

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No changes recorded for this area yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border text-sm">
      {rows.map((r) => (
        <li key={r.id} className="py-2.5">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold text-forest">{r.action}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString()}
            </span>
            {r.actor_email && (
              <span className="text-xs text-muted-foreground">· {r.actor_email}</span>
            )}
          </div>
          {(r.before_value || r.after_value) && (
            <p className="mt-1 break-words font-mono text-[11px] text-muted-foreground">
              {JSON.stringify(r.before_value)} → {JSON.stringify(r.after_value)}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Bulk bar                                                            */
/* ------------------------------------------------------------------ */

function BulkBar({
  checked,
  locations,
  onDone,
  onError,
}: {
  checked: Set<string>;
  locations: LocationRow[];
  onDone: () => Promise<void>;
  onError: (s: string) => void;
}) {
  const [flag, setFlag] = React.useState<AreaFlag>("is_public");
  const [value, setValue] = React.useState<"on" | "off" | "inherit">("on");
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  if (checked.size === 0) return null;

  const names = locations
    .filter((l) => checked.has(l.id))
    .map((l) => l.name);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-forest-600/30 bg-forest-50 px-3 py-2 text-sm">
        <span className="font-semibold text-forest">{checked.size} selected</span>
        <select
          value={flag}
          onChange={(e) => setFlag(e.target.value as AreaFlag)}
          className="rounded border border-border bg-card px-2 py-1 text-xs"
        >
          {AREA_FLAGS.map((f) => (
            <option key={f} value={f}>
              {FLAG_LABELS[f]}
            </option>
          ))}
        </select>
        <select
          value={value}
          onChange={(e) => setValue(e.target.value as "on" | "off" | "inherit")}
          className="rounded border border-border bg-card px-2 py-1 text-xs"
        >
          <option value="on">On</option>
          <option value="off">Off</option>
          <option value="inherit">Reset to inherited</option>
        </select>
        <button
          onClick={() => setConfirm(true)}
          disabled={busy}
          className="rounded-lg bg-forest-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest-700 disabled:opacity-60"
        >
          Apply
        </button>
      </div>

      {confirm && (
        <ConfirmDialog
          title={`Change "${FLAG_LABELS[flag]}" on ${checked.size} areas?`}
          body={
            <>
              <p className="mb-2">
                {names.slice(0, 8).join(", ")}
                {names.length > 8 ? ` and ${names.length - 8} more` : ""}
              </p>
              <p className="text-muted-foreground">
                Existing listings and confirmed bookings are not affected.
              </p>
            </>
          }
          confirmLabel="Apply to all selected"
          onCancel={() => setConfirm(false)}
          onConfirm={async () => {
            setConfirm(false);
            setBusy(true);
            onError("");
            const r = await bulkSetFlag(
              [...checked],
              flag,
              value === "inherit" ? null : value === "on"
            );
            if (!r.ok) onError(r.error || "Bulk change failed.");
            await onDone();
            setBusy(false);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Small shared bits                                                   */
/* ------------------------------------------------------------------ */

/**
 * Whether this switch currently changes anything.
 *
 * Deliberately louder than OriginBadge: getting inheritance wrong is a
 * misconfiguration, but believing a dead switch is live is how an admin
 * closes bookings for an area and finds out weeks later that they never
 * stopped.
 */
function EffectBadge({ flag }: { flag: AreaFlag }) {
  const live = FLAG_STATUS[flag] === "live";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        live ? "bg-forest-50 text-forest-600" : "bg-amber-100 text-amber-800"
      )}
      title={live ? FLAG_EFFECT[flag] : FLAG_NOT_YET[flag]}
    >
      {live ? "In effect" : "Not wired up yet"}
    </span>
  );
}

function OriginBadge({ origin }: { origin: string }) {
  const inherited = origin === "inherited";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        inherited
          ? "bg-muted text-muted-foreground"
          : "bg-gold/20 text-gold-700"
      )}
      title={
        inherited
          ? "This value comes from a parent area."
          : "Set explicitly on this area, overriding the parent."
      }
    >
      {inherited ? "Inherited" : "Override"}
    </span>
  );
}

function Segmented({
  value,
  disabled,
  onChange,
}: {
  value: "on" | "off" | "inherit";
  disabled?: boolean;
  onChange: (v: "on" | "off" | "inherit") => void;
}) {
  const opts: { v: "inherit" | "on" | "off"; label: string }[] = [
    { v: "inherit", label: "—" },
    { v: "on", label: "On" },
    { v: "off", label: "Off" },
  ];
  return (
    <div className="flex overflow-hidden rounded-lg border border-border">
      {opts.map((o) => (
        <button
          key={o.v}
          disabled={disabled}
          onClick={() => onChange(o.v)}
          className={cn(
            "px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60",
            value === o.v
              ? o.v === "on"
                ? "bg-forest-600 text-white"
                : o.v === "off"
                  ? "bg-red-600 text-white"
                  : "bg-muted text-foreground"
              : "bg-card text-muted-foreground hover:bg-muted"
          )}
          title={o.v === "inherit" ? "Inherit from parent" : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl">
        <h4 className="font-display text-lg font-bold text-forest">{title}</h4>
        <div className="mt-2 text-sm leading-relaxed">{body}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-forest-600 px-3 py-2 text-sm font-semibold text-white hover:bg-forest-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
