import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface BookingLookupResult {
  kind: "hotel" | "homestay" | "tour" | "transport" | "guide" | "media" | "restaurant";
  ref: string;
  title: string;
  room_name: string | null;
  check_in: string | null;
  check_out: string | null;
  guests: number;
  rooms: number;
  total_price: number;
  status: string;
  created_at: string;
}

interface LookupRow {
  id: string;
  title: string;
  room_name: string | null;
  check_in: string | null;
  check_out: string | null;
  guests: number;
  rooms: number;
  total_price: number;
  status: string;
  created_at: string;
}

/**
 * Look up a booking by its reference (e.g. "SGB-2D7F95E9" for hotels or
 * "HGB-…" for homestays). The reference encodes the first 8 hex characters of
 * the booking's uuid, so we query by a uuid range covering that prefix. Only
 * non-sensitive status fields are returned (no customer contact details).
 */
async function queryTable(
  table: "bookings" | "homestay_bookings",
  titleCol: "hotel_title" | "homestay_title",
  lo: string,
  hi: string
): Promise<LookupRow | null> {
  const { data, error } = await supabase
    .from(table)
    .select(
      `id, title:${titleCol}, room_name, check_in, check_out, guests, rooms, total_price, status, created_at`
    )
    .gte("id", lo)
    .lt("id", hi)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as LookupRow;
}

async function queryTour(lo: string, hi: string): Promise<LookupRow | null> {
  const { data, error } = await supabase
    .from("tour_bookings")
    .select(
      "id, title:item_title, room_name:item_type, check_in:start_date, check_out:end_date, guests, total_price, status, created_at"
    )
    .gte("id", lo)
    .lt("id", hi)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { ...(data as unknown as Omit<LookupRow, "rooms">), rooms: 1 };
}

async function queryTransport(lo: string, hi: string): Promise<LookupRow | null> {
  const { data, error } = await supabase
    .from("transport_bookings")
    .select(
      "id, title:item_title, room_name:listing_type, check_in:start_date, check_out:end_date, guests:passengers, total_price, status, created_at"
    )
    .gte("id", lo)
    .lt("id", hi)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { ...(data as unknown as Omit<LookupRow, "rooms">), rooms: 1 };
}

async function queryGuide(lo: string, hi: string): Promise<LookupRow | null> {
  const { data, error } = await supabase
    .from("guide_bookings")
    .select(
      "id, title:item_title, room_name:service_title, check_in:start_date, check_out:end_date, guests, total_price, status, created_at"
    )
    .gte("id", lo)
    .lt("id", hi)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { ...(data as unknown as Omit<LookupRow, "rooms">), rooms: 1 };
}

async function queryMedia(lo: string, hi: string): Promise<LookupRow | null> {
  const { data, error } = await supabase
    .from("media_bookings")
    .select(
      "id, title:item_title, room_name:service_title, check_in:start_date, check_out:end_date, guests:people, total_price, status, created_at"
    )
    .gte("id", lo)
    .lt("id", hi)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { ...(data as unknown as Omit<LookupRow, "rooms">), rooms: 1 };
}

async function queryRestaurant(lo: string, hi: string): Promise<LookupRow | null> {
  const { data, error } = await supabase
    .from("restaurant_bookings")
    .select(
      "id, title:item_title, room_name:booking_type, check_in:date, check_out:time, guests, status, created_at"
    )
    .gte("id", lo)
    .lt("id", hi)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { ...(data as unknown as Omit<LookupRow, "rooms" | "total_price">), rooms: 1, total_price: 0 };
}

