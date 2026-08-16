"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck, Activity, Radar, Bell, KeyRound, Monitor, Ban, UserCog,
  Users, Store, Plug, CalendarCheck, Database, FileWarning, Globe,
  Siren, Bug, FileSearch, HardDriveDownload, Power, FileBarChart,
  GraduationCap, Settings, Loader2, Lock,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/* ============================================================
 * /cyber shell — layout, sidebar and access gate.
 *
 * IMPORTANT on the security model: this component renders no data of its
 * own. Every figure comes from /api/cyber/*, and those routes enforce
 * same-origin + admin role + email allowlist server-side. The gate below
 * is a usability layer, NOT the control — someone who bypasses it sees an
 * empty shell and gets 403 from every request behind it.
 *
 * Nothing in /admin is touched by this file.
 * ============================================================ */

const NAV: { group: string; items: { href: string; label: string; icon: typeof ShieldCheck }[] }[] = [
  {
    group: "Monitor",
    items: [
      { href: "/cyber", label: "Overview", icon: ShieldCheck },
      { href: "/cyber/events", label: "Live Events", icon: Activity },
      { href: "/cyber/threats", label: "Threat Detection", icon: Radar },
      { href: "/cyber/alerts", label: "Alerts", icon: Bell },
    ],
  },
  {
    group: "Identity",
    items: [
      { href: "/cyber/auth", label: "Authentication", icon: KeyRound },
      { href: "/cyber/sessions", label: "Sessions", icon: Monitor },
      { href: "/cyber/authz", label: "Authorization", icon: Ban },
      { href: "/cyber/admin-activity", label: "Admin Activity", icon: UserCog },
      { href: "/cyber/user-risk", label: "User Risk", icon: Users },
      { href: "/cyber/owner-risk", label: "Owner Risk", icon: Store },
    ],
  },
  {
    group: "Surface",
    items: [
      { href: "/cyber/api", label: "API Security", icon: Plug },
      { href: "/cyber/booking", label: "Booking Security", icon: CalendarCheck },
      { href: "/cyber/database", label: "Database", icon: Database },
      { href: "/cyber/files", label: "File Security", icon: FileWarning },
      { href: "/cyber/ip", label: "IP Security", icon: Globe },
    ],
  },
  {
    group: "Respond",
    items: [
      { href: "/cyber/incidents", label: "Incidents", icon: Siren },
      { href: "/cyber/vulnerabilities", label: "Vulnerabilities", icon: Bug },
      { href: "/cyber/evidence", label: "Audit Evidence", icon: FileSearch },
      { href: "/cyber/backup", label: "Backup & Recovery", icon: HardDriveDownload },
      { href: "/cyber/emergency", label: "Emergency Controls", icon: Power },
    ],
  },
  {
    group: "Learn",
    items: [
      { href: "/cyber/reports", label: "Security Reports", icon: FileBarChart },
      { href: "/cyber/reviews", label: "Post-Incident Reviews", icon: GraduationCap },
      { href: "/cyber/settings", label: "Security Settings", icon: Settings },
    ],
  },
];

export function CyberShell({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const pathname = usePathname();
  const [access, setAccess] = React.useState<"checking" | "granted" | "denied">(
    "checking"
  );

  /* Ask the server whether this session may enter. The answer — not the
     local role — decides what renders. */
  React.useEffect(() => {
    if (!ready) return;
    if (!user) {
      setAccess("denied");
      return;
    }
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return setAccess("denied");
        const r = await fetch("/api/cyber/summary", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAccess(r.ok ? "granted" : "denied");
      } catch {
        setAccess("denied");
      }
    })();
  }, [ready, user]);

  if (access === "checking") {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1220] text-slate-300">
        <div className="text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          <p className="mt-3 text-sm">Verifying security clearance…</p>
        </div>
      </div>
    );
  }

  if (access === "denied") {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0b1220] px-6 text-slate-300">
        <div className="max-w-sm text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-800 text-slate-400">
            <Lock className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-display text-xl font-bold text-white">
            Restricted
          </h1>
          {/* Deliberately vague: never confirm the portal's shape to
              someone who shouldn't be here. */}
          <p className="mt-2 text-sm text-slate-400">
            This area is not available for your account.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Back to Rego
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0b1220] text-slate-200">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-800 bg-[#0e1729] lg:block">
        <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold text-white">
              Security Center
            </p>
            <p className="truncate text-[11px] text-slate-500">Rego SOC</p>
          </div>
        </div>

        <nav className="space-y-5 px-3 py-4">
          {NAV.map((g) => (
            <div key={g.group}>
              <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                {g.group}
              </p>
              <ul className="space-y-0.5">
                {g.items.map((it) => {
                  const active = pathname === it.href;
                  const Icon = it.icon;
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                          active
                            ? "bg-forest-600 font-semibold text-white"
                            : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {it.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-3 border-b border-slate-800 bg-[#0e1729] px-5 py-3">
          <div className="flex items-center gap-2 lg:hidden">
            <ShieldCheck className="h-5 w-5 text-forest-500" />
            <span className="font-display text-sm font-bold text-white">
              Security Center
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
            <span className="hidden sm:inline">{user?.email}</span>
            <Link
              href="/admin"
              className="rounded-lg border border-slate-700 px-3 py-1.5 font-semibold text-slate-200 hover:bg-slate-800"
            >
              Admin
            </Link>
          </div>
        </header>

        <main className="p-5">{children}</main>
      </div>
    </div>
  );
}
