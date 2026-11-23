"use client";

import * as React from "react";
import { CheckCircle2, Loader2, PencilLine, X } from "lucide-react";

import { can, type StaffProfile } from "@/lib/staff-portal";
import {
  approvePendingEdit,
  getPendingEdits,
  rejectPendingEdit,
  type PendingEdit,
} from "@/lib/pending-edits";

/* ============================================================
 * Edit requests, in the portal.
 *
 * WHY THERE IS NO MIGRATION BEHIND THIS
 *   A queued edit is not a separate table. When a provider edits
 *   an already-approved listing, updateOrQueue() writes the new
 *   values into pending_changes ON THE LISTING ROW and leaves the
 *   live columns alone. So the rows a reviewer needs are the same
 *   listing rows phase111 already lets staff with approve_listing
 *   or reject_listing read, scoped to their area. Nothing new to
 *   grant, and no second copy of the data.
 *
 * WHAT STOPS THIS BEING A WAY AROUND THE RULES
 *   Applying an edit writes the provider's own columns, which is
 *   what approve_listing means. It cannot be used to hand out a
 *   Verified or Featured badge: if a queued edit contains one, the
 *   phase111 trigger refuses the whole update and says so. The
 *   refusal comes from Postgres, not from this screen.
 *
 * ONE KNOWN GAP, STATED RATHER THAN HIDDEN
 *   PENDING_TABLES includes `transports`, which phase111 does not
 *   guard. Staff have no policy on it, so an edit queued there is
 *   invisible here and stays with Super Admin. Adding it to
 *   phase111 is a database change and belongs in its own migration.
 * ============================================================ */

export function PortalEdits({ profile }: { profile: StaffProfile }) {
  const [items, setItems] = React.useState<PendingEdit[] | null>(null);
  const [busy, setBusy] = React.useState("");
  const [note, setNote] = React.useState<{ ok: boolean; text: string } | null>(null);

  const mayApprove = can(profile, "approve_listing");
  const mayReject = can(profile, "reject_listing");
  const mayLook = mayApprove || mayReject || can(profile, "view_approvals");

  const load = React.useCallback(async () => {
    setItems(await getPendingEdits());
  }, []);

  React.useEffect(() => {
    if (mayLook) void load();
    else setItems([]);
  }, [mayLook, load]);

  if (!mayLook) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold text-forest">Edit requests</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your role does not include reviewing listing changes. If that is
          wrong, ask an admin — the database decides this, not this screen.
        </p>
      </section>
    );
  }

  const act = async (item: PendingEdit, apply: boolean) => {
    const key = `${item.table}:${item.id}`;
    setBusy(key);
    setNote(null);
    const res = apply
      ? await approvePendingEdit(item.table, item.id)
      : await rejectPendingEdit(item.table, item.id);
    setBusy("");

    /* Through `unknown`: approvePendingEdit returns either a PostgREST result
       or a bare { error: null } when Supabase is not configured, and the two
       shapes do not overlap enough for a direct cast. */
    const error = (res as unknown as { error?: { message?: string } | null } | null)
      ?.error;
    if (error) {
      /* The trigger writes its own message for a person — pass it through
         rather than replace it with something vaguer. */
      setNote({ ok: false, text: error.message ?? "That did not save." });
      return;
    }
    setNote({
      ok: true,
      text: `${item.title} — ${apply ? "changes applied" : "changes discarded"}.`,
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
          Changes waiting for review
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A provider edited a listing that is already live. Travellers keep
          seeing the approved version until somebody decides. The same queue
          Super Admin sees.
          {profile.scopes.length > 0 && (
            <> You are seeing {profile.scopes.map((s) => s.name).join(", ")} only.</>
          )}
        </p>
      </section>

      {items === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 py-16 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-forest-600" />
          <p className="mt-2 font-display text-lg font-semibold text-forest">
            Nothing waiting
          </p>
          <p className="text-sm text-muted-foreground">
            {profile.scopes.length === 0
              ? "No changes queued — or no area has been assigned to you yet, in which case there is nothing you could see."
              : "No changes queued in the areas you cover."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const key = `${item.table}:${item.id}`;
            return (
              <li key={key} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold text-forest">
                      <PencilLine className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.label}
                      {item.pending_at
                        ? ` · queued ${new Date(item.pending_at).toLocaleDateString("en-GB")}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {mayApprove && (
                      <button
                        type="button"
                        disabled={busy === key}
                        onClick={() => act(item, true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Apply changes
                      </button>
                    )}
                    {mayReject && (
                      <button
                        type="button"
                        disabled={busy === key}
                        onClick={() => act(item, false)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                        Discard
                      </button>
                    )}
                  </div>
                </div>

                {item.changes.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Nothing actually differs from the live listing. Discarding
                    clears it.
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Field</th>
                          <th className="px-3 py-2 font-semibold">Now</th>
                          <th className="px-3 py-2 font-semibold">Proposed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.changes.map((c) => (
                          <tr key={c.field} className="border-t border-border align-top">
                            <td className="px-3 py-2 font-medium text-forest">
                              {c.field.replace(/_/g, " ")}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {String(c.from)}
                            </td>
                            <td className="px-3 py-2">{String(c.to)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Verified and Featured are not decided here. If a queued change contains
        one, the database refuses the whole edit and tells you.
      </p>
    </div>
  );
}
