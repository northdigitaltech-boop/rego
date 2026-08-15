import nodemailer, { type Transporter } from "nodemailer";

/* ============================================================
 * SMTP sender (Gmail, Workspace, or any SMTP host).
 *
 * SERVER ONLY. Never import this from a "use client" file. None of these
 * variables carry a NEXT_PUBLIC_ prefix, so they are not bundled for the
 * browser — an App Password in client code would hand over the mailbox.
 *
 * Required env:
 *   SMTP_HOST      e.g. smtp.gmail.com
 *   SMTP_PORT      465 (SSL) or 587 (STARTTLS)
 *   SMTP_USER      full address, e.g. regodmp@gmail.com
 *   SMTP_PASSWORD  16-character Google App Password (not the login password)
 * Optional:
 *   EMAIL_FROM     "Rego <info@rego.services>" — defaults to SMTP_USER
 *   REPLY_TO       where replies should land
 * ============================================================ */

export const isSmtpConfigured = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
);

let cached: Transporter | null = null;

function transporter(): Transporter {
  if (cached) return cached;
  const port = Number(process.env.SMTP_PORT || 465);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 upgrades via STARTTLS.
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    // Gmail throttles hard on burst; keep one connection and queue.
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
  });
  return cached;
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send one email. Returns a plain result rather than throwing, so callers
 * can decide whether a failed notification should break their flow.
 */
export async function sendMail(
  input: MailInput
): Promise<{ ok: boolean; error?: string }> {
  if (!isSmtpConfigured) return { ok: false, error: "SMTP not configured" };

  try {
    await transporter().sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: process.env.REPLY_TO || undefined,
    });
    return { ok: true };
  } catch (e) {
    // Log the real reason server-side; callers get something generic.
    console.error("[mailer] send failed:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown SMTP error",
    };
  }
}
