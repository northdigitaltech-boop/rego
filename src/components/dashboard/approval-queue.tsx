"use client";

import * as React from "react";
import { CheckCircle2, Clock, Loader2, MapPin, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  decideListing,
  type Decision,
  type PendingListing,
} from "@/lib/approvals";

/* ============================================================
 * One queue, rendered the same way wherever it appears.
 *
 * WHY IT IS ITS OWN FILE
 *   The staff portal and Super Admin were each drawing their own
 *   version of "listings waiting for a decision", from their own
 *   list of tables. They disagreed: a co-working space, a roadside
 *   business or an expedition company reached the portal and never
 *   reached Super Admin. Nothing was broken — the two lists had
 *   just been written months apart.
 *
 *   So the table list lives in lib/approvals.ts and the rendering
 *   lives here, and both screens use both. A new listing type is
 *   one row in one array.
 *
 * IT DECIDES NOTHING
 *   The buttons call decideListing(), which is an ordinary UPDATE.
 *   What makes it safe is the phase111 trigger: it refuses a status
 *   change from anybody who is not an admin or staff holding the
 *   right permission for that listing's area. mayApprove/mayReject
 *   here only decide whether a button is drawn. A forged call fails
 *   in Postgres.
 * ============================================================ */

export function ApprovalQueue({
  items,
  mayApprove,
  mayReject,
  emptyTitle = "All caught up",
  emptyLine,
  onDecided,
}: {
  /** null means still loading. */
  items: PendingListing[] | null;
  mayApprove: boolean;
  mayReject: boolean;
  emptyTitle?: string;
  emptyLine: string;
  onDecided: () => void | Promise<void>;
}) {
  const [busy, setBusy] = React.useState("");
  const [note, setNote] = React.useState<{ ok: boolean; text: string } | null>(null);

  const decide = async (item: PendingListing, decision: Decision) => {
    setBusy(item.id);
    setNote(null);
    const res = await decideListing(item.table, item.id, decision);
    setBusy("");

    if (!res.ok) {
      setNote({ ok: false, text: res.error ?? "That did not save." });
      return;
    }
    setNote({
      ok: true,
      text: `${item.title} ${decision === "approved" ? "approved" : "rejected"}.`,
    });
    await onDecided();
  };

  if (items === null) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {note && (
        <p
          className={
            note.ok
              ? "rounded-xl border border-forest-200 bg-forest-50 px-4 py-3 text-sm text-forest-700"
              : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          }
        >
          {note.text}
        </p>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 py-16 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-forest-600" />
          <p className="mt-2 font-display text-lg font-semibold text-forest">
            {emptyTitle}
          </p>
          <p className="text-sm text-muted-foreground">{emptyLine}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={`${item.table}:${item.id}`}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  {item.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-xl object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-forest">{item.title}</p>
                    <p className="mt-0.5 break-all text-xs text-muted-foreground">
                      {item.kind}
                      {item.ownerEmail ? ` · ${item.ownerEmail}` : ""}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {waitedFor(item.createdAt)}
                      </span>
                      {!item.locationId && (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <MapPin className="h-3 w-3" />
                          No area set
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  {mayApprove && (
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() => decide(item, "approved")}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white",
                        busy === item.id && "opacity-50"
                      )}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </button>
                  )}
                  {mayReject && (
                    <button
                      type="button"
                      disabled={busy === item.id}
                      onClick={() => decide(item, "rejected")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* "9 days" reads better than a date when the question is how long somebody
   has been waiting. */
export function waitedFor(iso: string | null): string {
  if (!iso) return "Submitted";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Submitted today";
  if (days === 1) return "Waiting 1 day";
  return `Waiting ${days} days`;
}
