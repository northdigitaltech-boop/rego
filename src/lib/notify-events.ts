"use client";

import { sendEmail } from "@/lib/email";
import { emailLayout, emailButton } from "@/lib/email-layout";
import { createNotification } from "@/lib/notifications";
import { siteConfig, contactInbox } from "@/lib/site";

/* ============================================================
 * Automatic notifications.
 *
 * One place that decides, for each event: who hears about it, on which
 * channel, and with what wording. Everything fires without an admin
 * touching anything.
 *
 * Two rules this enforces:
 *  1. Notifying must NEVER break the action that triggered it. Every
 *     function swallows its own errors — a failed email must not stop a
 *     booking from being saved.
 *  2. Transactional mail (bookings, approvals, security) always sends.
 *     Only promotional mail respects the user's notification preferences,
 *     which createNotification already handles for the in-app side.
 * ============================================================ */

const BASE = siteConfig.url;

function esc(s: string): string {
  return (s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
}

function row(label: string, value: string): string {
  return `<p style="margin:4px 0"><strong>${esc(label)}:</strong> ${esc(value)}</p>`;
}

/** Fire-and-forget: never let a notification failure surface to the user. */
function safe(p: Promise<unknown>): void {
  void p.catch(() => {});
}

/* ================= 1. New account ================= */

/** Welcome email the moment someone registers. */
export function notifyWelcome(opts: {
  email: string;
  name?: string;
  isPartner?: boolean;
}): void {
  const first = (opts.name || "").split(" ")[0] || "there";

  const body = opts.isPartner
    ? `<p>Welcome to Rego, ${esc(first)} — your business account is ready.</p>
       <p>Next step: add your first listing with photos, prices and details. Our
       team reviews new listings before they go live, usually within a day.</p>
       ${emailButton("Set up your listing", `${BASE}/dashboard`)}
       <p style="color:#6b7c75;font-size:13px">Listings with 5 or more photos get
       noticeably more bookings — it's worth the extra ten minutes.</p>`
    : `<p>Welcome to Rego, ${esc(first)}!</p>
       <p>You can now book verified hotels, jeeps, guides, tour packages and
       restaurants across Gilgit-Baltistan — all in one place.</p>
       ${emailButton("Start exploring", `${BASE}/listings`)}
       <p style="color:#6b7c75;font-size:13px">Travelling soon? Check live road
       updates before you set off — passes close at short notice.</p>`;

  safe(
    sendEmail(
      opts.email,
      opts.isPartner ? "Your Rego partner account is ready" : "Welcome to Rego ✨",
      emailLayout(
        `<h1 style="margin:0 0 14px;font-size:20px;color:#0F4C3A">Welcome to Rego</h1>${body}`,
        { preheader: "Book, explore and experience Gilgit-Baltistan" }
      )
    )
  );

  safe(
    createNotification({
      user_email: opts.email,
      type: "system",
      title: "Welcome to Rego",
      message: opts.isPartner
        ? "Add your first listing to start receiving bookings."
        : "Explore verified stays, transport and guides across Gilgit-Baltistan.",
      priority: "informational",
      action_url: opts.isPartner ? "/dashboard" : "/listings",
      action_label: opts.isPartner ? "Add listing" : "Explore",
    })
  );
}

/* ================= 2. Listing submitted → admin ================= */

/** Tells the Rego team a new listing is waiting for review. */
export function notifyListingSubmitted(opts: {
  title: string;
  category: string;
  ownerEmail: string;
  location?: string | null;
  listingId?: string;
}): void {
  safe(
    sendEmail(
      contactInbox,
      `[Rego] New ${opts.category} awaiting review — ${opts.title}`,
      emailLayout(
        `<h1 style="margin:0 0 14px;font-size:20px;color:#0F4C3A">New listing to review</h1>
         ${row("Listing", opts.title)}
         ${row("Category", opts.category)}
         ${opts.location ? row("Location", opts.location) : ""}
         ${row("Submitted by", opts.ownerEmail)}
         ${emailButton("Open admin review", `${BASE}/admin`)}`,
        { preheader: `${opts.title} — ${opts.category}` }
      )
    )
  );
}

/* ================= 3. Listing approved / rejected → provider ================= */

export function notifyListingReviewed(opts: {
  ownerEmail: string;
  title: string;
  approved: boolean;
  reason?: string | null;
}): void {
  const subject = opts.approved
    ? `Your listing is live on Rego — ${opts.title}`
    : `Your listing needs a change — ${opts.title}`;

  const body = opts.approved
    ? `<p><strong>${esc(opts.title)}</strong> has been approved and is now visible
       to travellers.</p>
       ${emailButton("View your listing", `${BASE}/dashboard`)}
       <p style="color:#6b7c75;font-size:13px">Keep your availability and prices
       current — outdated listings get fewer bookings.</p>`
    : `<p>We couldn't approve <strong>${esc(opts.title)}</strong> yet.</p>
       ${opts.reason ? `<p style="border-left:3px solid #C9A227;padding-left:12px">${esc(opts.reason)}</p>` : ""}
       <p>Update the details in your dashboard and resubmit — we'll review it again.</p>
       ${emailButton("Edit listing", `${BASE}/dashboard`)}`;

  safe(sendEmail(opts.ownerEmail, subject, emailLayout(
    `<h1 style="margin:0 0 14px;font-size:20px;color:#0F4C3A">${
      opts.approved ? "Listing approved" : "Listing needs attention"
    }</h1>${body}`,
    { preheader: opts.title }
  )));

  safe(
    createNotification({
      user_email: opts.ownerEmail,
      type: "system",
      title: opts.approved ? "Listing approved" : "Listing needs attention",
      message: opts.approved
        ? `${opts.title} is now live on Rego.`
        : `${opts.title} couldn't be approved yet.`,
      priority: "important",
      action_url: "/dashboard",
      action_label: "Open dashboard",
    })
  );
}

/* ================= 4. Road status change ================= */

/**
 * Alerts travellers when a road's status changes. Only sent for changes
 * that affect a journey — a road reopening or closing — never for cosmetic
 * edits, or people learn to ignore them.
 */
export function notifyRoadChange(opts: {
  emails: string[];
  roadName: string;
  status: string;
  statusLabel: string;
  reason?: string | null;
  alternativeRoute?: string | null;
}): void {
  const blocked = /blocked|closed/i.test(opts.status);
  const subject = blocked
    ? `⚠️ ${opts.roadName} is ${opts.statusLabel}`
    : `${opts.roadName} is ${opts.statusLabel}`;

  const html = emailLayout(
    `<h1 style="margin:0 0 14px;font-size:20px;color:#0F4C3A">${esc(opts.roadName)}</h1>
     <p style="font-size:17px;font-weight:700;color:${blocked ? "#b91c1c" : "#15803d"}">
       ${esc(opts.statusLabel)}
     </p>
     ${opts.reason ? `<p>${esc(opts.reason)}</p>` : ""}
     ${opts.alternativeRoute ? row("Alternative route", opts.alternativeRoute) : ""}
     ${emailButton("See live road updates", `${BASE}/roadside#road-updates`)}
     <p style="color:#6b7c75;font-size:13px">Conditions in the mountains change
     quickly. Always confirm locally before travelling.</p>`,
    { preheader: `${opts.roadName} — ${opts.statusLabel}` }
  );

  for (const email of opts.emails) {
    safe(sendEmail(email, subject, html));
    safe(
      createNotification({
        user_email: email,
        type: "road_alert",
        title: `${opts.roadName}: ${opts.statusLabel}`,
        message: opts.reason ?? undefined,
        priority: blocked ? "urgent" : "important",
        action_url: "/roadside#road-updates",
        action_label: "View updates",
      })
    );
  }
}

/* ================= 5. Booking received → provider ================= */

export function notifyNewBooking(opts: {
  ownerEmail: string;
  listingTitle: string;
  ref: string;
  customerName: string;
  dates?: string | null;
}): void {
  safe(
    sendEmail(
      opts.ownerEmail,
      `New booking request — ${opts.listingTitle}`,
      emailLayout(
        `<h1 style="margin:0 0 14px;font-size:20px;color:#0F4C3A">New booking request</h1>
         ${row("Listing", opts.listingTitle)}
         ${row("Customer", opts.customerName)}
         ${opts.dates ? row("Dates", opts.dates) : ""}
         ${row("Reference", opts.ref)}
         ${emailButton("Review in your dashboard", `${BASE}/dashboard`)}
         <p style="color:#6b7c75;font-size:13px">Replying quickly is the single
         biggest factor in whether a traveller books with you.</p>`,
        { preheader: `${opts.customerName} — ${opts.listingTitle}` }
      )
    )
  );
}

/* ================= 6. Booking cancelled → provider ================= */

/**
 * Tells a provider their traveller cancelled.
 *
 * Both channels, because the two do different jobs: the in-app notification
 * is what they see next time they open the dashboard, and the email is what
 * reaches them if they do not open it for a week. A provider who prepares
 * for a booking that no longer exists is the failure this prevents, and it
 * is worth two messages.
 *
 * Transactional, so it ignores promotional preferences — as bookings already
 * do everywhere else in this file.
 */
export function notifyBookingCancelled(opts: {
  ownerEmail: string;
  listingTitle: string;
  ref: string;
  reason: string;
  note?: string | null;
  dates?: string | null;
  customerName?: string | null;
}): void {
  if (!opts.ownerEmail) return;

  safe(
    createNotification({
      user_email: opts.ownerEmail,
      type: "booking",
      title: "Booking cancelled",
      message: `A traveller has cancelled booking ${opts.ref} — ${opts.listingTitle}.`,
      priority: "important",
      action_url: "/dashboard",
      action_label: "Open your dashboard",
    })
  );

  safe(
    sendEmail(
      opts.ownerEmail,
      `Booking cancelled — ${opts.listingTitle}`,
      emailLayout(
        `<h1 style="margin:0 0 14px;font-size:20px;color:#0F4C3A">Booking cancelled</h1>
         <p style="margin:0 0 12px">A traveller has cancelled this booking. No action
         is needed from you — the dates are free again.</p>
         ${row("Listing", opts.listingTitle)}
         ${opts.customerName ? row("Traveller", opts.customerName) : ""}
         ${opts.dates ? row("Dates", opts.dates) : ""}
         ${row("Reference", opts.ref)}
         ${row("Reason given", opts.reason)}
         ${opts.note ? row("Their note", opts.note) : ""}
         ${emailButton("View in your dashboard", `${BASE}/dashboard`)}
         <p style="color:#6b7c75;font-size:13px">Any advance payment or refund is
         settled directly between you and the traveller — Rego does not process or
         hold booking payments.</p>`,
        { preheader: `${opts.ref} — ${opts.listingTitle}` }
      )
    )
  );
}
