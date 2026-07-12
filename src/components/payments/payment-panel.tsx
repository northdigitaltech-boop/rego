"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Building2,
  Banknote,
  Smartphone,
  Clock,
  ShieldCheck,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PaymentUpload } from "@/components/payments/payment-upload";
import { cn, formatPrice } from "@/lib/utils";
import {
  PAYMENT_METHODS,
  type PaymentMethodId,
  type PaymentConfig,
  type PayTable,
  computeAmounts,
  initBookingPayment,
  setPayAtProperty,
  submitPaymentProof,
} from "@/lib/payments";

const METHOD_ICON: Record<string, React.ReactNode> = {
  pay_at_property: <Building2 className="h-4 w-4" />,
  bank_transfer: <Banknote className="h-4 w-4" />,
  jazzcash: <Smartphone className="h-4 w-4" />,
  easypaisa: <Smartphone className="h-4 w-4" />,
  online: <Clock className="h-4 w-4" />,
};

/**
 * Step 2 + 3 of booking, shown as a modal after the booking is created:
 *  - Step 2: choose payment method → Submit / Confirm
 *  - Step 3: booking reference + confirmation
 */
export function PaymentPanel({
  table,
  bookingId,
  reference,
  providerName,
  summary,
  total,
  config,
  bookingStatus = "Pending",
}: {
  table: PayTable;
  bookingId: string;
  reference: string;
  providerName: string;
  summary: string[];
  total: number;
  config: PaymentConfig;
  bookingStatus?: string;
}) {
  const [method, setMethod] = React.useState<PaymentMethodId | null>(null);
  const [txRef, setTxRef] = React.useState("");
  const [shot, setShot] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<"property" | "proof" | null>(null);
  const [err, setErr] = React.useState("");
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // A transfer method only shows if the provider both enabled it AND entered
  // the receiving details for it — so customers never see an empty instructions box.
  const hasDetails = (id: PaymentMethodId): boolean => {
    if (id === "bank_transfer") return !!(config.accountNumber || config.iban);
    if (id === "jazzcash") return !!config.jazzcash;
    if (id === "easypaisa") return !!config.easypaisa;
    return true;
  };
  let methods = PAYMENT_METHODS.filter((m) => {
    if (m.id === "online") return true;
    if (m.id === "pay_at_property") return config.acceptPayAtProperty;
    return config.acceptedMethods.includes(m.id) && hasDetails(m.id);
  });
  // Fallback: if nothing payable is available, always allow Pay at Property.
  const hasPayable = methods.some((m) => m.id !== "online");
  if (!hasPayable && !methods.some((m) => m.id === "pay_at_property")) {
    methods = [PAYMENT_METHODS[0], ...methods]; // Pay at Property is index 0
  }

  const amounts = method ? computeAmounts(total, config, method) : null;
  const selected = PAYMENT_METHODS.find((m) => m.id === method) || null;

  const choose = async (id: PaymentMethodId) => {
    if (id === "online") return;
    setErr("");
    setMethod(id);
    const a = computeAmounts(total, config, id);
    await initBookingPayment(table, bookingId, {
      method: id,
      total: a.total,
      advance: a.advance,
      remaining: a.remaining,
      advanceRequired: a.advanceRequired,
    });
  };

  const confirmProperty = async () => {
    setBusy(true);
    await setPayAtProperty(table, bookingId);
    setBusy(false);
    setDone("property");
  };

  const submitProof = async () => {
    setErr("");
    if (!shot) {
      setErr("Please upload your payment screenshot.");
      return;
    }
    setBusy(true);
    const { error } = await submitPaymentProof(table, bookingId, {
      method: method as PaymentMethodId,
      reference: txRef.trim(),
      screenshotUrl: shot,
    });
    setBusy(false);
    if (error) {
      setErr("Could not submit. Please try again.");
      return;
    }
    setDone("proof");
  };

  if (dismissed) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-forest-900/60 p-3 backdrop-blur-sm sm:p-6">
      <div className="relative my-auto w-full max-w-md overflow-hidden rounded-3xl bg-card shadow-premium-lg">
        {/* Header / steps */}
        <div className="flex items-center justify-between border-b border-border bg-forest-600 px-5 py-3 text-white">
          <p className="font-display text-sm font-bold">
            {done ? "Booking confirmed" : "Complete your booking"}
          </p>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-white/90 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <Stepper step={done ? 3 : 2} />

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {/* ---------- STEP 3: confirmation ---------- */}
          {done ? (
            <div className="space-y-4 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-forest-50 text-forest-600">
                {done === "property" ? <Building2 className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
              </span>
              <div>
                <h3 className="font-display text-xl font-bold text-forest">
                  {done === "property" ? "Booking request sent!" : "Payment proof submitted!"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {done === "property"
                    ? "Pay directly at the property or service provider according to their payment policy."
                    : "Your payment is pending verification. You'll be notified once it's confirmed."}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-left">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Booking reference</p>
                <p className="font-display text-2xl font-bold tracking-widest text-forest">{reference}</p>
                <dl className="mt-3 space-y-1 text-sm">
                  <Row k="Status" v={bookingStatus} />
                  <Row k="Provider" v={providerName} />
                  {selected && <Row k="Payment" v={selected.label} />}
                  {total > 0 && <Row k="Amount" v={formatPrice(total)} />}
                </dl>
                {summary.length > 0 && (
                  <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">{summary.join(" · ")}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Link href="/dashboard">
                  <Button variant="gold" size="lg" className="w-full rounded-lg">Track in my dashboard</Button>
                </Link>
                <Button variant="outline" size="lg" className="w-full rounded-lg" onClick={() => setDismissed(true)}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            /* ---------- STEP 2: payment ---------- */
            <div className="space-y-4">
              {/* compact booking summary */}
              <div className="rounded-2xl border border-forest-200 bg-forest-50/60 p-3">
                <div className="flex items-center gap-2 text-forest">
                  <CheckCircle2 className="h-4 w-4 text-forest-600" />
                  <p className="text-sm font-semibold">Booking saved — choose how to pay</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {providerName}
                  {summary.length > 0 ? ` · ${summary.join(" · ")}` : ""}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {methods.map((m) => {
                  const active = method === m.id;
                  const disabled = !!m.comingSoon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => choose(m.id)}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition-colors",
                        disabled
                          ? "cursor-not-allowed border-dashed border-border text-muted-foreground"
                          : active
                            ? "border-forest bg-forest-50 text-forest"
                            : "border-border text-forest hover:border-forest/40"
                      )}
                    >
                      <span className="flex items-center gap-2">{METHOD_ICON[m.id]} {m.label}</span>
                      {disabled ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">Soon</span>
                      ) : active ? (
                        <CheckCircle2 className="h-4 w-4 text-forest-600" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {amounts && total > 0 && (
                <div className="rounded-xl bg-muted/50 p-3 text-sm">
                  <AmountRow k="Total amount" v={formatPrice(amounts.total)} />
                  {amounts.advanceRequired && (
                    <>
                      <AmountRow k={`Advance due now (${config.advancePercentage}%)`} v={formatPrice(amounts.advance)} accent />
                      <AmountRow k="Remaining at service" v={formatPrice(amounts.remaining)} />
                    </>
                  )}
                </div>
              )}

              {method === "pay_at_property" && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    You&apos;ll pay directly at the property or service provider per their policy.
                  </p>
                  <Button variant="gold" size="lg" className="w-full rounded-lg" onClick={confirmProperty} disabled={busy}>
                    {busy ? "Submitting…" : "Submit booking"}
                  </Button>
                </div>
              )}

              {selected?.needsProof && (
                <div className="space-y-3">
                  <Instructions method={method as PaymentMethodId} config={config} />
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-forest">Transaction reference number</span>
                    <input
                      value={txRef}
                      onChange={(e) => setTxRef(e.target.value)}
                      placeholder="e.g. TXN123456789"
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm text-forest focus:border-forest-600 focus:outline-none"
                    />
                  </label>
                  <div>
                    <span className="mb-1 block text-xs font-semibold text-forest">Payment screenshot</span>
                    <PaymentUpload value={shot} onChange={setShot} />
                  </div>
                  {err && <p className="text-sm font-medium text-red-600">{err}</p>}
                  <Button variant="gold" size="lg" className="w-full rounded-lg" onClick={submitProof} disabled={busy}>
                    {busy ? "Submitting…" : "Submit payment proof"}
                  </Button>
                </div>
              )}

              {!method && (
                <p className="text-center text-xs text-muted-foreground">Select a payment method to continue.</p>
              )}
              {err && !selected?.needsProof && <p className="text-center text-sm font-medium text-red-600">{err}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const steps = ["Details", "Payment", "Confirm"];
  return (
    <div className="flex items-center gap-2 border-b border-border px-5 py-2.5">
      {steps.map((label, i) => {
        const n = i + 1;
        const stateDone = n < step;
        const active = n === step;
        return (
          <React.Fragment key={label}>
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold",
                  stateDone ? "bg-forest-600 text-white" : active ? "bg-gold text-forest-900" : "bg-muted text-muted-foreground"
                )}
              >
                {stateDone ? "✓" : n}
              </span>
              <span className={cn("text-[11px] font-semibold", active ? "text-forest" : "text-muted-foreground")}>{label}</span>
            </span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-border" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Instructions({ method, config }: { method: PaymentMethodId; config: PaymentConfig }) {
  const rows: [string, string | undefined][] = [];
  if (method === "bank_transfer") {
    rows.push(["Bank", config.bankName], ["Account title", config.accountTitle], ["Account #", config.accountNumber], ["IBAN", config.iban]);
  } else if (method === "jazzcash") {
    rows.push(["JazzCash #", config.jazzcash], ["Account title", config.accountTitle]);
  } else if (method === "easypaisa") {
    rows.push(["Easypaisa #", config.easypaisa], ["Account title", config.accountTitle]);
  }
  const filled = rows.filter(([, v]) => v);
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-forest-600">Send payment to</p>
      {filled.length > 0 ? (
        <dl className="mt-1.5 space-y-0.5 text-sm">
          {filled.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium text-forest">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          The provider will share account details — send the payment, then enter your reference and screenshot below.
        </p>
      )}
      {config.instructions && <p className="mt-2 text-xs text-muted-foreground">{config.instructions}</p>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-semibold text-forest">{v}</dd>
    </div>
  );
}

function AmountRow({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn("font-semibold", accent ? "text-gold-700" : "text-forest")}>{v}</span>
    </div>
  );
}
