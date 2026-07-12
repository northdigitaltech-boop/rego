import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ================================================================== */
/* Types                                                               */
/* ================================================================== */
export interface PlatformSettings {
  id: number;
  subscription_enabled: boolean;
  free_access_enabled: boolean;
  public_pricing_visible: boolean;
  admin_preview_enabled: boolean;
  test_checkout_enabled: boolean;
  payment_enabled: boolean;
  owner_subscription_menu_visible: boolean;
  navbar_pricing_visible: boolean;
  free_launch_banner_visible: boolean;
  free_access_start_date: string | null;
  free_access_end_date: string | null;
  subscription_launch_date: string | null;
  grace_period_days: number;
  apply_paid_plans_to: "new_owners" | "existing_owners" | "all_owners" | "test_accounts";
  announcement_enabled: boolean;
  announcement_title: string | null;
  announcement_message: string | null;
  announcement_start_date: string | null;
  announcement_end_date: string | null;
  updated_at?: string;
  updated_by?: string | null;
}

// The safe default state: everything hidden, free access ON. Used when the
// table/row doesn't exist yet so the app NEVER accidentally shows pricing.
export const DEFAULT_SETTINGS: PlatformSettings = {
  id: 1,
  subscription_enabled: false,
  free_access_enabled: true,
  public_pricing_visible: false,
  admin_preview_enabled: false,
  test_checkout_enabled: false,
  payment_enabled: false,
  owner_subscription_menu_visible: false,
  navbar_pricing_visible: false,
  free_launch_banner_visible: false,
  free_access_start_date: null,
  free_access_end_date: null,
  subscription_launch_date: null,
  grace_period_days: 30,
  apply_paid_plans_to: "new_owners",
  announcement_enabled: false,
  announcement_title: null,
  announcement_message: null,
  announcement_start_date: null,
  announcement_end_date: null,
};

export type DiscountType = "none" | "percentage" | "fixed" | "manual";

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string | null;
  short_description: string | null;
  full_description: string | null;
  icon: string | null;
  features: string[];
  limitations: string[];
  category_scope: string[];
  currency: string;
  monthly_enabled: boolean;
  monthly_purchase_enabled: boolean;
  monthly_original_price: number | null;
  monthly_discounted_price: number | null;
  monthly_discount_type: DiscountType;
  monthly_discount_value: number | null;
  monthly_discount_percentage: number | null;
  monthly_discount_start: string | null;
  monthly_discount_end: string | null;
  monthly_offer_label: string | null;
  monthly_badge_text: string | null;
  yearly_enabled: boolean;
  yearly_purchase_enabled: boolean;
  yearly_original_price: number | null;
  yearly_discounted_price: number | null;
  yearly_discount_type: DiscountType;
  yearly_discount_value: number | null;
  yearly_discount_percentage: number | null;
  yearly_discount_start: string | null;
  yearly_discount_end: string | null;
  yearly_offer_label: string | null;
  yearly_badge_text: string | null;
  is_recommended: boolean;
  is_best_value: boolean;
  is_popular: boolean;
  badge_text: string | null;
  cta_text: string | null;
  is_active: boolean;
  is_visible: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

/* ================================================================== */
/* Price calculations (pure — matches the spec formulas exactly)       */
/* ================================================================== */

/** ((original - discounted) / original) × 100, rounded to a whole number. */
export function discountPct(original?: number | null, discounted?: number | null): number {
  if (!original || original <= 0 || discounted == null || discounted < 0 || discounted > original) return 0;
  return Math.round(((original - discounted) / original) * 100);
}

/** Effective monthly cost of a yearly plan = yearlyDiscounted / 12. */
export function effectiveMonthly(yearlyDiscounted?: number | null): number {
  if (!yearlyDiscounted || yearlyDiscounted < 0) return 0;
  return Math.round(yearlyDiscounted / 12);
}

/** 12 months at the monthly price = monthlyDiscounted × 12. */
export function twelveMonthCost(monthlyDiscounted?: number | null): number {
  if (!monthlyDiscounted || monthlyDiscounted < 0) return 0;
  return monthlyDiscounted * 12;
}

/** Extra saving from choosing yearly = (monthly×12) − yearlyDiscounted (never negative). */
export function additionalYearlySaving(monthlyDiscounted?: number | null, yearlyDiscounted?: number | null): number {
  const twelve = twelveMonthCost(monthlyDiscounted);
  if (!twelve || !yearlyDiscounted) return 0;
  return Math.max(0, twelve - yearlyDiscounted);
}

/** Is a scheduled discount active right now? (null dates = always). */
export function discountActive(start?: string | null, end?: string | null, now = new Date()): boolean {
  if (start && new Date(start) > now) return false;
  if (end && new Date(end) < now) return false;
  return true;
}

