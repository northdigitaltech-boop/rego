import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

import { siteConfig } from "@/lib/site";

/* ============================================================
 * Booking voucher PDF.
 *
 * WHY A PDF AND NOT JUST THE EMAIL: a traveller arrives in
 * Skardu or upper Hunza where there is often no signal. They
 * cannot open an email at the hotel desk. A PDF sits on the
 * phone and opens offline, and it forwards cleanly on WhatsApp
 * to a driver or a guesthouse — which is how bookings actually
 * get confirmed on the ground here.
 *
 * DESIGN: one page, high contrast, large reference number.
 * It will be read on a cracked phone screen in a dim lobby, and
 * possibly printed on a bad printer. No colour is load-bearing.
 *
 * Built with pdf-lib — pure JS, no headless browser, works in a
 * serverless function without a cold-start penalty.
 * ============================================================ */

const FOREST = rgb(0.059, 0.298, 0.227); // #0F4C3A
const GOLD = rgb(0.788, 0.635, 0.153);
const INK = rgb(0.07, 0.09, 0.11);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.87, 0.9, 0.88);

export interface VoucherData {
  reference: string;
  status: string;
  /** What was booked — hotel name, tour title, vehicle. */
  title: string;
  /** "Hotel", "Tour package", "Transport" … */
  kind: string;
  roomOrDetail?: string | null;

  guestName: string;
  guestEmail: string;
  guestPhone?: string | null;

  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number | null;
  rooms?: number | null;

  providerName?: string | null;
  providerPhone?: string | null;
  location?: string | null;

  totalPrice?: number | null;
  notes?: string | null;
  bookedOn?: string | null;
}

function money(n?: number | null): string {
  if (!n || n <= 0) return "On arrival";
  return `PKR ${n.toLocaleString("en-PK")}`;
}

