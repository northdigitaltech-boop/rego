import { NextResponse } from "next/server";

import { isSmtpConfigured } from "@/lib/mailer";

/* ============================================================
 * SMTP diagnostics — TEMPORARY.
 *
 * /api/email/diag?key=<CRON_SECRET>
 *
 * Reports which mail settings the running deployment can actually see, and
 * tries a real connection to the SMTP host. Nothing secret is returned —
 * the password is only ever reported as present/absent, never echoed.
 *
 * Protected by CRON_SECRET so it can't be probed by anyone else. Delete
 * this file once email is working.
 * ============================================================ */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const config = {
    smtpConfigured: isSmtpConfigured,
    host: process.env.SMTP_HOST ?? null,
    port: process.env.SMTP_PORT ?? "(default 465)",
    user: process.env.SMTP_USER ?? null,
    passwordSet: Boolean(process.env.SMTP_PASSWORD),
    from: process.env.EMAIL_FROM ?? null,
    replyTo: process.env.REPLY_TO ?? null,
    resendKeySet: Boolean(process.env.RESEND_API_KEY),
  };

  if (!isSmtpConfigured) {
    return NextResponse.json({
      ok: false,
      stage: "config",
      error:
        "SMTP is not configured on this deployment. Check the variables below, then REDEPLOY — env changes need a new build.",
      config,
    });
  }

  // Verify the connection and credentials without sending anything.
  try {
    const nodemailer = (await import("nodemailer")).default;
    const port = Number(process.env.SMTP_PORT || 465);
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
    });
    await t.verify();
    return NextResponse.json({
      ok: true,
      stage: "verified",
      message: "Connected and authenticated successfully.",
      config,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      stage: "connect",
      // The real reason — this is the bit worth reading.
      error: e instanceof Error ? e.message : String(e),
      config,
    });
  }
}
