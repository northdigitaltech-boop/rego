"use client";

import * as React from "react";
import { Loader2, CheckCircle2, XCircle, Trash2, LayoutGrid } from "lucide-react";

import {
  getPendingServiceRequests,
  setServiceStatus,
  deleteServiceRequest,
  type ProviderServiceRow,
} from "@/lib/provider-services";
import { allCategories } from "@/lib/data";
import { sendEmail } from "@/lib/email";

/**
 * Providers who already have an account can request an ADDITIONAL service
 * (e.g. a hotel owner who also runs jeeps). Those requests land here for
 * approval before the new dashboard unlocks for them.
 */
export function AdminServiceRequests() {
  const [rows, setRows] = React.useState<ProviderServiceRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setRows(await getPendingServiceRequests());
    setLoading(false);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const label = (slug: string) =>
    allCategories.find((c) => c.slug === slug)?.name ?? slug;

  const decide = async (r: ProviderServiceRow, approved: boolean) => {
    setBusyId(r.id);
    await setServiceStatus(r.id, approved ? "approved" : "rejected");
    sendEmail(
      r.owner_email,
      approved
        ? `Your new service is live on Rego — ${label(r.category)}`
        : `Update on your Rego service request`,
      approved
        ? `<p>Good news! Your request to add <strong>${label(r.category)}</strong> has been approved.</p>
           <p>Sign in and use the service switcher at the top of your dashboard to manage it.</p>`
        : `<p>Thanks for your interest in adding <strong>${label(r.category)}</strong>.</p>
           <p>We couldn't approve this request at the moment. Please contact us if you'd like more detail.</p>`
    ).catch(() => {});
    await refresh();
    setBusyId(null);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-forest">Additional Service Requests</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Existing providers asking to run another service from the same account.
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
          No pending service requests.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const rowBusy = busyId === r.id;
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-premium"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-bold text-forest-700">
                      <LayoutGrid className="h-3.5 w-3.5" /> {label(r.category)}
                    </span>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      Pending
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-forest">{r.owner_email}</p>
                  {r.note && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{r.note}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Requested {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    disabled={rowBusy}
                    onClick={() => decide(r, true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-forest-50 px-3 py-1.5 text-xs font-bold text-forest-700 hover:bg-forest-100 disabled:opacity-50"
                  >
                    {rowBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Approve
                  </button>
                  <button
                    disabled={rowBusy}
                    onClick={() => decide(r, false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                  <button
                    disabled={rowBusy}
                    onClick={() => {
                      if (window.confirm("Delete this request?")) {
                        setBusyId(r.id);
                        deleteServiceRequest(r.id).then(async () => {
                          await refresh();
                          setBusyId(null);
                        });
                      }
                    }}
                    title="Delete"
                    className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
