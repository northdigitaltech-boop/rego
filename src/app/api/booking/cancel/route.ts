import { createClient } from "@supabase/supabase-js";
import { clientIp } from "@/lib/rate-limit";
import { limitAndLogShared } from "@/lib/rate-limit-guard";

import {
  CANCELLED_BY_TRAVELER,
  CANCELLED_STATUS,
  BLOCK_MESSAGE,
  MAX_CUSTOM_REASON,
  MAX_NOTE,
  cancelEligibility,
  isCancelReason,
  reasonLabel,
  tableForKind,
} from "@/lib/booking-cancellation";

/* ============================================================
 * Traveller cancels their own booking.
 *
 * POST /api/booking/cancel
 * Authorization: Bearer <supabase access token>
 * { id, kind, reason, customReason?, note? }
 *
 * WHY THIS IS SERVER-SIDE
 *   The browser holds the anon key and can call Supabase
 *   directly. Every check below — you are signed in, this
 *   booking is yours, its status still allows cancelling —
 *   would be advisory if it lived in the component. This route
 *   uses the service-role key, which never leaves the server,
 *   and is the only path that writes a cancellation.
 *
 * THE RACE THIS IS BUILT AROUND
 *   A provider can accept, reject or complete a booking in the
 *   seconds the traveller spends in the confirmation modal.
 *   Read-then-write would overwrite whatever they did. So the
 *   write is conditional on the status we read:
 *
 *       .eq("id", id).eq("status", statusWeRead)
 *
 *   If the provider got there first the update matches zero
 *   rows, and we say so instead of silently winning. The same
 *   condition makes a double-clicked button harmless: the
 *   second request finds the status already 'cancelled' and is
 *   refused rather than writing a second audit row.
 * ============================================================ */

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function POST(req: Request) {
  /* 5 per IP per 15 minutes. Cancelling is deliberate and rare — nobody
     legitimately cancels six bookings in a quarter of an hour, and the
     limiter is what stops a stolen token being used to cancel a whole
     book of business in one script. */
  const ip = clientIp(req);
  const limited = await limitAndLogShared(req, `booking-cancel:${ip}`, 5, 15 * 60_000, {
    endpoint: "/api/booking/cancel",
    category: "booking",
  });
  if (!limited.ok) {
    return json({ error: "Too many attempts. Please wait a few minutes." }, 429);
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: "Not configured." }, 500);
  }

  /* ---------- 1. Who is asking ---------- */
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) return json({ error: "Sign in to cancel a booking." }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Bad request." }, 400);
  }

  const id = str(body.id);
  const kind = str(body.kind);
  const reason = str(body.reason);
  const customReason = str(body.customReason).slice(0, MAX_CUSTOM_REASON);
  const note = str(body.note).slice(0, MAX_NOTE);

  if (!id) return json({ error: "Missing booking id." }, 400);

  /* A table name from a request body would be an injection. tableForKind is
     a lookup in a fixed object, so anything unrecognised stops here. */
  const table = tableForKind(kind);
  if (!table) return json({ error: "Unknown booking type." }, 400);

  if (!isCancelReason(reason)) {
    return json({ error: "Please choose a cancellation reason." }, 400);
  }
  if (reason === "other" && !customReason.trim()) {
    return json({ error: "Please tell us the reason." }, 400);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: caller, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !caller?.user?.email) {
    return json({ error: "Session expired. Sign in again." }, 401);
  }
  const me = caller.user.email.toLowerCase();

  /* ---------- 2. The booking, and whether it is theirs ---------- */
  const { data, error } = await sb
    .from(table)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  /* Same answer whether the booking belongs to someone else or does not
     exist. Distinguishing them turns this route into a way to discover
     which booking ids are real. */
  if (error || !data) return json({ error: "Booking not found." }, 404);
  const b = data as Record<string, unknown>;

  if (String(b.customer_email ?? "").toLowerCase() !== me) {
    return json({ error: "Booking not found." }, 404);
  }

  /* ---------- 3. May it be cancelled ---------- */
  const currentStatus = String(b.status ?? "");
  const eligible = cancelEligibility(currentStatus);
  if (!eligible.ok) {
    return json({ error: BLOCK_MESSAGE[eligible.why], code: eligible.why }, 409);
  }

  /* ---------- 4. Cancel, but only if nothing moved underneath us ---------- */
  const now = new Date().toISOString();
  const fullReason =
    reason === "other" ? customReason.trim() : reasonLabel(reason);

  const { data: updated, error: updErr } = await sb
    .from(table)
    .update({
      status: CANCELLED_STATUS,
      previous_status: currentStatus,
      cancelled_by: CANCELLED_BY_TRAVELER,
      cancelled_at: now,
      cancellation_reason: fullReason,
      cancellation_note: note.trim() || null,
    })
    .eq("id", id)
    .eq("status", currentStatus)     // ← the whole point
    .select()
    .maybeSingle();

  if (updErr) {
    /* Most likely phase93 has not been run, which is worth saying plainly
       rather than as a generic failure. */
    return json(
      {
        error:
          "Could not cancel this booking. If this keeps happening, the cancellation update may not have been applied to the database yet.",
        detail: updErr.message,
      },
      500
    );
  }

  if (!updated) {
    /* Zero rows matched: the status changed between the read and the write.
       Read it back so the traveller is told what actually happened rather
       than "try again". */
    const { data: fresh } = await sb
      .from(table)
      .select("status")
      .eq("id", id)
      .maybeSingle();
    const nowStatus = String((fresh as { status?: string } | null)?.status ?? "");
    const why = cancelEligibility(nowStatus);
    return json(
      {
        error: why.ok
          ? "This booking changed while you were cancelling. Please try again."
          : BLOCK_MESSAGE[why.why],
        status: nowStatus,
      },
      409
    );
  }

  /* ---------- 5. Record it ---------- */
  /* After the update, never before. An audit row for a cancellation that
     lost the race would be a lie in the permanent record. */
  await sb.from("booking_audit_logs").insert({
    booking_id: id,
    booking_kind: kind,
    actor_id: caller.user.id,
    actor_email: me,
    actor_role: "traveler",
    action: "cancelled",
    from_status: currentStatus,
    to_status: CANCELLED_STATUS,
    reason: fullReason,
    note: note.trim() || null,
  });

  return json({
    ok: true,
    booking: updated,
    status: CANCELLED_STATUS,
    cancelled_at: now,
    /* The provider's address, so the client can fire the existing
       notification helpers rather than this route growing its own mail
       stack. Only ever returned to the traveller on their own booking. */
    owner_email: String(b.owner_email ?? "") || null,
    title: title(b),
    dates: dates(b),
  });
}

/* ------------------------------------------------------------------ */

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** The ten tables name their listing differently. Try each in turn. */
function title(b: Record<string, unknown>): string {
  for (const k of ["hotel_title", "item_title", "homestay_title", "hostel_title"]) {
    const v = b[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "your booking";
}

/** Same for dates: check_in/check_out on stays, start_date/end_date elsewhere. */
function dates(b: Record<string, unknown>): string | null {
  const from = b.check_in ?? b.start_date ?? b.date;
  const to = b.check_out ?? b.end_date;
  if (typeof from !== "string" || !from) return null;
  return typeof to === "string" && to ? `${from} → ${to}` : from;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
