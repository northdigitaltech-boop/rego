import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * What a team member has actually done.
 *
 * Five things, each from the table that already owns it — no new
 * copies, no derived counters kept in step by hand:
 *
 *   tasks       staff_tasks       (phase108)
 *   leads       staff_leads       (phase107)
 *   listings    staff_attributions(phase105)
 *   sessions    staff_sessions    (phase121)
 *   approvals   the listing tables, via phase111's policies
 *
 * EVERY COUNT IS LIMITED BY RLS, NOT BY THIS FILE.
 *   A member calling these sees their own rows because the
 *   policies say so; an admin sees everyone for the same reason.
 *   Nothing here filters by staff id as a security measure, and
 *   nothing here should start to — that would be a second set of
 *   rules to keep in step with the first.
 * ============================================================ */

export interface StaffTaskRow {
  id: string;
  /* Short, quotable form of the uuid. Someone reading a task number aloud
     needs eight characters, not thirty-six. */
  ref: string;
  title: string;
  status: string;
  priority: string | null;
  dueAt: string | null;
  progressNote: string | null;
  createdAt: string;
}

export interface StaffAnalytics {
  staffId: string;

  tasks: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    overdue: number;
    rows: StaffTaskRow[];
  };

  leads: {
    total: number;
    open: number;
    won: number;
    lost: number;
    /* Activities logged against their leads — calls, visits, notes. */
    activities: number;
  };

  listings: {
    /* Providers this member is recorded as having brought in. */
    referred: number;
    created: number;
    assisted: number;
    /* Of those, how many are still waiting for a decision. */
    pending: number;
  };

  portal: {
    sessionsTotal: number;
    sessions30d: number;
    sessions7d: number;
    minutesTotal: number;
    minutes30d: number;
    lastSeenAt: string | null;
    firstSeenAt: string | null;
  };

  /** Listings sitting unreviewed in the areas this member covers. */
  approvalsWaiting: number;
}

/** "a3f9c21e" from a uuid — enough to quote, short enough to read out. */
export const taskRef = (id: string): string =>
  id.replace(/-/g, "").slice(0, 8).toUpperCase();

const empty = (staffId: string): StaffAnalytics => ({
  staffId,
  tasks: { total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0, rows: [] },
  leads: { total: 0, open: 0, won: 0, lost: 0, activities: 0 },
  listings: { referred: 0, created: 0, assisted: 0, pending: 0 },
  portal: {
    sessionsTotal: 0,
    sessions30d: 0,
    sessions7d: 0,
    minutesTotal: 0,
    minutes30d: 0,
    lastSeenAt: null,
    firstSeenAt: null,
  },
  approvalsWaiting: 0,
});

/**
 * Everything about one member, in as few round trips as possible.
 *
 * Queries run in parallel and a failing one degrades to zero for that
 * section rather than failing the screen — a dashboard that shows four of
 * five panels is more useful than one that shows an error.
 */
export async function loadStaffAnalytics(staffId: string): Promise<StaffAnalytics> {
  if (!isSupabaseConfigured || !staffId) return empty(staffId);

  const nowIso = new Date().toISOString();

  const [tasksRes, leadsRes, activitiesRes, attributionsRes, sessionRes] =
    await Promise.all([
      supabase
        .from("staff_tasks")
        .select("id, title, status, priority, due_at, progress_note, created_at")
        .eq("staff_id", staffId)
        .order("created_at", { ascending: false }),

      supabase.from("staff_leads").select("id, status").eq("staff_id", staffId),

      supabase
        .from("staff_activities")
        .select("id", { count: "exact", head: true })
        .eq("staff_id", staffId),

      supabase
        .from("staff_attributions")
        .select("relation, listing_table, listing_id")
        .eq("staff_id", staffId),

      supabase
        .from("staff_session_summary")
        .select("*")
        .eq("staff_id", staffId)
        .maybeSingle(),
    ]);

  const out = empty(staffId);

  /* ---- tasks ---- */
  const taskRows = (tasksRes.data ?? []) as {
    id: string;
    title: string;
    status: string;
    priority: string | null;
    due_at: string | null;
    progress_note: string | null;
    created_at: string;
  }[];

  out.tasks.rows = taskRows.map((t) => ({
    id: t.id,
    ref: taskRef(t.id),
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueAt: t.due_at,
    progressNote: t.progress_note,
    createdAt: t.created_at,
  }));
  out.tasks.total = taskRows.length;
  out.tasks.todo = taskRows.filter((t) => t.status === "todo").length;
  out.tasks.inProgress = taskRows.filter((t) => t.status === "in_progress").length;
  out.tasks.done = taskRows.filter((t) => t.status === "done").length;
  /* Overdue counts only what is still open — a task finished late is not a
     problem waiting to be solved, and showing it as one is noise. */
  out.tasks.overdue = taskRows.filter(
    (t) => t.status !== "done" && t.due_at !== null && t.due_at < nowIso
  ).length;

  /* ---- leads ---- */
  const leadRows = (leadsRes.data ?? []) as { status: string }[];
  out.leads.total = leadRows.length;
  out.leads.won = leadRows.filter((l) => l.status === "won").length;
  out.leads.lost = leadRows.filter((l) => l.status === "lost").length;
  out.leads.open = leadRows.length - out.leads.won - out.leads.lost;
  out.leads.activities = activitiesRes.count ?? 0;

  /* ---- listings brought in ---- */
  const attributions = (attributionsRes.data ?? []) as {
    relation: string;
    listing_table: string;
    listing_id: string;
  }[];
  out.listings.referred = attributions.filter((a) => a.relation === "referred").length;
  out.listings.created = attributions.filter((a) => a.relation === "created").length;
  out.listings.assisted = attributions.filter((a) => a.relation === "assisted").length;

  /* ---- portal usage ---- */
  const s = sessionRes.data as {
    sessions_total?: number;
    sessions_30d?: number;
    sessions_7d?: number;
    minutes_total?: number;
    minutes_30d?: number;
    last_seen_at?: string | null;
    first_seen_at?: string | null;
  } | null;

  if (s) {
    out.portal = {
      sessionsTotal: s.sessions_total ?? 0,
      sessions30d: s.sessions_30d ?? 0,
      sessions7d: s.sessions_7d ?? 0,
      minutesTotal: s.minutes_total ?? 0,
      minutes30d: s.minutes_30d ?? 0,
      lastSeenAt: s.last_seen_at ?? null,
      firstSeenAt: s.first_seen_at ?? null,
    };
  }

  return out;
}

/**
 * How many listings are waiting for a decision that this member can see.
 *
 * Deliberately reuses the approvals reader rather than counting rows here:
 * phase111 already decides which rows a reviewer may read, scoped to their
 * areas, and a second count written against the same tables would drift from
 * what the Approvals screen actually shows.
 */
export async function countApprovalsWaiting(): Promise<number> {
  const { loadPendingApprovals } = await import("@/lib/approvals");
  return (await loadPendingApprovals()).length;
}

/** "9h 20m" from minutes. Hours first, because that is what gets compared. */
export function formatMinutes(total: number): string {
  if (total <= 0) return "0m";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