/** Resolve the price to charge/show for a cycle, honoring discount schedule. */
export function resolvedPrice(plan: SubscriptionPlan, cycle: "monthly" | "yearly") {
  const original = cycle === "monthly" ? plan.monthly_original_price : plan.yearly_original_price;
  const discounted = cycle === "monthly" ? plan.monthly_discounted_price : plan.yearly_discounted_price;
  const start = cycle === "monthly" ? plan.monthly_discount_start : plan.yearly_discount_start;
  const end = cycle === "monthly" ? plan.monthly_discount_end : plan.yearly_discount_end;
  const type = cycle === "monthly" ? plan.monthly_discount_type : plan.yearly_discount_type;
  const on = type !== "none" && discounted != null && discountActive(start, end);
  const finalPrice = on ? (discounted as number) : (original ?? 0);
  return {
    original: original ?? 0,
    final: finalPrice,
    discounted: on,
    pct: on ? discountPct(original, discounted) : 0,
    offerLabel: on ? (cycle === "monthly" ? plan.monthly_offer_label : plan.yearly_offer_label) : null,
    badge: on ? (cycle === "monthly" ? plan.monthly_badge_text : plan.yearly_badge_text) : null,
  };
}

/* ================================================================== */
/* Settings                                                            */
/* ================================================================== */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  if (!isSupabaseConfigured) return DEFAULT_SETTINGS;
  try {
    const { data, error } = await supabase.from("platform_settings").select("*").eq("id", 1).maybeSingle();
    if (error || !data) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(data as PlatformSettings) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function savePlatformSettings(patch: Partial<PlatformSettings>, adminEmail?: string) {
  return supabase.from("platform_settings").upsert({
    id: 1,
    ...patch,
    updated_at: new Date().toISOString(),
    updated_by: adminEmail ?? null,
  });
}

/* ================================================================== */
/* Visibility gating — the single source of truth for "who sees pricing"*/
/* ================================================================== */
export interface Viewer {
  email?: string | null;
  role?: string | null; // 'admin' | 'partner' | 'traveler'
  isTestUser?: boolean;
}

/**
 * Decide whether the pricing experience is visible to a given viewer.
 *  - Public launch on  → everyone.
 *  - Admin preview on   → admins only.
 *  - Test users         → only flagged test accounts.
 *  - Otherwise          → hidden (default).
 */
export function canViewPricing(settings: PlatformSettings, viewer: Viewer): { visible: boolean; preview: boolean } {
  if (settings.public_pricing_visible) return { visible: true, preview: false };
  if (settings.admin_preview_enabled && viewer.role === "admin") return { visible: true, preview: true };
  if (viewer.isTestUser) return { visible: true, preview: settings.test_checkout_enabled };
  return { visible: false, preview: false };
}

/** Should the navbar show a Pricing link? Only when explicitly enabled + public. */
export function showNavbarPricing(settings: PlatformSettings): boolean {
  return settings.public_pricing_visible && settings.navbar_pricing_visible;
}

/** Should owners see a Subscription menu? Only when explicitly enabled. */
export function showOwnerSubscriptionMenu(settings: PlatformSettings): boolean {
  return settings.subscription_enabled && settings.owner_subscription_menu_visible;
}

/* ================================================================== */
/* Plans (reads gated by RLS: public only after launch; admins always) */
/* ================================================================== */
export async function getVisiblePlans(): Promise<SubscriptionPlan[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("is_active", true)
    .eq("is_visible", true)
    .order("display_order", { ascending: true });
  return (data ?? []) as SubscriptionPlan[];
}

/** All plans (admin editor / preview — RLS lets admins read hidden ones). */
export async function getAllPlans(): Promise<SubscriptionPlan[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("subscription_plans")
    .select("*")
    .order("display_order", { ascending: true });
  return (data ?? []) as SubscriptionPlan[];
}

export async function savePlan(plan: Partial<SubscriptionPlan>) {
  // Never trust client discount percentages — recompute from prices.
  const patch: Record<string, unknown> = { ...plan };
  if (plan.monthly_original_price != null && plan.monthly_discounted_price != null) {
    patch.monthly_discount_percentage = discountPct(plan.monthly_original_price, plan.monthly_discounted_price);
  }
  if (plan.yearly_original_price != null && plan.yearly_discounted_price != null) {
    patch.yearly_discount_percentage = discountPct(plan.yearly_original_price, plan.yearly_discounted_price);
  }
  if (plan.id) return supabase.from("subscription_plans").update(patch).eq("id", plan.id);
  return supabase.from("subscription_plans").insert(patch);
}

export async function deletePlan(id: string) {
  return supabase.from("subscription_plans").delete().eq("id", id);
}

/** Audit trail — call on every settings / pricing change. */
export async function logSubscriptionAction(entry: {
  admin_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  previous_value?: unknown;
  new_value?: unknown;
}) {
  return supabase.from("subscription_audit_logs").insert({
    admin_id: entry.admin_id ?? null,
    action: entry.action,
    entity_type: entry.entity_type ?? null,
    entity_id: entry.entity_id ?? null,
    previous_value: entry.previous_value ?? null,
    new_value: entry.new_value ?? null,
  });
}
