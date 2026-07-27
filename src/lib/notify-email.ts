// Shared server-side HTML builder for outbound Rego emails (broadcasts and the
// signup-reminder cron). No browser APIs — safe to import in route handlers.

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
          ? `<div style="font-weight:700;color:#0F4C3A">PKR ${Number(it.price).toLocaleString()}${
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
  const greeting = opts.name ? `<p>Hi ${esc(opts.name)},</p>` : "";
  const body = esc(opts.message).replace(/\n/g, "<br/>");
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e6efe9;border-radius:12px;overflow:hidden">
    <div style="background:#0F4C3A;padding:18px 24px;color:#fff">
      <span style="font-size:20px;font-weight:800">Rego</span>
    </div>
    <div style="padding:24px;color:#0F4C3A">
      <h2 style="margin:0 0 12px;font-size:18px">${esc(opts.heading)}</h2>
      ${greeting}
      <p style="color:#334">${body}</p>
      ${itemsHtml(opts.items ?? [], opts.base)}
      <p style="margin-top:20px">
        <a href="${opts.base}" style="background:#E0A82E;color:#0F4C3A;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:8px;display:inline-block">Explore Rego</a>
      </p>
    </div>
    <div style="padding:14px 24px;background:#f3f8f5;color:#6b7c75;font-size:12px">
      Rego — Book. Explore. Experience. · Gilgit Baltistan
    </div>
  </div>`;
}
