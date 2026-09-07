"use client";

import * as React from "react";
import { CheckCircle2, Clock, Loader2, MapPin, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { can, type StaffProfile } from "@/lib/staff-portal";
import {
  decideListing,
  loadPendingApprovals,
  type Decision,
  type PendingListing,
} from "@/lib/approvals";

/* ============================================================
 * Listings waiting for a decision.
 *
 * SAME ROWS AS THE ADMIN QUEUE
 *   Not a copy of the data and not a copy of the decision. A
 *   listing approved here is approved everywhere the moment the
 *   UPDATE lands, because there is one status column and one
 *   trigger deciding who may write it.
 *
 * WHAT IT SHOWS IS ALREADY FILTERED
 *   phase111 lets a reviewer read pending listings only inside
 *   the area they cover. So this component does no filtering of
 *   its own — an empty queue means Postgres returned nothing,
 *   which is the honest answer rather than a screen quietly
 *   hiding rows it fetched.
 * ============================================================ */

export function PortalApprovals({ profile }: { profile: StaffProfile }) {
  const [items, setItems] = React.useState<PendingListing[] | null>(null);
  const [busy, setBusy] = React.useState("");
  const [note, setNote] = React.useState<{ ok: boolean; text: string } | null>(null);

  const mayApprove = can(profile, "approve_listing");
  const mayReject = can(profile, "reject_listing");
  const mayLook = mayApprove || mayReject || can(profile, "view_approvals");

  const load = React.useCallback(async () => {
    setItems(await loadPendingApprovals());
  }, []);

  React.useEffect(() => {
    if (mayLook) void load();
    else setItems([]);
  }, [mayLook, load]);

  if (!mayLook) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold text-forest">Approvals</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your role does not include approvals. If that is wrong, ask an admin —
          the database decides this, not this screen.
        </p>
      </section>
    );
  }

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
    await load();
  };

  return (
    <div className="space-y-5">
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

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold text-forest">
          Waiting for a decision
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The same queue Super Admin sees. Whatever you decide here is decided
          everywhere — there is one status, not a copy.
          {profile.scopes.length > 0 && (
            <>
              {" "}
              You are seeing{" "}
              {profile.scopes.map((s) => s.name).join(", ")} only.
            </>
          )}
        </p>
        {!mayApprove && mayReject && (
          <p className="mt-2 text-xs text-muted-foreground">
            Your role can reject but not approve.
          </p>
        )}
        {mayApprove && !mayReject && (
          <p className="mt-2 text-xs text-muted-foreground">
            Your role can approve but not reject.
          </p>
        )}
      </section>

      {items === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 py-16 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-forest-600" />
          <p className="mt-2 font-display text-lg font-semibold text-forest">
            All caught up
          </p>
          <p className="text-sm text-muted-foreground">
            {profile.scopes.length === 0
              ? "Nothing is waiting — or no area has been assigned to you yet, in which case there is nothing you could see."
              : "Nothing is waiting in the areas you cover."}
          </p>
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
                    <p className="mt-0.5 text-xs text-muted-foreground">
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

      <p className="text-xs text-muted-foreground">
        Verified and Featured badges are not here. Those stay with Super Admin,
        and there is no permission that grants them.
      </p>
    </div>
  );
}

/* "9 days" reads better than a date when the question is how long somebody
   has been waiting. */
function waitedFor(iso: string | null): string {
  if (!iso) return "Submitted";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Submitted today";
  if (days === 1) return "Waiting 1 day";
  return `Waiting ${days} days`;
}
