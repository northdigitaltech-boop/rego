import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  captureReferral,
  clearReferral,
  looksLikeReferralCode,
  readReferral,
  referralMessage,
  rememberTypedReferral,
} from "@/lib/referral";

/* A referral survives several page loads and possibly several days, so the
   thing worth testing is the storage rules rather than the network call. */
const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.useRealTimers();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
});

describe("looksLikeReferralCode", () => {
  it("accepts the shapes employee codes actually take", () => {
    expect(looksLikeReferralCode("MKT-001")).toBe(true);
    expect(looksLikeReferralCode("ALI-REGO-01")).toBe(true);
    expect(looksLikeReferralCode("VER001")).toBe(true);
  });

  it("rejects junk before it can be stored for a month", () => {
    expect(looksLikeReferralCode("")).toBe(false);
    expect(looksLikeReferralCode("ab")).toBe(false);
    expect(looksLikeReferralCode("-leading")).toBe(false);
    expect(looksLikeReferralCode("has space")).toBe(false);
    expect(looksLikeReferralCode("<script>alert(1)</script>")).toBe(false);
    expect(looksLikeReferralCode("x".repeat(40))).toBe(false);
  });
});

describe("captureReferral", () => {
  it("stores a code from the query string, upper-cased", () => {
    expect(captureReferral("?ref=mkt-001")).toBe("MKT-001");
    expect(readReferral()).toBe("MKT-001");
  });

  it("ignores a query string with no ref", () => {
    expect(captureReferral("?utm_source=whatsapp")).toBeNull();
    expect(readReferral()).toBeNull();
  });

  it("ignores a malformed ref rather than storing it", () => {
    expect(captureReferral("?ref=<script>")).toBeNull();
    expect(readReferral()).toBeNull();
  });

  it("keeps the FIRST link and ignores a later one", () => {
    /* Matches the database, where referral is first-touch: whoever actually
       brought them here did that once. A second link must not overwrite it. */
    captureReferral("?ref=MKT-001");
    captureReferral("?ref=MKT-002");
    expect(readReferral()).toBe("MKT-001");
  });

  it("survives a page with other parameters", () => {
    expect(captureReferral("?utm=x&ref=MKT-007&page=2")).toBe("MKT-007");
  });
});

describe("rememberTypedReferral", () => {
  it("takes a code somebody typed instead of following a link", () => {
    expect(rememberTypedReferral(" mkt-003 ")).toBe("MKT-003");
    expect(readReferral()).toBe("MKT-003");
  });

  it("refuses junk", () => {
    expect(rememberTypedReferral("!!")).toBeNull();
    expect(readReferral()).toBeNull();
  });

  it("REPLACES a stashed link, unlike captureReferral", () => {
    /* Deliberate asymmetry. A link is passive and first-touch wins; typing a
       code is a person telling us who sent them, and they get the last word. */
    captureReferral("?ref=MKT-001");
    rememberTypedReferral("MKT-002");
    expect(readReferral()).toBe("MKT-002");
  });
});

describe("expiry", () => {
  it("forgets a code older than thirty days", () => {
    /* Otherwise a link clicked in January credits someone for a registration
       in June that they had nothing to do with. */
    store.set(
      "rego_referral",
      JSON.stringify({
        code: "MKT-001",
        at: Date.now() - 31 * 24 * 60 * 60 * 1000,
        source: "referral_link",
      })
    );
    expect(readReferral()).toBeNull();
    expect(store.has("rego_referral")).toBe(false);
  });

  it("keeps one from a fortnight ago", () => {
    store.set(
      "rego_referral",
      JSON.stringify({
        code: "MKT-001",
        at: Date.now() - 14 * 24 * 60 * 60 * 1000,
        source: "referral_link",
      })
    );
    expect(readReferral()).toBe("MKT-001");
  });
});

describe("corrupt storage", () => {
  it("survives a value that is not JSON", () => {
    store.set("rego_referral", "not json at all");
    expect(readReferral()).toBeNull();
  });

  it("survives JSON of the wrong shape", () => {
    store.set("rego_referral", JSON.stringify({ nope: true }));
    expect(readReferral()).toBeNull();
  });

  it("rejects a stored code that no longer looks like one", () => {
    // Somebody editing localStorage by hand.
    store.set(
      "rego_referral",
      JSON.stringify({ code: "'; drop table --", at: Date.now(), source: "referral_link" })
    );
    expect(readReferral()).toBeNull();
  });

  it("survives storage throwing entirely", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("private browsing");
        },
        setItem: () => {
          throw new Error("quota");
        },
        removeItem: () => {},
      },
    });
    /* A referral is worth having and not worth breaking a page for. */
    expect(() => captureReferral("?ref=MKT-001")).not.toThrow();
    expect(readReferral()).toBeNull();
  });
});

describe("clearReferral", () => {
  it("removes the code", () => {
    captureReferral("?ref=MKT-001");
    clearReferral();
    expect(readReferral()).toBeNull();
  });
});

describe("referralMessage", () => {
  it("says nothing when it worked", () => {
    expect(referralMessage("attached")).toBeNull();
    expect(referralMessage("already")).toBeNull();
  });

  it("mentions a code that was not recognised", () => {
    /* A typo is worth telling them about; it is the one case they can fix. */
    expect(referralMessage("unknown_code")).toContain("not recognised");
  });

  it("mentions a code that is no longer active", () => {
    expect(referralMessage("inactive")).toContain("no longer active");
  });

  it("stays quiet about internal failures", () => {
    /* "not_yours" and "failed" are Rego's problem, not the provider's, and
       their registration succeeded either way. */
    expect(referralMessage("not_yours")).toBeNull();
    expect(referralMessage("failed")).toBeNull();
    expect(referralMessage("none")).toBeNull();
  });
});
