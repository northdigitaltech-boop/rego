"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search, LocateFixed, ChevronDown, Sun, LayoutDashboard, MapPinned, Route as RouteIcon,
  Ruler, TriangleAlert, ShieldAlert, Snowflake, Megaphone, Bookmark, BookOpen, Download, Settings,
  Navigation, X, Loader2, RefreshCw, Mountain, Plus, LifeBuoy, ShieldCheck, Phone, BadgeCheck,
  ExternalLink, CloudSun, MapPin, Menu,
} from "lucide-react";

import { RegoMapReport } from "@/components/map/rego-map-report";
import { getApprovedStories, type StoryRow } from "@/lib/safarnama";
import {
  MAP_CATEGORIES, mapCategory, categoryName, GB_CENTER, GB_BOUNDS, GB_PLACES, DEFAULT_ROADS,
  haversineKm, roadKm, driveTime, fuelEstimate, difficultyFor, linkedProfileUrl, getVerifiedReports,
  type MapPlaceRow, type RoadRouteRow, type RoadAlertRow, type MapReportRow,
} from "@/lib/rego-map";
import { photo, cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

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
function emojiIcon(L: any, emoji: string, color: string) {
  const html =
    `<div style="position:relative;width:30px;height:40px">` +
    `<div style="position:absolute;left:0;top:0;width:30px;height:30px;background:${color};border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>` +
    `<div style="position:absolute;left:0;top:3px;width:30px;height:26px;display:grid;place-items:center;font-size:15px">${emoji}</div></div>`;
  return L.divIcon({ html, className: "rego-pin", iconSize: [30, 40], iconAnchor: [15, 38], popupAnchor: [0, -34] });
}

const ROAD_COLOR: Record<string, string> = {
  open: "#22c55e", partial: "#eab308", risky: "#f97316", blocked: "#ef4444",
  "snow-blocked": "#38bdf8", clearance: "#a855f7", seasonal: "#38bdf8",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Open", partial: "Partially Open", risky: "Risky", blocked: "Closed",
  "snow-blocked": "Snow Blocked", clearance: "Under Clearance", seasonal: "Seasonal Closed",
};

const SAVED_KEY = "rego-map-saved";
const getSaved = (): string[] => { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); } catch { return []; } };

const esc = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// Rich HTML for the Leaflet popup that opens right at a place pin.
function placePopupHtml(p: MapPlaceRow, userLoc: [number, number] | null) {
  const cat = mapCategory(p.category);
  const dist = userLoc ? haversineKm(userLoc, [p.latitude, p.longitude]) : null;
  const dir = `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}${userLoc ? `&origin=${userLoc[0]},${userLoc[1]}` : ""}`;
  const profileUrl = (p as any).linked_profile_url || linkedProfileUrl((p as any).linked_service_type, (p as any).linked_service_id);
  const img = (p.photos?.length ?? 0) > 0
    ? `<img src="${esc(photo(p.photos![0]))}" alt="" style="width:100%;height:118px;object-fit:cover;border-radius:12px;margin-bottom:8px" />` : "";
  const verified = p.is_verified
    ? `<span style="display:inline-block;background:#E6F2EF;color:#006951;font-weight:600;font-size:11px;padding:2px 8px;border-radius:999px">✓ Verified</span>`
    : `<span style="display:inline-block;background:#eef0ef;color:#6b7280;font-weight:600;font-size:11px;padding:2px 8px;border-radius:999px">Unverified</span>`;
  const distTxt = dist != null ? `<span style="color:#6b7280;font-size:11px;margin-left:4px">· ${dist} km away</span>` : "";
  const desc = p.description ? `<p style="font-size:12px;color:#4b5563;margin:6px 0 8px;line-height:1.5">${esc(p.description)}</p>` : "";
  const phone = p.contact_number ? `<a href="tel:${esc(p.contact_number)}" style="display:block;font-size:12px;color:#006951;font-weight:600;margin-bottom:8px;text-decoration:none">📞 ${esc(p.contact_number)}</a>` : "";
  return `<div style="width:232px;font-family:inherit">
    ${img}
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
      <span style="display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:${cat?.color ?? "#1f5f45"};font-size:18px;flex:0 0 auto">${cat?.emoji ?? "📍"}</span>
      <div style="min-width:0">
        <p style="font-weight:700;font-size:14px;color:#003F31;margin:0;line-height:1.25">${esc(p.name)}</p>
        <p style="font-size:11px;color:#6b7280;margin:0">${esc(categoryName(p.category))}${p.district ? " · " + esc(p.district) : ""}</p>
      </div>
    </div>
    <div style="margin:6px 0 2px">${verified}${distTxt}</div>
    ${desc}
    ${phone}
    <a href="${esc(dir)}" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;background:#006951;color:#fff;font-weight:600;font-size:13px;padding:8px;border-radius:8px;text-decoration:none;margin-top:4px">➤ Directions</a>
    ${profileUrl ? `<a href="${esc(profileUrl)}" style="display:block;text-align:center;background:#E5B94B;color:#002A21;font-weight:700;font-size:13px;padding:8px;border-radius:8px;text-decoration:none;margin-top:6px">View Full Profile ↗</a>` : ""}
  </div>`;
}

type Modal =
  | null
  | { t: "place"; data: MapPlaceRow }
  | { t: "alert"; data: RoadAlertRow };

