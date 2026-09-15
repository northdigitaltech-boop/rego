import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { clientIp } from "@/lib/rate-limit";
import { limitAndLog } from "@/lib/rate-limit-guard";
import { enforceIpBlock } from "@/lib/ip-block";
import { sendMail } from "@/lib/mailer";

/* ============================================================
 * POST /api/admin/flight-requests
 *
 * Work the concierge queue: move a request along, record what the
 * airline actually quoted, attach the PNR once it is booked.
 *
 * WHY STATUS CHANGES GO THROUGH A ROUTE
 *   Two of them email the customer. A direct table update from a
 *   client would change the status and send nothing, which is
 *   worse than not changing it — the customer would be waiting on
 *   a call that the system thinks already happened.
 *
 * WHAT IS NOT HERE
 *   No deletion. A request is somebody asking Rego for something;
 *   the record of that survives being declined. `declined` and
 *   `cancelled` are statuses, not erasures.
 * ============================================================ */

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

const STATUSES = [
  "new",
  "contacted",
  "quoted",
  "confirmed",
  "booked",
  "declined",
  "cancelled",
] as const;
type Status = (typeof STATUSES)[number];

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function sameOrigin(req: Request): boolean {
  const host = req.headers.get("host");
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!host || !origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function callerIsAdmin(token: string): Promise<{ ok: boolean; userId: string | null }> {
  if (!SUPABASE_URL || !ANON_KEY) return { ok: false, userId: null };

  const sb: SupabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user;
  if (!user) return { ok: false, userId: null };

  const { data } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { ok: (data as { role: string } | null)?.role === "admin", userId: user.id };
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );

const money = (minor: number, currency: string): string =>
  `${currency} ${(minor / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/* ------------------------------------------------------------------ */

export async function POST(req: Request) {
  const blocked = await enforceIpBlock(req);
  if (blocked) return blocked;
  if (!sameOrigin(req)) return bad("Invalid origin.", 403);

  const ip = clientIp(req);
  const limited = limitAndLog(req, `flight-requests-admin:${ip}`, 40, 60_000, {
    endpoint: "/api/admin/flight-requests",
    category: "admin",
  });
  if (!limited.ok) return bad("Too many changes in a short time. Wait a minute.", 429);

  if (!SUPABASE_URL || !SERVICE_KEY) return bad("Server is not configured.", 503);

  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) return bad("Sign in required.", 401);

  const caller = await callerIsAdmin(token);
  if (!caller.ok) return bad("Admins only.", 403);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("Invalid request.");

  const id = String(body.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return bad("Invalid request id.");

  const status = String(body.status ?? "") as Status;
  if (!STATUSES.includes(status)) return bad("Unknown status.");

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: existing } = await sb
    .from("flight_requests")
    .select(
      "id, reference, status, customer_name, customer_email, origin, destination, departure_date, quoted_total, quoted_currency"
    )
    .eq("id", id)
    .maybeSingle();

  if (!existing) return bad("That request no longer exists.", 404);

  const row = existing as {
    reference: string;
    status: string;
    customer_name: string;
    customer_email: string;
    origin: string;
    destination: string;
    departure_date: string;
    quoted_total: number | null;
    quoted_currency: string | null;
  };

  const patch: Record<string, unknown> = {
    status,
    handled_by: caller.userId,
    handled_at: new Date().toISOString(),
    /* Kept so a status can be reasoned about after the fact — the same
       column phase93 uses across every booking table. */
    previous_status: row.status,
  };

  if (typeof body.agentNote === "string") {
    patch.agent_note = body.agentNote.slice(0, 2000) || null;
  }
  if (typeof body.airlineRef === "string") {
    patch.airline_ref = body.airlineRef.trim().toUpperCase().slice(0, 20) || null;
  }

  /* The confirmed fare, in MAJOR units from the form like every other admin
     price input, stored in minor units like every other amount. */
  if (body.confirmedTotal !== undefined && body.confirmedTotal !== null && body.confirmedTotal !== "") {
    const n = Number(body.confirmedTotal);
    if (!Number.isFinite(n) || n < 0) return bad("Enter a valid confirmed price.");
    patch.confirmed_total = Math.round(n * 100);
    patch.confirmed_currency = String(body.confirmedCurrency ?? row.quoted_currency ?? "PKR");
  }

  if (status === "cancelled" || status === "declined") {
    patch.cancelled_at = new Date().toISOString();
    patch.cancelled_by = "rego";
    if (typeof body.agentNote === "string" && body.agentNote.trim()) {
      patch.cancellation_reason = body.agentNote.trim().slice(0, 200);
    }
  }

  const { error } = await sb.from("flight_requests").update(patch).eq("id", id);
  if (error) return bad(error.message, 500);

  /* ---- tell the customer, for the two statuses they are waiting on ----
     Fire and forget: the status change is saved, and a failed email must not
     roll it back. */
  const route = `${row.origin} → ${row.destination}`;
  const first = row.customer_name.split(" ")[0];

  if (status === "quoted" && patch.confirmed_total) {
    void sendMail({
      to: row.customer_email,
      subject: `Your flight quote — ${row.reference}`,
      html:
        `<p>Hi ${escapeHtml(first)},</p>` +
        `<p>We have confirmed the fare for <strong>${escapeHtml(route)}</strong> ` +
        `on ${escapeHtml(row.departure_date)}.</p>` +
        `<p><strong>Confirmed price: ${money(
          patch.confirmed_total as number,
          String(patch.confirmed_currency ?? "PKR")
        )}</strong></p>` +
        (patch.agent_note ? `<p>${escapeHtml(String(patch.agent_note))}</p>` : "") +
        `<p>Reply to this email quoting ${row.reference} and we will hold it for you. ` +
        `Nothing is booked until you confirm.</p>`,
    }).catch(() => {});
  }

  if (status === "booked") {
    void sendMail({
      to: row.customer_email,
      subject: `Your flight is booked — ${row.reference}`,
      html:
        `<p>Hi ${escapeHtml(first)},</p>` +
        `<p>Your flight <strong>${escapeHtml(route)}</strong> on ` +
        `${escapeHtml(row.departure_date)} is booked.</p>` +
        (patch.airline_ref
          ? `<p><strong>Airline reference (PNR):</strong> ${escapeHtml(
              String(patch.airline_ref)
            )}</p>`
          : "") +
        (patch.agent_note ? `<p>${escapeHtml(String(patch.agent_note))}</p>` : "") +
        /* The airline is the source of truth for a ticket, not Rego. Saying
           so here saves a support conversation later. */
        `<p>Check in and manage this booking with the airline directly using ` +
        `that reference. Quote ${row.reference} if you need us.</p>`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
