import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
export type NotifPriority = "informational" | "promotional" | "important" | "urgent";
export type NotifType =
  | "price_drop" | "deal" | "booking" | "availability"
  | "recommendation" | "road_alert" | "system";

export interface NotificationRow {
  id: string;
  user_email: string;
  type: NotifType | string;
  category: string | null;
  title: string;
  message: string | null;
  image_url: string | null;
  priority: NotifPriority | string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  action_url: string | null;
  action_label: string | null;
  is_read: boolean;
  is_deleted: boolean;
  created_at: string;
  expires_at: string | null;
}

export interface NotificationInput {
  user_email: string;
  type: NotifType | string;
  title: string;
  message?: string | null;
  category?: string | null;
  image_url?: string | null;
  priority?: NotifPriority;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  action_url?: string | null;
  action_label?: string | null;
  expires_at?: string | null;
}

export interface NotificationPreferences {
  user_email: string;
  in_app_enabled: boolean;
  browser_push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  price_drop_enabled: boolean;
  deal_enabled: boolean;
  booking_enabled: boolean;
  availability_enabled: boolean;
  recommendation_enabled: boolean;
  road_alert_enabled: boolean;
  promotional_paused: boolean;
  frequency: "immediate" | "daily" | "weekly" | "important";
  updated_at?: string;
}

export const DEFAULT_PREFERENCES: Omit<NotificationPreferences, "user_email"> = {
  in_app_enabled: true,
  browser_push_enabled: false,
  email_enabled: false,
  sms_enabled: false,
  whatsapp_enabled: false,
  price_drop_enabled: true,
  deal_enabled: true,
  booking_enabled: true,
  availability_enabled: true,
  recommendation_enabled: true,
  road_alert_enabled: true,
  promotional_paused: false,
  frequency: "immediate",
};

const norm = (email: string) => email.trim().toLowerCase();

/* ------------------------------------------------------------------ */
/* Reads (customer-scoped by email — matches app pattern)              */
/* ------------------------------------------------------------------ */
export async function getNotifications(email: string, limit = 50): Promise<NotificationRow[]> {
  if (!isSupabaseConfigured || !email) return [];
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_email", norm(email))
    .eq("is_deleted", false)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getNotifications:", error.message);
    return [];
  }
  return (data ?? []) as NotificationRow[];
}

export async function getUnreadCount(email: string): Promise<number> {
  if (!isSupabaseConfigured || !email) return 0;
  const nowIso = new Date().toISOString();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_email", norm(email))
    .eq("is_read", false)
    .eq("is_deleted", false)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  if (error) return 0;
  return count ?? 0;
}

/* ------------------------------------------------------------------ */
/* Customer actions                                                    */
/* ------------------------------------------------------------------ */
export async function markRead(id: string) {
  return supabase.from("notifications").update({ is_read: true }).eq("id", id);
}
export async function markAllRead(email: string) {
  return supabase.from("notifications").update({ is_read: true }).eq("user_email", norm(email)).eq("is_read", false);
}
export async function deleteNotification(id: string) {
  return supabase.from("notifications").update({ is_deleted: true }).eq("id", id);
}
export async function clearAllNotifications(email: string) {
  return supabase.from("notifications").update({ is_deleted: true }).eq("user_email", norm(email));
}

/* ------------------------------------------------------------------ */
/* Create (used by triggers / admin / server logic). Respects the      */
/* recipient's preferences so we never send a muted category.          */
/* ------------------------------------------------------------------ */
const CATEGORY_PREF: Record<string, keyof NotificationPreferences> = {
  price_drop: "price_drop_enabled",
  deal: "deal_enabled",
  booking: "booking_enabled",
  availability: "availability_enabled",
  recommendation: "recommendation_enabled",
  road_alert: "road_alert_enabled",
};

export async function createNotification(input: NotificationInput): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!isSupabaseConfigured) return { ok: false };
  const prefs = await getPreferences(input.user_email);
  // Essential (booking/system/urgent) always sends; promotional respects pause.
  const isPromotional = input.priority === "promotional" || input.type === "deal" || input.type === "price_drop" || input.type === "recommendation";
  if (prefs.promotional_paused && isPromotional) return { ok: true, skipped: true };
  const prefKey = CATEGORY_PREF[input.type];
  if (prefKey && prefs[prefKey] === false) return { ok: true, skipped: true };
  if (!prefs.in_app_enabled && isPromotional) return { ok: true, skipped: true };

  const { error } = await supabase.from("notifications").insert({
    user_email: norm(input.user_email),
    type: input.type,
    title: input.title,
    message: input.message ?? null,
    category: input.category ?? null,
    image_url: input.image_url ?? null,
    priority: input.priority ?? "informational",
    related_entity_type: input.related_entity_type ?? null,
    related_entity_id: input.related_entity_id ?? null,
    action_url: input.action_url ?? null,
    action_label: input.action_label ?? null,
    expires_at: input.expires_at ?? null,
  });
  return { ok: !error };
}

/* ------------------------------------------------------------------ */
/* Preferences                                                         */
/* ------------------------------------------------------------------ */
export async function getPreferences(email: string): Promise<NotificationPreferences> {
  const base = { user_email: norm(email), ...DEFAULT_PREFERENCES };
  if (!isSupabaseConfigured || !email) return base;
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_email", norm(email))
    .maybeSingle();
  if (error || !data) return base;
  return { ...base, ...(data as NotificationPreferences) };
}

export async function savePreferences(prefs: NotificationPreferences) {
  return supabase
    .from("notification_preferences")
    .upsert({ ...prefs, user_email: norm(prefs.user_email), updated_at: new Date().toISOString() });
}
