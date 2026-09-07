"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Check,
  ClipboardList,
  ShieldQuestion,
  MessageSquare,
  FileText,
  Globe2,
  Copy,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-context";
import {
  can,
  referralLink,
  touchStaffSeen,
  useStaffProfile,
  type StaffProfile,
} from "@/lib/staff-portal";
import { PortalLeads } from "@/components/portal/portal-leads";
import { PortalTasks } from "@/components/portal/portal-tasks";
import { PortalProfile } from "@/components/portal/portal-profile";
import { PORTAL_MODULES } from "@/components/portal/portal-modules";
import { PortalApprovals } from "@/components/portal/portal-approvals";
import { StaffThread } from "@/components/portal/staff-thread";
import { unreadCount } from "@/lib/staff-messages";
import { AdminBlog } from "@/components/dashboard/admin-blog";
import { MarketAreas } from "@/components/dashboard/market-areas";

/* ============================================================
 * The team portal.
 *
 * WHAT IS HERE AND WHAT IS NOT
 *   Identity, leads, tasks, the referral link and what it has
 *   earned, assigned areas, and effective permissions. Every number
 *   on this page comes from a row that exists.
 *
 *   Plus whichever admin modules they have been granted, from
 *   PORTAL_MODULES — the real admin components, not copies.
 *
 *   Approvals are here as of phase111, which stopped an owner
 *   setting their own status — an approval queue on top of that
 *   would have decided nothing. Verification, edit requests and
 *   the full listings screen are still to come. This note is
 *   updated as each one lands, because a stale "not built yet" is
 *   its own small lie.
 *
 * WHY IT MIRRORS THE TRAVELLER DASHBOARD
 *   Same sidebar, same card shapes, same sign-out. Somebody who
 *   uses Rego already knows how to read this, and a second visual
 *   language for the same product is a cost with no payer.
 * ============================================================ */

type FixedTab =
  | "overview" | "leads" | "tasks" | "referrals"
  | "areas" | "permissions" | "profile" | "blog" | "places" | "approvals" | "messages";

/* A module tab is its id from PORTAL_MODULES. Kept as a plain string so the
   list stays the single place a module is declared — narrowing this to a
   union would mean adding every new module in two files. */
type Tab = FixedTab | string;

/* `needs` is about DRAWING the tab, not about access. Somebody who reaches
   /portal and types the tab into React devtools sees a screen whose every
   query the database then refuses. The hidden tab is a courtesy. */
const NAV: {
  id: Tab;
  label: string;
  icon: typeof LayoutDashboard;
  needs?: string[];
}[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  {
    id: "approvals",
    label: "Approvals",
    icon: ShieldQuestion,
    needs: ["view_approvals", "approve_listing", "reject_listing"],
  },
  { id: "leads", label: "Leads", icon: Users, needs: ["view_leads", "manage_own_leads"] },
  {
    id: "tasks",
    label: "Tasks",
    icon: ClipboardList,
    needs: ["view_tasks", "update_own_tasks"],
  },
  {
    id: "blog",
    label: "Blog & news",
    icon: FileText,
    needs: ["create_blog", "edit_blog", "publish_blog", "unpublish_blog"],
  },
  {
    id: "places",
    label: "Destinations & areas",
    icon: Globe2,
    needs: ["view_locations", "add_location", "edit_location", "add_attraction"],
  },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "referrals", label: "My referrals", icon: BadgeCheck },
  { id: "areas", label: "Where I work", icon: MapPin },
  { id: "permissions", label: "What I can do", icon: ShieldCheck },
  { id: "profile", label: "My profile", icon: UserCog },
];

