"use client";

import * as React from "react";
import { useDashboardDrill, DashboardBack } from "@/components/dashboard/dashboard-drill";
import { Mountain, BarChart3, UserRound, LogOut } from "lucide-react";

import { AccountSecurity } from "@/components/account/account-security";
import { ContactAdminButton } from "@/components/chat/contact-admin-button";
import { OwnerCrm } from "@/components/crm/owner-crm";
import { ActivitiesManager } from "@/components/dashboard/activities-manager";
import { type User } from "@/components/auth/auth-context";
import { cn } from "@/lib/utils";

type Tab = "activities" | "crm" | "account";

const nav: { id: Tab; label: string; icon: typeof Mountain }[] = [
  { id: "activities", label: "My Activities", icon: Mountain },
  { id: "crm", label: "CRM & Insights", icon: BarChart3 },
  { id: "account", label: "Account", icon: UserRound },
];

export function ActivityProviderDashboard({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("activities");
  const drill = useDashboardDrill();

  return (
    <div className="container-px py-10">
      <div>
        <h1 className="font-display text-3xl font-bold text-forest">Activities Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          List your adventures — camping, treks, safaris and more. They go live once an admin approves.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr] rego-dash" {...drill.gridProps}>
        <DashboardBack onClick={drill.back} />
        <aside>
          <div className="sticky top-24 rounded-3xl border border-border/70 bg-card p-3 shadow-premium">
            <div className="flex items-center gap-3 border-b border-border p-3">
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-gold text-forest-900">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Mountain className="h-6 w-6" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-forest">{user.name}</p>
                <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-700">
                  Activity Provider
                </span>
              </div>
            </div>
            <nav className="mt-2 space-y-1">
              {nav.map((n) => {
                const Icon = n.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => setTab(n.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      tab === n.id ? "bg-gradient-forest text-white shadow-soft" : "text-forest hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {n.label}
                  </button>
                );
              })}
              <div className="my-2 border-t border-border" />
              <ContactAdminButton ownerEmail={user.email} ownerName={user.name} ownerAvatar={user.avatar} />
              <button
                onClick={onSignOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-forest hover:bg-muted"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </nav>
          </div>
        </aside>

        <div>
          {tab === "activities" && (
            <ActivitiesManager user={user} ownerType="activity-provider" businessName={user.name} />
          )}
          {tab === "crm" && <OwnerCrm user={user} />}
          {tab === "account" && <AccountSecurity />}
        </div>
      </div>
    </div>
  );
}
