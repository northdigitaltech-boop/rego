"use client";

import * as React from "react";
import { FileDown, Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/* ============================================================
 * Download voucher button.
 *
 * Only rendered for CONFIRMED bookings — a pending booking is a
 * request, and handing someone a document for it would send them
 * to a hotel that never accepted them.
 *
 * The fetch carries the user's access token because the voucher
 * contains their phone number and travel dates; the API refuses
 * anyone who is not the traveller, the provider or an admin.
 * ============================================================ */

const CONFIRMED = new Set(["accepted", "confirmed", "completed"]);

export function VoucherButton({
  bookingId,
  status,
  className,
}: {
  bookingId: string;
  status: string;
  className?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  if (!CONFIRMED.has((status || "").toLowerCase())) return null;

  const download = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError("Please sign in again.");
        return;
      }

      const res = await fetch(`/api/booking/voucher?id=${encodeURIComponent(bookingId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error || "Could not create the voucher.");
        return;
      }

      /* Trigger a real download rather than opening a tab — on a phone
         that puts the file in Downloads, where it stays available with
         no signal. That is the whole point of the voucher. */
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rego-voucher-${bookingId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not create the voucher. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={cn("inline-flex flex-col items-start gap-1", className)}>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-forest transition-colors hover:border-forest-600 hover:bg-forest-50 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileDown className="h-3.5 w-3.5" />
        )}
        {busy ? "Preparing…" : "Download voucher"}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}
