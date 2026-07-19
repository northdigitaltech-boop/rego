"use client";

import * as React from "react";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudRain,
  CloudSnow,
  CloudLightning,
  type LucideIcon,
} from "lucide-react";

// Fixed GB cities (hardcoded coords — no user input, no injection surface).
const CITIES = [
  { name: "Skardu", lat: 35.3, lon: 75.63 },
  { name: "Hunza", lat: 36.32, lon: 74.65 },
  { name: "Gilgit", lat: 35.92, lon: 74.31 },
  { name: "Ghizer", lat: 36.17, lon: 73.77 },
  { name: "Astore", lat: 35.37, lon: 74.86 },
  { name: "Diamer", lat: 35.2, lon: 73.6 },
  { name: "Chilas", lat: 35.42, lon: 74.1 },
];

function wmo(code: number): { label: string; Icon: LucideIcon } {
  if (code === 0) return { label: "Clear", Icon: Sun };
  if (code <= 2) return { label: "Partly cloudy", Icon: CloudSun };
  if (code === 3) return { label: "Cloudy", Icon: Cloud };
  if (code === 45 || code === 48) return { label: "Fog", Icon: CloudFog };
  if (code >= 71 && code <= 77) return { label: "Snow", Icon: CloudSnow };
  if (code === 85 || code === 86) return { label: "Snow", Icon: CloudSnow };
  if (code >= 95) return { label: "Thunder", Icon: CloudLightning };
  if (code >= 51) return { label: "Rain", Icon: CloudRain };
  return { label: "Cloudy", Icon: Cloud };
}

interface CityWeather {
  name: string;
  temp: number;
  code: number;
}

export function HeroWeather() {
  const [data, setData] = React.useState<CityWeather[]>([]);

  React.useEffect(() => {
    const ctrl = new AbortController();
    const lat = CITIES.map((c) => c.lat).join(",");
    const lon = CITIES.map((c) => c.lon).join(",");
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;

    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => {
        const arr = Array.isArray(json) ? json : [json];
        const out: CityWeather[] = CITIES.map((c, i) => {
          const cur = arr[i]?.current;
          return cur
            ? { name: c.name, temp: Math.round(cur.temperature_2m), code: Number(cur.weather_code) }
            : null;
        }).filter(Boolean) as CityWeather[];
        setData(out);
      })
      .catch(() => {
        /* fail silently — never break the hero */
      });

    return () => ctrl.abort();
  }, []);

  if (data.length === 0) return null;

  return (
    <div className="no-scrollbar mt-7 flex flex-nowrap gap-2 overflow-x-auto pb-1">
      {data.map((c) => {
        const { Icon } = wmo(c.code);
        return (
          <div
            key={c.name}
            title={wmo(c.code).label}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-md"
          >
            <Icon className="h-5 w-5 shrink-0 text-gold" />
            <div className="leading-tight">
              <p className="text-[11px] font-medium text-white/80">{c.name}</p>
              <p className="text-sm font-bold text-white">{c.temp}°C</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
