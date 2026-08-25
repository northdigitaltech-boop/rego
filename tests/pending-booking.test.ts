import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  bool,
  clearPendingBooking,
  num,
  savePendingBooking,
  signupHref,
  str,
  takePendingBooking,
} from "@/lib/pending-booking";

/* ============================================================
 * Bookings here are confirmed the moment they are created, so
 * the rules this file enforces are not cosmetic: a snapshot
 * that replayed twice, or replayed into the wrong listing, or
 * replayed a week later, would each mean a real booking that
 * nobody asked for and a provider committed to it.
 * ============================================================ */

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.get(k) ?? null; }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, v); }
}

beforeEach(() => {
  vi.useRealTimers();
  const store = new MemoryStorage();
  vi.stubGlobal("window", { sessionStorage: store });
});

const FORM = { checkIn: "2026-09-01", guests: 3, notes: "late arrival" };

describe("holding a booking across sign-up", () => {
  it("gives the form back to the listing it came from", () => {
    savePendingBooking("hotel", "abc", FORM);
    expect(takePendingBooking("hotel", "abc")).toEqual(FORM);
  });

  it("returns nothing when there is no snapshot", () => {
    expect(takePendingBooking("hotel", "abc")).toBeNull();
  });

  /* The one that matters most. */
  it("can only be replayed once", () => {
    savePendingBooking("hotel", "abc", FORM);
    expect(takePendingBooking("hotel", "abc")).toEqual(FORM);
    expect(takePendingBooking("hotel", "abc")).toBeNull();
  });

  it("will not replay into a different listing", () => {
    savePendingBooking("hotel", "abc", FORM);
    expect(takePendingBooking("hotel", "xyz")).toBeNull();
  });

  it("will not replay a media form into a hotel", () => {
    savePendingBooking("media", "abc", FORM);
    expect(takePendingBooking("hotel", "abc")).toBeNull();
  });

  it("expires, so an abandoned sign-up cannot book hours later", () => {
    savePendingBooking("hotel", "abc", FORM);
    /* Two hours on from saving — past the one-hour window. */
    vi.setSystemTime(new Date(Date.now() + 2 * 60 * 60 * 1000));
    expect(takePendingBooking("hotel", "abc")).toBeNull();
    vi.useRealTimers();
  });

  it("still replays inside the window", () => {
    savePendingBooking("hotel", "abc", FORM);
    vi.setSystemTime(new Date(Date.now() + 30 * 60 * 1000));
    expect(takePendingBooking("hotel", "abc")).toEqual(FORM);
    vi.useRealTimers();
  });

  it("drops a corrupted snapshot instead of throwing", () => {
    window.sessionStorage.setItem("rego:pending-booking", "{not json");
    expect(() => takePendingBooking("hotel", "abc")).not.toThrow();
    expect(takePendingBooking("hotel", "abc")).toBeNull();
  });

  it("clears on request", () => {
    savePendingBooking("hotel", "abc", FORM);
    clearPendingBooking();
    expect(takePendingBooking("hotel", "abc")).toBeNull();
  });

  /* Private browsing and locked-down browsers throw on sessionStorage. Losing
     the snapshot is a nuisance; a booking form that crashes is not. */
  it("survives a browser that refuses storage", () => {
    vi.stubGlobal("window", {
      get sessionStorage(): Storage {
        throw new Error("blocked");
      },
    });
    expect(() => savePendingBooking("hotel", "abc", FORM)).not.toThrow();
    expect(takePendingBooking("hotel", "abc")).toBeNull();
    expect(() => clearPendingBooking()).not.toThrow();
  });

  it("survives being called with no window at all", () => {
    vi.stubGlobal("window", undefined);
    expect(() => savePendingBooking("hotel", "abc", FORM)).not.toThrow();
    expect(takePendingBooking("hotel", "abc")).toBeNull();
  });
});

describe("signupHref", () => {
  it("sends them back to the booking form afterwards", () => {
    expect(signupHref("/listings/abc#book")).toBe(
      "/signup?redirect=%2Flistings%2Fabc%23book"
    );
  });
});

describe("reading values back out", () => {
  /* Everything comes back through JSON as unknown, and a wrong type reaching
     a form field is how a booking ends up with 0 guests. */
  it("falls back rather than passing a wrong type through", () => {
    expect(str(undefined)).toBe("");
    expect(str(42)).toBe("");
    expect(str("ok")).toBe("ok");

    expect(num(undefined, 2)).toBe(2);
    expect(num("3", 2)).toBe(2);
    expect(num(NaN, 2)).toBe(2);
    expect(num(5, 2)).toBe(5);

    expect(bool(undefined)).toBe(false);
    expect(bool("true")).toBe(false);
    expect(bool(true)).toBe(true);
    expect(bool(undefined, true)).toBe(true);
  });
});
