"use client";

import * as React from "react";
import { Loader2, ExternalLink, Wallet, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

import { cn, formatPrice } from "@/lib/utils";
import { sendPaymentNotification } from "@/lib/messages";
import {
  type PayTable,
  paymentMethodLabel,
  paymentStatusMeta,
  approvePayment,
  rejectPayment,
  refundPayment,
  getProofSignedUrl,
} from "@/lib/payments";

export interface PayBooking {
  id: string;
  customer_name?: string | null;
  customer_email?: string | null;
  item_title?: string | null;
  hotel_title?: string | null;
  homestay_title?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  total_amount?: number | null;
  advance_amount?: number | null;
  remaining_amount?: number | null;
  transaction_reference?: string | null;
  payment_screenshot_url?: string | null;
  admin_payment_note?: string | null;
  verified_by_admin?: boolean | null;
}

const FILTERS = [
  { id: "pending", label: "Pending verification" },
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
] as const;

export function PaymentsManager({
  table,
  bookings,
  onChange,
  isAdmin = false,
  senderEmail,
  senderName,
}: {
  table: PayTable;
  bookings: PayBooking[];
  onChange: () => void;
  isAdmin?: boolean;
  senderEmail?: string;
  senderName?: string;
}) {
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["id"]>("pending");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<Record<string, string>>({});

  const withPayment = bookings.filter(
    (b) => b.payment_method || (b.payment_status && b.payment_status !== "unpaid")
  );
  const list = withPayment.filter((b) => {
    if (filter === "all") return true;
    if (filter === "pending") return b.payment_status === "pending_verification";
    if (filter === "paid") return b.payment_status === "paid" || b.payment_status === "partially_paid";
    return true;
  });

  const refOf = (id: string) => "SGB-" + id.slice(0, 8).toUpperCase();

  const runAction = async (b: PayBooking, action: "paid" | "partial" | "reject" | "refund") => {
    setBusy(b.id);
    const note = notes[b.id] ?? b.admin_payment_note ?? "";
    if (action === "paid") await approvePayment(table, b.id, { byAdmin: isAdmin, note });
    else if (action === "partial") await approvePayment(table, b.id, { partial: true, byAdmin: isAdmin, note });
    else if (action === "reject") await rejectPayment(table, b.id, note);
    else await refundPayment(table, b.id, note);

    // Notify the customer in the booking chat with the amount.
    if (senderEmail) {
      const amount = b.advance_amount && b.advance_amount > 0 ? b.advance_amount : b.total_amount ?? 0;
      const statusMap = { paid: "paid", partial: "partially_paid", reject: "rejected", refund: "refunded" } as const;
      await sendPaymentNotification({
        booking_id: b.id,
        owner_email: senderEmail,
        owner_name: senderName || "Provider",
        ref: refOf(b.id),
        amount,
        status: statusMap[action],
      });
    }
    setBusy(null);
    onChange();
  };
  const titleOf = (b: PayBooking) => b.item_title || b.hotel_title || b.homestay_title || "Booking";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-forest">Payments</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review transfer proofs and confirm payment status. Customers are notified when you approve.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              filter === f.id ? "bg-forest text-white shadow-premium" : "border border-border bg-card text-muted-foreground hover:text-forest"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-muted/40 py-16 text-center">
          <Wallet className="mx-auto h-10 w-10 text-forest-600" />
          <p className="mt-2 font-display text-lg font-semibold text-forest">Nothing here yet</p>
          <p className="text-sm text-muted-foreground">Payment submissions will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((b) => {
            const meta = paymentStatusMeta(b.payment_status);
            const note = notes[b.id] ?? b.admin_payment_note ?? "";
            return (
              <div key={b.id} className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-xs font-bold tracking-wider text-forest-600">{refOf(b.id)}</p>
                    <p className="font-display text-base font-semibold text-forest">{titleOf(b)}</p>
                    <p className="text-sm text-muted-foreground">
                      {b.customer_name ?? b.customer_email} · {paymentMethodLabel(b.payment_method)}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase", meta.cls)}>{meta.label}</span>
                </div>

                <div className="mt-3 grid gap-2 rounded-xl bg-muted/40 p-3 text-sm sm:grid-cols-3">
                  <KV k="Total" v={b.total_amount ? formatPrice(b.total_amount) : "—"} />
                  <KV k="Advance" v={b.advance_amount ? formatPrice(b.advance_amount) : "—"} />
                  <KV k="Reference" v={b.transaction_reference || "—"} />
                </div>

                {b.payment_screenshot_url && <ProofThumb value={b.payment_screenshot_url} />}

                <input
                  value={note}
                  onChange={(e) => setNotes((n) => ({ ...n, [b.id]: e.target.value }))}
                  placeholder="Add a payment note (optional)"
                  className="auth-input mt-3 w-full text-sm"
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    disabled={busy === b.id}
                    onClick={() => runAction(b, "paid")}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-forest px-3.5 py-2 text-sm font-semibold text-white shadow-soft hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    {busy === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Mark Paid
                  </button>
                  <button
                    disabled={busy === b.id}
                    onClick={() => runAction(b, "partial")}
                    className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-forest hover:bg-muted disabled:opacity-60"
                  >
                    Partially Paid
                  </button>
                  <button
                    disabled={busy === b.id}
                    onClick={() => runAction(b, "reject")}
                    className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                  {isAdmin && (
                    <button
                      disabled={busy === b.id}
                      onClick={() => runAction(b, "refund")}
                      className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-60"
                    >
                      <RotateCcw className="h-4 w-4" /> Refund
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Resolves a private proof path to a short-lived signed URL for viewing. */
function ProofThumb({ value }: { value: string }) {
  const [url, setUrl] = React.useState("");
  React.useEffect(() => {
    let alive = true;
    getProofSignedUrl(value).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [value]);

  if (!url) {
    return <span className="mt-3 inline-block text-xs text-muted-foreground">Loading proof…</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-forest-600 hover:text-forest"
    >
      <span className="block h-16 w-24 overflow-hidden rounded-lg border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Proof" className="h-full w-full object-cover" />
      </span>
      View screenshot <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p>
      <p className="font-medium text-forest">{v}</p>
    </div>
  );
}
