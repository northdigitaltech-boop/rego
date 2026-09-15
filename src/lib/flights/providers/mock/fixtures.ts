/* ============================================================
 * Mock reference data and route inventory.
 *
 * Realistic in SHAPE — code formats, timings, connection patterns,
 * fare structures — so the UI is built against something that
 * behaves like the real thing.
 *
 * NOT realistic as FACT. These fares are invented. They are not a
 * claim about what any airline charges, and nothing here should
 * ever be shown to a customer as a real price. Every offer built
 * from this file carries isMock: true.
 * ============================================================ */

import type { CabinClass } from "../../types";

export interface MockAirport {
  iata: string;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  timezone: string;
  /** Minutes from UTC. Used to build plausible local departure times. */
  utcOffsetMinutes: number;
}

export const MOCK_AIRPORTS: Record<string, MockAirport> = {
  KUL: {
    iata: "KUL",
    name: "Kuala Lumpur International Airport",
    city: "Kuala Lumpur",
    country: "Malaysia",
    countryCode: "MY",
    timezone: "Asia/Kuala_Lumpur",
    utcOffsetMinutes: 480,
  },
  ISB: {
    iata: "ISB",
    name: "Islamabad International Airport",
    city: "Islamabad",
    country: "Pakistan",
    countryCode: "PK",
    timezone: "Asia/Karachi",
    utcOffsetMinutes: 300,
  },
  KHI: {
    iata: "KHI",
    name: "Jinnah International Airport",
    city: "Karachi",
    country: "Pakistan",
    countryCode: "PK",
    timezone: "Asia/Karachi",
    utcOffsetMinutes: 300,
  },
  LHE: {
    iata: "LHE",
    name: "Allama Iqbal International Airport",
    city: "Lahore",
    country: "Pakistan",
    countryCode: "PK",
    timezone: "Asia/Karachi",
    utcOffsetMinutes: 300,
  },
  KDU: {
    iata: "KDU",
    name: "Skardu International Airport",
    city: "Skardu",
    country: "Pakistan",
    countryCode: "PK",
    timezone: "Asia/Karachi",
    utcOffsetMinutes: 300,
  },
  GIL: {
    iata: "GIL",
    name: "Gilgit Airport",
    city: "Gilgit",
    country: "Pakistan",
    countryCode: "PK",
    timezone: "Asia/Karachi",
    utcOffsetMinutes: 300,
  },
  DXB: {
    iata: "DXB",
    name: "Dubai International Airport",
    city: "Dubai",
    country: "United Arab Emirates",
    countryCode: "AE",
    timezone: "Asia/Dubai",
    utcOffsetMinutes: 240,
  },
  DOH: {
    iata: "DOH",
    name: "Hamad International Airport",
    city: "Doha",
    country: "Qatar",
    countryCode: "QA",
    timezone: "Asia/Qatar",
    utcOffsetMinutes: 180,
  },
  JED: {
    iata: "JED",
    name: "King Abdulaziz International Airport",
    city: "Jeddah",
    country: "Saudi Arabia",
    countryCode: "SA",
    timezone: "Asia/Riyadh",
    utcOffsetMinutes: 180,
  },
  LHR: {
    iata: "LHR",
    name: "London Heathrow Airport",
    city: "London",
    country: "United Kingdom",
    countryCode: "GB",
    timezone: "Europe/London",
    utcOffsetMinutes: 0,
  },
  IST: {
    iata: "IST",
    name: "Istanbul Airport",
    city: "Istanbul",
    country: "Türkiye",
    countryCode: "TR",
    timezone: "Europe/Istanbul",
    utcOffsetMinutes: 180,
  },
};

export interface MockAirline {
  iata: string;
  name: string;
  countryCode: string;
}

export const MOCK_AIRLINES: Record<string, MockAirline> = {
  PK: { iata: "PK", name: "Pakistan International Airlines", countryCode: "PK" },
  ER: { iata: "ER", name: "Serene Air", countryCode: "PK" },
  PA: { iata: "PA", name: "Airblue", countryCode: "PK" },
  EK: { iata: "EK", name: "Emirates", countryCode: "AE" },
  QR: { iata: "QR", name: "Qatar Airways", countryCode: "QA" },
  MH: { iata: "MH", name: "Malaysia Airlines", countryCode: "MY" },
  TK: { iata: "TK", name: "Turkish Airlines", countryCode: "TR" },
  SV: { iata: "SV", name: "Saudia", countryCode: "SA" },
  BA: { iata: "BA", name: "British Airways", countryCode: "GB" },
};

