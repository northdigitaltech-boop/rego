import { siteConfig } from "@/lib/site";

/* ============================================================
 * Branded wrapper for every outbound Rego email.
 *
 * Email clients are not browsers. Constraints this respects:
 *  - Images need ABSOLUTE https URLs; relative paths never resolve.
 *  - Outlook renders PNG transparency as black, so the logo is
 *    pre-flattened onto the forest green it sits on.
 *  - Roughly half of recipients have images blocked by default, so the
 *    header still reads correctly with no image at all (alt text + a
 *    green band that carries the brand on its own).
 *  - Layout uses tables and inline styles — Outlook ignores <style> blocks
 *    and most of flexbox/grid.
 * ============================================================ */

const FOREST = "#0F4C3A";
const GOLD = "#C9A227";
const INK = "#12211C";
const MUTED = "#6b7c75";

/** Absolute URL for an asset in /public. */
function asset(path: string): string {
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface LayoutOptions {
  /** Small line under the logo, e.g. "Booking confirmed". */
  preheader?: string;
  /** Hide the unsubscribe hint on transactional mail. */
  transactional?: boolean;
}

/**
 * Wrap message HTML in the Rego header/footer.
 * `inner` is trusted HTML the caller has already escaped.
 */
export function emailLayout(inner: string, opts: LayoutOptions = {}): string {
  const { preheader, transactional = true } = opts;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${siteConfig.name}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f5;">
${
  preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>`
    : ""
}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:24px 12px">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;
                    border:1px solid #e6efe9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">

        <!-- Header: green band carries the brand even with images blocked -->
        <tr>
          <td align="center" style="background:${FOREST};padding:22px 20px">
            <a href="${siteConfig.url}" style="text-decoration:none">
              <img src="${asset("/email-logo.png")}"
                   width="170" alt="${siteConfig.name}"
                   style="display:block;border:0;outline:none;width:170px;max-width:60%;height:auto" />
            </a>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:26px 24px;color:${INK};font-size:15px;line-height:1.65">
            ${inner}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f7faf8;border-top:1px solid #e6efe9;padding:18px 24px;
                     color:${MUTED};font-size:12px;line-height:1.6">
            <p style="margin:0 0 6px">
              <strong style="color:${FOREST}">${siteConfig.name}</strong> — ${siteConfig.address}
            </p>
            <p style="margin:0 0 6px">
              <a href="tel:${siteConfig.contactPhone}" style="color:${FOREST};text-decoration:none">${siteConfig.contactPhoneDisplay}</a>
              &nbsp;·&nbsp;
              <a href="mailto:${siteConfig.contactEmail}" style="color:${FOREST};text-decoration:none">${siteConfig.contactEmail}</a>
            </p>
            <p style="margin:0">
              <a href="${siteConfig.url}" style="color:${GOLD};text-decoration:none">rego.services</a>
              ${
                transactional
                  ? ""
                  : ` &nbsp;·&nbsp; <span style="color:${MUTED}">You're receiving this because you have a Rego account.</span>`
              }
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** A gold call-to-action button that survives Outlook. */
export function emailButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0">
    <tr><td align="center" bgcolor="${GOLD}" style="border-radius:10px">
      <a href="${href}" style="display:inline-block;padding:12px 26px;font-weight:700;
         font-size:15px;color:#12211C;text-decoration:none">${label}</a>
    </td></tr>
  </table>`;
}
