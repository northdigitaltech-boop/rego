import { createClient } from "@supabase/supabase-js";

import { buildVoucherPdf, type VoucherData } from "@/lib/voucher-pdf";

/* ============================================================
 * Booking voucher download.
 *
 * GET /api/booking/voucher?id=<booking-id>
 * Authorization: Bearer <supabase access token>
 *
 * SECURITY — a voucher carries a guest's full name, phone and
 * travel dates, so this route is strict about who may fetch one:
 *
 *   • the traveller who made the booking
 *   • the provider who owns the listing
 *   • an admin
 *
 * Anyone else gets 403 even with a valid booking id. Booking ids
 * are UUIDs, but "hard to guess" is not an access control.
 *
 * ONLY CONFIRMED BOOKINGS get a voucher. A pending booking is a
 * request, not an agreement — issuing a document for one would
 * send travellers to hotels that never accepted them.
 * ============================================================ */

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** status values that count as confirmed across the booking tables. */
const CONFIRMED = new Set(["accepted", "confirmed", "completed"]);

export async function GET(req: Request) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "Not configured." }, 500);
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "Missing booking id." }, 400);

  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) return json({ error: "Sign in to download your voucher." }, 401);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: caller, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !caller?.user?.email) {
    return json({ error: "Session expired. Sign in again." }, 401);
  }
  const me = caller.user.email.toLowerCase();

  const { data, error } = await sb
    .from("bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return json({ error: "Booking not found." }, 404);
  const b = data as Record<string, unknown>;

  const customer = String(b.customer_email ?? "").toLowerCase();
  const owner = String(b.owner_email ?? "").toLowerCase();

  let allowed = me === customer || me === owner;
  if (!allowed) {
    const { data: profile } = await sb
      .from("profiles")
      .select("role")
      .eq("id", caller.user.id)
      .maybeSingle();
    allowed = (profile as { role?: string } | null)?.role === "admin";
  }
  /* Same message whether the booking is someone else's or does not
     exist — otherwise this route confirms which ids are real. */
  if (!allowed) return json({ error: "Booking not found." }, 404);

  const status = String(b.status ?? "").toLowerCase();
  if (!CONFIRMED.has(status)) {
    return json(
      { error: "This booking hasn't been confirmed yet, so there's no voucher." },
      409
    );
  }

  const v: VoucherData = {
    reference: shortRef(String(b.id)),
    status: "Confirmed",
    kind: "Hotel booking",
    title: String(b.hotel_title ?? "Booking"),
    roomOrDetail: (b.room_name as string) ?? null,
    guestName: String(b.customer_name ?? b.customer_email ?? "Guest"),
    guestEmail: String(b.customer_email ?? ""),
    guestPhone: (b.customer_phone as string) ?? null,
    checkIn: (b.check_in as string) ?? null,
    checkOut: (b.check_out as string) ?? null,
    guests: (b.guests as number) ?? null,
    rooms: (b.rooms as number) ?? null,
    providerName: null,
    providerPhone: null,
    location: (b.customer_city as string) ?? null,
    totalPrice: (b.total_price as number) ?? null,
    notes: (b.notes as string) ?? null,
    bookedOn: (b.created_at as string) ?? null,
  };

  const bytes = await buildVoucherPdf(v);

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rego-voucher-${v.reference}.pdf"`,
      // A voucher can change if the booking is amended — never cache it.
      "Cache-Control": "no-store",
    },
  });
}

/** Short, readable reference. A UUID is unusable across a hotel desk. */
function shortRef(uuid: string): string {
  return "RG-" + uuid.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