/** One hop the mock can build a segment from. */
export interface MockHop {
  carrier: string;
  flightNumber: string;
  from: string;
  to: string;
  /** Local departure, minutes past midnight at the origin. */
  departMinuteOfDay: number;
  durationMinutes: number;
  aircraft: string;
  aircraftName: string;
}

/**
 * The hop table. Connections are composed from these at search time rather
 * than enumerated, so a two-stop KUL→KDU itinerary falls out of the same data
 * as a direct ISB→KDU.
 */
export const MOCK_HOPS: MockHop[] = [
  /* Domestic Pakistan */
  { carrier: "PK", flightNumber: "451", from: "ISB", to: "KDU", departMinuteOfDay: 7 * 60 + 15, durationMinutes: 65, aircraft: "AT7", aircraftName: "ATR 72" },
  { carrier: "ER", flightNumber: "521", from: "ISB", to: "KDU", departMinuteOfDay: 9 * 60 + 40, durationMinutes: 70, aircraft: "AT7", aircraftName: "ATR 72" },
  { carrier: "PK", flightNumber: "605", from: "ISB", to: "GIL", departMinuteOfDay: 8 * 60 + 5, durationMinutes: 60, aircraft: "AT7", aircraftName: "ATR 72" },
  { carrier: "PK", flightNumber: "301", from: "KHI", to: "ISB", departMinuteOfDay: 6 * 60 + 30, durationMinutes: 125, aircraft: "320", aircraftName: "Airbus A320" },
  { carrier: "PA", flightNumber: "201", from: "KHI", to: "ISB", departMinuteOfDay: 14 * 60, durationMinutes: 120, aircraft: "320", aircraftName: "Airbus A320" },
  { carrier: "ER", flightNumber: "811", from: "LHE", to: "ISB", departMinuteOfDay: 11 * 60 + 20, durationMinutes: 55, aircraft: "738", aircraftName: "Boeing 737-800" },
  { carrier: "PK", flightNumber: "368", from: "ISB", to: "KHI", departMinuteOfDay: 17 * 60 + 45, durationMinutes: 125, aircraft: "320", aircraftName: "Airbus A320" },

  /* Pakistan ↔ Gulf */
  { carrier: "EK", flightNumber: "615", from: "ISB", to: "DXB", departMinuteOfDay: 4 * 60 + 25, durationMinutes: 175, aircraft: "77W", aircraftName: "Boeing 777-300ER" },
  { carrier: "EK", flightNumber: "612", from: "DXB", to: "ISB", departMinuteOfDay: 22 * 60 + 15, durationMinutes: 185, aircraft: "77W", aircraftName: "Boeing 777-300ER" },
  { carrier: "QR", flightNumber: "615", from: "ISB", to: "DOH", departMinuteOfDay: 3 * 60 + 5, durationMinutes: 210, aircraft: "359", aircraftName: "Airbus A350-900" },
  { carrier: "QR", flightNumber: "614", from: "DOH", to: "ISB", departMinuteOfDay: 19 * 60 + 50, durationMinutes: 215, aircraft: "359", aircraftName: "Airbus A350-900" },
  { carrier: "SV", flightNumber: "731", from: "KHI", to: "JED", departMinuteOfDay: 9 * 60 + 15, durationMinutes: 235, aircraft: "789", aircraftName: "Boeing 787-9" },
  { carrier: "PK", flightNumber: "743", from: "KHI", to: "JED", departMinuteOfDay: 2 * 60 + 40, durationMinutes: 245, aircraft: "777", aircraftName: "Boeing 777-200ER" },

  /* Gulf / Türkiye ↔ Southeast Asia */
  { carrier: "EK", flightNumber: "343", from: "DXB", to: "KUL", departMinuteOfDay: 3 * 60 + 45, durationMinutes: 430, aircraft: "388", aircraftName: "Airbus A380-800" },
  { carrier: "EK", flightNumber: "342", from: "KUL", to: "DXB", departMinuteOfDay: 21 * 60 + 30, durationMinutes: 455, aircraft: "388", aircraftName: "Airbus A380-800" },
  { carrier: "QR", flightNumber: "849", from: "KUL", to: "DOH", departMinuteOfDay: 20 * 60 + 5, durationMinutes: 460, aircraft: "35K", aircraftName: "Airbus A350-1000" },
  { carrier: "MH", flightNumber: "160", from: "KUL", to: "DXB", departMinuteOfDay: 9 * 60 + 25, durationMinutes: 445, aircraft: "333", aircraftName: "Airbus A330-300" },
  { carrier: "TK", flightNumber: "61", from: "KUL", to: "IST", departMinuteOfDay: 23 * 60 + 10, durationMinutes: 645, aircraft: "77W", aircraftName: "Boeing 777-300ER" },
  { carrier: "TK", flightNumber: "710", from: "IST", to: "ISB", departMinuteOfDay: 19 * 60 + 25, durationMinutes: 300, aircraft: "321", aircraftName: "Airbus A321neo" },

  /* Pakistan ↔ Europe */
  { carrier: "PK", flightNumber: "785", from: "ISB", to: "LHR", departMinuteOfDay: 10 * 60 + 30, durationMinutes: 520, aircraft: "77L", aircraftName: "Boeing 777-200LR" },
  { carrier: "BA", flightNumber: "262", from: "ISB", to: "LHR", departMinuteOfDay: 2 * 60 + 15, durationMinutes: 500, aircraft: "788", aircraftName: "Boeing 787-8" },
  { carrier: "QR", flightNumber: "9", from: "DOH", to: "LHR", departMinuteOfDay: 7 * 60 + 55, durationMinutes: 425, aircraft: "35K", aircraftName: "Airbus A350-1000" },
];

