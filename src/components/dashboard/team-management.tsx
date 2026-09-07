"use client";

import * as React from "react";
import {
  Loader2,
  Search,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
  Users,
} from "lucide-react";

import {
  STAFF_STATUSES,
  STATUS_HELP,
  addStaffMember,
  effectivePermissions,
  getDepartments,
  getGrants,
  getPermissions,
  getRolePermissions,
  getRoles,
  getScopes,
  getStaffMembers,
  setPermissionOverride,
  setRolePermission,
  assignTask,
  removeStaffMember,
  resendStaffInvite,
  setScope,
  updateStaffMember,
  type DepartmentRow,
  type GrantRow,
  type PermissionRow,
  type RoleRow,
  type ScopeRow,
  type StaffMemberRow,
  type StaffStatus,
} from "@/lib/staff";
import { getLocations, getMarkets, type LocationRow } from "@/lib/markets";
import { StaffThread } from "@/components/portal/staff-thread";
import { useAuth } from "@/components/auth/auth-context";
import { unreadByStaff } from "@/lib/staff-messages";
import { cn } from "@/lib/utils";

/* ============================================================
 * Team Management.
 *
 * The screen deliberately shows what a member CAN do rather than
 * which switches are on: a role grants a set, an override changes
 * it in either direction, and the useful question is always the
 * result. Reading two lists and doing the arithmetic in your head
 * is how someone ends up believing a permission is off when it is
 * on.
 *
 * Nothing here is authorisation. Every write goes to
 * /api/admin/staff, which re-checks the caller server-side.
 * ============================================================ */

type Tab = "members" | "add" | "roles";

