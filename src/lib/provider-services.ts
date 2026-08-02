import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { type CategorySlug } from "@/lib/data";

/* ============================================================
 * Multi-service provider accounts (phase 60).
 * One login can run several services (hotel + transport + guiding).
 * Extra services are requested by the owner and must be approved
 * by an admin before they become usable.
 * ============================================================ */

export type ProviderServiceStatus = "pending" | "approved" | "rejected";

export interface ProviderServiceRow {
  id: string;
  owner_email: string;
  category: string;
  status: ProviderServiceStatus | string;
  note: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

const norm = (email: string) => email.trim().toLowerCase();

/** Every service row for one owner (any status). */
export async function getMyServices(email: string): Promise<ProviderServiceRow[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data, error } = await supabase
    .from("provider_services")
    .select("*")
    .eq("owner_email", norm(email))
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as ProviderServiceRow[];
}

/** Only the services this owner is allowed to operate right now. */
export async function getApprovedServiceSlugs(email: string): Promise<CategorySlug[]> {
  const rows = await getMyServices(email);
  return rows
    .filter((r) => r.status === "approved")
    .map((r) => r.category as CategorySlug);
}

/** Request an extra service. Starts as `pending` for admin approval. */
export async function requestService(email: string, category: string, note?: string) {
  if (!isSupabaseConfigured) {
    return { error: new Error("Not available right now.") };
  }
  const { error } = await supabase.from("provider_services").insert({
    owner_email: norm(email),
    category,
    note: note?.trim() || null,
    status: "pending",
  });
  return { error };
}

/* ---------------- admin ---------------- */

/** Services awaiting approval, newest first. */
export async function getPendingServiceRequests(): Promise<ProviderServiceRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("provider_services")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as ProviderServiceRow[];
}

export async function setServiceStatus(id: string, status: ProviderServiceStatus) {
  return supabase.from("provider_services").update({ status }).eq("id", id);
}

export async function deleteServiceRequest(id: string) {
  return supabase.from("provider_services").delete().eq("id", id);
}

/**
 * Ensure a partner always has at least their original registration category
 * recorded (covers accounts created before this feature existed).
 */
export async function ensureBaseService(email: string, category?: string | null) {
  if (!isSupabaseConfigured || !email || !category) return;
  const existing = await getMyServices(email);
  if (existing.some((r) => r.category === category)) return;
  await supabase
    .from("provider_services")
    .insert({ owner_email: norm(email), category, status: "approved" })
    .then(undefined, () => undefined);
}
