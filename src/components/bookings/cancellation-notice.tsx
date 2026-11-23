import { Ban } from "lucide-react";

import {
  cancelledByLabel,
  type CancellationFields,
} from "@/lib/booking-cancellation";

/* ============================================================
 * What a provider or an admin sees on a cancelled booking.
 *
 * The status badge alone says "Cancelled", which leaves the
 * provider with the two questions that actually matter: was it
 * the traveller or us, and why. Both are recorded; this is
 * where they are read back.
 *
 * Renders nothing unless cancelled_at is set, so it can be
 * dropped into any booking card without a condition around it.
 * Every field is optional because every one of them is: a
 * booking cancelled before phase93, or by some path that did
 * not record a reason, still has to display.
 * ============================================================ */

export function CancellationNotice({
  b,
  className,
}: {
  b: CancellationFields;
  className?: string;
}) {
  if (!b.cancelled_at) return null;

  return (
    <div
      className={
        "mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm " +
        (className ?? "")
      }
    >
      <p className="flex items-center gap-1.5 font-semibold text-slate-700">
        <Ban className="h-4 w-4 shrink-0" />
        {cancelledByLabel(b.cancelled_by)}
      </p>

      <dl className="mt-1.5 space-y-0.5 text-slate-600">
        <Line k="When" v={when(b.cancelled_at)} />
        {b.cancellation_reason && <Line k="Reason" v={b.cancellation_reason} />}
        {b.cancellation_note && <Line k="Note" v={b.cancellation_note} />}
        {/* The status it was cancelled from. Worth showing to a provider:
            cancelling a booking they had already accepted is a different
            event from cancelling one they never answered. */}
        {b.previous_status && (
          <Line k="Was" v={`${b.previous_status} → cancelled`} />
        )}
      </dl>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 font-medium">{k}:</dt>
      <dd className="min-w-0 break-words">{v}</dd>
    </div>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
