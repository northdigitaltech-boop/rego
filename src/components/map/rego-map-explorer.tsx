"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search, LocateFixed, Route as RouteIcon, Megaphone, Ruler, X, Navigation,
  Bookmark, BookmarkCheck, Share2, Phone, BadgeCheck, MapPin, TriangleAlert,
  Loader2, ExternalLink, Layers,
} from "lucide-react";

import {
  MAP_CATEGORIES, mapCategory, categoryName, GB_CENTER, GB_BOUNDS, GB_PLACES,
  DEFAULT_ROADS, haversineKm, roadKm, driveTime, fuelEstimate, difficultyFor,
  linkedProfileUrl, LINK_SERVICE_TYPES, type MapPlaceRow, type RoadRouteRow,
  type RoadAlertRow,
} from "@/lib/rego-map";
import { RegoMapReport } from "@/components/map/rego-map-report";
import { photo } from "@/lib/utils";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Load Leaflet from CDN once (no npm dependency).
let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    js.onload = () => resolve((window as any).L);
    document.body.appendChild(js);
  });
  return leafletPromise;
}

/** Colored teardrop pin with an emoji glyph (Leaflet divIcon). */
function emojiIcon(L: any, emoji: string, color: string): any {
  const html =
    `<div style="position:relative;width:30px;height:40px">` +
    `<div style="position:absolute;left:0;top:0;width:30px;height:30px;background:${color};` +
    `border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);` +
    `box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>` +
    `<div style="position:absolute;left:0;top:3px;width:30px;height:26px;display:grid;` +
    `place-items:center;font-size:15px">${emoji}</div></div>`;
  return L.divIcon({ html, className: "rego-pin", iconSize: [30, 40], iconAnchor: [15, 38], popupAnchor: [0, -34] });
}

const ROAD_COLOR: Record<string, string> = {
  open: "#16a34a", partial: "#d4a017", risky: "#ea580c", blocked: "#dc2626",
  "snow-blocked": "#0ea5e9", clearance: "#7c3aed", seasonal: "#0891b2",
};

type Selected =
  | { kind: "place"; data: MapPlaceRow }
  | { kind: "alert"; data: RoadAlertRow }
  | null;

const SAVED_KEY = "rego-map-saved";
function getSaved(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); } catch { return []; }
}

