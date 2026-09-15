"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Percent, Plane } from "lucide-react";

import { cn } from "@/lib/utils";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { useAuth } from "@/components/auth/auth-context";
import { AdminFlightRequests } from "@/components/dashboard/admin-flight-requests";
import { AdminFlightMarkup } from "@/components/dashboard/admin-flight-markup";

/* ============================================================
 * /admin/flights — the flights hub.
 *
 * A separate route rather than more tabs in admin-dashboard.tsx,
 * which is already ~2,700 lines in one client component. Eight
 * flight tabs would make the hardest file in the project harder.
 *
 * THIS PAGE IS NOT THE ACCESS CONTROL
 *   The role check below decides what to render. Every write goes
 *   through /api/admin/flight-requests or
 *   /api/admin/flight-markup, each of which reads the caller's
 *   role from the database, and the phase117/118 policies limit
 *   the tables to admins regardless. A non-admin who reaches this
 *   URL gets a screen whose every action the server refuses.
 * ============================================================ */

type Tab = "requests" | "markup";

const TABS: { id: Tab; label: string; icon: typeof Plane }[] = [
  { id: "requests", label: "Requests", icon: Plane },
  { id: "markup", label: "Markup", icon: Percent },
];

export default function AdminFlightsPage() {
  const { user, ready } = useAuth();
  const [tab, setTab] = React.useState<Tab>("requests");

  if (!ready) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-background">
          <p className="container-px py-24 text-center text-muted-foreground">Loading…</p>
        </main>
        <Footer />
      </>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-background">
          <div className="container-px py-24 text-center">
            <p className="font-display text-xl font-bold text-forest">Admins only</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This page is for the Rego team.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-xl bg-gradient-forest px-5 py-2.5 text-sm font-bold text-white"
            >
              Back to Rego
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background">
        <div className="container-px py-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-600 hover:text-gold"
          >
            <ArrowLeft className="h-4 w-4" /> Back to admin
          </Link>

          <div className="mt-4 mb-6 flex flex-wrap gap-2">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                    tab === t.id
                      ? "bg-gradient-forest text-white shadow-soft"
                      : "border border-border bg-card text-forest hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === "requests" && <AdminFlightRequests />}
          {tab === "markup" && <AdminFlightMarkup />}
        </div>
      </main>
      <Footer />
    </>
  );
}
