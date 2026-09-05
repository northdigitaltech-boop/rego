import { emailLayout, emailButton } from "@/lib/email-layout";
import { sendMail, isSmtpConfigured } from "@/lib/mailer";
import { esc } from "@/lib/notify-email";
import { siteConfig } from "@/lib/site";

/* ============================================================
 * The team invitation email.
 *
 * SERVER ONLY. It handles a one-time sign-in link.
 *
 * ---------------------------------------------------------------------------
 * WHY REGO SENDS THIS AND NOT SUPABASE
 *
 * The first version called inviteUserByEmail(), which asks Supabase to send
 * the mail. On a project with no custom SMTP that returns "Error sending
 * invite email": the built-in service is rate-limited and, in practice, only
 * reaches addresses on the project team. A colleague's Gmail is not one.
 *
 * generateLink() creates exactly the same account and the same one-time link
 * but sends nothing, so the mail goes out through the SMTP Rego already uses
 * for bookings — from Rego's own address, in Rego's own words, with none of
 * the auth-service rate limit.
 *
 * ---------------------------------------------------------------------------
 * THE LINK IS A CREDENTIAL
 *
 * Opening it signs the recipient in. So it is never logged, never returned to
 * the browser, and never written to the audit trail — the audit records that
 * an invitation was sent, which is the part anyone auditing needs.
 * ============================================================ */

export { isSmtpConfigured };

export interface StaffInviteInput {
  to: string;
  /** Their name if the admin supplied one; the address is used otherwise. */
  name?: string | null;
  /** Supabase action link. Do not log this. */
  link: string;
  employeeCode: string;
  departmentName?: string | null;
  roleName?: string | null;
  /** Who added them, so the email is from a person and not a system. */
  invitedBy?: string | null;
}

export async function sendStaffInvite(
  input: StaffInviteInput
): Promise<{ ok: boolean; error?: string }> {
  const who = (input.name || "").trim() || input.to;

  const position = [input.roleName, input.departmentName]
    .filter(Boolean)
    .map((s) => esc(String(s)))
    .join(" · ");

  const inner = `
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0F4C3A;">
      You have been added to the Rego team
    </h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
      Hello ${esc(who)},
    </p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">
      ${input.invitedBy ? `${esc(input.invitedBy)} has added you` : "You have been added"}
      to the team at Rego${position ? ` as <strong>${position}</strong>` : ""}.
      Your employee code is <strong>${esc(input.employeeCode)}</strong>.
    </p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
      Choose a password to finish setting up your account. Nobody at Rego sets
      it for you and nobody can see it.
    </p>
    ${emailButton("Choose your password", input.link)}
    <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#6b7c75;">
      This link works once and expires. If it has expired by the time you open
      it, tell whoever added you and they can send a new one.
    </p>
    <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#6b7c75;">
      If you were not expecting this, you can ignore this email — nothing
      happens until you open the link. Questions:
      <a href="mailto:${esc(siteConfig.contactEmail)}" style="color:#0F4C3A;">${esc(siteConfig.contactEmail)}</a>.
    </p>
  `;

  return sendMail({
    to: input.to,
    subject: `Your Rego team account — ${input.employeeCode}`,
    html: emailLayout(inner, {
      preheader: "Choose your password to finish setting up your account",
      transactional: true,
    }),
  });
}