export function RegoMapExplorer({
  places, routes, alerts,
}: {
  places: MapPlaceRow[];
  routes: RoadRouteRow[];
  alerts: RoadAlertRow[];
}) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const LRef = React.useRef<any>(null);
  const mapObj = React.useRef<any>(null);
  const placeLayer = React.useRef<any>(null);
  const userMarker = React.useRef<any>(null);

  const [ready, setReady] = React.useState(false);
  const [active, setActive] = React.useState<Set<string>>(() => new Set(MAP_CATEGORIES.map((c) => c.slug)));
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<Selected>(null);
  const [tool, setTool] = React.useState<null | "distance" | "route" | "report">(null);
  const [userLoc, setUserLoc] = React.useState<[number, number] | null>(null);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return places.filter((p) => {
      if (!active.has(p.category)) return false;
      if (q && !`${p.name} ${p.city ?? ""} ${p.district ?? ""} ${categoryName(p.category)}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [places, active, search]);

  // Init map once
  React.useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !L || !mapRef.current || mapObj.current) return;
      LRef.current = L;
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: true })
        .setView([GB_CENTER.lat, GB_CENTER.lng], GB_CENTER.zoom);

      // Base maps. Preference: MapTiler (free, NO card) → Mapbox (needs card) →
      // free OpenTopoMap / Esri / CARTO tiles. First one configured wins.
      const mtKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
      const mbToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const bases: Record<string, any> = {};
      let defaultBase: any;
      if (mtKey) {
        const mt = (style: string, ext: string) =>
          L.tileLayer(`https://api.maptiler.com/maps/${style}/256/{z}/{x}/{y}.${ext}?key=${mtKey}`, {
            maxZoom: 20, attribution: "© MapTiler © OpenStreetMap",
          });
        bases["🏔️ Outdoor"] = mt("outdoor-v2", "png");
        bases["🛰️ Satellite"] = mt("hybrid", "jpg");
        bases["🗺️ Streets"] = mt("streets-v2", "png");
        defaultBase = bases["🏔️ Outdoor"];
      } else if (mbToken) {
        const mb = (style: string) =>
          L.tileLayer(
            `https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/512/{z}/{x}/{y}@2x?access_token=${mbToken}`,
            { tileSize: 512, zoomOffset: -1, maxZoom: 19, attribution: "© Mapbox © OpenStreetMap" }
          );
        bases["🏔️ Outdoors"] = mb("outdoors-v12");
        bases["🛰️ Satellite"] = mb("satellite-streets-v12");
        bases["🗺️ Streets"] = mb("streets-v12");
        defaultBase = bases["🏔️ Outdoors"];
      } else {
        bases["🏔️ Terrain"] = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
          maxZoom: 17, subdomains: "abc", attribution: "© OpenTopoMap (CC-BY-SA)",
        });
        bases["🛰️ Satellite"] = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 18, attribution: "Imagery © Esri" }
        );
        bases["🗺️ Streets"] = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          maxZoom: 19, subdomains: "abcd", attribution: "© OpenStreetMap, © CARTO",
        });
        defaultBase = bases["🏔️ Terrain"];
      }
      defaultBase.addTo(map);
      L.control.layers(bases, {}, { position: "topright", collapsed: true }).addTo(map);
      map.setMaxBounds(GB_BOUNDS as any);

      // Roads (defaults + DB)
      const roads = L.layerGroup().addTo(map);
      const allRoads = [
        ...DEFAULT_ROADS.map((r) => ({ ...r, path: r.path, id: r.road_name })),
        ...routes.filter((r) => r.path && r.path.length > 1),
      ];
      for (const r of allRoads as any[]) {
        if (!r.path || r.path.length < 2) continue;
        const line = L.polyline(r.path, {
          color: ROAD_COLOR[r.status] ?? "#6b7280", weight: 4, opacity: 0.85,
        }).addTo(roads);
        line.bindPopup(
          `<b>${r.road_name}</b><br/>${r.road_type ?? ""} · ${r.distance_km ?? "?"} km<br/>` +
          `Status: <b style="color:${ROAD_COLOR[r.status] ?? "#374151"}">${(r.status || "open").replace("-", " ")}</b>` +
          (r.estimated_time ? `<br/>~${r.estimated_time}` : "")
        );
      }

      // Alerts / danger zones
      const alertLayer = L.layerGroup().addTo(map);
      for (const a of alerts) {
        if (a.latitude == null || a.longitude == null) continue;
        const m = L.marker([a.latitude, a.longitude], { icon: emojiIcon(L, "⚠️", "#ea580c") }).addTo(alertLayer);
        m.on("click", () => { setSelected({ kind: "alert", data: a }); setTool(null); });
      }

      placeLayer.current = L.layerGroup().addTo(map);
      mapObj.current = map;
      setReady(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild place markers when filters change
  React.useEffect(() => {
    const L = LRef.current;
    if (!L || !placeLayer.current) return;
    placeLayer.current.clearLayers();
    for (const p of filtered) {
      const cat = mapCategory(p.category);
      const m = L.marker([p.latitude, p.longitude], {
        icon: emojiIcon(L, cat?.emoji ?? "📍", cat?.color ?? "#1f5f45"),
      }).addTo(placeLayer.current);
      m.on("click", () => { setSelected({ kind: "place", data: p }); setTool(null); });
    }
  }, [filtered, ready]);

  const locate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setUserLoc(loc);
      const L = LRef.current;
      if (L && mapObj.current) {
        mapObj.current.setView(loc, 10);
        if (userMarker.current) mapObj.current.removeLayer(userMarker.current);
        userMarker.current = L.marker(loc, { icon: emojiIcon(L, "📍", "#d4a017") }).addTo(mapObj.current).bindPopup("You are here");
      }
    });
  };

  const flyTo = (lat: number, lng: number) => {
    if (mapObj.current) mapObj.current.setView([lat, lng], 11);
  };

  const toggleCat = (slug: string) =>
    setActive((s) => { const n = new Set(s); n.has(slug) ? n.delete(slug) : n.add(slug); return n; });

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="container-px pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-premium">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search city, spot, road, hospital, hotel, police…"
              className="w-full bg-transparent text-sm text-forest focus:outline-none"
            />
          </div>
          <ToolBtn onClick={locate} icon={LocateFixed} label="My location" />
          <ToolBtn onClick={() => { setTool(tool === "distance" ? null : "distance"); setSelected(null); }} icon={Ruler} label="Distance" active={tool === "distance"} />
          <ToolBtn onClick={() => { setTool(tool === "route" ? null : "route"); setSelected(null); }} icon={RouteIcon} label="Route" active={tool === "route"} />
          <ToolBtn onClick={() => { setTool(tool === "report" ? null : "report"); setSelected(null); }} icon={Megaphone} label="Report" active={tool === "report"} primary />
        </div>

        {/* Category filters */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setActive(new Set(MAP_CATEGORIES.map((c) => c.slug)))}
            className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-forest hover:bg-muted"
          >
            <Layers className="mr-1 inline h-3.5 w-3.5" /> All
          </button>
          {MAP_CATEGORIES.map((c) => {
            const on = active.has(c.slug);
            return (
              <button
                key={c.slug}
                onClick={() => toggleCat(c.slug)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  on ? "border-transparent text-white" : "border-border bg-card text-forest hover:bg-muted"
                )}
                style={on ? { background: c.color } : undefined}
              >
                <span className="mr-1">{c.emoji}</span>{c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Map + side panel */}
      <div className="container-px py-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="relative overflow-hidden rounded-3xl border border-border shadow-premium">
            <div ref={mapRef} className="h-[62vh] min-h-[420px] w-full lg:h-[76vh]" />
            {!ready && (
              <div className="absolute inset-0 grid place-items-center bg-forest-50/60">
                <Loader2 className="h-6 w-6 animate-spin text-forest-600" />
              </div>
            )}
          </div>

          {/* Desktop side panel */}
          <aside className="hidden lg:block">
            <div className="lg:sticky lg:top-24">
              <SidePanel
                selected={selected} tool={tool} userLoc={userLoc}
                onClose={() => { setSelected(null); setTool(null); }}
                onFly={flyTo}
              />
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile bottom sheet */}
      {(selected || tool) && (
        <div className="fixed inset-x-0 bottom-0 z-[60] max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-4 shadow-premium-lg lg:hidden">
          <SidePanel
            selected={selected} tool={tool} userLoc={userLoc}
            onClose={() => { setSelected(null); setTool(null); }}
            onFly={flyTo}
          />
        </div>
      )}
    </div>
  );
}

