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

      /* This decides whether to create an account, so a failed lookup must
         not read as "no account exists". */
      const { data: person, error: personErr } = await sb
        .from("profiles")
        .select("id, email, role")
        .ilike("email", email)
        .maybeSingle();
      if (personErr) return bad(personErr.message, 500);

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

        const { data: already, error: alreadyErr } = await sb
          .from("staff_members")
          .select("id, employee_code")
          .eq("profile_id", p.id)
          .maybeSingle();
        if (alreadyErr) return bad(alreadyErr.message, 500);

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
     * Assign a task.
     *
     * WHY THIS IS A ROUTE AND STATUS UPDATES ARE NOT
     *   phase108 revokes the blanket update grant on staff_tasks and
     *   re-grants only (status, progress_note). A signed-in member can
     *   therefore move their work along from the browser, and Postgres
     *   itself refuses `set due_date` or `set title` before any policy is
     *   consulted. Assigning has to write the columns that grant excludes,
     *   so it runs with the service-role client — and leaves an audit row,
     *   which is the other reason it belongs here.
     *
     *   There is no `assign_tasks` permission in phase104, so this is an
     *   admin act. Inventing the permission here would create one the Super
     *   Admin screens never granted and nobody reviewed.
     * ================================================================ */
    case "assign_task": {
      const staffId = String(body.staffId ?? "");
      const title = String(body.title ?? "").trim();
      const detail = String(body.detail ?? "").trim();
      const priority = String(body.priority ?? "normal");
      const dueDate = body.dueDate ? String(body.dueDate) : null;

      if (!staffId) return bad("Missing team member.");
      if (!title) return bad("Give the task a title.");
      if (!["low", "normal", "high"].includes(priority)) return bad("Unknown priority.");

      const { data: row, error: rowErr } = await sb
        .from("staff_members")
        .select("id, employee_code, status, department_id")
        .eq("id", staffId)
        .maybeSingle();
      if (rowErr) return bad(rowErr.message, 500);
      if (!row) return bad("Team member not found.", 404);

      const t = row as { employee_code: string; status: string; department_id: string };
      if (t.status !== "active") {
        return bad(
          `${t.employee_code} is ${t.status}. Assigning work to somebody who cannot sign in would leave it sitting there unread.`
        );
      }

      const { data: created, error } = await sb
        .from("staff_tasks")
        .insert({
          staff_id: staffId,
          /* Read from the member, not from the request. A task filed under
             the wrong department disappears from the view that would have
             chased it. */
          department_id: t.department_id,
          title,
          detail: detail || null,
          priority,
          due_date: dueDate,
          assigned_by: caller.user.id,
        })
        .select("id")
        .single();

      if (error) return bad(error.message, 500);

      await audit({
        action: "staff.assign_task",
        entityId: staffId,
        entityLabel: `${t.employee_code} · ${title}`,
        before: null,
        after: { title, priority, due_date: dueDate },
      });

      return NextResponse.json({ ok: true, id: created.id });
    }

    /* ================================================================
     * Remove somebody from the team, and optionally delete the account
     * that was created for them.
     *
     * TWO SEPARATE THINGS, ON PURPOSE
     *   Removing from the team deletes the staff row. Scopes and permission
     *   grants go with it by cascade. The Rego ACCOUNT survives, because
     *   leaving the team is not the same as ceasing to exist, and somebody
     *   who was staff may still have bookings as a customer.
     *
     * WHAT THE DATABASE REFUSES BEFORE THIS DOES
     *   staff_attributions.staff_id is `on delete restrict`. A member who
     *   brought in even one provider cannot be deleted at all — deleting
     *   them would destroy the record of who earned that. The error is
     *   translated below rather than dressed up.
     *
     * DELETING THE ACCOUNT IS NARROWER THAN IT LOOKS
     *   Only when it has NEVER been signed into. That is the invitation
     *   case — an account this system created, which nobody has used, and
     *   which therefore cannot own a booking or a listing. Anything else is
     *   a real person's account and goes through Users, which already has
     *   the reason note, the listing handling and the checks. A second
     *   general account-deletion path is a second place for those to drift.
     * ================================================================ */
    case "remove_member": {
      const staffId = String(body.staffId ?? "");
      const alsoAccount = body.deleteAccount === true;
      if (!staffId) return bad("Missing team member.");

      /* NO EMBEDDED profiles(...) HERE, AND THE ERROR IS NOT DISCARDED.
         staff_members points at profiles three times — profile_id, created_by
         and updated_by — so `profiles(email, role)` is ambiguous and PostgREST
         refuses the whole query. The first version of this read only `data`,
         so that refusal arrived as data:null and the screen said "Team member
         not found" about a row that was sitting right there. Two plain
         queries cannot be ambiguous, and an error now says what it was. */
      const { data: row, error: rowErr } = await sb
        .from("staff_members")
        .select("id, employee_code, profile_id")
        .eq("id", staffId)
        .maybeSingle();
      if (rowErr) return bad(rowErr.message, 500);
      if (!row) return bad("Team member not found.", 404);

      const m = row as { employee_code: string; profile_id: string };

      const { data: prof } = await sb
        .from("profiles")
        .select("email, role")
        .eq("id", m.profile_id)
        .maybeSingle();
      const p2 = prof as { email: string | null; role: string | null } | null;
      const targetEmail = (p2?.email ?? "").toLowerCase();

      if (m.profile_id === caller.user.id) {
        return bad("You cannot remove your own account from here.");
      }

      const { error: delErr } = await sb.from("staff_members").delete().eq("id", staffId);
      if (delErr) {
        /* 23503 is a foreign key violation, and the only thing pointing here
           with `restrict` is attribution. Saying which one matters: an admin
           reading "violates foreign key constraint" learns nothing. */
        return bad(
          delErr.code === "23503"
            ? `${m.employee_code} cannot be removed: providers are credited to them, and deleting the record would erase who brought those in. Set their status to disabled instead.`
            : delErr.message,
          400
        );
      }

      let accountDeleted = false;
      let accountNote: string | null = null;

      if (alsoAccount) {
        if (p2?.role === "admin") {
          accountNote = "The account is an admin account and was kept.";
        } else {
          /* The evidence, not an assumption: an account that has never been
             signed into cannot have created anything. */
          const { data: authUser } = await sb.auth.admin.getUserById(m.profile_id);
          const everSignedIn = Boolean(authUser?.user?.last_sign_in_at);

          if (everSignedIn) {
            accountNote =
              "The Rego account was kept: somebody has signed into it, so it may hold their own bookings. Delete it from Users if that is really what you want.";
          } else {
            await sb.from("profiles").delete().eq("id", m.profile_id);
            const { error: authErr } = await sb.auth.admin.deleteUser(m.profile_id);
            if (authErr) {
              accountNote = `They were removed from the team, but the account could not be deleted: ${authErr.message}`;
            } else {
              accountDeleted = true;
              /* Written to the same table the Users screen writes to, so
                 there is one history of account deletions rather than two. */
              try {
                await sb.from("admin_audit_logs").insert({
                  admin_id: caller.user.id,
                  admin_email: actorEmail,
                  target_user_id: m.profile_id,
                  target_email: targetEmail || null,
                  field: "delete_account",
                  note: `Unused invited account removed with team member ${m.employee_code}`,
                });
              } catch {
                /* A gap in the history, not an error on the screen. */
              }
            }
          }
        }
      }

      await audit({
        action: accountDeleted ? "staff.remove_and_delete_account" : "staff.remove",
        entityId: staffId,
        entityLabel: `${m.employee_code} · ${targetEmail}`,
        before: { employee_code: m.employee_code, email: targetEmail },
        after: null,
      });

      return NextResponse.json({
        ok: true,
        email: targetEmail,
        accountDeleted,
        warning: accountNote,
      });
    }

    /* ================================================================
     * Send the sign-in link again.
     *
     * Needed because add_member keeps the account when the mail fails: the
     * person is on the team, the account exists, and every later attempt to
     * add them is correctly refused as a duplicate. Without this there was
     * no way to reach them at all — a gap the first version left.
     *
     * A RECOVERY link, not an invite: invite refuses for a user who already
     * exists. It lands on the same screen and sets the same password, and
     * it works whether they never had one or forgot the one they chose.
     *
     * It can only ever go to the address already on their profile. Nothing
     * in the request says where to send it.
     * ================================================================ */
    case "resend_invite": {
      const staffId = String(body.staffId ?? "");
      if (!staffId) return bad("Missing team member.");
      if (!isSmtpConfigured) {
        return bad(
          "Email is not configured on this server, so nothing can be sent. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD.",
          503
        );
      }

      /* Plain columns, and the error is read. An embedded profiles(...) is
         ambiguous here — staff_members points at profiles three times — and
         PostgREST refuses the whole query. Reading only `data` turned that
         refusal into "Team member not found" about a row that was there. */
      const { data: row, error: rowErr } = await sb
        .from("staff_members")
        .select("id, employee_code, status, profile_id, department_id, role_id")
        .eq("id", staffId)
        .maybeSingle();

      if (rowErr) return bad(rowErr.message, 500);
      if (!row) return bad("Team member not found.", 404);

      const m = row as {
        employee_code: string;
        status: string;
        profile_id: string;
        department_id: string;
        role_id: string;
      };

      if (m.status !== "active") {
        return bad(
          `${m.employee_code} is ${m.status}. Set them back to active before sending a sign-in link.`
        );
      }

      const [{ data: who }, { data: deptRow }, { data: roleRow }] = await Promise.all([
        sb.from("profiles").select("email, full_name").eq("id", m.profile_id).maybeSingle(),
        sb.from("staff_departments").select("name").eq("id", m.department_id).maybeSingle(),
        sb.from("staff_roles").select("name").eq("id", m.role_id).maybeSingle(),
      ]);

      const person = who as { email: string | null; full_name: string | null } | null;
      const target = (person?.email ?? "").trim().toLowerCase();
      if (!target) return bad("That team member has no email address on file.", 500);

      const { data: link, error: linkErr } = await sb.auth.admin.generateLink({
        type: "recovery",
        email: target,
        options: { redirectTo: absoluteUrl("/reset-password?welcome=1") },
      });

      if (linkErr || !link?.properties?.action_link) {
        return bad(linkErr?.message ?? "Could not create a sign-in link.", 500);
      }

      const sent = await sendStaffInvite({
        to: target,
        name: person?.full_name ?? null,
        link: link.properties.action_link,
        employeeCode: m.employee_code,
        departmentName: (deptRow as { name?: string } | null)?.name ?? null,
        roleName: (roleRow as { name?: string } | null)?.name ?? null,
        invitedBy: actorEmail,
      });

      if (!sent.ok) {
        return bad(
          `The link was created but the email could not be sent: ${sent.error ?? "unknown error"}.`,
          502
        );
      }

      /* The address and the mail server's answer are recorded; the link is
         not. It signs its holder in. */
      await audit({
        action: "staff.invite_resent",
        entityId: staffId,
        entityLabel: `${m.employee_code} · ${target}`,
        before: null,
        after: { email: target, smtp_response: sent.response ?? null },
      });

      return NextResponse.json({
        ok: true,
        email: target,
        /* The queue id, so "it says sent but never arrived" has something a
           mail host can actually trace. */
        smtpResponse: sent.response ?? null,
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
     * What a ROLE carries.
     *
     * This was the missing half. set_permission below changes one person;
     * until now the only way to change what "Marketing Manager" means was a
     * migration, so an admin who wanted every marketing manager to write
     * blog posts had to tick eight boxes per person and remember to do it
     * again for the next hire. That is how somebody eventually gets missed.
     *
     * IT CHANGES EVERYONE IN THE ROLE, AT ONCE
     *   No cache to wait out: staff_can() reads these rows on every call.
     *   Somebody signed in right now gains or loses the permission on their
     *   next request. The screen says so before the tick.
     *
     * PERSONAL OVERRIDES STILL WIN
     *   Somebody who had it explicitly taken away keeps not having it, even
     *   after the role grants it. That is the point of an override, and it
     *   is why the member screen shows the result rather than the switch.
     *
     * Super Admin's own authority is unreachable here for the same reason as
     * everywhere else: those permissions have no rows, so no role can be
     * given them.
     * ================================================================ */
    case "set_role_permission": {
      const roleId = String(body.roleId ?? "");
      const permissionId = String(body.permissionId ?? "");
      const granted = body.granted;

      if (!roleId) return bad("Missing role.");
      if (!permissionId) return bad("Missing permission.");
      if (typeof granted !== "boolean") {
        return bad("Value must be true or false — a role either carries it or does not.");
      }

      const [{ data: roleRow, error: roleErr }, { data: perm, error: permErr }] =
        await Promise.all([
          sb.from("staff_roles").select("id, name").eq("id", roleId).maybeSingle(),
          sb
            .from("staff_permissions")
            .select("id, slug, label")
            .eq("id", permissionId)
            .maybeSingle(),
        ]);

      if (roleErr) return bad(roleErr.message, 500);
      if (permErr) return bad(permErr.message, 500);
      if (!roleRow) return bad("Unknown role.", 404);
      if (!perm) return bad("Unknown permission.", 404);

      const r = roleRow as { name: string };
      const pm = perm as { slug: string; label: string };

      if (granted) {
        const { error } = await sb
          .from("staff_role_permissions")
          .upsert(
            { role_id: roleId, permission_id: permissionId },
            { onConflict: "role_id,permission_id" }
          );
        if (error) return bad(error.message, 500);
      } else {
        const { error } = await sb
          .from("staff_role_permissions")
          .delete()
          .eq("role_id", roleId)
          .eq("permission_id", permissionId);
        if (error) return bad(error.message, 500);
      }

      /* How many people this just affected — recorded because "we changed a
         role" and "we changed it for nine people" are different facts, and
         the second is the one an audit trail is read for. */
      const { count } = await sb
        .from("staff_members")
        .select("id", { count: "exact", head: true })
        .eq("role_id", roleId)
        .eq("status", "active");

      await audit({
        action: "staff.role_permission",
        entityId: roleId,
        entityLabel: `${r.name} · ${pm.label}`,
        before: null,
        after: { permission: pm.slug, granted, active_members_affected: count ?? 0 },
      });

      return NextResponse.json({ ok: true, affected: count ?? 0 });
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
