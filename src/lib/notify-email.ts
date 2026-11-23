// Shared server-side HTML builder for outbound Rego emails (broadcasts and the
// signup-reminder cron). No browser APIs — safe to import in route handlers.

import { emailLayout, emailButton } from "@/lib/email-layout";

export interface RecItem {
  title: string;
  location?: string | null;
  price?: number | null;
  unit?: string | null;
  image?: string | null;
  href?: string | null;
}

export function esc(s: string): string {
  return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
}

export function itemsHtml(items: RecItem[], base: string): string {
  if (!items.length) return "";
  const cards = items
    .slice(0, 6)
    .map((it) => {
      const href = it.href ? (it.href.startsWith("http") ? it.href : base + it.href) : base;
      const img = it.image
        ? `<img src="${it.image}" width="70" height="70" style="border-radius:10px;object-fit:cover" alt="" />`
        : "";
      const price =
        it.price && it.price > 0
          ? `<div style="font-weight:700;color:#0F4C3A">PKR ${Number(it.price).toLocaleString("en-GB")}${
              it.unit ? `<span style="font-weight:400;color:#6b7c75">/${esc(it.unit)}</span>` : ""
            }</div>`
          : "";
      return `<a href="${href}" style="display:block;text-decoration:none;color:inherit">
        <table style="width:100%;border:1px solid #e6efe9;border-radius:12px;margin:8px 0;border-collapse:separate">
          <tr>
            <td style="padding:10px;width:80px">${img}</td>
            <td style="padding:10px 10px 10px 0;vertical-align:top">
              <div style="font-weight:700;color:#0F4C3A">${esc(it.title)}</div>
              ${it.location ? `<div style="color:#6b7c75;font-size:13px">${esc(it.location)}</div>` : ""}
              ${price}
            </td>
          </tr>
        </table>
      </a>`;
    })
    .join("");
  return `<div style="margin-top:16px">${cards}</div>`;
}

export function buildNotifyEmail(opts: {
  name?: string;
  heading: string;
  message: string;
  items?: RecItem[];
  base: string;
}): string {
  const greeting = opts.name ? `<p style="margin:0 0 10px">Hi ${esc(opts.name)},</p>` : "";
  const body = esc(opts.message).replace(/\n/g, "<br/>");

  return emailLayout(
    `<h1 style="margin:0 0 14px;font-size:20px;line-height:1.35;color:#0F4C3A">${esc(
      opts.heading
    )}</h1>
     ${greeting}
     <p style="margin:0 0 6px">${body}</p>
     ${itemsHtml(opts.items ?? [], opts.base)}
     ${emailButton("Explore Rego", opts.base)}`,
    { preheader: opts.heading, transactional: false }
  );
}
