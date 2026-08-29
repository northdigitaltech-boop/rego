import { describe, expect, it } from "vitest";

import {
  BOOKING_KINDS,
  BOOKING_TABLES,
  BLOCK_MESSAGE,
  CANCELLED_STATUS,
  CANCEL_REASONS,
  bookingStatusMeta,
  canCancel,
  cancelEligibility,
  cancelledByLabel,
  isCancelReason,
  reasonLabel,
  tableForKind,
} from "@/lib/booking-cancellation";

/* ============================================================
 * The API and the UI both decide from this module. These tests
 * are what stops them from disagreeing — a button offering a
 * cancellation the server refuses is a dead click with no
 * explanation, and it is the failure most likely to appear
 * later, once someone edits one side.
 * ============================================================ */

describe("which statuses may be cancelled", () => {
  it("allows the two statuses REGO actually writes", () => {
    expect(canCancel("pending")).toBe(true);
    expect(canCancel("accepted")).toBe(true);
  });

  it("allows the confirmed spellings the voucher route already honours", () => {
    expect(canCancel("approved")).toBe(true);
    expect(canCancel("confirmed")).toBe(true);
  });

  it("refuses anything that has already ended", () => {
    for (const s of ["completed", "cancelled", "canceled", "rejected", "declined"]) {
      expect(canCancel(s), s).toBe(false);
    }
  });

  it("refuses a service that has already started", () => {
    expect(canCancel("in_progress")).toBe(false);
    expect(canCancel("started")).toBe(false);
  });

  it("refuses a status it does not recognise", () => {
    /* The safe direction. An unknown status means nobody here knows what the
       booking is, and cancelling it would be acting on a guess. */
    expect(canCancel("awaiting_deposit")).toBe(false);
    expect(cancelEligibility("awaiting_deposit")).toEqual({
      ok: false,
      why: "unknown_status",
    });
  });

  it("refuses null, undefined and empty, which old rows really do have", () => {
    expect(canCancel(null)).toBe(false);
    expect(canCancel(undefined)).toBe(false);
    expect(canCancel("")).toBe(false);
  });

  it("ignores case and stray whitespace", () => {
    /* Ten tables written at ten different times. Assuming they all agree on
       casing is the kind of assumption that fails in production only. */
    expect(canCancel("  Pending ")).toBe(true);
    expect(canCancel("ACCEPTED")).toBe(true);
    expect(canCancel(" Cancelled")).toBe(false);
  });

  it("gives a specific reason for every refusal", () => {
    const cases: [string, keyof typeof BLOCK_MESSAGE][] = [
      ["cancelled", "already_cancelled"],
      ["completed", "completed"],
      ["rejected", "rejected"],
      ["in_progress", "in_progress"],
      ["nonsense", "unknown_status"],
    ];
    for (const [status, why] of cases) {
      const r = cancelEligibility(status);
      expect(r.ok, status).toBe(false);
      if (!r.ok) {
        expect(r.why, status).toBe(why);
        expect(BLOCK_MESSAGE[r.why].length).toBeGreaterThan(20);
      }
    }
  });

  it("cannot cancel a booking twice", () => {
    /* The second click of a double-click, and the second tab of someone with
       the dashboard open twice. */
    expect(canCancel(CANCELLED_STATUS)).toBe(false);
  });
});

describe("kind to table", () => {
  it("covers all ten booking tables", () => {
    expect(BOOKING_KINDS).toHaveLength(10);
    expect(new Set(Object.values(BOOKING_TABLES)).size).toBe(10);
  });

  it("maps every kind to a table", () => {
    for (const k of BOOKING_KINDS) {
      expect(tableForKind(k), k).toBe(BOOKING_TABLES[k]);
    }
  });

  it("refuses anything not in the list", () => {
    /* The kind arrives in a request body, and the result is used as a table
       name. Everything here is a payload someone could send. */
    for (const bad of [
      "profiles",
      "auth.users",
      "bookings; drop table bookings",
      "",
      "HOTEL",
      "__proto__",
      "constructor",
      "toString",
    ]) {
      expect(tableForKind(bad), bad).toBeNull();
    }
  });

  it("does not inherit a table name from Object.prototype", () => {
    /* hasOwnProperty rather than `kind in BOOKING_TABLES`, so a payload of
       {"kind":"toString"} cannot resolve to a function. */
    expect(tableForKind("hasOwnProperty")).toBeNull();
    expect(tableForKind("valueOf")).toBeNull();
  });
});

describe("reasons", () => {
  it("offers the seven the traveller can pick", () => {
    expect(CANCEL_REASONS).toHaveLength(7);
    expect(CANCEL_REASONS.at(-1)!.value).toBe("other");
  });

  it("accepts only its own values", () => {
    for (const r of CANCEL_REASONS) expect(isCancelReason(r.value)).toBe(true);
    expect(isCancelReason("whatever")).toBe(false);
    expect(isCancelReason("")).toBe(false);
  });

  it("has a label for every value, and falls back to the raw value", () => {
    for (const r of CANCEL_REASONS) expect(reasonLabel(r.value)).toBe(r.label);
    expect(reasonLabel("a custom reason")).toBe("a custom reason");
  });
});

describe("what each side calls a status", () => {
  it("no longer shows a cancelled booking as pending", () => {
    /* The bug this helper was written for: every dashboard had its own chain
       of ternaries whose final else was "Pending", so a booking the traveller
       cancelled displayed to its provider as still awaiting their answer. */
    expect(bookingStatusMeta("cancelled").label).toBe("Cancelled");
    expect(bookingStatusMeta("canceled").label).toBe("Cancelled");
  });

  it("labels the statuses the dashboards already showed", () => {
    expect(bookingStatusMeta("accepted").label).toBe("Confirmed");
    expect(bookingStatusMeta("rejected").label).toBe("Rejected");
    expect(bookingStatusMeta("pending").label).toBe("Pending");
  });

  it("treats an unknown or missing status as pending", () => {
    /* Different from cancellation, where unknown means refuse. Here the
       question is only what to print, and "Pending" is the least wrong
       thing to print about a booking nobody has answered. */
    expect(bookingStatusMeta(null).label).toBe("Pending");
    expect(bookingStatusMeta("something_new").label).toBe("Pending");
  });

  it("says who cancelled, including for rows that do not say", () => {
    expect(cancelledByLabel("traveler")).toBe("Cancelled by traveller");
    expect(cancelledByLabel("traveller")).toBe("Cancelled by traveller");
    expect(cancelledByLabel("provider")).toBe("Cancelled by provider");
    expect(cancelledByLabel("admin")).toBe("Cancelled by Rego");
    /* A booking cancelled some other way, before this existed. */
    expect(cancelledByLabel(null)).toBe("Cancelled");
    expect(cancelledByLabel("")).toBe("Cancelled");
  });
});
