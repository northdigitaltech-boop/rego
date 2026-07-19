import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Rego — Manual payment system (data layer)
 * Payment-ready: manual methods now, online gateway later.
 * Booking creation is untouched; these helpers only *augment* a
 * booking with payment data after it exists.
 * ============================================================ */

/* ---------------- Methods ---------------- */

export type PaymentMethodId =
  | "pay_at_property"
  | "bank_transfer"
  | "jazzcash"
  | "easypaisa"
  | "online";

export interface PaymentMethodDef {
  id: PaymentMethodId;
  label: string;
  needsProof: boolean; // requires reference + screenshot
  comingSoon?: boolean;
}

export const PAYMENT_METHODS: PaymentMethodDef[] = [
  { id: "pay_at_property", label: "Pay at Property", needsProof: false },
  { id: "bank_transfer", label: "Bank Transfer", needsProof: true },
  { id: "jazzcash", label: "JazzCash", needsProof: true },
  { id: "easypaisa", label: "Easypaisa", needsProof: true },
  { id: "online", label: "Online Payment (Coming Soon)", needsProof: false, comingSoon: true },
];

export function paymentMethodLabel(id?: string | null): string {
  return PAYMENT_METHODS.find((m) => m.id === id)?.label ?? "—";
}

/* ---------------- Status ---------------- */

export type PaymentStatusId =
  | "unpaid"
  | "pending_verification"
  | "partially_paid"
  | "paid"
  | "refunded"
  | "rejected";

export const PAYMENT_STATUSES: { id: PaymentStatusId; label: string; cls: string }[] = [
  { id: "unpaid", label: "Unpaid", cls: "bg-muted text-muted-foreground" },
  { id: "pending_verification", label: "Pending Verification", cls: "bg-gold/20 text-gold-700" },
  { id: "partially_paid", label: "Partially Paid", cls: "bg-amber-100 text-amber-700" },
  { id: "paid", label: "Paid", cls: "bg-forest-50 text-forest-600" },
  { id: "refunded", label: "Refunded", cls: "bg-blue-50 text-blue-600" },
  { id: "rejected", label: "Rejected", cls: "bg-red-50 text-red-600" },
];

export function paymentStatusMeta(id?: string | null) {
  return PAYMENT_STATUSES.find((s) => s.id === id) ?? PAYMENT_STATUSES[0];
}

/* ---------------- Booking tables ---------------- */

export type PayTable =
  | "bookings"
  | "homestay_bookings"
  | "hostel_bookings"
  | "tour_bookings"
  | "transport_bookings"
  | "guide_bookings"
  | "media_bookings"
  | "restaurant_bookings";

/* ---------------- Provider configuration ---------------- */

export interface PaymentConfig {
  acceptPayAtProperty: boolean;
  requireAdvancePayment: boolean;
  advancePercentage: number;
  acceptedMethods: PaymentMethodId[];
  bankName?: string;
  accountTitle?: string;
  accountNumber?: string;
  iban?: string;
  jazzcash?: string;
  easypaisa?: string;
  instructions?: string;
}

const DEFAULT_METHODS: PaymentMethodId[] = [
  "pay_at_property",
  "bank_transfer",
  "jazzcash",
  "easypaisa",
];

/** Normalize a listing/provider row into a PaymentConfig with safe defaults. */
export function paymentConfigFrom(row: Record<string, unknown> | null | undefined): PaymentConfig {
  const r = row ?? {};
  const methods = Array.isArray(r.accepted_payment_methods)
    ? (r.accepted_payment_methods as PaymentMethodId[])
    : DEFAULT_METHODS;
  return {
    acceptPayAtProperty: (r.accept_pay_at_property as boolean) ?? true,
    requireAdvancePayment: (r.require_advance_payment as boolean) ?? false,
    advancePercentage: Number(r.advance_payment_percentage ?? 0) || 0,
    acceptedMethods: methods.length ? methods : DEFAULT_METHODS,
    bankName: (r.payment_bank_name as string) || undefined,
    accountTitle: (r.payment_account_title as string) || undefined,
    accountNumber: (r.payment_account_number as string) || undefined,
    iban: (r.payment_iban as string) || undefined,
    jazzcash: (r.payment_jazzcash as string) || undefined,
    easypaisa: (r.payment_easypaisa as string) || undefined,
    instructions: (r.payment_instructions as string) || undefined,
  };
}

/** The columns a provider can configure (for forms / updates). */
export const PAYMENT_CONFIG_COLUMNS = [
  "accept_pay_at_property",
  "require_advance_payment",
  "advance_payment_percentage",
  "accepted_payment_methods",
  "payment_bank_name",
  "payment_account_title",
  "payment_account_number",
  "payment_iban",
  "payment_jazzcash",
  "payment_easypaisa",
  "payment_instructions",
] as const;

/** Advance / remaining split for a total, given config + chosen method. */
export function computeAmounts(
  total: number,
  cfg: PaymentConfig,
  method: PaymentMethodId
): { total: number; advance: number; remaining: number; advanceRequired: boolean } {
  const advanceRequired =
    cfg.requireAdvancePayment && cfg.advancePercentage > 0 && method !== "pay_at_property";
  const advance = advanceRequired
    ? Math.round((total * cfg.advancePercentage) / 100)
    : 0;
  return {
    total,
    advance,
    remaining: advanceRequired ? Math.max(0, total - advance) : total,
    advanceRequired,
  };
}

/* ---------------- Storage upload ---------------- */

const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

/**
 * Uploads a proof to the PRIVATE payment-proofs bucket and returns the object
 * PATH (not a public URL). Use getProofSignedUrl() to view it. Validates type
 * and size client-side; the bucket also enforces these server-side.
 */
