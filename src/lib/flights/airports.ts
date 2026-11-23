import { supabase, isSupabaseConfigured } from "@/lib/supabase";

import type { Airline, Airport } from "./types";

/* ============================================================
 * Airport and airline lookups.
 *
 * Reads the public tables directly with the anon key. That is
 * deliberate and safe: phase116 exposes only active rows, the data
 * is on every boarding pass in the world, and autocomplete has to
 * answer while somebody is still typing. Routing this through an
 * API route would add a hop for no privacy gain.
 *
 * NOT loaded in bulk. ~9,000 airports is roughly 2 MB of JSON;
 * shipping that to a phone on a Skardu connection to save a 40ms
 * query is the wrong trade.
 * ============================================================ */

interface AirportRow {
  id: string;
  iata_code: string;
  icao_code: string | null;
  airport_name: string;
  city: string;
  country: string;
  country_code: string;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
}

const toAirport = (r: AirportRow): Airport => ({
  id: r.id,
  iataCode: r.iata_code,
  icaoCode: r.icao_code,
  airportName: r.airport_name,
  city: r.city,
  country: r.country,
  countryCode: r.country_code,
  timezone: r.timezone,
  latitude: r.latitude,
  longitude: r.longitude,
  isActive: r.is_active,
});

const COLUMNS =
  "id, iata_code, icao_code, airport_name, city, country, country_code, timezone, latitude, longitude, is_active";

/**
 * Search airports by code, city or name.
 *
 * Ordering matters more than it looks. Somebody typing "LHR" wants Heathrow
 * first, not "Lahore" because L-H-R appears in it. So an exact IATA match is
 * promoted above everything else, then city, then airport name.
 */
export async function searchAirports(query: string, limit = 8): Promise<Airport[]> {
  const q = query.trim();
  if (!isSupabaseConfigured || q.length < 2) return [];

  const upper = q.toUpperCase();

  /* An exact code match short-circuits: three characters that are a real
     airport code are almost never meant as a city-name fragment. */
  if (/^[A-Z]{3}$/.test(upper)) {
    const { data } = await supabase
      .from("airports")
      .select(COLUMNS)
      .eq("iata_code", upper)
      .limit(1);
    const exact = ((data as AirportRow[]) ?? []).map(toAirport);
    if (exact.length > 0) {
      const rest = await fuzzyAirports(q, limit - 1, [upper]);
      return [...exact, ...rest];
    }
  }

  return fuzzyAirports(q, limit, []);
}

async function fuzzyAirports(
  q: string,
  limit: number,
  excludeCodes: string[]
): Promise<Airport[]> {
  if (limit <= 0) return [];

  /* PostgREST `or` with ilike. The trigram indexes from phase116 are what
     keep this fast; without them this is a sequential scan. */
  const pattern = `%${q.replace(/[%,]/g, "")}%`;
  let builder = supabase
    .from("airports")
    .select(COLUMNS)
    .or(
      `city.ilike.${pattern},airport_name.ilike.${pattern},iata_code.ilike.${pattern}`
    )
    .limit(limit);

  if (excludeCodes.length > 0) {
    builder = builder.not("iata_code", "in", `(${excludeCodes.join(",")})`);
  }

  const { data, error } = await builder;
  if (error || !data) return [];

  const rows = (data as AirportRow[]).map(toAirport);
  const needle = q.toLowerCase();

  /* Rank client-side over a handful of rows: cheaper than a second query and
     it puts "Islamabad" above "Islamabad Cargo Terminal" for "isla". */
  return rows.sort((a, b) => score(b, needle) - score(a, needle));
}

function score(a: Airport, needle: string): number {
  const code = a.iataCode.toLowerCase();
  const city = a.city.toLowerCase();
  const name = a.airportName.toLowerCase();
  if (code === needle) return 100;
  if (city === needle) return 90;
  if (city.startsWith(needle)) return 80;
  if (name.startsWith(needle)) return 70;
  if (city.includes(needle)) return 60;
  if (name.includes(needle)) return 50;
  return 10;
}

export async function getAirport(iataCode: string): Promise<Airport | null> {
  if (!isSupabaseConfigured || !/^[A-Za-z]{3}$/.test(iataCode)) return null;
  const { data } = await supabase
    .from("airports")
    .select(COLUMNS)
    .eq("iata_code", iataCode.toUpperCase())
    .maybeSingle();
  return data ? toAirport(data as AirportRow) : null;
}

/** Several at once, for rendering an itinerary without a query per segment. */
export async function getAirports(iataCodes: string[]): Promise<Map<string, Airport>> {
  const out = new Map<string, Airport>();
  const codes = [...new Set(iataCodes.map((c) => c.toUpperCase()))].filter((c) =>
    /^[A-Z]{3}$/.test(c)
  );
  if (!isSupabaseConfigured || codes.length === 0) return out;

  const { data } = await supabase.from("airports").select(COLUMNS).in("iata_code", codes);
  for (const r of (data as AirportRow[]) ?? []) {
    const a = toAirport(r);
    out.set(a.iataCode, a);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Airlines                                                            */
/* ------------------------------------------------------------------ */

interface AirlineRow {
  id: string;
  iata_code: string;
  icao_code: string | null;
  name: string;
  logo_url: string | null;
  country_code: string | null;
  is_active: boolean;
}

const toAirline = (r: AirlineRow): Airline => ({
  id: r.id,
  iataCode: r.iata_code,
  icaoCode: r.icao_code,
  name: r.name,
  logoUrl: r.logo_url,
  countryCode: r.country_code,
  isActive: r.is_active,
});

export async function getAirlines(iataCodes: string[]): Promise<Map<string, Airline>> {
  const out = new Map<string, Airline>();
  const codes = [...new Set(iataCodes.map((c) => c.toUpperCase()))];
  if (!isSupabaseConfigured || codes.length === 0) return out;

  const { data } = await supabase
    .from("airlines")
    .select("id, iata_code, icao_code, name, logo_url, country_code, is_active")
    .in("iata_code", codes);

  for (const r of (data as AirlineRow[]) ?? []) {
    const a = toAirline(r);
    out.set(a.iataCode, a);
  }
  return out;
}

/** "Islamabad (ISB)" — the shape a search field should echo back. */
export const airportLabel = (a: Airport): string => `${a.city} (${a.iataCode})`;


/**
 * The airport a typed or pasted word most likely means.
 *
 * Used when someone types "Islamabad" and presses Search without picking
 * from the dropdown — the search used to refuse with "Choose both
 * airports". Order: exact IATA code ("ISB"), exact city ("skardu"),
 * a city that starts with the text, an airport name that contains it,
 * then simply the first result the search returned.
 */
export function bestAirportMatch(list: Airport[], text: string): Airport | null {
  const t = text.trim().toLowerCase();
  if (!t || list.length === 0) return null;
  const by = (f: (a: Airport) => boolean) => list.find(f) ?? null;
  return (
    by((a) => (a.iataCode ?? "").toLowerCase() === t) ??
    by((a) => (a.city ?? "").toLowerCase() === t) ??
    by((a) => (a.city ?? "").toLowerCase().startsWith(t)) ??
    by((a) => (a.airportName ?? "").toLowerCase().includes(t)) ??
    list[0]
  );
}

/** Resolve free text to one airport, or null if nothing matches. */
export async function resolveAirport(text: string): Promise<Airport | null> {
  if (text.trim().length < 2) return null;
  return bestAirportMatch(await searchAirports(text, 8), text);
}
