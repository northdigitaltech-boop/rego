import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Edit re-approval system. When an owner edits an already-approved listing, the
 * new values are queued in `pending_changes` instead of overwriting the live
 * row, so customers keep seeing the approved version until an admin approves.
 */

export interface PendingTable {
  table: string;
  titleField: string;
  label: string;
}

export const PENDING_TABLES: PendingTable[] = [
  { table: "hotels", titleField: "title", label: "Hotel" },
  { table: "homestays", titleField: "title", label: "Homestay" },
  { table: "hostels", titleField: "title", label: "Hostel" },
  { table: "tour_companies", titleField: "name", label: "Tour Company" },
  { table: "tour_packages", titleField: "title", label: "Tour Package" },
  { table: "transports", titleField: "name", label: "Transport (tour co.)" },
  { table: "tour_guides", titleField: "name", label: "Tour Guide" },
  { table: "transport_providers", titleField: "name", label: "Transport Provider" },
  { table: "transport_services", titleField: "title", label: "Transport Service" },
  { table: "rental_vehicles", titleField: "title", label: "Rental Vehicle" },
  { table: "media_providers", titleField: "name", label: "Media Provider" },
  { table: "restaurants", titleField: "name", label: "Restaurant" },
];

// Fields never worth showing in a change diff.
const HIDDEN_FIELDS = new Set([
  "id",
  "created_at",
  "pending_changes",
  "pending_at",
  "status",
  "verified",
  "featured",
  "rating",
  "reviews",
  "owner_email",
  "company_id",
  "company_name",
  "portfolio_views",
]);

/**
 * Update a listing — but if it's already approved, queue the edit for admin
 * re-approval instead of changing the live row. Returns a supabase-style result.
 */
export async function updateOrQueue(
  table: string,
  id: string,
  payload: Record<string, unknown>
) {
  if (!isSupabaseConfigured) return { data: null, error: null, queued: false };
  const { data: row } = await supabase
    .from(table)
    .select("status")
    .eq("id", id)
    .maybeSingle();
  const status = (row as { status?: string } | null)?.status;
  if (status === "approved") {
    const res = await supabase
      .from(table)
      .update({ pending_changes: payload, pending_at: new Date().toISOString() })
      .eq("id", id);
    return { ...res, queued: true };
  }
  const res = await supabase.from(table).update(payload).eq("id", id);
  return { ...res, queued: false };
}

export interface PendingEdit {
  table: string;
  label: string;
  id: string;
  title: string;
  pending_at: string | null;
  changes: { field: string; from: unknown; to: unknown }[];
}

function fmt(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ") || "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function diff(
  current: Record<string, unknown>,
  pending: Record<string, unknown>
): { field: string; from: unknown; to: unknown }[] {
  const out: { field: string; from: unknown; to: unknown }[] = [];
  for (const key of Object.keys(pending)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    const a = current[key];
    const b = pending[key];
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) {
      out.push({ field: key, from: fmt(a), to: fmt(b) });
    }
  }
  return out;
}

/** All queued edits across every table, with a field-by-field diff. */
export async function getPendingEdits(): Promise<PendingEdit[]> {
  if (!isSupabaseConfigured) return [];
  const out: PendingEdit[] = [];
  for (const t of PENDING_TABLES) {
    const { data, error } = await supabase
      .from(t.table)
      .select("*")
      .not("pending_changes", "is", null);
    if (error || !data) continue;
    for (const row of data as Record<string, unknown>[]) {
      const pending = (row.pending_changes ?? {}) as Record<string, unknown>;
      const changes = diff(row, pending);
      out.push({
        table: t.table,
        label: t.label,
        id: row.id as string,
        title: (row[t.titleField] as string) ?? "Listing",
        pending_at: (row.pending_at as string) ?? null,
        changes,
      });
    }
  }
  // Most recent first.
  out.sort((a, b) => (b.pending_at ?? "").localeCompare(a.pending_at ?? ""));
  return out;
}

export async function approvePendingEdit(table: string, id: string) {
  if (!isSupabaseConfigured) return { error: null };
  const { data: row } = await supabase
    .from(table)
    .select("pending_changes")
    .eq("id", id)
    .maybeSingle();
  const pending = (row as { pending_changes?: Record<string, unknown> } | null)
    ?.pending_changes;
  if (!pending) {
    return supabase
      .from(table)
      .update({ pending_changes: null, pending_at: null })
      .eq("id", id);
  }
  return supabase
    .from(table)
    .update({ ...pending, pending_changes: null, pending_at: null })
    .eq("id", id);
}

export async function rejectPendingEdit(table: string, id: string) {
  if (!isSupabaseConfigured) return { error: null };
  return supabase
    .from(table)
    .update({ pending_changes: null, pending_at: null })
    .eq("id", id);
}
