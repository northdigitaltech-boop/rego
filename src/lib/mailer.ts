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
    /* Pooling is deliberately left OFF (nodemailer's default). On Vercel the
       function is frozen the moment it returns, so a pooled socket waiting to
       flush is killed and the message is lost. One connection per send is
       slower but reliable. */
    // Fail fast instead of hanging until the function times out.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return cached;
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
}

export interface MailResult {
  ok: boolean;
  error?: string;
  /* What the receiving server actually said. Everything below is optional and
     only present on a successful send.

     WHY THESE ARE RETURNED
       This used to return `{ ok: true }` and throw the rest away, which meant
       "ok" said only that no exception was raised. When a message is accepted
       and then never arrives, that is not enough to tell anyone: the SMTP
       response carries a queue id, and the queue id is the one thing a host's
       support can trace.

     NONE OF IT DECIDES `ok`. Only a thrown error does. Reporting is worth
     adding; it is not worth putting between Rego and its outbound mail. */
  /** Raw final SMTP line, e.g. "250 2.0.0 Ok: queued as 4b2f…". */
  response?: string;
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
}

/**
 * Send one email. Returns a plain result rather than throwing, so callers
 * can decide whether a failed notification should break their flow.
 */
export async function sendMail(input: MailInput): Promise<MailResult> {
  if (!isSmtpConfigured) return { ok: false, error: "SMTP not configured" };

  try {
    const info = await transporter().sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: process.env.REPLY_TO || undefined,
    });

    const accepted = (info.accepted ?? []).map(String);
    const rejected = (info.rejected ?? []).map(String);

    /* A send succeeds when nodemailer does not throw. That is the rule this
       function had for its whole working life and it is the rule again.

       I briefly made an empty `accepted` list a failure, reasoning that a
       message refused for every recipient can still resolve. The reasoning
       was fine and the trade was not: if `accepted` is ever unpopulated on a
       send that actually worked, EVERY email in Rego starts reporting
       failure — bookings, welcome mail, admin alerts. Risking all outbound
       mail to catch a rare partial rejection is the wrong way round.

       The lists are still returned, so a caller that cares can look. */
    return {
      ok: true,
      response: info.response,
      messageId: info.messageId,
      accepted,
      rejected,
    };
  } catch (e) {
    // Log the real reason server-side; callers get something generic.
    console.error("[mailer] send failed:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown SMTP error",
    };
  }
}
