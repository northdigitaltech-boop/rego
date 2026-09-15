"use client";

import * as React from "react";

import { can, type StaffProfile } from "@/lib/staff-portal";
import { ApprovalQueue } from "@/components/dashboard/approval-queue";
import { loadPendingApprovals, type PendingListing } from "@/lib/approvals";

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

  return (
    <div className="space-y-5">
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

      <ApprovalQueue
        items={items}
        mayApprove={mayApprove}
        mayReject={mayReject}
        emptyLine={
          profile.scopes.length === 0
            ? "Nothing is waiting — or no area has been assigned to you yet, in which case there is nothing you could see."
            : "Nothing is waiting in the areas you cover."
        }
        onDecided={load}
      />

      <p className="text-xs text-muted-foreground">
        Verified and Featured badges are not here. Those stay with Super Admin,
        and there is no permission that grants them.
      </p>
    </div>
  );
}
