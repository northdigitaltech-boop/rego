import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

import { clientIp } from "@/lib/rate-limit";
import { limitAndLog } from "@/lib/rate-limit-guard";
import { enforceIpBlock } from "@/lib/ip-block";
import { absoluteUrl } from "@/lib/site";
import { sendStaffInvite, isSmtpConfigured } from "@/lib/staff-invite";

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
 * It cannot grant a permission that does not exist and it cannot make someone
 * an admin. That is the whole point of phase104.
 *
 * It CAN create an account, by invitation. An earlier version refused to,
 * on the grounds that it would be "a second signup path" — which was wrong.
 * inviteUserByEmail() is Supabase's own invite mechanism on the same auth
 * system: one auth.users row, one password, the same /reset-password screen
 * a forgotten password already uses. There is no second path. What the
 * refusal actually produced was an admin telling a colleague to go and sign
 * up, then waiting to be told they had, then coming back here.
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

/* Checked before an invitation is sent, not after. A typo in an address that
   nobody owns produces an auth user that can never sign in, and it is easier
   to refuse it here than to explain it later. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
     * Add a team member. Either the person already has a Rego account,
     * or they are invited by email and set their own password.
     * ================================================================ */
    case "add_member": {
      const email = String(body.email ?? "").trim().toLowerCase();
      const departmentId = String(body.departmentId ?? "");
      const roleId = String(body.roleId ?? "");
      const fullName = String(body.fullName ?? "").trim();

      if (!email) return bad("Email is required.");
      if (!EMAIL_RE.test(email)) return bad("That does not look like an email address.");
      if (!departmentId) return bad("Choose a department.");
      if (!roleId) return bad("Choose a role.");

      const { data: person } = await sb
        .from("profiles")
        .select("id, email, role")
        .ilike("email", email)
        .maybeSingle();

      const p = person as { id: string; role: string | null } | null;

      if (p) {
        /* An admin is Super Admin. Making them staff as well would give one
           person two authorisation paths and make "who approved this"
           ambiguous in the audit trail. */
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
      }

      /* Server-generated and immutable. Attribution points at this, never at
         a name — people share names, change them, and leave.

         Generated BEFORE the invite on purpose: if code generation fails, no
         account has been created yet and there is nothing left behind. */
      const { data: codeRow, error: codeErr } = await sb.rpc("next_employee_code", {
        p_department_id: departmentId,
      });
      if (codeErr || !codeRow) {
        return bad(codeErr?.message ?? "Could not generate an employee code.", 500);
      }
      const employeeCode = String(codeRow);

      /* ---- the invite, when there is no account yet ----

         generateLink CREATES the account and returns a one-time link but
         sends nothing. inviteUserByEmail would have Supabase send it, and on
         a project without custom SMTP that fails outright — the built-in
         service is rate-limited and in practice only reaches project members.
         So Rego sends it, through the same SMTP that sends booking mail.

         handle_new_user() fires on auth.users and writes the profiles row in
         the same transaction, so the profile the foreign key needs exists by
         the time this returns. Role is left at its default: a staff member's
         authority comes from staff_members, and writing anything into
         profiles.role would be a second place for permissions to live. */
      let profileId: string;
      let invitedNow = false;
      let inviteLink = "";

      if (p) {
        profileId = p.id;
      } else {
        if (!isSmtpConfigured) {
          /* Refuse BEFORE creating the account. An account nobody can be told
             about is worse than a clear no. */
          return bad(
            `${email} has no Rego account, and email is not configured on this server, so no invitation can be sent. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD, or ask them to sign up first.`,
            503
          );
        }

        const { data: link, error: linkErr } = await sb.auth.admin.generateLink({
          type: "invite",
          email,
          options: {
            redirectTo: absoluteUrl("/reset-password?welcome=1"),
            data: fullName ? { full_name: fullName } : undefined,
          },
        });

        if (linkErr || !link?.user || !link.properties?.action_link) {
          const msg = linkErr?.message ?? "Could not create the invitation.";
          return bad(
            /already.*registered|already been registered/i.test(msg)
              ? `${email} already has a Rego account but no profile record. Ask them to sign in once, then add them here.`
              : `Could not invite ${email}: ${msg}`,
            500
          );
        }

        profileId = link.user.id;
        /* Held in a local only. It is a sign-in credential: never logged,
           never audited, never sent back to the browser. */
        inviteLink = link.properties.action_link;
        invitedNow = true;
      }

      const { data: created, error } = await sb
        .from("staff_members")
        .insert({
          profile_id: profileId,
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

      if (error) {
        /* If the invite went out and this failed, the account exists and the
           person may already have the email. Deleting it would be worse: they
           would click a dead link. A retry finds the profile and takes the
           existing-account path, so say that plainly. */
        return bad(
          invitedNow
            ? `The invitation to ${email} was sent, but adding them to the team failed: ${error.message}. Try adding them again — the account now exists.`
            : error.message,
          500
        );
      }

      /* The account and the staff row both exist now, so the email can name
         the job it is inviting them to. */
      let mailProblem: string | null = null;
      if (invitedNow) {
        const [{ data: dept }, { data: roleRow }] = await Promise.all([
          sb.from("staff_departments").select("name").eq("id", departmentId).maybeSingle(),
          sb.from("staff_roles").select("name").eq("id", roleId).maybeSingle(),
        ]);

        const sent = await sendStaffInvite({
          to: email,
          name: fullName || null,
          link: inviteLink,
          employeeCode,
          departmentName: (dept as { name?: string } | null)?.name ?? null,
          roleName: (roleRow as { name?: string } | null)?.name ?? null,
          invitedBy: actorEmail,
        });

        /* The account exists either way. Deleting it because the mail bounced
           would be worse — the admin would have no record and the person may
           already have received it. Say what happened instead. */
        if (!sent.ok) mailProblem = sent.error ?? "The invitation email could not be sent.";
      }

      await audit({
        /* The link is deliberately absent. It signs its holder in, and an
           audit trail is read by more people than it is written by. */
        action: invitedNow ? "staff.add_invited" : "staff.add",
        entityId: created.id,
        entityLabel: `${employeeCode} · ${email}`,
        before: null,
        after: {
          email,
          department_id: departmentId,
          role_id: roleId,
          invited: invitedNow,
          invite_email_sent: invitedNow ? mailProblem === null : null,
        },
      });

      return NextResponse.json({
        ok: true,
        id: created.id,
        employeeCode: created.employee_code,
        referralCode: created.referral_code,
        /* So the screen can say what actually happened rather than one
           message that is half wrong either way. */
        invited: invitedNow,
        inviteEmailFailed: mailProblem !== null,
        warning: mailProblem,
        email,
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
