import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

import { clientIp } from "@/lib/rate-limit";
import { limitAndLog } from "@/lib/rate-limit-guard";
import { enforceIpBlock } from "@/lib/ip-block";

/* ============================================================
 * Team management — the only write path.
 *
 * Deliberately the same shape as /api/admin/markets: service-role
 * client, caller's role read from the DATABASE rather than the
 * request, every change audited.
 *
 * ---------------------------------------------------------------------------
 * WHY EVERY WRITE IS HERE AND NONE IN THE BROWSER
 *
 * These rows decide who may review a listing, in which districts, and whether
 * a suspended person still has access. The browser holds the anon key, so a
 * client-side write path is a write path anyone can call from a console. RLS
 * would still refuse them — staff_*_admin_write requires is_admin() — but
 * defence in depth is cheap here and the audit row is not optional.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS ROUTE REFUSES TO DO
 *
 * It cannot grant a permission that does not exist, cannot make someone an
 * admin, and cannot create an auth user. The first two are the whole point of
 * phase104; the third is because a second signup path is a second place for
 * an email to be wrong.
 * ============================================================ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function sameOrigin(req: Request): boolean {
  const host = req.headers.get("host");
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!host || !origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Hashed, never stored raw — an audit trail should not become a log of IPs. */
function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

const STATUSES = new Set(["active", "suspended", "disabled"]);