type View = "map" | "route" | "distance" | "alerts" | "danger" | "weather" | "seasonal" | "community" | "saved" | "offline" | "report" | "roadstatus" | "guides";
const VIEW_TITLE: Record<View, string> = {
  map: "Rego Map", route: "Route Planner", distance: "Distance Chart", alerts: "Road Alerts",
  danger: "Danger Zones", weather: "Weather", seasonal: "Seasonal Roads", community: "Community Reports",
  saved: "Saved Places", offline: "Offline Maps", report: "Report Road Update",
  roadstatus: "Road Status", guides: "Travel Guides",
};

const SIDEBAR = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { key: "map", label: "Rego Map", icon: MapPinned, view: "map" as View },
  { key: "roadstatus", label: "Road Status", icon: ShieldCheck, view: "roadstatus" as View },
  { key: "route", label: "Route Planner", icon: RouteIcon, view: "route" as View },
  { key: "distance", label: "Distance Chart", icon: Ruler, view: "distance" as View },
  { key: "alerts", label: "Road Alerts", icon: TriangleAlert, view: "alerts" as View },
  { key: "danger", label: "Danger Zones", icon: ShieldAlert, view: "danger" as View },
  { key: "weather", label: "Weather", icon: CloudSun, view: "weather" as View },
  { key: "seasonal", label: "Seasonal Roads", icon: Snowflake, view: "seasonal" as View },
  { key: "reports", label: "Community Reports", icon: Megaphone, view: "community" as View },
  { key: "saved", label: "Saved Places", icon: Bookmark, view: "saved" as View },
  { key: "guides", label: "Travel Guides", icon: BookOpen, view: "guides" as View },
  { key: "offline", label: "Offline Maps", icon: Download, view: "offline" as View },
  { key: "settings", label: "Settings", icon: Settings, href: "/dashboard" },
];

// Chips shown above the map (subset; "More" reveals all).
const CHIP_CATS = ["roads", "road-alerts", "tourist-spots", "hospitals", "police", "rescue"];

