import { emailLayout, emailButton } from "@/lib/email-layout";
import { siteConfig } from "@/lib/site";

/**
 * Send an email and report WHY it failed.
 *
 * sendEmail() below swallows the reason, which is right for fire-and-forget
 * notifications but wrong when a human is standing there waiting — they end
 * up guessing, or asking someone to read server logs. Use this wherever the
 * result is shown to a person.
 */
export async function sendEmailDetailed(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  if (!to) return { ok: false, error: "No recipient address on this application." };
  try {
    const res = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      skipped?: boolean;
    };
    if (json.ok) return { ok: true };

    if (json.skipped) {
      return { ok: false, error: "Email is not configured on the server (no SMTP credentials)." };
    }
    if (res.status === 429) {
      return { ok: false, error: "Too many emails in the last minute — wait 60 seconds and try again." };
    }
    if (res.status === 403) {
      return { ok: false, error: "The email service refused the request (403)." };
    }
    return { ok: false, error: json.error || `Mail server returned ${res.status}.` };
  } catch {
    return { ok: false, error: "Could not reach the email service. Check your connection." };
  }
}

/** Send email via the /api/email route. Returns true if it was delivered. */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  if (!to) return false;
  try {
    const res = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html }),
    });
    const json = await res.json().catch(() => ({ ok: false }));
    return !!json.ok;
  } catch {
    return false;
  }
}

/** Every booking / verification email goes through the branded layout. */
function shell(title: string, body: string) {
  return emailLayout(
    `<h1 style="margin:0 0 14px;font-size:20px;line-height:1.35;color:#0F4C3A">${title}</h1>
     ${body}`,
    { preheader: title }
  );
}

function row(label: string, value: string) {
  return `<p style="margin:4px 0"><strong>${label}:</strong> ${value}</p>`;
}

export function verificationCodeEmail(opts: { name: string; code: string }) {
  return shell(
    "Verify your email",
    `<p>Hi ${opts.name},</p>
     <p>Welcome to Rego! Use this code to verify your email:</p>
     <p style="font-size:30px;font-weight:800;letter-spacing:8px;color:#0F4C3A;margin:16px 0">${opts.code}</p>
     <p style="color:#6b7c75;font-size:13px">If you didn't create an account, you can ignore this email.</p>`
  );
}

export function bookingRequestEmailToCustomer(opts: {
  name: string;
  hotel: string;
  ref: string;
  checkIn?: string | null;
  checkOut?: string | null;
}) {
  return shell(
    "Your booking request was received",
    `<p>Hi ${opts.name},</p>
     <p>We've received your booking request. The provider will confirm shortly.</p>
     ${row("Booking reference", opts.ref)}
     ${row("Hotel", opts.hotel)}
     ${opts.checkIn ? row("Check-in", opts.checkIn) : ""}
     ${opts.checkOut ? row("Check-out", opts.checkOut) : ""}
     <p>Track its status anytime in your Rego dashboard.</p>`
  );
}

export function bookingRequestEmailToOwner(opts: {
  hotel: string;
  ref: string;
  customer: string;
}) {
  return shell(
    "New booking request",
    `<p>You have a new booking request for <strong>${opts.hotel}</strong>.</p>
     ${row("Booking reference", opts.ref)}
     ${row("Customer", opts.customer)}
     <p>Review the details and accept or reject it in your provider dashboard.</p>`
  );
}

export function bookingStatusEmail(opts: {
  name: string;
  hotel: string;
  ref: string;
  accepted: boolean;
}) {
  return shell(
    opts.accepted ? "Your booking is confirmed 🎉" : "Booking update",
    `<p>Hi ${opts.name},</p>
     <p>Your booking <strong>${opts.ref}</strong> for <strong>${opts.hotel}</strong> was
     ${opts.accepted ? "<strong>confirmed</strong>" : "unfortunately <strong>declined</strong>"}.</p>
     ${
       opts.accepted
         ? `<p>We look forward to hosting you. Please keep your reference handy.</p>
            <p style="margin:18px 0 6px"><strong>Download your booking voucher</strong></p>
            <p style="margin:0 0 14px;color:#556;font-size:14px;line-height:1.6">
              Open your bookings and tap <strong>Download voucher</strong> to save a PDF with your
              reference and check-in details. Save it to your phone before you travel &mdash; mobile
              signal is limited in many Gilgit-Baltistan valleys, and the hotel desk can read the PDF
              offline.
            </p>
            ${emailButton("Open my bookings", `${siteConfig.url}/dashboard`)}`
         : "<p>Please explore other great stays on Rego.</p>"
     }`
  );
}