export async function uploadPaymentProof(file: File): Promise<string> {
  if (!isSupabaseConfigured) throw new Error("Storage is not configured.");
  if (!ALLOWED.includes(file.type)) {
    throw new Error("Please upload a PNG, JPG or WEBP image.");
  }
  if (file.size > MAX_PROOF_BYTES) {
    throw new Error("Image is too large (max 5 MB).");
  }
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `proofs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("payment-proofs")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw new Error("Upload failed. Please try again.");
  return path;
}

/**
 * Resolves a stored proof reference to a viewable URL.
 *  - legacy public URLs (http…) are returned as-is
 *  - object paths get a short-lived signed URL (default 2 min)
 */
export async function getProofSignedUrl(value: string, expiresInSec = 120): Promise<string> {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value; // legacy public URL
  if (!isSupabaseConfigured) return "";
  const { data } = await supabase.storage
    .from("payment-proofs")
    .createSignedUrl(value, expiresInSec);
  return data?.signedUrl ?? "";
}

/* ---------------- Mutations ---------------- */

async function updatePayment(table: PayTable, id: string, payload: Record<string, unknown>) {
  if (!isSupabaseConfigured) return { error: { message: "not configured" } } as const;
  return supabase.from(table).update(payload).eq("id", id);
}

/** Record the chosen amounts on a freshly created booking (no status change). */
export async function initBookingPayment(
  table: PayTable,
  id: string,
  opts: { method: PaymentMethodId; total: number; advance: number; remaining: number; advanceRequired: boolean }
) {
  return updatePayment(table, id, {
    payment_method: opts.method,
    total_amount: opts.total,
    advance_amount: opts.advance,
    remaining_amount: opts.remaining,
    advance_payment_required: opts.advanceRequired,
    payment_status: "unpaid",
  });
}

/** Customer submits a manual transfer proof → pending verification. */
export async function submitPaymentProof(
  table: PayTable,
  id: string,
  opts: { method: PaymentMethodId; reference: string; screenshotUrl: string }
) {
  return updatePayment(table, id, {
    payment_method: opts.method,
    transaction_reference: opts.reference || null,
    payment_screenshot_url: opts.screenshotUrl || null,
    payment_status: "pending_verification",
    paid_at: new Date().toISOString(),
  });
}

/** Customer chose Pay at Property — record the method, stays unpaid. */
export async function setPayAtProperty(table: PayTable, id: string) {
  return updatePayment(table, id, {
    payment_method: "pay_at_property",
    payment_status: "unpaid",
  });
}

/* ---- Owner / admin verification actions (used in phases 2 & 3) ---- */

export async function approvePayment(
  table: PayTable,
  id: string,
  opts?: { partial?: boolean; byAdmin?: boolean; note?: string }
) {
  return updatePayment(table, id, {
    payment_status: opts?.partial ? "partially_paid" : "paid",
    verified_by_admin: opts?.byAdmin ?? false,
    admin_payment_note: opts?.note ?? null,
    paid_at: new Date().toISOString(),
  });
}

export async function rejectPayment(table: PayTable, id: string, note?: string) {
  return updatePayment(table, id, {
    payment_status: "rejected",
    admin_payment_note: note ?? null,
  });
}

export async function refundPayment(table: PayTable, id: string, note?: string) {
  return updatePayment(table, id, {
    payment_status: "refunded",
    admin_payment_note: note ?? null,
  });
}

export async function setPaymentStatus(
  table: PayTable,
  id: string,
  status: PaymentStatusId,
  note?: string
) {
  return updatePayment(table, id, {
    payment_status: status,
    ...(note !== undefined ? { admin_payment_note: note } : {}),
  });
}

/* ---------------- Provider payment configuration (settings) ---------------- */

function configPayload(cfg: PaymentConfig): Record<string, unknown> {
  return {
    accept_pay_at_property: cfg.acceptPayAtProperty,
    require_advance_payment: cfg.requireAdvancePayment,
    advance_payment_percentage: cfg.advancePercentage,
    accepted_payment_methods: cfg.acceptedMethods,
    payment_bank_name: cfg.bankName ?? null,
    payment_account_title: cfg.accountTitle ?? null,
    payment_account_number: cfg.accountNumber ?? null,
    payment_iban: cfg.iban ?? null,
    payment_jazzcash: cfg.jazzcash ?? null,
    payment_easypaisa: cfg.easypaisa ?? null,
    payment_instructions: cfg.instructions ?? null,
  };
}

/** Load a provider's saved payment config from one of their listing tables. */
export async function loadPaymentConfig(
  table: string,
  ownerEmail: string
): Promise<PaymentConfig | null> {
  if (!isSupabaseConfigured || !ownerEmail) return null;
  const { data } = await supabase
    .from(table)
    .select(PAYMENT_CONFIG_COLUMNS.join(","))
    .eq("owner_email", ownerEmail)
    .limit(1)
    .maybeSingle();
  return data ? paymentConfigFrom(data as unknown as Record<string, unknown>) : null;
}

/**
 * Save a provider's payment config to every one of their listings in the given
 * tables (applies the same receiving details across all their listings).
 */
export async function savePaymentConfig(
  tables: string[],
  ownerEmail: string,
  cfg: PaymentConfig
) {
  if (!isSupabaseConfigured || !ownerEmail) return { error: { message: "not configured" } } as const;
  const payload = configPayload(cfg);
  let lastError: { message: string } | null = null;
  for (const table of tables) {
    const { error } = await supabase.from(table).update(payload).eq("owner_email", ownerEmail);
    if (error) lastError = error;
  }
  return { error: lastError } as const;
}
