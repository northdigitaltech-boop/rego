import { createClient } from "@supabase/supabase-js";

// Reads from .env.local. Supports both the new "publishable" key and the
// older "anon" key naming.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export const isSupabaseConfigured =
  supabaseUrl.startsWith("http") && supabaseKey.length > 10;

// Use a harmless placeholder when not configured so the app never crashes.
// Data functions guard on `isSupabaseConfigured`, so this is never queried.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : "https://placeholder.supabase.co",
  isSupabaseConfigured ? supabaseKey : "placeholder-key"
);

/* ---- Row types (match supabase/schema.sql) ---- */

export interface HotelRow {
  id: string;
  title: string;
  category: string;
  category_label: string;
  location: string;
  price: number;
  unit: string;
  rating: number;
  reviews: number;
  image: string | null;
  description: string | null;
  amenities: string[] | null;
  gallery: string[] | null;
  featured: boolean;
  status: string; // 'pending' | 'approved' | 'rejected'
  total_rooms: number | null;
  address: string | null;
  reg_number: string | null;
  license_doc: string | null;
  owner_cnic: string | null;
  owner_cnic_doc: string | null;
  ownership_doc: string | null;
  verified: boolean;
  ranking_badge?: string | null;
  owner_email: string | null;
  created_at: string;
}

export interface RoomRow {
  id: string;
  hotel_id: string;
  name: string;
  room_type: string | null;
  price: number;
  guests: number;
  beds: string;
  features: string[] | null;
  images: string[] | null;
  total_units: number | null;
  created_at: string;
}
