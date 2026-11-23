"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  LogIn,
  Store,
  Target,
  Timer,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  formatMinutes,
  loadStaffAnalytics,
  type StaffAnalytics,
  type StaffTaskRow,
} from "@/lib/staff-analytics";

/* ============================================================
 * One team member's numbers.
 *
 * Reused by the member's own portal and by the admin's team
 * screen, because the person being measured should see exactly
 * what their manager sees. Measuring somebody and hiding the
 * measurement is the part that turns analytics into surveillance.
 *
 * WHAT THE NUMBERS DO NOT MEAN
 *   Time in the portal is not hours worked — a tab left open
 *   counts, and a member on the phone to a provider for an hour
 *   does not. The screen says so under the figure rather than
 *   leaving a manager to assume otherwise.
 * ============================================================ */

export function StaffAnalyticsPanel({
  staffId,
  approvalsWaiting = null,
  title = "Activity",
}: {
  staffId: string;
  /** Passed in when the caller already knows, to avoid a second query. */
  approvalsWaiting?: number | null;
  title?: string;
}) {
  const [data, setData] = React.useState<StaffAnalytics | null>(null);

  React.useEffect(() => {
    let alive = true;
    void loadStaffAnalytics(staffId).then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [staffId]);

  if (!data) {
    return (
      <div className="grid h-40 place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-forest-600" />
      </div>
    );
  }

  const neverOpened = data.portal.sessionsTotal === 0;

  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl font-bold text-forest">{title}</h2>

      {/* ---- headline figures ---- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={LogIn}
          label="Portal opened"
          value={String(data.portal.sessionsTotal)}
          sub={
            data.portal.sessions30d > 0
              ? `${data.portal.sessions30d} in the last 30 days`
              : "none in the last 30 days"
          }
          tone={neverOpened ? "warn" : "normal"}
        />
        <Stat
          icon={Timer}
          label="Time in the portal"
          value={formatMinutes(data.portal.minutesTotal)}
          sub={`${formatMinutes(data.portal.minutes30d)} in 30 days`}
        />
        <Stat
          icon={Target}
          label="Leads"
          value={String(data.leads.total)}
          sub={`${data.leads.open} open · ${data.leads.won} won`}
        />
        <Stat
          icon={Store}
          label="Providers brought in"
          value={String(
            data.listings.referred + data.listings.created + data.listings.assisted
          )}
          sub={`${data.listings.referred} referred · ${data.listings.created} created`}
        />
      </div>

      {neverOpened && (
        /* The single most useful thing this screen can say about a new hire:
           they have never opened it. Worth its own line rather than being a
           zero somebody has to notice. */
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          This member has never opened the portal. If they have been set up,
          check they received the invitation email.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Time in the portal is approximate — it counts while the tab is open and
        in front of them, so a tab left open counts and a phone call to a
        provider does not. It is a sign of whether the tool is being used, not
        a record of hours worked.
      </p>

      {/* ---- approvals waiting ---- */}
      {approvalsWaiting !== null && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-2xl border p-4",
            approvalsWaiting > 0
              ? "border-amber-200 bg-amber-50"
              : "border-border bg-card"
          )}
        >
          <Clock
            className={cn(
              "h-5 w-5 shrink-0",
              approvalsWaiting > 0 ? "text-amber-700" : "text-forest-600"
            )}
          />
          <div>
            <p className="font-semibold text-forest">
              {approvalsWaiting > 0
                ? `${approvalsWaiting} approval${approvalsWaiting === 1 ? "" : "s"} waiting`
                : "No approvals waiting"}
            </p>
            <p className="text-xs text-muted-foreground">
              Listings needing a decision in the areas this member covers.
            </p>
          </div>
        </div>
      )}

      {/* ---- tasks ---- */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="font-display text-lg font-bold text-forest">Tasks</h3>
          <span className="text-sm text-muted-foreground">
            {data.tasks.done} of {data.tasks.total} done
          </span>
          {data.tasks.overdue > 0 && (
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
              {data.tasks.overdue} overdue
            </span>
          )}
        </div>

        {data.tasks.rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            No tasks assigned yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.tasks.rows.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TaskRow({ task }: { task: StaffTaskRow }) {
  const overdue =
    task.status !== "done" &&
    task.dueAt !== null &&
    task.dueAt < new Date().toISOString();

  return (
    <li className="rounded-2xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            {/* The ID, quotable. A manager asking "what happened to A3F9C21E"
                needs something shorter than a uuid. */}
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold text-muted-foreground">
              {task.ref}
            </span>
            <span className="font-semibold text-forest">{task.title}</span>
          </p>
          {task.progressNote && (
            <p className="mt-1 text-xs text-muted-foreground">{task.progressNote}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {task.dueAt && (
            <span
              className={cn(
                "text-xs",
                overdue ? "font-bold text-red-700" : "text-muted-foreground"
              )}
            >
              {overdue ? "overdue " : "due "}
              {new Date(task.dueAt).toLocaleDateString("en-GB")}
            </span>
          )}
          <StatusPill status={task.status} />
        </div>
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    todo: "bg-muted text-muted-foreground",
    in_progress: "bg-blue-50 text-blue-800",
    done: "bg-emerald-50 text-emerald-800",
    blocked: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        map[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {status === "done" && <CheckCircle2 className="h-3 w-3" />}
      {status.replace("_", " ")}
    </span>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone = "normal",
}: {
  icon: typeof Target;
  label: string;
  value: string;
  sub?: string;
  tone?: "normal" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "warn" ? "border-amber-200 bg-amber-50" : "border-border bg-card"
      )}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold text-forest">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