export function RegoMapDashboard({
  places, routes, alerts,
}: {
  places: MapPlaceRow[]; routes: RoadRouteRow[]; alerts: RoadAlertRow[];
}) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const LRef = React.useRef<any>(null);
  const mapObj = React.useRef<any>(null);
  const placeLayer = React.useRef<any>(null);
  const userMarker = React.useRef<any>(null);

  const [ready, setReady] = React.useState(false);
  const [active, setActive] = React.useState<Set<string>>(() => new Set(MAP_CATEGORIES.map((c) => c.slug)));
  const [search, setSearch] = React.useState("");
  const [view, setView] = React.useState<View>("map");
  const [modal, setModal] = React.useState<Modal>(null);
  const [userLoc, setUserLoc] = React.useState<[number, number] | null>(null);
  const [weather, setWeather] = React.useState<string>("—");
  const [showMore, setShowMore] = React.useState(false);
  const [sideOpen, setSideOpen] = React.useState(false);

  // roads: defaults + DB
  const allRoads = React.useMemo(() => [
    ...DEFAULT_ROADS.map((r) => ({ road_name: r.road_name, status: r.status, distance_km: r.distance_km, path: r.path })),
    ...routes.map((r) => ({ road_name: r.road_name, status: r.status, distance_km: r.distance_km, path: r.path })),
  ], [routes]);
  const totalKm = allRoads.reduce((s, r) => s + (Number(r.distance_km) || 0), 0);
  const count = (slug: string) => places.filter((p) => p.category === slug).length;

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return places.filter((p) => active.has(p.category) &&
      (!q || `${p.name} ${p.city ?? ""} ${p.district ?? ""} ${categoryName(p.category)}`.toLowerCase().includes(q)));
  }, [places, active, search]);

  // weather (Open-Meteo, free, no key) — Skardu
  React.useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=35.30&longitude=75.63&current=temperature_2m")
      .then((r) => r.json()).then((d) => { const t = d?.current?.temperature_2m; if (t != null) setWeather(`${Math.round(t)}°C`); })
      .catch(() => {});
  }, []);

  // init map
  React.useEffect(() => {
    let cancel = false;
    loadLeaflet().then((L) => {
      if (cancel || !L || !mapRef.current || mapObj.current) return;
      LRef.current = L;
      const map = L.map(mapRef.current, { zoomControl: true }).setView([GB_CENTER.lat, GB_CENTER.lng], GB_CENTER.zoom);
      const mtKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
      const mbToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const bases: Record<string, any> = {}; let def: any;
      if (mtKey) {
        const mt = (s: string, e: string) => L.tileLayer(`https://api.maptiler.com/maps/${s}/256/{z}/{x}/{y}.${e}?key=${mtKey}`, { maxZoom: 20, attribution: "© MapTiler © OSM" });
        bases["🏔️ Outdoor"] = mt("outdoor-v2", "png"); bases["🛰️ Satellite"] = mt("hybrid", "jpg"); bases["🗺️ Streets"] = mt("streets-v2", "png"); def = bases["🏔️ Outdoor"];
      } else if (mbToken) {
        const mb = (s: string) => L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/${s}/tiles/512/{z}/{x}/{y}@2x?access_token=${mbToken}`, { tileSize: 512, zoomOffset: -1, maxZoom: 19, attribution: "© Mapbox © OSM" });
        bases["🏔️ Outdoors"] = mb("outdoors-v12"); bases["🛰️ Satellite"] = mb("satellite-streets-v12"); bases["🗺️ Streets"] = mb("streets-v12"); def = bases["🏔️ Outdoors"];
      } else {
        bases["🏔️ Terrain"] = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { maxZoom: 17, subdomains: "abc", attribution: "© OpenTopoMap" });
        bases["🛰️ Satellite"] = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 18, attribution: "© Esri" });
        bases["🗺️ Streets"] = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { maxZoom: 19, subdomains: "abcd", attribution: "© CARTO" });
        def = bases["🏔️ Terrain"];
      }
      def.addTo(map);
      L.control.layers(bases, {}, { position: "topright", collapsed: true }).addTo(map);
      map.setMaxBounds(GB_BOUNDS as any);

      const roadsLayer = L.layerGroup().addTo(map);
      for (const r of allRoads as any[]) {
        if (!r.path || r.path.length < 2) continue;
        L.polyline(r.path, { color: ROAD_COLOR[r.status] ?? "#9ca3af", weight: 4, opacity: 0.9 }).addTo(roadsLayer)
          .bindPopup(`<b>${r.road_name}</b><br/>${STATUS_LABEL[r.status] ?? r.status}${r.distance_km ? ` · ${r.distance_km} km` : ""}`);
      }
      const alertLayer = L.layerGroup().addTo(map);
      for (const a of alerts) {
        if (a.latitude == null || a.longitude == null) continue;
        L.marker([a.latitude, a.longitude], { icon: emojiIcon(L, "⚠️", "#f97316") }).addTo(alertLayer)
          .on("click", () => setModal({ t: "alert", data: a }));
      }
      placeLayer.current = L.layerGroup().addTo(map);
      mapObj.current = map;
      setTimeout(() => map.invalidateSize(), 200);
      setReady(true);
    });
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const L = LRef.current; if (!L || !placeLayer.current) return;
    placeLayer.current.clearLayers();
    for (const p of filtered) {
      const cat = mapCategory(p.category);
      L.marker([p.latitude, p.longitude], { icon: emojiIcon(L, cat?.emoji ?? "📍", cat?.color ?? "#1f5f45") })
        .addTo(placeLayer.current)
        .bindPopup(placePopupHtml(p, userLoc), { maxWidth: 260, minWidth: 232, className: "rego-map-popup", autoPan: true, autoPanPadding: [24, 24] });
    }
  }, [filtered, ready, userLoc]);

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
  const flyTo = (lat: number, lng: number) => mapObj.current?.setView([lat, lng], 12);
  const onlyCat = (slug: string) => setActive(new Set([slug]));
  const toggleCat = (slug: string) => setActive((s) => { const n = new Set(s); n.has(slug) ? n.delete(slug) : n.add(slug); return n; });

  const sideAction = (item: (typeof SIDEBAR)[number]) => {
    setSideOpen(false);
    if ((item as any).view) { setView((item as any).view); setModal(null); }
  };

  // Leaflet needs a resize nudge when the map becomes visible again.
  React.useEffect(() => {
    if (view === "map" && mapObj.current) {
      const t = setTimeout(() => mapObj.current.invalidateSize(), 80);
      return () => clearTimeout(t);
    }
  }, [view]);

  // Close the mobile sidebar drawer with the Escape key (accessibility).
  React.useEffect(() => {
    if (!sideOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSideOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sideOpen]);

  const renderView = () => {
    switch (view) {
      case "route": return <RoutePlanner />;
      case "distance": return <DistanceCalc userLoc={userLoc} />;
      case "alerts": return <AlertsList alerts={alerts} onOpen={(a) => setModal({ t: "alert", data: a })} />;
      case "danger": return <DangerList alerts={alerts} onOpen={(a) => setModal({ t: "alert", data: a })} />;
      case "weather": return <WeatherPanel />;
      case "seasonal": return <SeasonalRoads roads={allRoads} />;
      case "community": return <CommunityReports onReport={() => setView("report")} />;
      case "saved": return <SavedPanel places={places} onOpen={(p) => setModal({ t: "place", data: p })} />;
      case "offline": return <OfflinePanel places={places} onOpen={(p) => setModal({ t: "place", data: p })} />;
      case "report": return <RegoMapReport />;
      case "roadstatus": return <RoadStatusPanel roads={allRoads} alerts={alerts} onAlert={(a) => setModal({ t: "alert", data: a })} />;
      case "guides": return <TravelGuides />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 text-forest">
      {/* Map toolbar (sits under the Rego navbar) */}
      <div className="border-b border-border bg-card">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <button onClick={() => setSideOpen((v) => !v)} aria-label="Toggle map menu" aria-expanded={sideOpen} className="grid h-9 w-9 place-items-center rounded-lg text-forest transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 xl:hidden"><Menu className="h-5 w-5" /></button>
          <div className="hidden shrink-0 sm:block">
            <p className="font-display text-sm font-bold text-gold">Rego Map</p>
            <p className="text-[11px] text-muted-foreground">Smart Map of Gilgit-Baltistan</p>
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-600/25">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search the map" placeholder="Search city, spot, road, hospital, hotel…" className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none" />
          </div>
          <button onClick={locate} className="hidden items-center gap-1.5 rounded-xl bg-gradient-forest px-3 py-2 text-sm font-semibold text-white shadow-soft transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 sm:inline-flex">
            <LocateFixed className="h-4 w-4 text-gold" /> My Location
          </button>
          <button onClick={() => setView("weather")} aria-label="Weather in Skardu" className="hidden items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 sm:flex">
            <Sun className="h-4 w-4 text-gold" /><div className="text-left"><p className="text-sm font-bold leading-none">{weather}</p><p className="text-[10px] text-muted-foreground">Skardu</p></div>
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={cn("fixed inset-y-0 left-0 z-[60] w-64 shrink-0 overflow-y-auto border-r border-forest-900 bg-forest-700 p-3 text-white transition-transform xl:static xl:z-auto xl:translate-x-0", sideOpen ? "translate-x-0" : "-translate-x-full")}>
          <nav className="space-y-1">
            {SIDEBAR.map((it) => {
              const Icon = it.icon;
              const isActive = (it as any).view === view;
              const cls = cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-forest-700",
                isActive ? "bg-forest-500 text-white shadow-soft" : "text-white/75 hover:bg-white/10 hover:text-white");
              const inner = <><Icon className={cn("h-4 w-4", isActive && "text-gold")} /> {it.label}</>;
              if (it.href) return <Link key={it.key} href={it.href} className={cls}>{inner}</Link>;
              return <button key={it.key} onClick={() => sideAction(it)} aria-current={isActive ? "page" : undefined} className={cls}>{inner}</button>;
            })}
          </nav>

          <div className="mt-4 rounded-2xl border border-gold/30 bg-forest-800/60 p-4">
            <p className="font-display text-sm font-bold text-white">Report Road Update</p>
            <p className="mt-1 text-xs text-white/60">Help other travelers by reporting road conditions.</p>
            <button onClick={() => { setView("report"); setSideOpen(false); }} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-gold px-3 py-2 text-sm font-bold text-forest-900"><TriangleAlert className="h-4 w-4" /> Report Now</button>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 p-3">
            <LifeBuoy className="h-8 w-8 text-gold" />
            <div><p className="text-sm font-semibold text-white">Need Help?</p><p className="text-[11px] text-white/60">24/7 · +92 316 1290604</p></div>
          </div>
        </aside>
        {sideOpen && <div onClick={() => setSideOpen(false)} className="fixed inset-0 z-40 bg-black/50 xl:hidden" />}

        {/* Main */}
        <main className="min-w-0 flex-1 p-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            {/* Center */}
            <div className="min-w-0 space-y-4">
              {/* Map view — hidden while a module panel is open */}
              <div className={cn("space-y-4", view === "map" ? "" : "hidden")}>
              {/* Chips */}
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2">
                <Chip label="All" active={active.size === MAP_CATEGORIES.length} onClick={() => setActive(new Set(MAP_CATEGORIES.map((c) => c.slug)))} />
                {(showMore ? MAP_CATEGORIES.map((c) => c.slug) : CHIP_CATS).map((slug) => {
                  const c = mapCategory(slug)!;
                  return <Chip key={slug} label={c.name} emoji={c.emoji} active={active.has(slug) && active.size !== MAP_CATEGORIES.length} onClick={() => onlyCat(slug)} />;
                })}
                <button onClick={() => setShowMore((v) => !v)} className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-forest hover:bg-muted">
                  {showMore ? "Less" : "More"} <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showMore && "rotate-180")} />
                </button>
              </div>

              {/* Map */}
              <div className="relative overflow-hidden rounded-2xl border border-border">
                <div ref={mapRef} className="h-[58vh] min-h-[420px] w-full" />
                {!ready && <div className="absolute inset-0 grid place-items-center bg-card/70"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>}
                {/* Legend */}
                <div className="absolute bottom-3 left-3 z-[500] hidden rounded-xl border border-black/10 bg-white/95 p-3 text-forest shadow-lg sm:block">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide">Legend</p>
                  <div className="grid grid-cols-1 gap-1 text-[11px]">
                    {["tourist-spots", "hospitals", "police", "rescue", "road-alerts", "petrol", "airports", "checkpoints"].map((s) => {
                      const c = mapCategory(s)!;
                      return <span key={s} className="flex items-center gap-1.5"><span>{c.emoji}</span> {c.name}</span>;
                    })}
                  </div>
                </div>
              </div>
              </div>

              {/* Module view — replaces the map when a sidebar module is open */}
              {view !== "map" && (
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <p className="font-display text-sm font-bold text-forest">{VIEW_TITLE[view]}</p>
                    <button onClick={() => setView("map")} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-forest px-3 py-1.5 text-xs font-semibold text-white shadow-soft hover:opacity-95"><MapPinned className="h-3.5 w-3.5 text-gold" /> Back to Map</button>
                  </div>
                  <div className="bg-card p-4 text-forest">{renderView()}</div>
                </div>
              )}

              {/* Stat cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <Stat icon={Mountain} color="#0f766e" label="Tourist Spots" value={count("tourist-spots")} onClick={() => { onlyCat("tourist-spots"); setView("map"); }} />
                <Stat icon={Plus} color="#dc2626" label="Hospitals" value={count("hospitals")} onClick={() => { onlyCat("hospitals"); setView("map"); }} />
                <Stat icon={ShieldCheck} color="#1d4ed8" label="Police Stations" value={count("police")} onClick={() => { onlyCat("police"); setView("map"); }} />
                <Stat icon={LifeBuoy} color="#e11d48" label="Rescue Points" value={count("rescue")} onClick={() => { onlyCat("rescue"); setView("map"); }} />
                <Stat icon={RouteIcon} color="#7c3aed" label="Total Roads" value={`${Math.round(totalKm)} km`} onClick={() => setView("seasonal")} />
              </div>
            </div>

            {/* Right panel */}
            <aside className="space-y-4">
              <Card title="Road Status Overview" right={<RefreshCw className="h-4 w-4 text-muted-foreground" />}>
                <p className="mb-2 text-[11px] text-white/60">Live network status</p>
                <div className="space-y-1.5">
                  {allRoads.slice(0, 8).map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 truncate text-white/90"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ROAD_COLOR[r.status] ?? "#9ca3af" }} /> {r.road_name}</span>
                      <span className="shrink-0 text-xs font-semibold" style={{ color: ROAD_COLOR[r.status] ?? "#9ca3af" }}>{STATUS_LABEL[r.status] ?? r.status}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setView("roadstatus")} className="mt-3 block w-full rounded-lg border border-white/20 bg-white/10 py-2 text-center text-xs font-semibold text-white hover:bg-white/20">View All Road Status</button>
              </Card>

              <Card title="Active Road Alerts" right={<span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold">{alerts.length}</span>}>
                {alerts.length === 0 ? (
                  <p className="text-sm text-white/70">No active alerts right now.</p>
                ) : (
                  <div className="space-y-2">
                    {alerts.slice(0, 3).map((a) => (
                      <button key={a.id} onClick={() => setModal({ t: "alert", data: a })} className="flex w-full items-start gap-2 rounded-xl border border-white/15 bg-white/5 p-2.5 text-left hover:bg-white/10">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-orange-500/20 text-orange-400"><TriangleAlert className="h-4 w-4" /></span>
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold capitalize text-white">{a.alert_type?.replace("-", " ")}</span><span className="block truncate text-[11px] text-white/60">{a.road_name || a.location} · {timeAgo(a.updated_at)}</span></span>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setView("alerts")} className="mt-3 block w-full text-center text-xs font-semibold text-gold">View All Alerts</button>
              </Card>

              <Card title="Quick Tools">
                <div className="grid grid-cols-3 gap-2">
                  <Tool icon={RouteIcon} label="Route Planner" onClick={() => setView("route")} />
                  <Tool icon={Ruler} label="Distance" onClick={() => setView("distance")} />
                  <Tool icon={CloudSun} label="Weather" onClick={() => setView("weather")} />
                  <Tool icon={Download} label="Offline" onClick={() => setView("offline")} />
                  <Tool icon={Bookmark} label="Saved" onClick={() => setView("saved")} />
                  <Tool icon={Megaphone} label="Reports" onClick={() => setView("community")} />
                </div>
              </Card>
            </aside>
          </div>
        </main>
      </div>

      {modal && (
        <ModalShell title={modal.t === "place" ? "Place details" : "Road alert"} onClose={() => setModal(null)}>
          {modal.t === "place" && <PlaceDetail place={modal.data} userLoc={userLoc} onFly={flyTo} />}
          {modal.t === "alert" && <AlertDetail alert={modal.data} />}
        </ModalShell>
      )}
    </div>
  );
}

/* ---------------- small UI ---------------- */
function timeAgo(iso: string) { const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); if (m < 60) return `${m} min ago`; const h = Math.floor(m / 60); return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`; }
function Chip({ label, emoji, active, onClick }: { label: string; emoji?: string; active?: boolean; onClick: () => void }) {
  return <button onClick={onClick} aria-pressed={active} className={cn("inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-1", active ? "bg-gradient-forest text-white" : "border border-border bg-muted/40 text-forest hover:bg-muted")}>{emoji && <span>{emoji}</span>}{label}</button>;
}
function Stat({ icon: Icon, color, label, value, onClick }: { icon: any; color: string; label: string; value: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: color }}><Icon className="h-5 w-5" /></span>
      <p className="mt-3 font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      <span className="mt-1 inline-block text-[11px] font-semibold text-gold">View →</span>
    </button>
  );
}
function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-forest-900 bg-forest-700 p-4 text-white">
      <div className="mb-3 flex items-center justify-between"><p className="font-display text-sm font-bold uppercase tracking-wide text-white">{title}</p>{right}</div>
      {children}
    </div>
  );
}
function Tool({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex flex-col items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 p-3 text-center transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"><Icon className="h-5 w-5 text-gold" /><span className="text-[11px] font-semibold text-white">{label}</span></button>;
}
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-card text-forest shadow-premium-lg sm:max-w-lg sm:rounded-3xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card/95 px-5 py-3.5 backdrop-blur">
          <p className="font-display text-base font-bold text-forest">{title}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-forest"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- detail + tools (light theme inside modal) ---------------- */
function PlaceDetail({ place: p, userLoc, onFly }: { place: MapPlaceRow; userLoc: [number, number] | null; onFly: (a: number, b: number) => void }) {
  const cat = mapCategory(p.category);
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => { setSaved(getSaved().includes(p.id)); }, [p.id]);
  const dist = userLoc ? haversineKm(userLoc, [p.latitude, p.longitude]) : null;
  const profileUrl = p.linked_profile_url || linkedProfileUrl(p.linked_service_type, p.linked_service_id);
  const dir = `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}${userLoc ? `&origin=${userLoc[0]},${userLoc[1]}` : ""}`;
  const toggleSave = () => { const c = getSaved(); const n = c.includes(p.id) ? c.filter((x) => x !== p.id) : [...c, p.id]; localStorage.setItem(SAVED_KEY, JSON.stringify(n)); setSaved(n.includes(p.id)); };
  return (
    <div className="space-y-3">
      {(p.photos?.length ?? 0) > 0 && /* eslint-disable-next-line @next/next/no-img-element */ <img src={photo(p.photos![0])} alt={p.name} className="h-40 w-full rounded-2xl object-cover" />}
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ background: cat?.color ?? "#1f5f45" }}>{cat?.emoji ?? "📍"}</span>
        <div><p className="font-display text-base font-bold text-forest">{p.name}</p><p className="text-xs text-muted-foreground">{categoryName(p.category)}{p.district ? ` · ${p.district}` : ""}</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {p.is_verified ? <span className="inline-flex items-center gap-1 rounded-full bg-forest-50 px-2 py-0.5 font-semibold text-forest-600"><BadgeCheck className="h-3.5 w-3.5 text-gold" /> Verified</span> : <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">Unverified</span>}
        <span className="rounded-full bg-muted px-2 py-0.5 font-semibold capitalize text-forest">{p.status}</span>
        {dist != null && <span className="text-muted-foreground">· {dist} km away</span>}
      </div>
      {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
      {p.contact_number && <a href={`tel:${p.contact_number}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-600"><Phone className="h-4 w-4" /> {p.contact_number}</a>}
      <div className="grid grid-cols-2 gap-2">
        <a href={dir} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-forest px-3 py-2 text-sm font-semibold text-white"><Navigation className="h-4 w-4" /> Directions</a>
        <button onClick={() => onFly(p.latitude, p.longitude)} className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-forest hover:bg-muted"><MapPin className="h-4 w-4" /> Center</button>
        <button onClick={toggleSave} className={cn("flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold", saved ? "border-gold bg-gold/10 text-gold-700" : "border-border text-forest hover:bg-muted")}><Bookmark className="h-4 w-4" /> {saved ? "Saved" : "Save"}</button>
        <button onClick={() => { navigator.clipboard?.writeText(window.location.href); }} className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-forest hover:bg-muted">Share</button>
      </div>
      {profileUrl && <Link href={profileUrl} className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-gold px-3 py-2.5 text-sm font-bold text-forest-900"><ExternalLink className="h-4 w-4" /> View Full Profile</Link>}
    </div>
  );
}
function AlertDetail({ alert: a }: { alert: RoadAlertRow }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm text-orange-700">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold capitalize">{a.alert_type?.replace("-", " ")} — {a.road_name || a.location}</p>{a.reason && <p className="mt-0.5 text-xs">{a.reason}</p>}</div>
      </div>
      {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
      <div className="space-y-1 text-xs text-muted-foreground">
        <p><b className="text-forest">Status:</b> <span className="capitalize">{a.status}</span> · <b className="text-forest">Level:</b> <span className="capitalize">{a.alert_level}</span></p>
        {a.expected_opening_time && <p><b className="text-forest">Expected opening:</b> {a.expected_opening_time}</p>}
        {a.source_name && <p><b className="text-forest">Source:</b> {a.source_name}</p>}
        <p><b className="text-forest">Updated:</b> {new Date(a.updated_at).toLocaleString()}</p>
      </div>
    </div>
  );
}
function DistanceCalc({ userLoc }: { userLoc: [number, number] | null }) {
  const opts = React.useMemo(() => (userLoc ? ["My location", ...GB_PLACES.map((p) => p.name)] : GB_PLACES.map((p) => p.name)), [userLoc]);
  const [from, setFrom] = React.useState(opts[0]); const [to, setTo] = React.useState(GB_PLACES[1].name);
  const coord = (n: string): [number, number] | null => n === "My location" ? userLoc : (() => { const p = GB_PLACES.find((x) => x.name === n); return p ? [p.lat, p.lng] : null; })();
  const a = coord(from), b = coord(to); const km = a && b ? roadKm(haversineKm(a, b)) : null; const fuel = km != null ? fuelEstimate(km) : null;
  return (
    <div className="space-y-3">
      <Sel label="From" value={from} onChange={setFrom} opts={opts} />
      <Sel label="To" value={to} onChange={setTo} opts={GB_PLACES.map((p) => p.name)} />
      {km != null ? (
        <div className="space-y-2 rounded-2xl border border-border bg-forest-50/40 p-4">
          <Kv label="Distance" value={`~${km} km`} big /><Kv label="Estimated time" value={driveTime(km)} /><Kv label="Difficulty" value={difficultyFor()} />
          {fuel && <Kv label="Fuel estimate" value={`~${fuel.litres} L (≈ PKR ${fuel.cost.toLocaleString()})`} />}
          {km > 100 && <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700"><TriangleAlert className="h-4 w-4" /> Long route — avoid night travel on mountain roads.</p>}
        </div>
      ) : <p className="text-sm text-muted-foreground">Pick two locations.</p>}
    </div>
  );
}
function RoutePlanner() {
  const [from, setFrom] = React.useState(GB_PLACES[0].name); const [to, setTo] = React.useState(GB_PLACES[1].name);
  const pa = GB_PLACES.find((x) => x.name === from)!, pb = GB_PLACES.find((x) => x.name === to)!; const km = roadKm(haversineKm([pa.lat, pa.lng], [pb.lat, pb.lng]));
  return (
    <div className="space-y-3">
      <Sel label="From" value={from} onChange={setFrom} opts={GB_PLACES.map((p) => p.name)} />
      <Sel label="To" value={to} onChange={setTo} opts={GB_PLACES.map((p) => p.name)} />
      <div className="space-y-2 rounded-2xl border border-border bg-forest-50/40 p-4">
        <Kv label="Route" value={`${from} → ${to}`} /><Kv label="Distance" value={`~${km} km`} big /><Kv label="Time" value={driveTime(km)} />
        <a href={`https://www.google.com/maps/dir/?api=1&origin=${pa.lat},${pa.lng}&destination=${pb.lat},${pb.lng}`} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-forest px-3 py-2 text-sm font-semibold text-white"><Navigation className="h-4 w-4" /> Open in Google Maps</a>
      </div>
      <p className="rounded-xl border border-border p-3 text-xs text-muted-foreground">Use the map filters to spot 🏥 hospitals · 🚓 police · ⛑️ rescue · ⛽ petrol along your route.</p>
    </div>
  );
}
function WeatherPanel() {
  const cities = [{ n: "Skardu", la: 35.30, lo: 75.63 }, { n: "Gilgit", la: 35.92, lo: 74.31 }, { n: "Hunza", la: 36.32, lo: 74.65 }, { n: "Chilas", la: 35.42, lo: 74.09 }, { n: "Astore", la: 35.37, lo: 74.86 }];
  const [data, setData] = React.useState<Record<string, string>>({});
  React.useEffect(() => { cities.forEach((c) => { fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.la}&longitude=${c.lo}&current=temperature_2m`).then((r) => r.json()).then((d) => { const t = d?.current?.temperature_2m; if (t != null) setData((p) => ({ ...p, [c.n]: `${Math.round(t)}°C` })); }).catch(() => {}); }); /* eslint-disable-next-line */ }, []);
  return (
    <div className="grid grid-cols-2 gap-2">
      {cities.map((c) => <div key={c.n} className="flex items-center justify-between rounded-xl border border-border bg-forest-50/40 px-3 py-2.5"><span className="flex items-center gap-1.5 text-sm font-semibold text-forest"><CloudSun className="h-4 w-4 text-gold" /> {c.n}</span><span className="font-display text-lg font-bold text-forest">{data[c.n] ?? "…"}</span></div>)}
      <p className="col-span-2 text-[11px] text-muted-foreground">Live conditions via Open-Meteo. Mountain weather changes fast — check before travel.</p>
    </div>
  );
}
function SavedPanel({ places, onOpen }: { places: MapPlaceRow[]; onOpen: (p: MapPlaceRow) => void }) {
  const ids = getSaved(); const saved = places.filter((p) => ids.includes(p.id));
  if (saved.length === 0) return <p className="text-sm text-muted-foreground">No saved places yet. Tap a pin and press Save.</p>;
  return <div className="space-y-2">{saved.map((p) => <button key={p.id} onClick={() => onOpen(p)} className="flex w-full items-center gap-2 rounded-xl border border-border p-2.5 text-left hover:bg-muted"><span>{mapCategory(p.category)?.emoji}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-forest">{p.name}</span><span className="block text-xs text-muted-foreground">{categoryName(p.category)}</span></span></button>)}</div>;
}
function AlertsList({ alerts, onOpen }: { alerts: RoadAlertRow[]; onOpen: (a: RoadAlertRow) => void }) {
  if (alerts.length === 0) return <p className="text-sm text-muted-foreground">No active alerts.</p>;
  return <div className="space-y-2">{alerts.map((a) => <button key={a.id} onClick={() => onOpen(a)} className="flex w-full items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 p-2.5 text-left"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" /><span className="min-w-0"><span className="block truncate text-sm font-semibold capitalize text-orange-800">{a.alert_type?.replace("-", " ")} — {a.road_name || a.location}</span>{a.reason && <span className="block truncate text-xs text-orange-700/80">{a.reason}</span>}</span></button>)}</div>;
}
function DangerList({ alerts, onOpen }: { alerts: RoadAlertRow[]; onOpen: (a: RoadAlertRow) => void }) {
  const danger = alerts.filter((a) => a.is_danger_zone);
  if (danger.length === 0) return <p className="text-sm text-muted-foreground">No danger zones flagged right now. Always drive carefully on mountain roads, narrow sections and bridges.</p>;
  return (
    <div className="space-y-2">
      {danger.map((a) => (
        <button key={a.id} onClick={() => onOpen(a)} className="flex w-full items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-left hover:bg-red-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <span className="min-w-0"><span className="block truncate text-sm font-semibold capitalize text-red-800">{a.alert_type?.replace("-", " ")} — {a.road_name || a.location}</span><span className="block truncate text-xs text-red-700/80">Level: {a.alert_level}{a.reason ? ` · ${a.reason}` : ""}</span></span>
        </button>
      ))}
    </div>
  );
}
function SeasonalRoads({ roads }: { roads: { road_name: string; status: string; distance_km: number | null }[] }) {
  const seasonal = roads.filter((r) => ["seasonal", "snow-blocked", "blocked", "clearance", "risky", "partial"].includes(r.status));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Roads that close or turn risky by season (snow, landslides). Check live status before you travel.</p>
      {seasonal.length === 0 ? (
        <p className="text-sm text-muted-foreground">All roads currently open.</p>
      ) : (
        <div className="space-y-1.5">
          {seasonal.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-forest-50/40 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 truncate text-forest"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ROAD_COLOR[r.status] ?? "#9ca3af" }} /> {r.road_name}{r.distance_km ? ` · ${r.distance_km} km` : ""}</span>
              <span className="shrink-0 text-xs font-semibold" style={{ color: ROAD_COLOR[r.status] ?? "#6b7280" }}>{STATUS_LABEL[r.status] ?? r.status}</span>
            </div>
          ))}
        </div>
      )}
      <Link href="/roadside/updates" className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-forest px-3 py-2 text-sm font-semibold text-white">View live road updates</Link>
    </div>
  );
}
function CommunityReports({ onReport }: { onReport: () => void }) {
  const [reports, setReports] = React.useState<MapReportRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => { getVerifiedReports().then((r) => { setReports(r); setLoading(false); }); }, []);
  return (
    <div className="space-y-3">
      <button onClick={onReport} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-forest px-3 py-2.5 text-sm font-semibold text-white hover:opacity-95">
        <Megaphone className="h-4 w-4" /> Report a road update
      </button>
      <p className="text-xs text-muted-foreground">Verified updates shared by fellow travellers. New reports appear here once our team confirms them.</p>
      {loading ? (
        <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-forest-600" /></div>
      ) : reports.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 py-8 text-center text-sm text-muted-foreground">No verified community reports yet. Be the first to share a road update!</p>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-bold capitalize text-forest">{r.report_type?.replace("-", " ")}</span>
                <span className="text-[11px] text-muted-foreground">{timeAgo(r.created_at)}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.location_name || (r.latitude ? `${r.latitude.toFixed(3)}, ${r.longitude?.toFixed(3)}` : "—")}{r.road_name ? ` · ${r.road_name}` : ""} · by {r.user_name || "a traveller"}</p>
              {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
              {r.photo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.photo} alt="" className="mt-2 h-24 w-full rounded-lg object-cover" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function RoadStatusPanel({ roads, alerts, onAlert }: { roads: { road_name: string; status: string; distance_km: number | null }[]; alerts: RoadAlertRow[]; onAlert: (a: RoadAlertRow) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Road network status</p>
        <div className="space-y-1.5">
          {roads.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-forest-50/40 px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2 truncate text-forest"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ROAD_COLOR[r.status] ?? "#9ca3af" }} /> {r.road_name}{r.distance_km ? ` · ${r.distance_km} km` : ""}</span>
              <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: `${ROAD_COLOR[r.status] ?? "#9ca3af"}22`, color: ROAD_COLOR[r.status] ?? "#6b7280" }}>{STATUS_LABEL[r.status] ?? r.status}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active alerts ({alerts.length})</p>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active road alerts right now.</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => (
              <button key={a.id} onClick={() => onAlert(a)} className="flex w-full items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 p-2.5 text-left hover:bg-orange-100">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                <span className="min-w-0"><span className="block truncate text-sm font-semibold capitalize text-orange-800">{a.alert_type?.replace("-", " ")} — {a.road_name || a.location}</span><span className="block truncate text-[11px] text-orange-700/80">{a.reason || ""} {a.expected_opening_time ? `· ETA ${a.expected_opening_time}` : ""}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="rounded-lg bg-forest-50/70 px-3 py-2 text-xs text-forest">Status is updated by the Rego team and verified travellers. Always confirm before setting off.</p>
    </div>
  );
}
function TravelGuides() {
  const [stories, setStories] = React.useState<StoryRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => { getApprovedStories().then((s) => { setStories(s.slice(0, 8)); setLoading(false); }); }, []);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Top traveller stories &amp; guides for Gilgit-Baltistan.</p>
        <Link href="/safarnama" className="shrink-0 text-xs font-semibold text-forest-600 hover:text-gold">See all →</Link>
      </div>
      {loading ? (
        <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-forest-600" /></div>
      ) : stories.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 py-8 text-center text-sm text-muted-foreground">No published travel guides yet. Check back soon or share your own on Safarnama.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {stories.map((s) => (
            <Link key={s.id} href={`/safarnama/${s.id}`} className="group flex gap-3 rounded-2xl border border-border bg-card p-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-premium">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo(s.cover_image || (s.gallery && s.gallery[0]) || "https://picsum.photos/seed/guide/300/200")} alt={s.title} className="h-20 w-24 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-display text-sm font-bold leading-snug text-forest group-hover:text-forest-600">{s.title}</p>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{s.destination || s.city || "Gilgit-Baltistan"} · {s.reading_time} min read</p>
                <p className="mt-0.5 text-xs text-muted-foreground">❤ {s.likes} · 👁 {s.views}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
function OfflinePanel({ places, onOpen }: { places: MapPlaceRow[]; onOpen: (p: MapPlaceRow) => void }) {
  const ids = getSaved();
  const saved = places.filter((p) => ids.includes(p.id));
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-forest-100 bg-forest-50/60 p-3 text-sm text-forest">
        <p className="font-semibold">Offline access</p>
        <p className="mt-1 text-xs text-muted-foreground">Your <b>Saved Places</b> are stored on this device, so their name, category and coordinates stay available even without signal. Save spots along your route before you travel, and open Directions to cache them in Google Maps for full offline navigation.</p>
      </div>
      {saved.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saved places yet. Tap any pin and press <b>Save</b> to keep it for offline.</p>
      ) : (
        <div className="space-y-2">
          {saved.map((p) => (
            <button key={p.id} onClick={() => onOpen(p)} className="flex w-full items-center gap-2 rounded-xl border border-border p-2.5 text-left hover:bg-muted">
              <span>{mapCategory(p.category)?.emoji}</span>
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-forest">{p.name}</span><span className="block text-xs text-muted-foreground">{p.latitude.toFixed(3)}, {p.longitude.toFixed(3)}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Sel({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: string[] }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-forest">{label}</span><select className="auth-input" value={value} onChange={(e) => onChange(e.target.value)}>{opts.map((o) => <option key={o}>{o}</option>)}</select></label>;
}
function Kv({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{label}</span><span className={cn("font-semibold text-forest", big && "font-display text-lg")}>{value}</span></div>;
}