/* ---------------- Side panel (detail / tools) ---------------- */

function SidePanel({
  selected, tool, userLoc, onClose, onFly,
}: {
  selected: Selected;
  tool: null | "distance" | "route" | "report";
  userLoc: [number, number] | null;
  onClose: () => void;
  onFly: (lat: number, lng: number) => void;
}) {
  if (tool === "distance") return <Panel title="Distance calculator" onClose={onClose}><DistanceCalc userLoc={userLoc} /></Panel>;
  if (tool === "route") return <Panel title="Route planner" onClose={onClose}><RoutePlanner /></Panel>;
  if (tool === "report") return <Panel title="Report road update" onClose={onClose}><RegoMapReport /></Panel>;
  if (selected?.kind === "place") return <Panel title="Place details" onClose={onClose}><PlaceCard place={selected.data} userLoc={userLoc} onFly={onFly} /></Panel>;
  if (selected?.kind === "alert") return <Panel title="Road alert" onClose={onClose}><AlertCard alert={selected.data} /></Panel>;
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-6 text-center text-sm text-muted-foreground shadow-premium">
      <MapPin className="mx-auto h-8 w-8 text-forest-600" />
      <p className="mt-2 font-display text-base font-bold text-forest">Explore Gilgit-Baltistan</p>
      <p className="mt-1">Tap a pin for details, use the filters above, or open the distance / route tools.</p>
    </div>
  );
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card shadow-premium">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="font-display text-sm font-bold text-forest">{title}</p>
        <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-forest"><X className="h-4 w-4" /></button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function PlaceCard({ place: p, userLoc, onFly }: { place: MapPlaceRow; userLoc: [number, number] | null; onFly: (a: number, b: number) => void }) {
  const cat = mapCategory(p.category);
  const [saved, setSaved] = React.useState(false);
  const [shareMsg, setShareMsg] = React.useState("");
  React.useEffect(() => { setSaved(getSaved().includes(p.id)); }, [p.id]);
  const dist = userLoc ? haversineKm(userLoc, [p.latitude, p.longitude]) : null;
  const profileUrl = p.linked_profile_url || linkedProfileUrl(p.linked_service_type, p.linked_service_id);
  const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}${userLoc ? `&origin=${userLoc[0]},${userLoc[1]}` : ""}`;

  const toggleSave = () => {
    const cur = getSaved();
    const next = cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id];
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setSaved(next.includes(p.id));
  };
  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ title: p.name, url });
      else { await navigator.clipboard.writeText(url); setShareMsg("Link copied!"); setTimeout(() => setShareMsg(""), 2000); }
    } catch { /* cancelled */ }
  };

  return (
    <div className="space-y-3">
      {(p.photos?.length ?? 0) > 0 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo(p.photos![0])} alt={p.name} className="h-36 w-full rounded-2xl object-cover" />
      )}
      <div>
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: cat?.color ?? "#1f5f45" }}>{cat?.emoji ?? "📍"}</span>
          <div>
            <p className="font-display text-base font-bold text-forest">{p.name}</p>
            <p className="text-xs text-muted-foreground">{categoryName(p.category)}{p.district ? ` · ${p.district}` : ""}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {p.is_verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2 py-0.5 font-semibold text-forest-600"><BadgeCheck className="h-3.5 w-3.5 text-gold" /> Verified</span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">Unverified</span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 font-semibold capitalize text-forest">{p.status}</span>
          {(p.city || p.district) && <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {p.city || p.district}</span>}
          {dist != null && <span className="text-muted-foreground">· {dist} km away</span>}
        </div>
      </div>
      {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
      {p.contact_number && (
        <a href={`tel:${p.contact_number}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-600"><Phone className="h-4 w-4" /> {p.contact_number}</a>
      )}

      <div className="grid grid-cols-2 gap-2">
        <a href={dirUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-forest px-3 py-2 text-sm font-semibold text-white"><Navigation className="h-4 w-4" /> Directions</a>
        <button onClick={() => onFly(p.latitude, p.longitude)} className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-forest hover:bg-muted"><MapPin className="h-4 w-4" /> Center</button>
        <button onClick={toggleSave} className={cn("flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold", saved ? "border-gold bg-gold/10 text-gold-700" : "border-border text-forest hover:bg-muted")}>
          {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />} {saved ? "Saved" : "Save"}
        </button>
        <button onClick={share} className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-forest hover:bg-muted"><Share2 className="h-4 w-4" /> Share</button>
      </div>
      {shareMsg && <p className="text-center text-xs font-semibold text-forest-600">{shareMsg}</p>}

      {profileUrl && (
        <Link href={profileUrl} className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-gold px-3 py-2.5 text-sm font-bold text-forest-900">
          <ExternalLink className="h-4 w-4" /> View Full Profile
        </Link>
      )}
    </div>
  );
}

