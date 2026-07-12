"use client";

import * as React from "react";
import { Loader2, CheckCircle2, Banknote, Smartphone, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  type PaymentConfig,
  type PaymentMethodId,
  loadPaymentConfig,
  savePaymentConfig,
  paymentConfigFrom,
} from "@/lib/payments";

const TOGGLEABLE: { id: PaymentMethodId; label: string; icon: React.ReactNode }[] = [
  { id: "bank_transfer", label: "Bank Transfer", icon: <Banknote className="h-4 w-4" /> },
  { id: "jazzcash", label: "JazzCash", icon: <Smartphone className="h-4 w-4" /> },
  { id: "easypaisa", label: "Easypaisa", icon: <Smartphone className="h-4 w-4" /> },
];

/**
 * Lets a provider configure how they accept payment. Saves the same config to
 * every listing they own in the given tables.
 */
export function PaymentSettings({
  tables,
  ownerEmail,
}: {
  tables: string[];
  ownerEmail: string;
}) {
  const [cfg, setCfg] = React.useState<PaymentConfig>(paymentConfigFrom(null));
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const c = await loadPaymentConfig(tables[0], ownerEmail);
      if (alive && c) setCfg(c);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerEmail]);

  const set = <K extends keyof PaymentConfig>(k: K, v: PaymentConfig[K]) => {
    setCfg((c) => ({ ...c, [k]: v }));
    setSaved(false);
  };

  const toggleMethod = (id: PaymentMethodId) => {
    setCfg((c) => ({
      ...c,
      acceptedMethods: c.acceptedMethods.includes(id)
        ? c.acceptedMethods.filter((m) => m !== id)
        : [...c.acceptedMethods, id],
    }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    await savePaymentConfig(tables, ownerEmail, cfg);
    setSaving(false);
    setSaved(true);
  };

  if (loading) {
    return (
      <div className="grid place-items-center rounded-3xl border border-border/70 bg-card py-16 text-muted-foreground shadow-premium">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-forest">Payment settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how guests can pay you. These details are shown to customers after they book — applied to all your listings.
        </p>
      </div>

      {/* Pay at property + advance */}
      <div className="space-y-3 rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
        <Check
          label="Accept Pay at Property"
          desc="Guests pay you directly (cash/card) at check-in or on service."
          icon={<Building2 className="h-4 w-4" />}
          checked={cfg.acceptPayAtProperty}
          onChange={(v) => set("acceptPayAtProperty", v)}
        />
        <Check
          label="Require advance payment"
          desc="Ask guests to pay a percentage upfront to confirm."
          checked={cfg.requireAdvancePayment}
          onChange={(v) => set("requireAdvancePayment", v)}
        />
        {cfg.requireAdvancePayment && (
          <label className="block max-w-xs">
            <span className="mb-1 block text-sm font-semibold text-forest">Advance percentage</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={cfg.advancePercentage}
                onChange={(e) => set("advancePercentage", Math.max(0, Math.min(100, Number(e.target.value))))}
                className="auth-input w-24"
              />
              <span className="text-sm text-muted-foreground">% of total</span>
            </div>
          </label>
        )}
      </div>

      {/* Accepted digital methods */}
      <div className="space-y-3 rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
        <h3 className="font-display text-base font-bold text-forest">Accepted payment methods</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {TOGGLEABLE.map((m) => {
            const on = cfg.acceptedMethods.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleMethod(m.id)}
                className={
                  "flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors " +
                  (on ? "border-forest bg-forest-50 text-forest" : "border-border text-muted-foreground hover:border-forest/40")
                }
              >
                <span className="flex items-center gap-2">{m.icon} {m.label}</span>
                {on && <CheckCircle2 className="h-4 w-4 text-forest-600" />}
              </button>
            );
          })}
        </div>

        {/* Account details */}
        <div className="grid gap-3 sm:grid-cols-2">
          {cfg.acceptedMethods.includes("bank_transfer") && (
            <>
              <FieldI label="Bank name" value={cfg.bankName} onChange={(v) => set("bankName", v)} />
              <FieldI label="Account title" value={cfg.accountTitle} onChange={(v) => set("accountTitle", v)} />
              <FieldI label="Account number" value={cfg.accountNumber} onChange={(v) => set("accountNumber", v)} />
              <FieldI label="IBAN" value={cfg.iban} onChange={(v) => set("iban", v)} />
            </>
          )}
          {cfg.acceptedMethods.includes("jazzcash") && (
            <FieldI label="JazzCash number" value={cfg.jazzcash} onChange={(v) => set("jazzcash", v)} placeholder="03xx xxxxxxx" />
          )}
          {cfg.acceptedMethods.includes("easypaisa") && (
            <FieldI label="Easypaisa number" value={cfg.easypaisa} onChange={(v) => set("easypaisa", v)} placeholder="03xx xxxxxxx" />
          )}
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-forest">Extra instructions (optional)</span>
          <textarea
            rows={2}
            value={cfg.instructions ?? ""}
            onChange={(e) => set("instructions", e.target.value)}
            placeholder="e.g. Send screenshot on WhatsApp after transfer, include your booking ID in the note…"
            className="auth-input w-full resize-none"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="gold" size="lg" className="rounded-lg" onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save payment settings"}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm font-medium text-forest-600">
            <CheckCircle2 className="h-4 w-4" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

function Check({
  label,
  desc,
  icon,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  icon?: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 accent-forest-600"
      />
      <span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-forest">{icon} {label}</span>
        {desc && <span className="block text-xs text-muted-foreground">{desc}</span>}
      </span>
    </label>
  );
}

function FieldI({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-forest">{label}</span>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="auth-input w-full"
      />
    </label>
  );
}
