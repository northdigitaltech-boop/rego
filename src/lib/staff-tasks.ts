import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Assigned work.
 *
 * READS AND STATUS UPDATES HAPPEN HERE, IN THE BROWSER.
 * ASSIGNING HAPPENS IN /api/admin/staff.
 *
 * That split is not stylistic. phase108 revokes the blanket update grant on
 * staff_tasks and re-grants only (status, progress_note), so Postgres itself
 * refuses `set due_date` or `set title` from a signed-in member — before any
 * policy is consulted. An assignee moves their work along; they cannot
 * quietly move a deadline they have missed.
 *
 * Assignment needs to write the columns that grant excludes, so it goes
 * through the service-role route, which also leaves an audit row.
 * ============================================================ */

export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export const TASK_PRIORITIES = ["low", "normal", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface StaffTask {
  id: string;
  staff_id: string;
  department_id: string;
  title: string;
  detail: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  progress_note: string | null;
  created_at: string;
  completed_at: string | null;
}

const COLUMNS =
  "id, staff_id, department_id, title, detail, priority, status, due_date, " +
  "progress_note, created_at, completed_at";

/** Everything RLS lets the caller see: their own, and their department's
 *  if their role carries view_tasks. Not filtered again here — two places
 *  deciding means one of them is wrong eventually, and only one is
 *  enforceable. */
export async function listTasks(): Promise<StaffTask[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("staff_tasks")
    .select(COLUMNS)
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error || !data) return [];
  return data as unknown as StaffTask[];
}

/**
 * The only write a member may make. `cancelled` is offered to admins
 * elsewhere and not here — deciding a task no longer needs doing is not the
 * assignee's call, and the database would refuse it anyway if the column
 * grant ever narrowed further.
 */
export async function updateTaskProgress(
  id: string,
  patch: { status?: TaskStatus; progress_note?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Not configured." };
  const { error } = await supabase.from("staff_tasks").update(patch).eq("id", id);
  if (error) {
    if (/permission denied|column/i.test(error.message)) {
      /* The column grant refused it. That is the design working, and it
         should read as a rule rather than as a fault. */
      return {
        ok: false,
        error:
          "You can change the status and add a note. Anything else about the task is set by whoever assigned it.",
      };
    }
    if (/row-level security/i.test(error.message)) {
      return { ok: false, error: "That task is not yours." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Overdue, and still worth doing. A finished task is not late. */
export function isOverdue(task: StaffTask): boolean {
  if (!task.due_date) return false;
  if (task.status === "done" || task.status === "cancelled") return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}
