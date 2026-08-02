"use client";

import * as React from "react";
import { Plus, Check, Clock, X, Loader2, LayoutGrid } from "lucide-react";

import {
  getMyServices,
  requestService,
  type ProviderServiceRow,
} from "@/lib/provider-services";
import { allCategories, type CategorySlug } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Lets one provider account operate several services (hotel + transport +
 * guiding …). Shows an approved-service switcher, any pending requests, and
 * an "Add another service" flow that goes to the admin for approval.
 */
export function ServiceSwitcher({
  email,
  active,
  onSwitch,
}: {
  email: string;
  active?: string;
  onSwitch: (category: CategorySlug) => void;
}) {
  const [rows, setRows] = React.useState<ProviderServiceRow[] | null>(null);
  const [adding, setAdding] = React.useState(false);

  const load = React.useCallback(async () => {
    setRows(await getMyServices(email));
  }, [email]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (!rows) return null;

  const approved = rows.filter((r) => r.status === "approved");
  const pending = rows.filter((r) => r.status === "pending");
  const label = (slug: string) =>
    allCategories.find((c) => c.slug === slug)?.name ?? slug;

  // Nothing to switch between and nothing pending → just the add button.
  const showBar = approved.length > 1 || pending.length > 0;

  return (
    <>
      <div className="mb-5 rounded-2xl border border-border bg-card p-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <LayoutGrid className="h-3.5 w-3.5" /> My services
          </span>

          {showBar &&
            approved.map((r) => {
              const on = r.category === active;
              return (
                <button
                  key={r.id}
                  onClick={() => onSwitch(r.category as CategorySlug)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    on
                      ? "bg-gradient-forest text-white"
                      : "border border-border bg-card text-forest hover:bg-muted"
                  )}
                >
                  {on && <Check className="h-3.5 w-3.5" />}
                  {label(r.category)}
                </button>
              );
            })}

          {pending.map((r) => (
            <span
              key={r.id}
              title="Waiting for admin approval"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"
            >
              <Clock className="h-3.5 w-3.5" /> {label(r.category)} · pending
            </span>
          ))}

          <button
            onClick={() => setAdding(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-forest-50 px-3 py-1.5 text-xs font-bold text-forest-700 hover:bg-forest-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add another service
          </button>
        </div>
      </div>

      {adding && (
        <AddServiceModal
          email={email}
          existing={rows.map((r) => r.category)}
          onClose={() => setAdding(false)}
          onDone={async () => {
            setAdding(false);
            await load();
          }}
        />
      )}
    </>
  );
}

function AddServiceModal({
  email,
  existing,
  onClose,
  onDone,
}: {
  email: string;
  existing: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [cat, setCat] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [sent, setSent] = React.useState(false);

  // Only services the provider doesn't already have.
  const options = allCategories.filter(
    (c) => !existing.includes(c.slug) && c.slug !== "more"
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cat) {
      setError("Please choose a service.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: err } = await requestService(email, cat, note);
    setBusy(false);
    if (err) {
      setError((err as { message?: string })?.message || "Could not send the request.");
      return;
    }
    setSent(true);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card shadow-premium-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-display text-base font-bold text-forest">Add another service</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-forest">
            <X className="h-5 w-5" />
          </button>
        </div>

        {sent ? (
          <div className="px-5 py-10 text-center">
            <Check className="mx-auto h-12 w-12 text-forest-600" />
            <h4 className="mt-3 font-display text-lg font-bold text-forest">Request sent</h4>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Our team will review it shortly. Once approved, the new service appears in your
              dashboard switcher.
            </p>
            <button
              onClick={onDone}
              className="mt-5 rounded-lg bg-gradient-forest px-5 py-2.5 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3 p-5">
            <p className="text-sm text-muted-foreground">
              Run more than one business? Add it here — you&apos;ll manage everything from this
              same account.
            </p>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Service</span>
              <select className="auth-input" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Choose a service…</option>
                {options.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Business name / short note (optional)
              </span>
              <textarea
                rows={3}
                className="auth-input resize-none"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Baltistan Rent a Car — 4 jeeps based in Skardu"
              />
            </label>
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-gold px-4 py-3 text-sm font-bold text-forest-900 disabled:opacity-50"
            >
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <>Send for approval</>}
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              New services are reviewed by the Rego team before going live.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