export async function POST(req: Request) {
  const blocked = await enforceIpBlock(req);
  if (blocked) return blocked;

  if (!sameOrigin(req)) return bad("Forbidden", 403);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return bad("Team management is not configured on this server.", 500);
  }

  /* Same caveat as the markets route: rateLimit() is in-memory and therefore
     per Vercel instance. It slows one runaway client; it is not a fleet-wide
     cap. Written down so nobody reads it as a guarantee. */
  const ip = clientIp(req);
  const limited = limitAndLog(req, `staff-admin:${ip}`, 40, 60_000, {
    endpoint: "/api/admin/staff",
    category: "admin",
  });
  if (!limited.ok) return bad("Too many changes in a short time. Wait a minute.", 429);

  /* ---- authenticate ---- */
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) return bad("Sign in required.", 401);

  const sb = adminClient();
  const { data: caller, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !caller?.user) return bad("Session expired. Sign in again.", 401);

  /* ---- authorise: the role comes from the database, never the request ---- */
  const { data: profile } = await sb
    .from("profiles")
    .select("role, email")
    .eq("id", caller.user.id)
    .maybeSingle();

  const role = (profile as { role?: string } | null)?.role;
  if (role !== "admin") return bad("Admins only.", 403);

  const actorEmail =
    (profile as { email?: string } | null)?.email ?? caller.user.email ?? null;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("Malformed request.");
  }

  const action = String(body.action ?? "");
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  /* Reuses market_audit_logs rather than starting a fourth audit shape. Its
     columns are generic — actor, action, entity, before, after — and one
     searchable history of admin actions beats three partial ones. */
  const audit = async (entry: {
    action: string;
    entityId?: string | null;
    entityLabel?: string | null;
    before?: unknown;
    after?: unknown;
  }) => {
    try {
      await sb.from("market_audit_logs").insert({
        actor_id: caller.user.id,
        actor_email: actorEmail,
        action: entry.action,
        entity_type: "staff",
        entity_id: entry.entityId ?? null,
        entity_label: entry.entityLabel ?? null,
        before_value: entry.before ?? null,
        after_value: entry.after ?? null,
        request_id: requestId,
        ip_hash: ip ? hashIp(ip) : null,
      });
    } catch {
      /* An audit failure must not roll back a change the admin already saw
         succeed. It is a gap in the history, not an error on the screen. */
    }
  };

  switch (action) {
    /* ================================================================
     * Turn an existing REGO account into a staff member.
     * ================================================================ */
    case "add_member": {
      const email = String(body.email ?? "").trim().toLowerCase();
      const departmentId = String(body.departmentId ?? "");
      const roleId = String(body.roleId ?? "");

      if (!email) return bad("Email is required.");
      if (!departmentId) return bad("Choose a department.");
      if (!roleId) return bad("Choose a role.");

      /* The account must already exist. Creating auth users here would be a
         second signup path — a second password flow and a second place for an
         email to be typed wrong. They sign up the way everyone does. */
      const { data: person } = await sb
        .from("profiles")
        .select("id, email, role")
        .ilike("email", email)
        .maybeSingle();

      if (!person) {
        return bad(
          `No REGO account for ${email}. Ask them to sign up first, then add them here.`,
          404
        );
      }

      const p = person as { id: string; email: string | null; role: string | null };

      /* An admin is Super Admin. Making them staff as well would give one
         person two authorisation paths and make "who approved this" ambiguous
         in the audit trail. */
      if (p.role === "admin") {
        return bad(
          "That account is an admin. Super Admin is a separate authority from staff — a person should be one or the other."
        );
      }

      const { data: already } = await sb
        .from("staff_members")
        .select("id, employee_code")
        .eq("profile_id", p.id)
        .maybeSingle();

      if (already) {
        return bad(
          `${email} is already on the team as ${(already as { employee_code: string }).employee_code}.`
        );
      }

      /* Server-generated and immutable. Attribution points at this, never at
         a name — people share names, change them, and leave. */
      const { data: codeRow, error: codeErr } = await sb.rpc("next_employee_code", {
        p_department_id: departmentId,
      });
      if (codeErr || !codeRow) {
        return bad(codeErr?.message ?? "Could not generate an employee code.", 500);
      }
      const employeeCode = String(codeRow);

      const { data: created, error } = await sb
        .from("staff_members")
        .insert({
          profile_id: p.id,
          employee_code: employeeCode,
          /* Defaults to the employee code: unique by construction, and a
             friendlier alias can be set later without risking a collision
             at the moment of creation. */
          referral_code: employeeCode,
          department_id: departmentId,
          role_id: roleId,
          job_title: String(body.jobTitle ?? "").trim() || null,
          phone: String(body.phone ?? "").trim() || null,
          joined_at: body.joinedAt ? String(body.joinedAt) : null,
          created_by: caller.user.id,
          updated_by: caller.user.id,
        })
        .select("id, employee_code, referral_code")
        .single();

      if (error) return bad(error.message, 500);

      await audit({
        action: "staff.add",
        entityId: created.id,
        entityLabel: `${employeeCode} · ${email}`,
        before: null,
        after: { email, department_id: departmentId, role_id: roleId },
      });

      return NextResponse.json({
        ok: true,
        id: created.id,
        employeeCode: created.employee_code,
        referralCode: created.referral_code,
      });
    }

    /* ================================================================
     * Department, role, title, phone, status.
     * ================================================================ */
    case "update_member": {
      const staffId = String(body.staffId ?? "");
      if (!staffId) return bad("Missing team member.");

      const { data: beforeRow } = await sb
        .from("staff_members")
        .select("*")
        .eq("id", staffId)
        .maybeSingle();
      if (!beforeRow) return bad("Team member not found.", 404);

      const patch: Record<string, unknown> = { updated_by: caller.user.id, updated_at: new Date().toISOString() };

      if (body.departmentId !== undefined) patch.department_id = String(body.departmentId);
      if (body.roleId !== undefined) patch.role_id = String(body.roleId);
      if (body.jobTitle !== undefined) patch.job_title = String(body.jobTitle ?? "").trim() || null;
      if (body.phone !== undefined) patch.phone = String(body.phone ?? "").trim() || null;
      if (body.joinedAt !== undefined) patch.joined_at = body.joinedAt ? String(body.joinedAt) : null;

      if (body.status !== undefined) {
        const status = String(body.status);
        if (!STATUSES.has(status)) return bad("Unknown status.");
        patch.status = status;
      }

      /* employee_code and referral_code are absent from this list on purpose.
         Attribution rows point at the code; changing it would silently
         re-attribute months of somebody's work. */

      const { error } = await sb.from("staff_members").update(patch).eq("id", staffId);
      if (error) return bad(error.message, 500);

      await audit({
        action: "staff.update",
        entityId: staffId,
        entityLabel: (beforeRow as { employee_code: string }).employee_code,
        before: beforeRow,
        after: patch,
      });

      return NextResponse.json({ ok: true });
    }

    /* ================================================================
     * Geographic scope.
     * ================================================================ */
    case "set_scope": {
      const staffId = String(body.staffId ?? "");
      const locationId = String(body.locationId ?? "");
      const included = body.included === true;
      const includesDescendants = body.includesDescendants !== false;

      if (!staffId) return bad("Missing team member.");
      if (!locationId) return bad("Missing location.");

      const { data: member } = await sb
        .from("staff_members")
        .select("employee_code")
        .eq("id", staffId)
        .maybeSingle();
      if (!member) return bad("Team member not found.", 404);

      if (included) {
        const { error } = await sb
          .from("staff_scopes")
          .upsert(
            {
              staff_id: staffId,
              location_id: locationId,
              includes_descendants: includesDescendants,
              created_by: caller.user.id,
            },
            { onConflict: "staff_id,location_id" }
          );
        if (error) return bad(error.message, 500);
      } else {
        const { error } = await sb
          .from("staff_scopes")
          .delete()
          .eq("staff_id", staffId)
          .eq("location_id", locationId);
        if (error) return bad(error.message, 500);
      }

      await audit({
        action: included ? "staff.scope_add" : "staff.scope_remove",
        entityId: staffId,
        entityLabel: (member as { employee_code: string }).employee_code,
        before: null,
        after: { location_id: locationId, includes_descendants: includesDescendants },
      });

      return NextResponse.json({ ok: true });
    }

    /* ================================================================
     * Per-person permission override.
     * ================================================================ */
    case "set_permission": {
      const staffId = String(body.staffId ?? "");
      const permissionId = String(body.permissionId ?? "");
      const granted = body.granted;

      if (!staffId) return bad("Missing team member.");
      if (!permissionId) return bad("Missing permission.");
      if (granted !== null && typeof granted !== "boolean") {
        return bad("Value must be true, false, or null to follow the role.");
      }

      const { data: member } = await sb
        .from("staff_members")
        .select("employee_code")
        .eq("id", staffId)
        .maybeSingle();
      if (!member) return bad("Team member not found.", 404);

      /* The permission has to exist. It cannot be one of Super Admin's,
         because those have no row — that is what makes them unreachable
         rather than merely hidden. */
      const { data: perm } = await sb
        .from("staff_permissions")
        .select("slug, label")
        .eq("id", permissionId)
        .maybeSingle();
      if (!perm) return bad("Unknown permission.", 404);

      if (granted === null) {
        /* Clearing an override is NOT the same as setting it false: it
           returns the person to whatever their role says, which may be
           either answer. */
        const { error } = await sb
          .from("staff_permission_grants")
          .delete()
          .eq("staff_id", staffId)
          .eq("permission_id", permissionId);
        if (error) return bad(error.message, 500);
      } else {
        const { error } = await sb.from("staff_permission_grants").upsert(
          {
            staff_id: staffId,
            permission_id: permissionId,
            granted,
            note: String(body.note ?? "").trim() || null,
            created_by: caller.user.id,
          },
          { onConflict: "staff_id,permission_id" }
        );
        if (error) return bad(error.message, 500);
      }

      await audit({
        action: "staff.permission",
        entityId: staffId,
        entityLabel: (member as { employee_code: string }).employee_code,
        before: null,
        after: { permission: (perm as { slug: string }).slug, granted },
      });

      return NextResponse.json({ ok: true });
    }

    default:
      return bad("Unknown action.");
  }
}