function AlertCard({ alert: a }: { alert: RoadAlertRow }) {
  const tone = a.alert_level === "critical" || a.alert_level === "high" ? "text-red-700 bg-red-50 border-red-200" : "text-amber-700 bg-amber-50 border-amber-200";
  return (
    <div className="space-y-3">
      <div className={cn("flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm", tone)}>
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold capitalize">{a.alert_type?.replace("-", " ")} — {a.road_name || a.location}</p>
          {a.reason && <p className="mt-0.5 text-xs">{a.reason}</p>}
        </div>
      </div>
      {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
      <div className="space-y-1 text-xs text-muted-foreground">
        {a.location && <p><b className="text-forest">Location:</b> {a.location}</p>}
        <p><b className="text-forest">Status:</b> <span className="capitalize">{a.status}</span> · <b className="text-forest">Level:</b> <span className="capitalize">{a.alert_level}</span></p>
        {a.expected_opening_time && <p><b className="text-forest">Expected opening:</b> {a.expected_opening_time}</p>}
        {a.source_name && <p><b className="text-forest">Source:</b> {a.source_name}</p>}
        <p><b className="text-forest">Updated:</b> {new Date(a.updated_at).toLocaleString()}</p>
      </div>
      <p className="rounded-lg bg-forest-50/70 px-3 py-2 text-xs text-forest">Drive carefully and check the latest updates before travelling.</p>
    </div>
  );
}

/* ---------------- Distance calculator ---------------- */

function DistanceCalc({ userLoc }: { userLoc: [number, number] | null }) {
  const opts = React.useMemo(() => {
    const base = GB_PLACES.map((p) => p.name);
    return userLoc ? ["My location", ...base] : base;
  }, [userLoc]);
  const [from, setFrom] = React.useState(opts[0]);
  const [to, setTo] = React.useState(GB_PLACES[1].name);

  const coordOf = (name: string): [number, number] | null => {
    if (name === "My location") return userLoc;
    const p = GB_PLACES.find((x) => x.name === name);
    return p ? [p.lat, p.lng] : null;
  };
  const a = coordOf(from), b = coordOf(to);
  const straight = a && b ? haversineKm(a, b) : null;
  const km = straight != null ? roadKm(straight) : null;
  const time = km != null ? driveTime(km) : "";
  const fuel = km != null ? fuelEstimate(km) : null;
  const night = km != null && km > 100;

  return (
    <div className="space-y-3">
      <Field label="From">
        <select className="auth-input" value={from} onChange={(e) => setFrom(e.target.value)}>{opts.map((o) => <option key={o}>{o}</option>)}</select>
      </Field>
      <Field label="To">
        <select className="auth-input" value={to} onChange={(e) => setTo(e.target.value)}>{GB_PLACES.map((p) => <option key={p.name}>{p.name}</option>)}</select>
      </Field>
      {km != null ? (
        <div className="space-y-2 rounded-2xl border border-border bg-forest-50/40 p-4">
          <Row label="Distance" value={`~${km} km`} big />
          <Row label="Estimated time" value={time} />
          <Row label="Difficulty" value={difficultyFor()} />
          {fuel && <Row label="Fuel estimate" value={`~${fuel.litres} L (≈ PKR ${fuel.cost.toLocaleString()})`} />}
          <Row label="Recommended travel" value="Daytime, May–Oct" />
          {night && <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700"><TriangleAlert className="h-4 w-4" /> Long route — avoid night travel on mountain roads.</p>}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Pick two locations to see distance.</p>
      )}
    </div>
  );
}

function RoutePlanner() {
  const [from, setFrom] = React.useState(GB_PLACES[0].name);
  const [to, setTo] = React.useState(GB_PLACES[1].name);
  const pa = GB_PLACES.find((x) => x.name === from)!;
  const pb = GB_PLACES.find((x) => x.name === to)!;
  const km = roadKm(haversineKm([pa.lat, pa.lng], [pb.lat, pb.lng]));

  return (
    <div className="space-y-3">
      <Field label="From"><select className="auth-input" value={from} onChange={(e) => setFrom(e.target.value)}>{GB_PLACES.map((p) => <option key={p.name}>{p.name}</option>)}</select></Field>
      <Field label="To"><select className="auth-input" value={to} onChange={(e) => setTo(e.target.value)}>{GB_PLACES.map((p) => <option key={p.name}>{p.name}</option>)}</select></Field>
      <div className="space-y-2 rounded-2xl border border-border bg-forest-50/40 p-4">
        <Row label="Best route" value={`${from} → ${to}`} />
        <Row label="Distance" value={`~${km} km`} big />
        <Row label="Estimated time" value={driveTime(km)} />
        <Row label="Road condition" value="Check live Road Updates before travel" />
        <a href={`https://www.google.com/maps/dir/?api=1&origin=${pa.lat},${pa.lng}&destination=${pb.lat},${pb.lng}`} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-forest px-3 py-2 text-sm font-semibold text-white"><Navigation className="h-4 w-4" /> Open in Google Maps</a>
      </div>
      <div className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-forest">Along the way, use the map filters to find:</p>
        <p className="mt-1">🏥 Hospitals · 🚓 Police · ⛑️ Rescue points · ⛽ Petrol pumps near your route.</p>
      </div>
    </div>
  );
}

/* ---------------- small helpers ---------------- */

function ToolBtn({ onClick, icon: Icon, label, active, primary }: { onClick: () => void; icon: any; label: string; active?: boolean; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold shadow-premium transition-colors",
        primary ? "bg-gradient-forest text-white hover:opacity-95"
          : active ? "border border-gold bg-gold/10 text-gold-700"
          : "border border-border bg-card text-forest hover:bg-muted"
      )}
    >
      <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-forest">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("font-semibold text-forest", big && "font-display text-lg")}>{value}</span>
    </div>
  );
}

export { LINK_SERVICE_TYPES };
