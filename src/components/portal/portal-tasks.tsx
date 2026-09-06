"use client";

import * as React from "react";
import { Loader2, CalendarClock, Flag } from "lucide-react";

import { cn } from "@/lib/utils";
import { can, type StaffProfile } from "@/lib/staff-portal";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  isOverdue,
  listTasks,
  updateTaskProgress,
  type StaffTask,
  type TaskStatus,
} from "@/lib/staff-tasks";

/* ============================================================
 * Tasks assigned to this person.
 *
 * They may change the status and add a note. Everything else —
 * title, detail, due date, who it belongs to — is refused by
 * Postgres itself (phase108 narrows the update grant to two
 * columns), so this screen offers no control for any of it.
 *
 * That is the rule this file follows throughout: do not draw a
 * control the database will refuse. A disabled field explains
 * nothing; an absent one raises no question.
 * ============================================================ */

const STATUS_STYLE: Record<TaskStatus, string> = {
  todo: "bg-muted text-forest",
  in_progress: "bg-blue-50 text-blue-700",
  blocked: "bg-red-50 text-red-700",
  done: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-muted text-muted-foreground",
};

/* An assignee moves between these four. Cancelling is a decision by whoever
   asked for the work, not by whoever was asked to do it. */
const OWN_STATUSES: TaskStatus[] = TASK_STATUSES.filter((s) => s !== "cancelled");

export function PortalTasks({ profile }: { profile: StaffProfile }) {
  const [tasks, setTasks] = React.useState<StaffTask[] | null>(null);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setTasks(await listTasks());
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (!can(profile, "view_tasks") && !can(profile, "update_own_tasks")) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold text-forest">Tasks</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your role does not include tasks. If that is wrong, ask an admin —
          the database decides this, not this screen.
        </p>
      </section>
    );
  }

  const open = (tasks ?? []).filter(
    (t) => t.status !== "done" && t.status !== "cancelled"
  );
  const closed = (tasks ?? []).filter(
    (t) => t.status === "done" || t.status === "cancelled"
  );

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold text-forest">Tasks</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Work assigned to you. You can move a task along and add a note —
          the title, the detail and the date belong to whoever assigned it.
        </p>
      </section>

      {tasks === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          Nothing assigned to you yet.
        </p>
      ) : (
        <>
          {open.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              profile={profile}
              onChanged={load}
              onError={setError}
            />
          ))}

          {closed.length > 0 && (
            <details className="rounded-2xl border border-border bg-card p-5">
              <summary className="cursor-pointer text-sm font-semibold text-forest">
                Finished and cancelled ({closed.length})
              </summary>
              <div className="mt-3 space-y-3">
                {closed.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    profile={profile}
                    onChanged={load}
                    onError={setError}
                  />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TaskCard({
  task,
  profile,
  onChanged,
  onError,
}: {
  task: StaffTask;
  profile: StaffProfile;
  onChanged: () => Promise<void>;
  onError: (s: string) => void;
}) {
  const [note, setNote] = React.useState(task.progress_note ?? "");
  const [busy, setBusy] = React.useState(false);

  const mine = task.staff_id === profile.staff_id;
  const mayUpdate = mine && can(profile, "update_own_tasks");
  const late = isOverdue(task);

  const save = async (patch: { status?: TaskStatus; progress_note?: string | null }) => {
    setBusy(true);
    const res = await updateTaskProgress(task.id, patch);
    setBusy(false);
    if (!res.ok) onError(res.error ?? "Could not save that.");
    else await onChanged();
  };

  return (
    <section
      className={cn(
        "rounded-2xl border bg-card p-5",
        late ? "border-red-200" : "border-border"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-forest">{task.title}</p>
          {task.detail && (
            <p className="mt-1 text-sm text-muted-foreground">{task.detail}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            {task.priority === "high" && (
              <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                <Flag className="h-3 w-3" /> High priority
              </span>
            )}
            {task.due_date && (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  late ? "font-semibold text-red-600" : "text-muted-foreground"
                )}
              >
                <CalendarClock className="h-3 w-3" />
                {late ? "Overdue: " : "Due "}
                {new Date(task.due_date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
            {!mine && (
              <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
                Colleague&apos;s task
              </span>
            )}
          </div>
        </div>

        {mayUpdate ? (
          <select
            value={task.status}
            disabled={busy}
            onChange={(e) => save({ status: e.target.value as TaskStatus })}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            {/* A cancelled task keeps its own option so the dropdown does not
                silently show the wrong value; it just is not a choice. */}
            {(task.status === "cancelled"
              ? TASK_STATUSES
              : OWN_STATUSES
            ).map((s) => (
              <option key={s} value={s} disabled={s === "cancelled"}>
                {TASK_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        ) : (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              STATUS_STYLE[task.status]
            )}
          >
            {TASK_STATUS_LABEL[task.status]}
          </span>
        )}
      </div>

      {mayUpdate && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="min-w-[14rem] flex-1">
            <span className="mb-1 block text-xs font-semibold text-forest">
              Your note
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Where you have got to"
              className="auth-input"
            />
          </label>
          <button
            type="button"
            disabled={busy || note === (task.progress_note ?? "")}
            onClick={() => save({ progress_note: note.trim() || null })}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-forest disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save note"}
          </button>
        </div>
      )}

      {!mayUpdate && task.progress_note && (
        <p className="mt-3 rounded-xl bg-muted/50 p-3 text-sm text-forest">
          {task.progress_note}
        </p>
      )}

      {task.completed_at && (
        <p className="mt-3 text-xs text-muted-foreground">
          Finished{" "}
          {new Date(task.completed_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      )}
    </section>
  );
}
