"use client";

import * as React from "react";
import {
  ShieldCheck, Smartphone, Loader2, AlertCircle, KeyRound, Copy, Check, LogOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";
import {
  getMfaStatus, enrollTotp, verifyTotp, primaryFactorId,
  type MfaStatus, type EnrollResult,
} from "@/lib/mfa";

/**
 * Wraps the admin area. Admins must pass two-step verification before the
 * dashboard renders; everyone else passes straight through (the dashboard
 * does its own role check and redirect).
 */
export function AdminMfaGate({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const [status, setStatus] = React.useState<MfaStatus>("loading");
  const [message, setMessage] = React.useState("");

  const isAdmin = user?.role === "admin";

  const check = React.useCallback(async () => {
    const r = await getMfaStatus();
    setStatus(r.status);
    setMessage(r.message ?? "");
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    if (!isAdmin) {
      setStatus("verified"); // not our concern — let the dashboard handle it
      return;
    }
    check();
  }, [ready, isAdmin, check]);

  if (!ready || status === "loading") {
    return (
      <div className="container-px py-24 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        <p className="mt-3 text-sm">Checking security…</p>
      </div>
    );
  }

  if (!isAdmin || status === "verified") return <>{children}</>;

  if (status === "error") {
    return (
      <Shell title="Couldn't verify your session">
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="gold" className="mt-4 w-full rounded-lg" onClick={check}>
          Try again
        </Button>
      </Shell>
    );
  }

  return status === "not-enrolled" ? (
    <EnrollStep onDone={check} onSignOut={logout} email={user?.email ?? ""} />
  ) : (
    <ChallengeStep onDone={check} onSignOut={logout} />
  );
}

/* ---------------- shared frame ---------------- */

function Shell({
  title,
  subtitle,
  children,
  onSignOut,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onSignOut?: () => void;
}) {
  return (
    <div className="container-px flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-premium sm:p-8">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-forest-50 text-forest-600">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-forest">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
        <div className="mt-5">{children}</div>
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-forest"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        )}
      </div>
    </div>
  );
}

function CodeInput({
  value,
  onChange,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      onKeyDown={(e) => e.key === "Enter" && onEnter()}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      placeholder="000000"
      aria-label="6-digit verification code"
      className="w-full rounded-xl border border-border bg-white px-4 py-3 text-center font-display text-2xl font-bold tracking-[0.4em] text-forest focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/25"
    />
  );
}

function ErrorNote({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div
      role="alert"
      className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {text}
    </div>
  );
}

/* ---------------- first-time setup ---------------- */

function EnrollStep({
  onDone,
  onSignOut,
  email,
}: {
  onDone: () => void;
  onSignOut: () => void;
  email: string;
}) {
  const [enroll, setEnroll] = React.useState<EnrollResult | null>(null);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current) return; // strict mode fires effects twice
    started.current = true;
    enrollTotp(email || "Rego Admin").then((r) => {
      if (r.error) setError(r.error);
      else if (r.data) setEnroll(r.data);
    });
  }, [email]);

  const submit = async () => {
    if (!enroll || busy) return;
    setError("");
    setBusy(true);
    const r = await verifyTotp(enroll.factorId, code);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "Could not verify.");
      setCode("");
      return;
    }
    onDone();
  };

  const copySecret = async () => {
    if (!enroll) return;
    try {
      await navigator.clipboard.writeText(enroll.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the secret is visible on screen anyway */
    }
  };

  return (
    <Shell
      title="Set up two-step verification"
      subtitle="The admin area needs a second check. Scan this with an authenticator app — Google Authenticator, Microsoft Authenticator or Authy all work."
      onSignOut={onSignOut}
    >
      {!enroll && !error && (
        <div className="py-8 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          <p className="mt-2 text-sm">Preparing your code…</p>
        </div>
      )}

      {enroll && (
        <>
          <div className="rounded-2xl border border-border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={enroll.qrCode}
              alt="QR code for your authenticator app"
              className="mx-auto h-48 w-48"
            />
          </div>

          <details className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-forest">
              Can&apos;t scan it? Enter this key by hand
            </summary>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-2 py-1.5 text-xs text-forest">
                {enroll.secret}
              </code>
              <button
                type="button"
                onClick={copySecret}
                aria-label="Copy setup key"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-white text-forest hover:bg-muted"
              >
                {copied ? <Check className="h-4 w-4 text-forest-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </details>

          <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-forest">
            <Smartphone className="h-3.5 w-3.5 text-gold" />
            Now enter the 6-digit code your app shows
          </p>
          <div className="mt-2">
            <CodeInput value={code} onChange={setCode} onEnter={submit} />
          </div>

          <ErrorNote text={error} />

          <Button
            variant="gold"
            size="lg"
            disabled={busy || code.length < 6}
            onClick={submit}
            className="mt-4 w-full rounded-lg bg-forest-600 text-white hover:bg-forest-700"
          >
            {busy ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</>
            ) : (
              "Turn on two-step verification"
            )}
          </Button>

          <p className="mt-3 rounded-xl border border-gold-300 bg-gold-50 px-3 py-2 text-xs text-gold-700">
            <strong>Keep the setup key somewhere safe.</strong> If you lose your
            phone it is the only way back in without database access.
          </p>
        </>
      )}

      {!enroll && error && <ErrorNote text={error} />}
    </Shell>
  );
}

/* ---------------- returning admin ---------------- */

function ChallengeStep({
  onDone,
  onSignOut,
}: {
  onDone: () => void;
  onSignOut: () => void;
}) {
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    const factorId = await primaryFactorId();
    if (!factorId) {
      setBusy(false);
      setError("No authenticator is registered on this account.");
      return;
    }
    const r = await verifyTotp(factorId, code);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "Could not verify.");
      setCode("");
      return;
    }
    onDone();
  };

  return (
    <Shell
      title="Enter your code"
      subtitle="Open your authenticator app and enter the 6-digit code for Rego."
      onSignOut={onSignOut}
    >
      <CodeInput value={code} onChange={setCode} onEnter={submit} />
      <ErrorNote text={error} />
      <Button
        variant="gold"
        size="lg"
        disabled={busy || code.length < 6}
        onClick={submit}
        className="mt-4 w-full rounded-lg bg-forest-600 text-white hover:bg-forest-700"
      >
        {busy ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Checking…</>
        ) : (
          <><KeyRound className="h-4 w-4" /> Unlock admin</>
        )}
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Codes change every 30 seconds. If it keeps failing, check your phone&apos;s clock is set automatically.
      </p>
    </Shell>
  );
}