/**
 * Indicative base fare per hop, in PKR minor units, economy, one adult.
 *
 * INVENTED. Roughly ordered so short domestic hops cost less than long-haul,
 * which is all the UI needs to look sane. Not a price claim.
 */
export const MOCK_BASE_FARE_PKR: Record<string, number> = {
  "ISB-KDU": 2_800_000,
  "ISB-GIL": 2_600_000,
  "KHI-ISB": 3_200_000,
  "LHE-ISB": 2_400_000,
  "ISB-KHI": 3_200_000,
  "ISB-DXB": 7_500_000,
  "DXB-ISB": 7_800_000,
  "ISB-DOH": 8_200_000,
  "DOH-ISB": 8_400_000,
  "KHI-JED": 9_500_000,
  "DXB-KUL": 16_500_000,
  "KUL-DXB": 17_000_000,
  "KUL-DOH": 17_500_000,
  "KUL-IST": 21_000_000,
  "IST-ISB": 9_800_000,
  "ISB-LHR": 24_000_000,
  "DOH-LHR": 19_500_000,
};

/** Cabin multipliers applied to the base fare. Conventional, not researched. */
export const CABIN_MULTIPLIER: Record<CabinClass, number> = {
  economy: 1,
  premium_economy: 1.7,
  business: 3.2,
  first: 5.5,
};

/** Fare families the mock hands out, cheapest first. */
export interface MockFareFamily {
  code: string;
  label: string;
  /** Multiplier on the cabin fare. */
  multiplier: number;
  refundable: boolean;
  changeable: boolean;
  checkedPieces: number;
  checkedWeightKg: number | null;
}

export const MOCK_FARE_FAMILIES: MockFareFamily[] = [
  { code: "ECOLITE", label: "Economy Lite", multiplier: 1, refundable: false, changeable: false, checkedPieces: 0, checkedWeightKg: null },
  { code: "ECOSTD", label: "Economy Standard", multiplier: 1.18, refundable: false, changeable: true, checkedPieces: 1, checkedWeightKg: 23 },
  { code: "ECOFLEX", label: "Economy Flex", multiplier: 1.42, refundable: true, changeable: true, checkedPieces: 2, checkedWeightKg: 23 },
];
