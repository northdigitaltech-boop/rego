import { emailLayout } from "@/lib/email-layout";

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
     ${opts.accepted ? "<p>We look forward to hosting you. Please keep your reference handy.</p>" : "<p>Please explore other great stays on Rego.</p>"}`
  );
}