export function TeamManagement() {
  const [tab, setTab] = React.useState<Tab>("members");

  const [departments, setDepartments] = React.useState<DepartmentRow[]>([]);
  const [roles, setRoles] = React.useState<RoleRow[]>([]);
  const [permissions, setPermissions] = React.useState<PermissionRow[]>([]);
  const [rolePerms, setRolePerms] = React.useState<{ role_id: string; permission_id: string }[]>([]);
  const [members, setMembers] = React.useState<StaffMemberRow[]>([]);
  const [emails, setEmails] = React.useState<Record<string, string>>({});
  const [locations, setLocations] = React.useState<LocationRow[]>([]);
  /* Unread messages per member. Without this the admin side of the thread was
     a screen nobody would ever open: a member could write and be met with
     silence, because finding the message meant guessing which of five people
     had sent one. */
  const [unread, setUnread] = React.useState<Record<string, number>>({});

  const [loading, setLoading] = React.useState(true);
  const [notReady, setNotReady] = React.useState(false);
  const [error, setError] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [d, r, p, rp, m] = await Promise.all([
        getDepartments(),
        getRoles(),
        getPermissions(),
        getRolePermissions(),
        getStaffMembers(),
      ]);
      /* No departments means phase104 has not been run. That is a setup
         state, not a failure — say which file rather than showing an
         empty screen. */
      if (d.length === 0) {
        setNotReady(true);
        return;
      }
      setDepartments(d);
      setRoles(r);
      setPermissions(p);
      setRolePerms(rp);
      setMembers(m);

      setUnread(await unreadByStaff());

      const mk = await getMarkets();
      if (mk.length > 0) setLocations(await getLocations(mk[0].id));
    } catch {
      setError("Could not load the team.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  /* Emails come from profiles, which an admin session can read. Fetched
     separately because staff_members deliberately does not copy them —
     one place for an address to be right. */
  React.useEffect(() => {
    if (members.length === 0) return;
    let alive = true;
    (async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", members.map((m) => m.profile_id));
      if (!alive) return;
      const map: Record<string, string> = {};
      for (const row of (data as { id: string; email: string | null; full_name: string | null }[] | null) ?? []) {
        map[row.id] = row.full_name || row.email || "";
      }
      setEmails(map);
    })();
    return () => {
      alive = false;
    };
  }, [members]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the team…
      </div>
    );
  }

  if (notReady) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-10 text-center">
        <Users className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-3 font-semibold text-forest">Team management is not set up yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Run <code className="rounded bg-muted px-1">phase104-staff-foundation.sql</code> in
          Supabase. It creates the departments, roles and permissions this screen reads,
          and adds nobody.
        </p>
      </div>
    );
  }

  const selected = members.find((m) => m.id === selectedId) ?? null;

  const shown = members.filter((m) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      m.employee_code.toLowerCase().includes(q) ||
      (emails[m.profile_id] ?? "").toLowerCase().includes(q) ||
      (m.job_title ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([
          [
            "members",
            (() => {
              const waiting = Object.values(unread).reduce((a, b) => a + b, 0);
              return waiting > 0
                ? `Team members (${members.length}) · ${waiting} unread`
                : `Team members (${members.length})`;
            })(),
          ],
          ["add", "Add a member"],
          ["roles", `Roles (${roles.length})`],
        ] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
              tab === id
                ? "bg-forest text-white"
                : "border border-border text-forest hover:bg-muted/60"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {tab === "add" && (
        <AddMember
          departments={departments}
          roles={roles}
          onAdded={async () => {
            await load();
            setTab("members");
          }}
        />
      )}

      {tab === "roles" && (
        <RolePermissions
          roles={roles}
          departments={departments}
          permissions={permissions}
          rolePerms={rolePerms}
          members={members}
          onChanged={load}
          onError={setError}
        />
      )}

      {tab === "members" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
          <div className="rounded-2xl border border-border bg-card p-2">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by code, name or title…"
                className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm"
              />
            </div>

            {members.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Nobody on the team yet. Add someone who already has a REGO account.
              </p>
            ) : shown.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No one matches “{query}”.
              </p>
            ) : (
              shown.map((m) => {
                const dept = departments.find((d) => d.id === m.department_id);
                const role = roles.find((r) => r.id === m.role_id);
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left",
                      selectedId === m.id ? "bg-forest-50" : "hover:bg-muted/60"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-forest">
                        {emails[m.profile_id] || "—"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.employee_code} · {dept?.name ?? "—"} · {role?.name ?? "—"}
                      </span>
                    </span>
                    {/* Unread first: an unanswered message is more urgent
                        than a status somebody already knows. */}
                    {(unread[m.id] ?? 0) > 0 && (
                      <span
                        title={`${unread[m.id]} unread message${unread[m.id] === 1 ? "" : "s"}`}
                        className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white"
                      >
                        {unread[m.id]}
                      </span>
                    )}
                    <StatusBadge status={m.status} />
                  </button>
                );
              })
            )}
          </div>

          <div>
            {selected ? (
              <MemberDetail
                key={selected.id}
                member={selected}
                who={emails[selected.profile_id] ?? ""}
                departments={departments}
                roles={roles}
                permissions={permissions}
                rolePerms={rolePerms}
                locations={locations}
                onChanged={load}
                onError={setError}
                unreadForMember={unread[selected.id] ?? 0}
                onRemoved={async () => {
                  /* Clear the selection first: the row this panel is drawn
                     from no longer exists. */
                  setSelectedId(null);
                  await load();
                }}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center text-sm text-muted-foreground">
                Choose someone to see their role, permissions and areas.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: StaffStatus }) {
  const tone =
    status === "active"
      ? "bg-forest-50 text-forest-600"
      : status === "suspended"
      ? "bg-amber-100 text-amber-800"
      : "bg-muted text-muted-foreground";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", tone)}>
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */

function AddMember({
  departments,
  roles,
  onAdded,
}: {
  departments: DepartmentRow[];
  roles: RoleRow[];
  onAdded: () => void;
}) {
  const [email, setEmail] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState("");
  const [roleId, setRoleId] = React.useState("");
  const [jobTitle, setJobTitle] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<{ ok: boolean; text: string } | null>(null);

  /* Roles for the chosen department, plus any that cross departments. */
  const available = roles.filter(
    (r) => !r.department_id || r.department_id === departmentId
  );

  const submit = async () => {
    setNote(null);
    if (!email.trim()) return setNote({ ok: false, text: "Enter their email address." });
    if (!departmentId) return setNote({ ok: false, text: "Choose a department." });
    if (!roleId) return setNote({ ok: false, text: "Choose a role." });

    setBusy(true);
    const res = await addStaffMember({
      email: email.trim(),
      fullName: fullName.trim() || undefined,
      departmentId,
      roleId,
      jobTitle: jobTitle.trim() || undefined,
      phone: phone.trim() || undefined,
    });
    setBusy(false);

    if (!res.ok) return setNote({ ok: false, text: res.error ?? "Could not add them." });

    /* Three outcomes, and the difference matters. Added to an existing
       account: nothing to wait for. Invited: somebody has an email to open.
       Invited but the mail failed: they are on the team and cannot sign in,
       which is the one an admin must not walk away from. */
    if (res.inviteEmailFailed) {
      setNote({
        ok: false,
        text: `${email.trim()} was added as ${res.employeeCode}, but the invitation email did not send${
          res.warning ? ` (${res.warning})` : ""
        }. They cannot sign in until it does — fix the email settings, then send them a password reset from the sign-in page.`,
      });
    } else {
      setNote({
        ok: true,
        text: res.invited
          ? `Invitation sent to ${email.trim()}. They are ${res.employeeCode}, referral code ${res.referralCode} — they can use the portal once they open the email and choose a password.`
          : `Added as ${res.employeeCode}. Their referral code is ${res.referralCode}.`,
      });
    }
    setEmail("");
    setFullName("");
    setJobTitle("");
    setPhone("");
    onAdded();
  };

  return (
    <div className="max-w-xl space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <p className="flex items-center gap-2 font-display text-lg font-bold text-forest">
          <UserPlus className="h-5 w-5" /> Add a team member
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          If they already have a Rego account, they are added straight away. If they
          do not, we email them an invitation and they set their own password — so
          nobody types a password for somebody else.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Their email" required>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="name@example.com"
            className="auth-input"
          />
        </Field>
        {/* Only used when the invitation creates the account — an existing
            profile keeps the name its owner chose. */}
        <Field label="Their name">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="auth-input"
            placeholder="Used only if we create the account"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Department" required>
          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setRoleId("");
            }}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">Choose…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code_prefix})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Role" required>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            disabled={!departmentId}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">{departmentId ? "Choose…" : "Pick a department first"}</option>
            {available.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Job title">
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="auth-input" />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="auth-input" inputMode="tel" />
        </Field>
      </div>

      <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Their employee code and referral code are generated by the server and cannot be
        changed afterwards. Attribution points at the code, so changing it later would
        silently re-attribute their work.
      </p>

      {note && (
        <p
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            note.ok ? "bg-forest-50 text-forest-700" : "bg-red-50 text-red-700"
          )}
        >
          {note.text}
        </p>
      )}

      <button
        onClick={submit}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Add to the team
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------
 * What each ROLE carries.
 *
 * The member screen answers "what can this person do". This answers "what
 * does this job mean", which is the question that stops an admin ticking
 * eight boxes for every new hire and eventually missing one.
 *
 * Two things it says out loud, because both surprise people:
 *   - a change reaches everyone in the role on their next request
 *   - somebody with a personal override keeps it, in either direction
 * ------------------------------------------------------------------ */
function RolePermissions({
  roles,
  departments,
  permissions,
  rolePerms,
  members,
  onChanged,
  onError,
}: {
  roles: RoleRow[];
  departments: DepartmentRow[];
  permissions: PermissionRow[];
  rolePerms: { role_id: string; permission_id: string }[];
  members: StaffMemberRow[];
  onChanged: () => Promise<void>;
  onError: (s: string) => void;
}) {
  const [roleId, setRoleId] = React.useState(roles[0]?.id ?? "");
  const [busy, setBusy] = React.useState("");
  const [note, setNote] = React.useState("");

  const role = roles.find((r) => r.id === roleId) ?? null;
  const dept = departments.find((d) => d.id === role?.department_id) ?? null;

  const held = React.useMemo(
    () => new Set(rolePerms.filter((rp) => rp.role_id === roleId).map((rp) => rp.permission_id)),
    [rolePerms, roleId]
  );

  const inRole = members.filter((m) => m.role_id === roleId && m.status === "active");

  const byModule = React.useMemo(() => {
    const map = new Map<string, PermissionRow[]>();
    for (const p of permissions) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  const toggle = async (p: PermissionRow) => {
    const next = !held.has(p.id);
    setBusy(p.id);
    setNote("");
    const res = await setRolePermission(roleId, p.id, next);
    setBusy("");
    if (!res.ok) {
      onError(res.error ?? "That did not save.");
      return;
    }
    const n = res.affected ?? 0;
    setNote(
      `${next ? "Added" : "Removed"} “${p.label}”. ${
        n === 0
          ? "Nobody holds this role yet."
          : `${n} active member${n === 1 ? "" : "s"} affected, from their next request.`
      }`
    );
    await onChanged();
  };

  if (roles.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
        No roles yet. Run phase104-staff-foundation.sql.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(220px,280px)_1fr]">
      <div className="rounded-2xl border border-border bg-card p-2">
        {roles.map((r) => {
          const d = departments.find((x) => x.id === r.department_id);
          const count = members.filter((m) => m.role_id === r.id && m.status === "active").length;
          return (
            <button
              key={r.id}
              onClick={() => {
                setRoleId(r.id);
                setNote("");
              }}
              className={cn(
                "block w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                roleId === r.id ? "bg-forest-50" : "hover:bg-muted/60"
              )}
            >
              <span className="block font-semibold text-forest">{r.name}</span>
              <span className="block text-xs text-muted-foreground">
                {d?.name ?? "All departments"} ·{" "}
                {count === 0 ? "nobody yet" : `${count} member${count === 1 ? "" : "s"}`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-display text-lg font-bold text-forest">{role?.name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {dept?.name ?? "Crosses departments"}
          </p>

          <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Changing this changes it for{" "}
              <strong>
                {inRole.length === 0
                  ? "nobody yet"
                  : `all ${inRole.length} active member${inRole.length === 1 ? "" : "s"}`}
              </strong>{" "}
              in the role, from their next request. Anyone with a personal
              override keeps it — added or removed — because that is what an
              override is for.
            </span>
          </p>

          {note && (
            <p className="mt-3 rounded-lg bg-forest-50 px-3 py-2 text-xs text-forest-700">
              {note}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 font-semibold text-forest">
            <ShieldCheck className="h-4 w-4" /> What this role carries
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Super Admin&apos;s own authority is not on this list — deleting,
            approving verification, badges, payment settings and permission
            changes have no permission to grant. That is why they cannot be
            given to a role by mistake.
          </p>

          <div className="mt-4 space-y-4">
            {byModule.map(([module, list]) => (
              <div key={module}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {module.replace(/_/g, " ")}
                </p>
                <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
                  {list.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={held.has(p.id)}
                        disabled={busy === p.id}
                        onChange={() => toggle(p)}
                        className="mt-0.5 h-4 w-4 rounded border-border accent-forest-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block">{p.label}</span>
                        {p.description && (
                          <span className="block text-[11px] text-muted-foreground">
                            {p.description}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
 * The admin side of the thread.
 *
 * Collapsed by default: an admin scanning a member's permissions does not
 * want a conversation in the way, and opening it is one click.
 * ------------------------------------------------------------------ */
function MessagePanel({
  member,
  who,
  unread,
}: {
  member: StaffMemberRow;
  who: string;
  unread: number;
}) {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);

  if (!open) {
    return (
      <div className="mt-4 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-semibold text-forest hover:underline"
        >
          Message {who || member.employee_code}
        </button>
        {unread > 0 && (
          <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
            {unread} unread
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold text-forest">
          Messages with {who || member.employee_code}
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted-foreground hover:text-forest"
        >
          Close
        </button>
      </div>
      <StaffThread
        staffId={member.id}
        /* Signed as the admin who typed it, not as "Rego" — a correction is
           easier to take from a person than from an institution. */
        senderName={user?.name ?? "Rego"}
        fromAdmin
        emptyLine="Nothing yet. Anything written here is seen only by this person and by admins."
      />
    </div>
  );
}

/* ------------------------------------------------------------------
 * Assigning work.
 *
 * The title and the due date can only be set from here — phase108 lets the
 * assignee change the status and a note and nothing else, so a deadline
 * cannot be quietly moved by whoever missed it.
 * ------------------------------------------------------------------ */
function AssignTask({
  member,
  onError,
}: {
  member: StaffMemberRow;
  onError: (s: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [detail, setDetail] = React.useState("");
  const [priority, setPriority] = React.useState<"low" | "normal" | "high">("normal");
  const [dueDate, setDueDate] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState("");

  const submit = async () => {
    if (!title.trim()) {
      onError("Give the task a title.");
      return;
    }
    setBusy(true);
    const res = await assignTask({
      staffId: member.id,
      title,
      detail: detail.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      onError(res.error ?? "Could not assign that.");
      return;
    }
    setSent(title.trim());
    setTitle("");
    setDetail("");
    setDueDate("");
  };

  if (!open) {
    return (
      <div className="mt-4 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-semibold text-forest hover:underline"
        >
          Assign a task
        </button>
        {sent && (
          <p className="mt-1 text-xs text-muted-foreground">
            Assigned “{sent}”. It is in their portal now.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border bg-background p-4">
      <p className="text-sm font-semibold text-forest">
        Assign a task to {member.employee_code}
      </p>

      <Field label="What needs doing" required>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="auth-input"
          placeholder="e.g. Visit three hotels in Skardu"
          autoFocus
        />
      </Field>

      <Field label="Detail">
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={2}
          className="auth-input"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Priority">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as "low" | "normal" | "high")}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </Field>
        <Field label="Due">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Assigning…" : "Assign"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-forest"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
 * Removing somebody.
 *
 * Two clicks, because one click that deletes is a click somebody makes by
 * accident. The second click is also where the consequence is stated — a
 * warning nobody has to read before acting is decoration.
 * ------------------------------------------------------------------ */
function RemoveMember({
  member,
  onRemoved,
  onError,
}: {
  member: StaffMemberRow;
  onRemoved: () => Promise<void>;
  onError: (s: string) => void;
}) {
  const [arming, setArming] = React.useState(false);
  const [alsoAccount, setAlsoAccount] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const remove = async () => {
    setBusy(true);
    const res = await removeStaffMember(member.id, { deleteAccount: alsoAccount });
    setBusy(false);

    if (!res.ok) {
      setArming(false);
      onError(res.error ?? "Could not remove them.");
      return;
    }
    /* A warning here means it partly worked — the staff row went, the
       account did not. Shown in the same place as an error, because it is
       the thing the admin still has to decide about. */
    if (res.warning) onError(res.warning);
    await onRemoved();
  };

  if (!arming) {
    return (
      <div className="mt-4 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setArming(true)}
          className="text-sm font-semibold text-red-600 hover:underline"
        >
          Remove from the team
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-red-200 bg-red-50/60 p-4">
      <p className="text-sm font-semibold text-red-700">
        Remove {member.employee_code} from the team?
      </p>
      <p className="text-xs leading-relaxed text-red-700/90">
        Their role, permissions and areas are deleted. Their Rego account is
        kept, so anything they booked as a customer stays with them. If any
        provider is credited to them, the database will refuse this — disable
        them instead, so the record of who brought those in survives.
      </p>

      <label className="flex items-start gap-2 text-xs text-red-700/90">
        <input
          type="checkbox"
          checked={alsoAccount}
          onChange={(e) => setAlsoAccount(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Delete the Rego account too. Only happens if nobody has ever signed
          into it — an invited account that was never used. If it has been
          used, it is kept and you will be told.
        </span>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Removing…" : "Yes, remove"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setArming(false)}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-forest"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function MemberDetail({
  member,
  who,
  departments,
  roles,
  permissions,
  rolePerms,
  locations,
  onChanged,
  onError,
  onRemoved,
  unreadForMember,
}: {
  member: StaffMemberRow;
  who: string;
  departments: DepartmentRow[];
  roles: RoleRow[];
  permissions: PermissionRow[];
  rolePerms: { role_id: string; permission_id: string }[];
  locations: LocationRow[];
  onChanged: () => Promise<void>;
  onError: (s: string) => void;
  onRemoved: () => Promise<void>;
  unreadForMember: number;
}) {
  const [grants, setGrants] = React.useState<GrantRow[]>([]);
  const [scopes, setScopes] = React.useState<ScopeRow[]>([]);
  const [busy, setBusy] = React.useState("");

  const reload = React.useCallback(async () => {
    const [g, s] = await Promise.all([getGrants(member.id), getScopes(member.id)]);
    setGrants(g);
    setScopes(s);
  }, [member.id]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const dept = departments.find((d) => d.id === member.department_id);
  const role = roles.find((r) => r.id === member.role_id);
  const effective = effectivePermissions(member.role_id, rolePerms, grants);
  const roleSet = new Set(
    rolePerms.filter((rp) => rp.role_id === member.role_id).map((rp) => rp.permission_id)
  );

  const byModule = permissions.reduce<Record<string, PermissionRow[]>>((acc, p) => {
    (acc[p.module] ??= []).push(p);
    return acc;
  }, {});

  const [sentTo, setSentTo] = React.useState("");
  /* The mail server's own words, kept so "it says sent but never arrived"
     comes with a queue id the host can trace. */
  const [smtp, setSmtp] = React.useState("");

  const act = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(key);
    const res = await fn();
    setBusy("");
    if (!res.ok) onError(res.error ?? "That did not save.");
    else {
      await reload();
      await onChanged();
    }
  };

  /* Districts and above. Scoping someone to a single attraction is possible
     and almost never what is meant. */
  const scopable = locations.filter((l) =>
    ["country", "region", "division", "district"].includes(l.location_type)
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-bold text-forest">{who || "—"}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {member.employee_code} · {dept?.name} · {role?.name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Referral code <code className="rounded bg-muted px-1">{member.referral_code}</code>
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-forest">Status</label>
            <select
              value={member.status}
              disabled={busy === "status"}
              onChange={(e) =>
                act("status", () =>
                  updateStaffMember(member.id, { status: e.target.value as StaffStatus })
                )
              }
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              {STAFF_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {STATUS_HELP[member.status]}
        </p>

        {/* If the first invitation never arrived, this is the only way back to
            them: they are already on the team, so adding them again is
            correctly refused as a duplicate. */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy === "invite" || member.status !== "active"}
            onClick={() =>
              act("invite", async () => {
                const res = await resendStaffInvite(member.id);
                if (res.ok) {
                  setSentTo(res.email ?? who);
                  setSmtp(res.smtpResponse ?? "");
                }
                return res;
              })
            }
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-forest disabled:opacity-50"
          >
            {busy === "invite" ? "Sending…" : "Send sign-in link"}
          </button>
          <span className="text-xs text-muted-foreground">
            {sentTo
              ? `Sent to ${sentTo}. It works once and expires.${
                  smtp ? ` Mail server said: ${smtp}` : ""
                }`
              : "Emails them a link to set their password. Goes to the address on their profile."}
          </span>
        </div>

        <MessagePanel member={member} who={who} unread={unreadForMember} />

        <AssignTask member={member} onError={onError} />

        <RemoveMember member={member} onRemoved={onRemoved} onError={onError} />
      </div>

      {/* ---- scope ---- */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="font-semibold text-forest">Where they work</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Scope goes down, never up. Someone scoped to Skardu covers everything inside it
          and nothing beside it. <strong>No area selected means no area access</strong> —
          for all of Pakistan, tick Pakistan.
        </p>

        {scopable.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No locations loaded. Run the market migrations first.
          </p>
        ) : (
          <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
            {scopable.map((l) => {
              const on = scopes.some((s) => s.location_id === l.id);
              return (
                <label
                  key={l.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    on ? "bg-forest-50 text-forest-600" : "hover:bg-muted/60"
                  )}
                  style={{ paddingLeft: `${0.5 + l.depth * 0.75}rem` }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={busy === `scope:${l.id}`}
                    onChange={() =>
                      act(`scope:${l.id}`, () => setScope(member.id, l.id, !on))
                    }
                    className="h-4 w-4 rounded border-border accent-forest-600"
                  />
                  <span className="flex-1 truncate">{l.name}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {l.location_type}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- permissions ---- */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="flex items-center gap-2 font-semibold text-forest">
          <ShieldCheck className="h-4 w-4" /> What they can do
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Ticked is what they can actually do. A tick that differs from the role is an
          override, marked below it.
        </p>

        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Deletion, verification approval, badges, bans and payment settings are not on
            this list and cannot be granted from it. They belong to Super Admin and have
            no permission to hand out.
          </span>
        </p>

        <div className="mt-4 space-y-4">
          {Object.entries(byModule).map(([module, perms]) => (
            <div key={module}>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {module}
              </p>
              <div className="space-y-1">
                {perms.map((p) => {
                  const on = effective.has(p.id);
                  const fromRole = roleSet.has(p.id);
                  const override = grants.find((g) => g.permission_id === p.id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={busy === `perm:${p.id}`}
                        onChange={() =>
                          act(`perm:${p.id}`, () =>
                            /* Setting it back to what the role says clears the
                               override rather than storing a redundant one. */
                            setPermissionOverride(
                              member.id,
                              p.id,
                              !on === fromRole ? null : !on
                            )
                          )
                        }
                        className="h-4 w-4 rounded border-border accent-forest-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{p.label}</span>
                        {override && (
                          <span className="block text-[11px] text-amber-700">
                            {override.granted ? "Added for this person" : "Removed for this person"}
                            {" — the role says "}
                            {fromRole ? "yes" : "no"}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
    </label>
  );
}
