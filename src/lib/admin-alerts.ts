"use client";

import { sendEmail } from "@/lib/email";
import { emailLayout, emailButton } from "@/lib/email-layout";
import { siteConfig, contactInbox } from "@/lib/site";

/* ============================================================
 * Admin alerts — operational email, NOT marketing.
 *
 * These go to one inbox (yours) when something needs a human:
 * a new provider signs up, a listing is submitted, a service is
 * requested. They exist so nobody waits three days for approval
 * because a row sat unseen in a dashboard.
 *
 * DESIGN RULES, learned the hard way on this project:
 *
 * 1. FIRE AND FORGET. An alert must never block or fail the
 *    action that triggered it. A provider's signup succeeding
 *    matters far more than you getting an email about it.
 *
 * 2. THE SUBJECT LINE CARRIES THE DECISION. You will read these
 *    on a phone. "New provider: Hunza Grand Hotel (hotels)"
 *    tells you what happened without opening anything.
 *
 * 3. ONE ACTION PER EMAIL, linking straight to the right admin
 *    tab. Not "log in and look around".
 *
 * 4. EVERY FACT COMES FROM THE EVENT. No invented counts, no
 *    "you have 5 pending" unless it was actually counted.
 *
 * Marketing email (campaigns, newsletters) is a different
 * system with consent and unsubscribe. It must never be sent
 * from this file — see the note at the bottom.
 * ============================================================ */

const ADMIN_URL = `${siteConfig.url}/admin`;

/** Never let a notification break the thing that triggered it. */
function safe(p: Promise<unknown>) {
  void p.catch(() => {});
}

function row(label: string, value?: string | null) {
  if (!value) return "";
  return `<tr>
    <td style="padding:6px 12px 6px 0;color:#667;font-size:14px;white-space:nowrap">${label}</td>
    <td style="padding:6px 0;color:#123;font-size:14px;font-weight:600">${escape(value)}</td>
  </tr>`;
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Shared shell so every alert looks the same and scans fast. */
function alertEmail(opts: {
  title: string;
  intro: string;
  rows: string;
  ctaLabel: string;
  ctaHref: string;
  /** Shown small at the bottom — why you got this. */
  footnote?: string;
}) {
  return emailLayout(
    `<h1 style="margin:0 0 6px;font-size:20px;line-height:1.35;color:#0F4C3A">${opts.title}</h1>
     <p style="margin:0 0 16px;color:#445;font-size:15px;line-height:1.6">${opts.intro}</p>
     <table style="width:100%;border-collapse:collapse;margin:0 0 20px">${opts.rows}</table>
     ${emailButton(opts.ctaLabel, opts.ctaHref)}
     <p style="margin:20px 0 0;color:#889;font-size:12px;line-height:1.5">
       ${opts.footnote ?? "You're receiving this because you're an admin on Rego."}
     </p>`,
    { preheader: opts.intro }
  );
}

/* ------------------------------------------------------------
 * 1. New provider / business owner registered
 * ---------------------------------------------------------- */
export function alertNewProvider(opts: {
  name?: string | null;
  email: string;
  category?: string | null;
  phone?: string | null;
  city?: string | null;
}) {
  const who = opts.name?.trim() || opts.email;
  const cat = opts.category?.trim();

  safe(
    sendEmail(
      contactInbox,
      /* Subject carries the decision — you can triage from the
         notification bar without opening the mail. */
      `New provider: ${who}${cat ? ` (${cat})` : ""}`,
      alertEmail({
        title: "A new provider signed up",
        intro:
          "They can't be found by travellers until you approve them, so this is worth a look today.",
        rows:
          row("Name", opts.name) +
          row("Email", opts.email) +
          row("Phone", opts.phone) +
          row("City", opts.city) +
          row("Category", cat),
        ctaLabel: "Review in admin",
        ctaHref: `${ADMIN_URL}?tab=users`,
      })
    )
  );
}

/* ------------------------------------------------------------
 * 2. New service request (existing owner adding a category)
 * ---------------------------------------------------------- */
export function alertServiceRequest(opts: {
  businessName?: string | null;
  email: string;
  service: string;
  note?: string | null;
}) {
  const who = opts.businessName?.trim() || opts.email;

  safe(
    sendEmail(
      contactInbox,
      `Service request: ${opts.service} — ${who}`,
      alertEmail({
        title: "A provider requested a new service",
        intro: `${escape(who)} wants to list under ${escape(
          opts.service
        )}. They can't add listings in that category until it's approved.`,
        rows:
          row("Business", opts.businessName) +
          row("Email", opts.email) +
          row("Service", opts.service) +
          row("Note", opts.note),
        ctaLabel: "Approve or decline",
        ctaHref: `${ADMIN_URL}?tab=service-requests`,
      })
    )
  );
}

/* ------------------------------------------------------------
 * 3. New listing submitted for approval
 * ---------------------------------------------------------- */
export function alertListingSubmitted(opts: {
  title: string;
  category: string;
  ownerEmail: string;
  location?: string | null;
}) {
  safe(
    sendEmail(
      contactInbox,
      `New listing to review: ${opts.title} (${opts.category})`,
      alertEmail({
        title: "A listing is waiting for approval",
        intro:
          "It stays hidden from travellers until you approve it. Providers usually chase within a day or two.",
        rows:
          row("Listing", opts.title) +
          row("Category", opts.category) +
          row("Location", opts.location) +
          row("Owner", opts.ownerEmail),
        ctaLabel: "Review the listing",
        ctaHref: `${ADMIN_URL}?tab=verification`,
      })
    )
  );
}

/* ------------------------------------------------------------
 * 4. New job application
 * ---------------------------------------------------------- */
export function alertJobApplication(opts: {
  applicantName: string;
  role: string;
  email: string;
  city?: string | null;
}) {
  safe(
    sendEmail(
      contactInbox,
      `Application: ${opts.role} — ${opts.applicantName}`,
      alertEmail({
        title: "Someone applied for a role",
        intro: "Their CV and answers are in the Applications tab.",
        rows:
          row("Applicant", opts.applicantName) +
          row("Role", opts.role) +
          row("Email", opts.email) +
          row("City", opts.city),
        ctaLabel: "Open Applications",
        ctaHref: `${ADMIN_URL}?tab=applications`,
      })
    )
  );
}

/* ============================================================
 * NOT FOR MARKETING.
 *
 * Everything above is transactional: it is sent because a
 * specific event happened, to one internal address, and nobody
 * needs to unsubscribe from their own business.
 *
 * Promotional email to TRAVELLERS is a different system and
 * belongs in the admin broadcast tool, because it needs:
 *   • explicit opt-in stored per user
 *   • a working unsubscribe link in every message
 *   • a send schedule that respects Hostinger's daily limit
 *
 * Mixing the two is how a domain that currently passes SPF,
 * DKIM and DMARC ends up in spam folders — and once booking
 * confirmations start landing in spam, the marketplace breaks.
 * ============================================================ */