function date(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export async function buildVoucherPdf(v: VoucherData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Rego booking ${v.reference}`);
  pdf.setAuthor(siteConfig.name);

  const page = pdf.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const body = await pdf.embedFont(StandardFonts.Helvetica);

  const M = 46; // margin
  let y = height;

  /* ---- header band ---- */
  page.drawRectangle({ x: 0, y: height - 96, width, height: 96, color: FOREST });
  page.drawText("REGO", {
    x: M, y: height - 52, size: 24, font: bold, color: rgb(1, 1, 1),
  });
  page.drawText("Gilgit-Baltistan tourism marketplace", {
    x: M, y: height - 72, size: 9, font: body, color: rgb(0.85, 0.9, 0.87),
  });
  page.drawText("BOOKING VOUCHER", {
    x: width - M - bold.widthOfTextAtSize("BOOKING VOUCHER", 11),
    y: height - 52, size: 11, font: bold, color: GOLD,
  });

  y = height - 130;

  /* ---- reference: the one thing that must be readable across a desk ---- */
  page.drawText("BOOKING REFERENCE", {
    x: M, y, size: 8, font: bold, color: MUTED,
  });
  y -= 26;
  page.drawText(v.reference, { x: M, y, size: 22, font: bold, color: FOREST });

  const statusLabel = v.status.toUpperCase();
  page.drawText(statusLabel, {
    x: width - M - bold.widthOfTextAtSize(statusLabel, 10),
    y: y + 4, size: 10, font: bold, color: FOREST,
  });

  y -= 18;
  page.drawLine({
    start: { x: M, y }, end: { x: width - M, y },
    thickness: 1, color: LINE,
  });
  y -= 28;

  /* ---- what was booked ---- */
  page.drawText(v.kind.toUpperCase(), { x: M, y, size: 8, font: bold, color: MUTED });
  y -= 20;
  y = drawWrapped(page, v.title, M, y, width - M * 2, 15, bold, INK);

  if (v.roomOrDetail) {
    y -= 4;
    y = drawWrapped(page, v.roomOrDetail, M, y, width - M * 2, 11, body, MUTED);
  }
  if (v.location) {
    y -= 4;
    y = drawWrapped(page, v.location, M, y, width - M * 2, 11, body, MUTED);
  }

  y -= 22;

  /* ---- two columns of facts ---- */
  const colL = M;
  const colR = width / 2 + 10;
  const startY = y;

  let ly = startY;
  ly = field(page, colL, ly, "Guest", v.guestName, bold, body);
  ly = field(page, colL, ly, "Email", v.guestEmail, bold, body);
  if (v.guestPhone) ly = field(page, colL, ly, "Phone", v.guestPhone, bold, body);
  if (v.checkIn) ly = field(page, colL, ly, "Check-in", date(v.checkIn), bold, body);
  if (v.checkOut) ly = field(page, colL, ly, "Check-out", date(v.checkOut), bold, body);

  let ry = startY;
  if (v.providerName) ry = field(page, colR, ry, "Provider", v.providerName, bold, body);
  if (v.providerPhone) ry = field(page, colR, ry, "Provider phone", v.providerPhone, bold, body);
  if (v.guests) ry = field(page, colR, ry, "Guests", String(v.guests), bold, body);
  if (v.rooms) ry = field(page, colR, ry, "Rooms", String(v.rooms), bold, body);
  ry = field(page, colR, ry, "Total", money(v.totalPrice), bold, body);

  y = Math.min(ly, ry) - 14;

  page.drawLine({
    start: { x: M, y }, end: { x: width - M, y },
    thickness: 1, color: LINE,
  });
  y -= 24;

  if (v.notes) {
    page.drawText("NOTES", { x: M, y, size: 8, font: bold, color: MUTED });
    y -= 16;
    y = drawWrapped(page, v.notes, M, y, width - M * 2, 10, body, INK);
    y -= 16;
  }

  /* ---- what to do on arrival. Practical, not decorative. ---- */
  page.drawText("ON ARRIVAL", { x: M, y, size: 8, font: bold, color: MUTED });
  y -= 16;
  for (const line of [
    "Show this voucher and a CNIC or passport at check-in.",
    "Save this file to your phone — mobile signal is limited in many GB valleys.",
    "Any problem on the ground: call Rego on " + siteConfig.contactPhoneDisplay + ".",
  ]) {
    y = drawWrapped(page, "•  " + line, M, y, width - M * 2, 10, body, INK);
    y -= 2;
  }

  /* ---- footer ---- */
  const foot = `${siteConfig.url}  ·  ${siteConfig.contactEmail}  ·  ${siteConfig.contactPhoneDisplay}`;
  page.drawLine({
    start: { x: M, y: 66 }, end: { x: width - M, y: 66 },
    thickness: 1, color: LINE,
  });
  page.drawText(foot, { x: M, y: 50, size: 8, font: body, color: MUTED });
  if (v.bookedOn) {
    const issued = `Issued ${date(v.bookedOn)}`;
    page.drawText(issued, {
      x: width - M - body.widthOfTextAtSize(issued, 8),
      y: 50, size: 8, font: body, color: MUTED,
    });
  }

  return pdf.save();
}

/* ---------------- small helpers ---------------- */

function field(
  page: ReturnType<PDFDocument["addPage"]>,
  x: number,
  y: number,
  label: string,
  value: string,
  bold: PDFFont,
  body: PDFFont
): number {
  page.drawText(label.toUpperCase(), { x, y, size: 7, font: body, color: MUTED });
  page.drawText(value, { x, y: y - 13, size: 11, font: bold, color: INK });
  return y - 34;
}

/** Wrap text by measured width — pdf-lib has no layout engine. */
function drawWrapped(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>
): number {
  const words = text.split(/\s+/);
  let line = "";
  let cursor = y;

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      page.drawText(line, { x, y: cursor, size, font, color });
      cursor -= size + 4;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) {
    page.drawText(line, { x, y: cursor, size, font, color });
    cursor -= size + 4;
  }
  return cursor;
}