export async function lookupBooking(
  rawRef: string
): Promise<BookingLookupResult | null> {
  if (!isSupabaseConfigured) return null;

  const cleaned = rawRef.trim().toUpperCase().replace(/\s+/g, "");
  // The prefix only hints which table to try first — we search both, because
  // the same 8-char code identifies the booking regardless of prefix.
  const preferHomestay = cleaned.startsWith("HGB");
  const body = cleaned.replace(/^(SGB|HGB)-?/, "");
  const hex = body.replace(/[^0-9A-F]/g, "").toLowerCase().slice(0, 8);
  if (hex.length < 8) return null;

  const lo = `${hex}-0000-0000-0000-000000000000`;
  const incNum = parseInt(hex, 16) + 1;
  const hiHex =
    incNum > 0xffffffff ? "ffffffff" : incNum.toString(16).padStart(8, "0");
  const hi = `${hiHex}-0000-0000-0000-000000000000`;

  const order: { kind: "hotel" | "homestay" }[] = preferHomestay
    ? [{ kind: "homestay" }, { kind: "hotel" }]
    : [{ kind: "hotel" }, { kind: "homestay" }];

  for (const { kind } of order) {
    const row = await queryTable(
      kind === "hotel" ? "bookings" : "homestay_bookings",
      kind === "hotel" ? "hotel_title" : "homestay_title",
      lo,
      hi
    );
    if (row) {
      return {
        kind,
        ref: `SGB-${hex.toUpperCase()}`,
        title: row.title,
        room_name: row.room_name,
        check_in: row.check_in,
        check_out: row.check_out,
        guests: row.guests,
        rooms: row.rooms,
        total_price: row.total_price,
        status: row.status,
        created_at: row.created_at,
      };
    }
  }

  // Then tour bookings (packages / transport / guides).
  const tourRow = await queryTour(lo, hi);
  if (tourRow) {
    return {
      kind: "tour",
      ref: `SGB-${hex.toUpperCase()}`,
      title: tourRow.title,
      room_name: tourRow.room_name,
      check_in: tourRow.check_in,
      check_out: tourRow.check_out,
      guests: tourRow.guests,
      rooms: tourRow.rooms,
      total_price: tourRow.total_price,
      status: tourRow.status,
      created_at: tourRow.created_at,
    };
  }

  // Transport & rental bookings.
  const transportRow = await queryTransport(lo, hi);
  if (transportRow) {
    return {
      kind: "transport",
      ref: `SGB-${hex.toUpperCase()}`,
      title: transportRow.title,
      room_name:
        transportRow.room_name === "rental" ? "Vehicle Rental" : "Transport Service",
      check_in: transportRow.check_in,
      check_out: transportRow.check_out,
      guests: transportRow.guests,
      rooms: transportRow.rooms,
      total_price: transportRow.total_price,
      status: transportRow.status,
      created_at: transportRow.created_at,
    };
  }

  // Independent guide bookings.
  const guideRow = await queryGuide(lo, hi);
  if (guideRow) {
    return {
      kind: "guide",
      ref: `SGB-${hex.toUpperCase()}`,
      title: guideRow.title,
      room_name: guideRow.room_name ?? "Tour Guide",
      check_in: guideRow.check_in,
      check_out: guideRow.check_out,
      guests: guideRow.guests,
      rooms: guideRow.rooms,
      total_price: guideRow.total_price,
      status: guideRow.status,
      created_at: guideRow.created_at,
    };
  }

  // Photographer / videographer bookings.
  const mediaRow = await queryMedia(lo, hi);
  if (mediaRow) {
    return {
      kind: "media",
      ref: `SGB-${hex.toUpperCase()}`,
      title: mediaRow.title,
      room_name: mediaRow.room_name ?? "Media shoot",
      check_in: mediaRow.check_in,
      check_out: mediaRow.check_out,
      guests: mediaRow.guests,
      rooms: mediaRow.rooms,
      total_price: mediaRow.total_price,
      status: mediaRow.status,
      created_at: mediaRow.created_at,
    };
  }

  // Finally, restaurant table bookings / inquiries.
  const restRow = await queryRestaurant(lo, hi);
  if (restRow) {
    return {
      kind: "restaurant",
      ref: `SGB-${hex.toUpperCase()}`,
      title: restRow.title,
      room_name: restRow.room_name === "inquiry" ? "Food inquiry" : "Table booking",
      check_in: restRow.check_in,
      check_out: restRow.check_out,
      guests: restRow.guests,
      rooms: restRow.rooms,
      total_price: restRow.total_price,
      status: restRow.status,
      created_at: restRow.created_at,
    };
  }
  return null;
}
