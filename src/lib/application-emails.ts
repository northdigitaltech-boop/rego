import { siteConfig } from "@/lib/site";

/* ============================================================
 * Applicant status emails.
 *
 * One template per status. The admin ALWAYS sees the exact text
 * before it sends — no silent mail. Two reasons that matters:
 *
 *   1. A rejection is the one email you cannot unsend. Reading it
 *      once before it goes out costs three seconds.
 *   2. Interview and hire emails commit Rego to something. The
 *      person clicking should see what was promised on their behalf.
 *
 * "New" sends nothing — moving a row back to New is housekeeping,
 * not a message to the candidate.
 * ============================================================ */

export type AppStatus = "new" | "shortlisted" | "interview" | "hired" | "rejected";

export interface StatusEmail {
  subject: string;
  /** Plain text shown to the admin in the preview. */
  body: string;
  /** Whether this status sends anything at all. */
  sends: boolean;
  /** Shown above the preview so the admin knows the weight of it. */
  tone: "positive" | "neutral" | "final";
}

export function statusEmail(
  status: AppStatus,
  applicantName: string,
  role: string
): StatusEmail {
  const name = (applicantName || "there").trim().split(/\s+/)[0];
  const position = role || "the role you applied for";
  const sign = `\n\n— The ${siteConfig.name} Team\n${siteConfig.contactEmail}`;

  switch (status) {
    case "shortlisted":
      return {
        sends: true,
        tone: "positive",
        subject: `Your application for ${position} — shortlisted`,
        body:
          `Hi ${name},\n\n` +
          `Thank you for applying for ${position} at ${siteConfig.name}.\n\n` +
          `We've reviewed your application and shortlisted you for the next stage. ` +
          `Our team will be in touch shortly with the details.\n\n` +
          `Nothing is needed from you right now — we'll come back to you.` +
          sign,
      };

    case "interview":
      return {
        sends: true,
        tone: "positive",
        subject: `Interview invitation — ${position}`,
        body:
          `Hi ${name},\n\n` +
          `We'd like to invite you to an interview for ${position} at ${siteConfig.name}.\n\n` +
          `Someone from our team will contact you on the number in your application ` +
          `to agree a time that suits you.\n\n` +
          /* Deliberately does NOT state a date or format — the admin has not
             chosen one yet, and a promise here becomes a broken one later. */
          `Please reply to this email if there's a better way to reach you.` +
          sign,
      };

    case "hired":
      return {
        sends: true,
        tone: "positive",
        subject: `Welcome to ${siteConfig.name} — ${position}`,
        body:
          `Hi ${name},\n\n` +
          `We're delighted to offer you the ${position} position at ${siteConfig.name}.\n\n` +
          `Our team will follow up with the details — start date, terms and ` +
          `everything you'll need for your first day.\n\n` +
          `Congratulations, and welcome aboard.` +
          sign,
      };

    case "rejected":
      return {
        sends: true,
        tone: "final",
        subject: `Your application for ${position}`,
        body:
          `Hi ${name},\n\n` +
          `Thank you for applying for ${position} at ${siteConfig.name}, and for ` +
          `the time you put into your application.\n\n` +
          `On this occasion we've decided to move forward with other candidates. ` +
          /* No false "we'll keep your CV on file" unless it is actually true. */
          `This was a decision about fit for this particular role, and we'd ` +
          `genuinely welcome an application from you for future openings.\n\n` +
          `We wish you the very best with your search.` +
          sign,
      };

    default:
      return {
        sends: false,
        tone: "neutral",
        subject: "",
        body: "",
      };
  }
}

/** Plain text → the simple HTML the mailer expects. */
export function toHtml(body: string): string {
  return body
    .split("\n\n")
    .map(
      (p) =>
        `<p style="margin:0 0 14px;line-height:1.6;color:#123">${p
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}
