import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isUuid } from "@/lib/hotels";
import { type Listing } from "@/lib/data";
import { updateOrQueue } from "@/lib/pending-edits";

export interface RestaurantRow {
  id: string;
  property_id: string | null;
  property_type: string | null;
  property_name: string | null;
  name: string;
  owner_name: string | null;
  logo: string | null;
  cover_image: string | null;
  gallery: string[] | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  map_link: string | null;
  city: string | null;
  location: string | null;
  opening_hours: string | null;
  closing_hours: string | null;
  cuisine_types: string[] | null;
  dining_options: string[] | null;
  price_range: string | null;
  description: string | null;
  facilities: string[] | null;
  social_links: string[] | null;
  license_doc: string | null;
  owner_cnic: string | null;
  owner_cnic_doc: string | null;
  rating: number;
  reviews: number;
  status: string;
  verified: boolean;
  featured: boolean;
  ranking_badge?: string | null;
  menu_views: number;
  owner_email: string | null;
  created_at: string;
}

export interface MenuItemRow {
  id: string;
  restaurant_id: string | null;
  name: string;
  category: string | null;
  image: string | null;
  description: string | null;
  price: number;
  discount_price: number | null;
  prep_time: string | null;
  serving_size: string | null;
  availability: string;
  featured: boolean;
  spicy_level: string | null;
  vegetarian: boolean;
  owner_email: string | null;
  created_at: string;
}

export const CUISINE_TYPES = [
  "Pakistani", "Balti", "Gilgiti", "Chinese", "Fast Food", "BBQ",
  "Continental", "Desi", "Cafe", "Bakery", "Traditional Food",
];
export const DINING_OPTIONS = [
  "Dine-in", "Takeaway", "Delivery", "Outdoor Seating", "Family Hall", "Private Room",
];
export const RESTAURANT_FACILITIES = [
  "Parking", "WiFi", "Family Area", "Kids Friendly", "Mountain View",
  "River View", "Card Payment", "Online Order",
];
export const PRICE_RANGES = ["Budget", "Mid-range", "Fine dining"];
export const MENU_CATEGORIES = [
  "Breakfast", "Lunch", "Dinner", "BBQ", "Fast Food", "Traditional Food",
  "Drinks", "Desserts", "Tea / Coffee", "Special Deals",
];
export const SPICY_LEVELS = ["Mild", "Medium", "Spicy"];

const PUBLIC =
  "id,property_id,property_type,property_name,name,owner_name,logo,cover_image,gallery,phone,whatsapp,email,address,map_link,city,location,opening_hours,closing_hours,cuisine_types,dining_options,price_range,description,facilities,social_links,rating,reviews,status,verified,featured,menu_views,ranking_badge,owner_email,created_at,accept_pay_at_property,require_advance_payment,advance_payment_percentage,accepted_payment_methods,payment_bank_name,payment_account_title,payment_account_number,payment_iban,payment_jazzcash,payment_easypaisa,payment_instructions";

export function restaurantToListing(r: RestaurantRow): Listing {
  return {
    id: r.id,
    title: r.name,
    category: "restaurants",
    categoryLabel: (r.cuisine_types ?? [])[0] || "Restaurant",
    location: r.location || r.city || "Gilgit Baltistan",
    price: 0,
    unit: "",
    rating: Number(r.rating),
    reviews: r.reviews,
    image: r.cover_image || r.logo || "https://picsum.photos/seed/restaurant/900/600",
    provider: r.property_name || undefined,
    featured: r.featured,
  };
}

/* ---------------- Restaurant ---------------- */

export async function getRestaurantByOwner(email: string): Promise<RestaurantRow | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_email", email)
    .is("property_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as RestaurantRow) ?? null;
}

export async function getRestaurantRowById(id: string): Promise<RestaurantRow | null> {
  if (!isSupabaseConfigured || !isUuid(id)) return null;
  const { data, error } = await supabase
    .from("restaurants")
    .select(PUBLIC)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as RestaurantRow;
}

export async function getApprovedRestaurants(): Promise<RestaurantRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("restaurants")
    .select(PUBLIC)
    .eq("status", "approved")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  return (data as unknown as RestaurantRow[]) ?? [];
}

export async function getApprovedRestaurantsByProperty(propertyId: string): Promise<RestaurantRow[]> {
  if (!isSupabaseConfigured || !isUuid(propertyId)) return [];
  const { data } = await supabase
    .from("restaurants")
    .select(PUBLIC)
    .eq("property_id", propertyId)
    .eq("status", "approved");
  return (data as unknown as RestaurantRow[]) ?? [];
}

/** The property restaurant owned by this email (property_type set). */
export async function getPropertyRestaurantByOwner(email: string): Promise<RestaurantRow | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_email", email)
    .not("property_type", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as RestaurantRow) ?? null;
}

export async function getRestaurantsByProperty(propertyId: string): Promise<RestaurantRow[]> {
  if (!isSupabaseConfigured || !isUuid(propertyId)) return [];
  const { data } = await supabase
    .from("restaurants")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });
  return (data as RestaurantRow[]) ?? [];
}

export async function getAllRestaurants(): Promise<RestaurantRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("restaurants").select("*").order("created_at", { ascending: false });
  return (data as RestaurantRow[]) ?? [];
}

export async function getPendingRestaurants(): Promise<RestaurantRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("restaurants").select("*").eq("status", "pending").order("created_at", { ascending: false });
  return (data as RestaurantRow[]) ?? [];
}

export type RestaurantInput = Partial<Omit<RestaurantRow, "id" | "created_at">> & { name: string };
export async function createRestaurant(input: RestaurantInput) {
  return supabase.from("restaurants").insert(input).select().single();
}
export async function updateRestaurant(id: string, input: Partial<RestaurantInput>) {
  return updateOrQueue("restaurants", id, input as Record<string, unknown>);
}
export async function deleteRestaurant(id: string) {
  return supabase.from("restaurants").delete().eq("id", id);
}
export async function setRestaurantStatus(id: string, status: string) {
  return supabase.from("restaurants").update({ status }).eq("id", id);
}
export async function setRestaurantVerified(id: string, verified: boolean) {
  return supabase.from("restaurants").update({ verified }).eq("id", id);
}
export async function setRestaurantFeatured(id: string, featured: boolean) {
  return supabase.from("restaurants").update({ featured }).eq("id", id);
}

/* ---------------- Menu ---------------- */

export async function getMenuByRestaurant(restaurantId: string): Promise<MenuItemRow[]> {
  if (!isSupabaseConfigured || !isUuid(restaurantId)) return [];
  const { data } = await supabase
    .from("restaurant_menu_items")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });
  return (data as MenuItemRow[]) ?? [];
}

export type MenuItemInput = Partial<Omit<MenuItemRow, "id" | "created_at">> & {
  name: string;
  restaurant_id: string;
};
export async function createMenuItem(input: MenuItemInput) {
  return supabase.from("restaurant_menu_items").insert(input).select().single();
}
export async function updateMenuItem(id: string, input: Partial<MenuItemInput>) {
  return supabase.from("restaurant_menu_items").update(input).eq("id", id);
}
export async function deleteMenuItem(id: string) {
  return supabase.from("restaurant_menu_items").delete().eq("id", id);
}
