import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Team management — client data layer.
 *
 * READS go through the anon key and are governed by the RLS in
 * phase104: an admin session sees every staff member, a staff
 * member sees only their own row, and everyone else sees nothing.
 *
 * WRITES do NOT happen here. Every change goes through
 * /api/admin/staff, which verifies the caller is an admin
 * server-side and writes an audit row.
 *
 * That is not a style preference. These rows decide who can review
 * a listing and where, and a write path in the browser is a write
 * path anyone can call from a console with the anon key.
 * ============================================================ */

export type StaffStatus = "active" | "suspended" | "disabled";

export const STAFF_STATUSES: StaffStatus[] = ["active", "suspended", "disabled"];

export const STATUS_HELP: Record<StaffStatus, string> = {
  active: "Can sign in to the team portal and use their permissions.",
  suspended:
    "Loses access immediately — status is checked on every request, so there is nothing to wait out. Their work and attribution are kept.",
  disabled:
    "Same as suspended. Use this for people who have left, so the list can tell the two apart.",
};

export interface DepartmentRow {
  id: string;
  slug: string;
  name: string;
  code_prefix: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
}

export interface RoleRow {
  id: string;
  slug: string;
  name: string;
  department_id: string | null;
  description: string | null;
  is_active: boolean;
  display_order: number;
}

export interface PermissionRow {
  id: string;
  slug: string;
  module: string;
  label: string;
  description: string | null;
}

export interface StaffMemberRow {
  id: string;
  profile_id: string;
  employee_code: string;
  referral_code: string;
  department_id: string;
  role_id: string;
  job_title: string | null;
  phone: string | null;
  status: StaffStatus;
  joined_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScopeRow {
  id: string;
  staff_id: string;
  location_id: string;
  includes_descendants: boolean;
}

export interface GrantRow {
  id: string;
  staff_id: string;
  permission_id: string;
  granted: boolean;
  note: string | null;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export async function getDepartments(): Promise<DepartmentRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("staff_departments")
    .select("*")
    .order("display_order");
  return (data as DepartmentRow[] | null) ?? [];
}

export async function getRoles(): Promise<RoleRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("staff_roles").select("*").order("display_order");
  return (data as RoleRow[] | null) ?? [];
}

export async function getPermissions(): Promise<PermissionRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("staff_permissions")
    .select("*")
    .order("module")
    .order("slug");
  return (data as PermissionRow[] | null) ?? [];
}

export async function getRolePermissions(): Promise<{ role_id: string; permission_id: string }[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from("staff_role_permissions").select("role_id, permission_id");
  return (data as { role_id: string; permission_id: string }[] | null) ?? [];
}

export async function getStaffMembers(): Promise<StaffMemberRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("staff_members")
    .select("*")
    .order("employee_code");
  return (data as StaffMemberRow[] | null) ?? [];
}

export async function getScopes(staffId: string): Promise<ScopeRow[]> {
  if (!isSupabaseConfigured || !staffId) return [];
  const { data } = await supabase.from("staff_scopes").select("*").eq("staff_id", staffId);
  return (data as ScopeRow[] | null) ?? [];
}

export async function getGrants(staffId: string): Promise<GrantRow[]> {
  if (!isSupabaseConfigured || !staffId) return [];
  const { data } = await supabase
    .from("staff_permission_grants")
    .select("*")
    .eq("staff_id", staffId);
  return (data as GrantRow[] | null) ?? [];
}

/**
 * The effective permission set for one member: role defaults, then overrides.
 *
 * Computed here for DISPLAY only. The database answers the same question in
 * staff_can(), and that is the one that decides anything. If these two ever
 * disagree, staff_can() is right — this is a screen, that is a gate.
 */
export function effectivePermissions(
  roleId: string,
  rolePerms: { role_id: string; permission_id: string }[],
  grants: GrantRow[]
): Set<string> {
  const out = new Set(
    rolePerms.filter((rp) => rp.role_id === roleId).map((rp) => rp.permission_id)
  );
  for (const g of grants) {
    if (g.granted) out.add(g.permission_id);
    else out.delete(g.permission_id);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Writes — all of them through the server                             */
/* ------------------------------------------------------------------ */

export interface StaffApiResult {
  ok: boolean;
  error?: string;
  id?: string;
  employeeCode?: string;
  referralCode?: string;
  /** True when the account did not exist and an invitation email was sent. */
  invited?: boolean;
  email?: string;
}

async function post(body: unknown): Promise<StaffApiResult> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: "Please sign in again." };

    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as StaffApiResult;
    if (!res.ok) {
      return { ok: false, error: json.error || `Server returned ${res.status}.` };
    }
    return json;
  } catch {
    return { ok: false, error: "Network error. Nothing was changed." };
  }
}

/**
 * Turn an existing REGO account into a staff member.
 *
 * WHY BY EMAIL, AND WHY THE ACCOUNT MUST ALREADY EXIST
 *   A staff member is a REGO account with a row in staff_members — not a
 *   second identity. Creating auth users from here would mean a second signup
 *   path, a second password flow and a second place for an email to be wrong.
 *   The person signs up the way everyone does, then Super Admin finds them.
 *
 *   An invite email is a reasonable thing to add later. It is not needed for
 *   the system to be correct, and inventing it now would be the third login
 *   route in a product with one.
 */
/**
 * Add a team member.
 *
 * If the email already has a Rego account they are attached to it. If it does
 * not, the server sends a Supabase invitation and the person sets their own
 * password — nobody ever types a password on someone else's behalf. Check
 * `invited` on the result to know which happened.
 */
export function addStaffMember(input: {
  email: string;
  /** Only used if the invitation creates the account. */
  fullName?: string;
  departmentId: string;
  roleId: string;
  jobTitle?: string;
  phone?: string;
  joinedAt?: string;
}): Promise<StaffApiResult> {
  return post({ action: "add_member", ...input });
}

export function updateStaffMember(
  staffId: string,
  patch: {
    departmentId?: string;
    roleId?: string;
    jobTitle?: string | null;
    phone?: string | null;
    status?: StaffStatus;
    joinedAt?: string | null;
  }
): Promise<StaffApiResult> {
  return post({ action: "update_member", staffId, ...patch });
}

/** Add or remove one location from a member's scope. */
export function setScope(
  staffId: string,
  locationId: string,
  included: boolean,
  includesDescendants = true
): Promise<StaffApiResult> {
  return post({ action: "set_scope", staffId, locationId, included, includesDescendants });
}

/**
 * Override one permission for one person.
 *
 * `granted` null clears the override and returns them to whatever their role
 * says — which is a different thing from setting it false, and the reason the
 * override table stores a boolean rather than a presence.
 */
export function setPermissionOverride(
  staffId: string,
  permissionId: string,
  granted: boolean | null,
  note?: string
): Promise<StaffApiResult> {
  return post({ action: "set_permission", staffId, permissionId, granted, note });
}