export function PortalShell() {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  /* fresh, always. The cached copy is for the navbar; here it would mean a
     permission granted five minutes ago has not arrived, and the member has
     no way to tell the difference between "not granted" and "not reloaded".
     One indexed lookup on page load is the cheaper mistake. */
  const profile = useStaffProfile({ fresh: true, watch: true });
  const [tab, setTab] = React.useState<Tab>("overview");

  /* Counted once, here, because the overview and the referrals tab both
     want it and neither should trigger its own request. */
  const [credited, setCredited] = React.useState<number | null>(null);
  /* Unread from Rego. The same gap existed on this side: an admin could reply
     and the member would never know unless they happened to open the tab. */
  const [unread, setUnread] = React.useState(0);

  React.useEffect(() => {
    /* Carry the destination. Without ?redirect= somebody who opened
       /portal directly signed in and landed on whatever the default was,
       which is the wrong answer to the door they knocked on.

       Not a separate team login form: it would be a second authentication
       path against the same accounts, which is one more place for a session
       bug to live. Same form, told where it is going. */
    if (ready && !user) router.replace("/signin?redirect=%2Fportal");
  }, [ready, user, router]);

  React.useEffect(() => {
    if (profile) void touchStaffSeen();
  }, [profile]);

  React.useEffect(() => {
    if (!profile || !isSupabaseConfigured) return;
    let alive = true;
    /* Only their own rows come back: the read policy on staff_attributions
       limits it to staff_id = them, or an admin. */
    supabase
      .from("staff_attributions")
      .select("relation", { count: "exact", head: true })
      .eq("staff_id", profile.staff_id)
      .eq("relation", "referred")
      .then(({ count, error }) => {
        if (alive) setCredited(error ? null : (count ?? 0));
      });
    return () => {
      alive = false;
    };
  }, [profile]);

  /* A permission can be taken away while they are looking at the screen it
     opened. Leaving them there would give them a page whose every action the
     database now refuses, with no clue why — so the tab closes itself. */
  React.useEffect(() => {
    if (!profile) return;
    const entry = NAV.find((n) => n.id === tab);
    if (entry?.needs && !entry.needs.some((slug) => can(profile, slug))) {
      setTab("overview");
    }
  }, [profile, tab]);

  React.useEffect(() => {
    if (!profile) return;
    let alive = true;
    /* Re-read when the tab changes, so opening Messages clears the badge
       without a reload — markRead runs inside the thread on mount. */
    unreadCount(profile.staff_id, true).then((n) => {
      if (alive) setUnread(n);
    });
    return () => {
      alive = false;
    };
  }, [profile, tab]);

  const signOut = async () => {
    await logout();
    router.push("/");
  };

  if (!ready || profile === undefined) {
    return (
      <div className="container-px mx-auto flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  if (profile === null) {
    return (
      <div className="container-px mx-auto max-w-2xl py-16">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h1 className="font-display text-xl font-bold text-forest">
            This area is for the Rego team
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is not on the team, or your access has been paused. If
            you think that is wrong, ask whoever added you.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-block rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white"
          >
            Go to my dashboard
          </Link>
        </div>
      </div>
    );
  }

  const firstName = user.name.trim().split(/\s+/)[0] || user.name;

  return (
    <div className="container-px py-10">
      <h1 className="font-display text-3xl font-bold text-forest">
        Welcome back, {firstName}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {profile.role.name} · {profile.department.name} · {profile.employee_code}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside>
          <div className="sticky top-24 rounded-3xl border border-border/70 bg-card p-3 shadow-premium">
            <div className="flex items-center gap-3 border-b border-border p-3">
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-gold text-forest-900">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-6 w-6" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-forest">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-700">
                  {profile.department.name}
                </span>
              </div>
            </div>

            <nav className="mt-2 space-y-1">
              {[
                ...NAV,
                /* The admin modules they have been given. Appended rather
                   than interleaved so the portal's own screens stay where
                   somebody learned to find them. */
                ...PORTAL_MODULES.map((m) => ({
                  id: m.id,
                  label: m.label,
                  icon: m.icon,
                  needs: m.needs,
                })),
              ].filter(
                (n) => !n.needs || n.needs.some((slug) => can(profile, slug))
              ).map((n) => {
                const Icon = n.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => setTab(n.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      tab === n.id
                        ? "bg-gradient-forest text-white shadow-soft"
                        : "text-forest hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {n.label}
                    {n.id === "messages" && unread > 0 && (
                      <span
                        className={cn(
                          "ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold",
                          tab === n.id ? "bg-white/25 text-white" : "bg-red-600 text-white"
                        )}
                      >
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* No link to /dashboard. A team account is a team account
                  now — /dashboard sends staff back here, so a link would
                  bounce between the two and reach nothing. */}
              <button
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-forest hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </nav>
          </div>
        </aside>

        <div className="space-y-5">
          {tab === "overview" && (
            <Overview profile={profile} credited={credited} onGo={setTab} />
          )}
          {tab === "leads" && <PortalLeads profile={profile} />}
          {tab === "tasks" && <PortalTasks profile={profile} />}
          {tab === "referrals" && <Referrals profile={profile} credited={credited} />}
          {tab === "areas" && <Areas profile={profile} />}
          {tab === "permissions" && <Permissions profile={profile} />}
          {tab === "profile" && <PortalProfile profile={profile} />}

          {/* The admin screens themselves, not copies. A second blog editor
              would drift from the first, and the difference would show up as
              a field that saves in one place and not the other. What a staff
              member may actually DO with them is decided by the route, per
              action — see /api/admin/blog and /api/admin/markets. */}
          {tab === "blog" && <AdminBlog />}
          {tab === "places" && <MarketAreas />}
          {tab === "approvals" && <PortalApprovals profile={profile} />}
          {tab === "messages" && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-display text-lg font-bold text-forest">
                Messages with Rego
              </h2>
              <p className="mb-4 mt-1 text-sm text-muted-foreground">
                Between you and the Rego admins. Your colleagues cannot see
                this thread.
              </p>
              <StaffThread
                staffId={profile.staff_id}
                senderName={user.name}
                fromAdmin={false}
                emptyLine="Nothing yet. Ask anything — this is the place for it."
              />
            </section>
          )}

          {/* Whichever admin module they opened. The component is the admin
              one, unchanged; what they may DO in it is decided by the
              staff110_* policies on the tables it writes to. */}
          {PORTAL_MODULES.filter(
            (m) => m.id === tab && m.needs.some((slug) => can(profile, slug))
          ).map((m) => (
            <m.Component key={m.id} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-forest">
        {icon}
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="font-display text-3xl font-bold text-forest">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Overview({
  profile,
  credited,
  onGo,
}: {
  profile: StaffProfile;
  credited: number | null;
  onGo: (t: Tab) => void;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Providers credited to you"
          value={credited === null ? "—" : String(credited)}
          hint="Through your referral link"
        />
        <Stat
          label="Areas you cover"
          value={String(profile.scopes.length)}
          hint={profile.scopes.length === 0 ? "None assigned yet" : undefined}
        />
        <Stat
          label="Permissions"
          value={String(profile.permissions.length)}
          hint="From your role"
        />
      </div>

      <Card title="Your details">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Detail label="Employee code" value={profile.employee_code} />
          <Detail label="Referral code" value={profile.referral_code} />
          <Detail
            label="Joined"
            value={
              profile.joined_at
                ? new Date(profile.joined_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"
            }
          />
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Your employee code was generated by the server and never changes.
          Everything credited to you points at it.
        </p>
      </Card>

      <Card title="What is not here yet">
        {/* Named plainly rather than shown as empty panels, and kept honest as
            each one lands — a stale "not built" note is its own small lie. */}
        <p className="text-sm text-muted-foreground">
          Verification, edit requests and the full listings screen are not here
          yet. Everything you can see on this page is real.
        </p>
        <button
          type="button"
          onClick={() => onGo("permissions")}
          className="mt-3 text-sm font-semibold text-forest underline"
        >
          See what you are allowed to do
        </button>
      </Card>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-semibold text-forest">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Referrals({
  profile,
  credited,
}: {
  profile: StaffProfile;
  credited: number | null;
}) {
  const link = referralLink(profile);
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard refused. The link is on screen and can be selected. */
    }
  };

  return (
    <Card title="Your referral link" icon={<BadgeCheck className="h-5 w-5" />}>
      <p className="text-sm text-muted-foreground">
        Share this with a provider. If they register after following it, you are
        credited — once. A second link cannot replace the first, so nobody can
        take a referral off you and you cannot take one off anybody else.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="auth-input flex-1 font-mono text-xs"
        />
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="mt-3 text-sm text-forest">
        {credited === null
          ? "Counting…"
          : credited === 0
            ? "No providers credited to you yet."
            : `${credited} provider${credited === 1 ? "" : "s"} credited to you.`}
      </p>

      <p className="mt-3 text-xs text-muted-foreground">
        Which providers, and when, is not shown here yet — that is part of the
        analytics screen and is not built.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function Areas({ profile }: { profile: StaffProfile }) {
  return (
    <Card title="Where you work" icon={<MapPin className="h-5 w-5" />}>
      {profile.scopes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No area has been assigned to you yet. Anything that depends on a
          location will be refused until an admin sets one — that is the
          database refusing it, not this screen.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {profile.scopes.map((s) => (
            <li
              key={s.location_id}
              className="rounded-full border border-border bg-background px-3 py-1 text-sm text-forest"
            >
              {s.name}
              <span className="ml-1 text-xs text-muted-foreground">
                {s.includes_descendants ? "and everything inside it" : "only"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

interface PermissionRow {
  slug: string;
  module: string;
  label: string;
}

function Permissions({ profile }: { profile: StaffProfile }) {
  const [rows, setRows] = React.useState<PermissionRow[] | null>(null);

  React.useEffect(() => {
    if (!isSupabaseConfigured || profile.permissions.length === 0) {
      setRows([]);
      return;
    }
    let alive = true;
    supabase
      .from("staff_permissions")
      .select("slug, module, label")
      .in("slug", profile.permissions)
      .then(({ data, error }) => {
        if (!alive) return;
        setRows(error || !data ? [] : (data as PermissionRow[]));
      });
    return () => {
      alive = false;
    };
  }, [profile.permissions]);

  const byModule = React.useMemo(() => {
    const map = new Map<string, PermissionRow[]>();
    for (const r of rows ?? []) {
      const list = map.get(r.module) ?? [];
      list.push(r);
      map.set(r.module, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  return (
    <Card title="What you are allowed to do" icon={<ShieldCheck className="h-5 w-5" />}>
      {rows === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : profile.permissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Your role carries no permissions yet.
        </p>
      ) : byModule.length === 0 ? (
        /* Names could not be loaded; the slugs are still the truth. */
        <ul className="flex flex-wrap gap-2">
          {profile.permissions.map((s) => (
            <li key={s} className="rounded-full border border-border px-3 py-1 font-mono text-xs">
              {s}
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-4">
          {byModule.map(([module, list]) => (
            <div key={module}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {module.replace(/_/g, " ")}
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {list.map((p) => (
                  <li
                    key={p.slug}
                    className="rounded-full border border-border bg-background px-3 py-1 text-sm text-forest"
                  >
                    {p.label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        These are checked again by the database on every action, so this list
        describes what will happen rather than deciding it.
      </p>
    </Card>
  );
}
