"use client";

import * as React from "react";
import { Clock, LogOut, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ContactAdminButton } from "@/components/chat/contact-admin-button";
import type { User } from "@/components/auth/auth-context";

/* ============================================================
 * Provider approval gate.
 *
 * A new partner used to land straight on the full dashboard —
 * bookings, rooms, jobs, analytics — before they had entered a
 * single business detail, and kept it while their registration
 * waited for review. The dashboard is now earned in two steps:
 *
 *   1. REGISTER   no business on file → only the registration
 *                 wizard is shown, nothing around it.
 *   2. PENDING    registered, nothing approved yet → an "under
 *                 review" screen, nothing else.
 *   3. OPEN       at least one business approved → the dashboard.
 *
 * Rejected or suspended (with nothing approved) also opens the
 * dashboard, as before: that is where the owner sees the status
 * and corrects their details. Locking them out would leave a
 * rejected partner with no way to fix anything.
 *
 * This is a screen gate, not the security boundary. Public
 * visibility is still decided by `status = 'approved'` in the
 * database (RLS), exactly as before.
 * ============================================================ */

export type GateState = "register" | "pending" | "open";

/**
 * Decide what a provider sees, from the status of every business they own.
 * Pass one status per business (hotels, or the single company row…).
 */
export function gateFor(statuses: (string | null | undefined)[]): GateState {
  const list = statuses.map((s) => (s ?? "").toLowerCase().trim());
  if (list.length === 0) return "register";
  if (list.includes("approved")) return "open";
  if (list.some((s) => s === "pending" || s === "")) return "pending";
  return "open"; // rejected / suspended → dashboard, where they can fix it
}

/** The registration wizard on its own — no sidebar, tabs or stats. */
export function RegisterShell({
  user,
  title,
  subtitle,
  onSignOut,
  children,
}: {
  user: User;
  title: string;
  subtitle: string;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="container-px py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-forest">
            Welcome, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">{subtitle}</p>
          <p className="mt-1 text-sm font-semibold text-forest">{title}</p>
        </div>
        <Button variant="outline" className="rounded-lg" onClick={onSignOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
      <ol className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
        <li className="rounded-full bg-forest-600 px-3 py-1 text-white">1. Business details</li>
        <li className="rounded-full bg-muted px-3 py-1 text-muted-foreground">2. Admin review</li>
        <li className="rounded-full bg-muted px-3 py-1 text-muted-foreground">3. Your dashboard</li>
      </ol>
      <div className="mt-8 max-w-3xl">{children}</div>
    </div>
  );
}

/** Shown after registering, until an admin approves the business. */
export function PendingApproval({
  user,
  businessName,
  onSignOut,
  onRefresh,
}: {
  user: User;
  businessName?: string | null;
  onSignOut: () => void;
  onRefresh?: () => void | Promise<void>;
}) {
  const [checking, setChecking] = React.useState(false);

  const check = async () => {
    if (!onRefresh) return;
    setChecking(true);
    try {
      await onRefresh();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="container-px py-10">
      <div className="mx-auto max-w-2xl rounded-3xl border border-border/70 bg-card p-8 text-center shadow-premium sm:p-10">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold/20 text-gold-700">
          <Clock className="h-8 w-8" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-forest sm:text-3xl">
          Your registration is under review
        </h1>
        {businessName?.trim() && (
          <p className="mt-2 font-semibold text-forest">{businessName}</p>
        )}
        <p className="mt-3 text-muted-foreground">
          Thanks, {user.name.split(" ")[0]}. The Rego team is checking your business
          details. Your dashboard opens here as soon as it is approved — you
          do not need to register again.
        </p>

        <ol className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-2 text-xs font-semibold">
          <li className="rounded-full bg-forest-50 px-3 py-1 text-forest-600">
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
            1. Business details — done
          </li>
          <li className="rounded-full bg-gold/20 px-3 py-1 text-gold-700">2. Admin review — in progress</li>
          <li className="rounded-full bg-muted px-3 py-1 text-muted-foreground">3. Your dashboard</li>
        </ol>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {onRefresh && (
            <Button variant="gold" className="rounded-lg" onClick={check} disabled={checking}>
              <RefreshCw className={checking ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              {checking ? "Checking…" : "Check status"}
            </Button>
          )}
          <ContactAdminButton ownerEmail={user.email} ownerName={user.name} ownerAvatar={user.avatar} />
          <Button variant="outline" className="rounded-lg" onClick={onSignOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
