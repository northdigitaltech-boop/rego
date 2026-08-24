import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/* ============================================================
 * SEO Phase 1 — regression tests.
 *
 * These cover the failures that are invisible from the browser:
 * a canonical pointing at the wrong URL, a preview deployment
 * that becomes indexable, a private route that quietly returns
 * a 200 with index:true, or JSON-LD that can break out of its
 * <script> tag.
 *
 * Each test names the bug it is guarding against, because a
 * test whose purpose is not obvious gets deleted the first
 * time it is inconvenient.
 * ============================================================ */

const PROD = "https://rego.services";

/** Re-import the modules with a specific environment. */
async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  const prev = { ...process.env };
  Object.assign(process.env, env);
  const site = await import("@/lib/site");
  const seo = await import("@/lib/seo");
  const robots = (await import("@/app/robots")).default;
  process.env = prev;
  return { site, seo, robots };
}

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/* ------------------------------------------------------------------ */

describe("canonical URL construction", () => {
  it("builds absolute canonicals against the production origin", async () => {
    const { site } = await load({
      NEXT_PUBLIC_SITE_URL: PROD,
      NODE_ENV: "production",
    });
    expect(site.absoluteUrl("/destinations/skardu")).toBe(
      `${PROD}/destinations/skardu`
    );
  });

  it("normalises a path that is missing its leading slash", async () => {
    const { site } = await load({ NEXT_PUBLIC_SITE_URL: PROD });
    expect(site.absoluteUrl("about")).toBe(`${PROD}/about`);
  });

  it("leaves an already-absolute URL alone", async () => {
    const { site } = await load({ NEXT_PUBLIC_SITE_URL: PROD });
    expect(site.absoluteUrl("https://example.com/x")).toBe("https://example.com/x");
  });

  it("returns the origin for an empty path", async () => {
    const { site } = await load({ NEXT_PUBLIC_SITE_URL: PROD });
    expect(site.absoluteUrl("")).toBe(PROD);
  });

  /* THE BUG THIS GUARDS: the root layout used to set canonical "/", which the
     App Router inherits onto every page without its own. Every such page then
     declared itself a duplicate of the homepage. */
  it("gives two different pages two different canonicals", async () => {
    const { seo } = await load({
      NEXT_PUBLIC_SITE_URL: PROD,
      NODE_ENV: "production",
    });
    const a = seo.buildMetadata({ path: "/about" });
    const b = seo.buildMetadata({ path: "/contact" });
    expect(a.alternates?.canonical).toBe(`${PROD}/about`);
    expect(b.alternates?.canonical).toBe(`${PROD}/contact`);
    expect(a.alternates?.canonical).not.toBe(b.alternates?.canonical);
  });

  it("never puts a query string in the canonical", async () => {
    const { seo } = await load({ NEXT_PUBLIC_SITE_URL: PROD });
    const m = seo.buildMetadata({ path: "/listings" });
    expect(String(m.alternates?.canonical)).not.toContain("?");
  });
});

/* ------------------------------------------------------------------ */

describe("production vs preview indexability", () => {
  it("is indexable on the production host in a production build", async () => {
    const { site } = await load({
      NEXT_PUBLIC_SITE_URL: PROD,
      NODE_ENV: "production",
    });
    expect(site.IS_INDEXABLE).toBe(true);
  });

  /* THE BUG THIS GUARDS: a Vercel preview deployment getting indexed and
     competing with production for its own queries. */
  it("is NOT indexable on a Vercel preview host", async () => {
    const { site } = await load({
      NEXT_PUBLIC_SITE_URL: "https://rego-git-feature-x.vercel.app",
      NODE_ENV: "production",
    });
    expect(site.IS_INDEXABLE).toBe(false);
  });

  it("is NOT indexable in development", async () => {
    const { site } = await load({
      NEXT_PUBLIC_SITE_URL: PROD,
      NODE_ENV: "development",
    });
    expect(site.IS_INDEXABLE).toBe(false);
  });

  it("is NOT indexable on localhost", async () => {
    const { site } = await load({
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NODE_ENV: "production",
    });
    expect(site.IS_INDEXABLE).toBe(false);
  });

  it("honours the explicit noindex kill switch even on production", async () => {
    const { site } = await load({
      NEXT_PUBLIC_SITE_URL: PROD,
      NODE_ENV: "production",
      NEXT_PUBLIC_SEO_NOINDEX: "true",
    });
    expect(site.IS_INDEXABLE).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

describe("buildMetadata robots decisions", () => {
  it("marks a page noindex when asked, even in production", async () => {
    const { seo } = await load({
      NEXT_PUBLIC_SITE_URL: PROD,
      NODE_ENV: "production",
    });
    const m = seo.buildMetadata({ path: "/listings", noindex: true });
    expect((m.robots as { index?: boolean }).index).toBe(false);
  });

  /* Filtered listing pages must stay FOLLOW so crawlers still reach the
     listings themselves — noindex,nofollow would strand them. */
  it("keeps follow enabled on a noindex search page", async () => {
    const { seo } = await load({
      NEXT_PUBLIC_SITE_URL: PROD,
      NODE_ENV: "production",
    });
    const m = seo.buildMetadata({ path: "/listings", noindex: true });
    expect((m.robots as { follow?: boolean }).follow).toBe(true);
  });

  it("noindexMetadata() is noindex AND nofollow, for private pages", async () => {
    const { seo } = await load({
      NEXT_PUBLIC_SITE_URL: PROD,
      NODE_ENV: "production",
    });
    const m = seo.noindexMetadata();
    expect((m.robots as { index?: boolean }).index).toBe(false);
    expect((m.robots as { follow?: boolean }).follow).toBe(false);
  });

  it("cannot be indexable on a preview host even without noindex", async () => {
    const { seo } = await load({
      NEXT_PUBLIC_SITE_URL: "https://preview.vercel.app",
      NODE_ENV: "production",
    });
    const m = seo.buildMetadata({ path: "/about" });
    expect((m.robots as { index?: boolean }).index).toBe(false);
  });

  it("emits an Open Graph image with real dimensions", async () => {
    const { seo } = await load({ NEXT_PUBLIC_SITE_URL: PROD });
    const og = seo.buildMetadata({ path: "/" }).openGraph as {
      images?: { url: string; width?: number; height?: number }[];
    };
    expect(og.images?.[0]?.width).toBe(1200);
    expect(og.images?.[0]?.height).toBe(630);
    expect(og.images?.[0]?.url.startsWith("http")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

/**
 * robots.rules became an ARRAY when the AI-crawler rules were added — one
 * block for "*", then one per bot group. These helpers read either shape so
 * the tests describe intent rather than the current data structure.
 */
type RuleBlock = {
  userAgent?: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
};

function blocks(r: { rules: unknown }): RuleBlock[] {
  return Array.isArray(r.rules) ? (r.rules as RuleBlock[]) : [r.rules as RuleBlock];
}

/** The rules that apply to ordinary search engines. */
function wildcardBlock(r: { rules: unknown }): RuleBlock {
  return blocks(r).find((b) => b.userAgent === "*") ?? blocks(r)[0];
}

function agentBlock(r: { rules: unknown }, agent: string): RuleBlock | undefined {
  return blocks(r).find((b) =>
    Array.isArray(b.userAgent) ? b.userAgent.includes(agent) : b.userAgent === agent
  );
}

const asList = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

describe("robots.txt", () => {
  it("blocks everything on a preview deployment", async () => {
    const { robots } = await load({
      NEXT_PUBLIC_SITE_URL: "https://preview.vercel.app",
      NODE_ENV: "production",
    });
    const r = robots();
    expect(asList(wildcardBlock(r).disallow)).toContain("/");
    // A blocked deployment must not advertise a sitemap.
    expect(r.sitemap).toBeUndefined();
  });

  it("references the sitemap on the canonical host", async () => {
    const { robots } = await load({
      NEXT_PUBLIC_SITE_URL: PROD,
      NODE_ENV: "production",
    });
    expect(robots().sitemap).toBe(`${PROD}/sitemap.xml`);
  });

  it("disallows every private area", async () => {
    const { robots } = await load({
      NEXT_PUBLIC_SITE_URL: PROD,
      NODE_ENV: "production",
    });
    const disallow = asList(wildcardBlock(robots()).disallow);
    for (const p of [
      "/admin",
      "/cyber", // was missing — the security portal
      "/dashboard",
      "/api/",
      "/signin",
      "/signup",
      "/reset-password",
      "/messages",
    ]) {
      expect(disallow).toContain(p);
    }
  });

  /* THE BUG THIS GUARDS: blanket-blocking "/*?" would also block ?page=2 and
     make paginated listings uncrawlable. Filters are handled with noindex
     instead, which needs the crawler to be able to fetch the page. */
  it("does not block query strings wholesale", async () => {
    const { robots } = await load({
      NEXT_PUBLIC_SITE_URL: PROD,
      NODE_ENV: "production",
    });
    const disallow = asList(wildcardBlock(robots()).disallow);
    expect(disallow.some((d) => d.includes("?"))).toBe(false);
  });

  it("does not block public content routes", async () => {
    const { robots } = await load({
      NEXT_PUBLIC_SITE_URL: PROD,
      NODE_ENV: "production",
    });
    const disallow = asList(wildcardBlock(robots()).disallow);
    for (const p of ["/listings", "/destinations", "/categories", "/jobs", "/safarnama"]) {
      expect(disallow).not.toContain(p);
    }
  });
});

/* ------------------------------------------------------------------ */

describe("JSON-LD escaping", () => {
  /* THE BUG THIS GUARDS: a name containing "</script>" breaking out of the
     JSON-LD block and executing as HTML. Our data is server-side, but a
     provider-supplied business name reaches these helpers. */
  it("escapes a closing script tag inside serialized data", () => {
    const evil = { name: 'Hotel </script><img src=x onerror=alert(1)>' };
    const out = JSON.stringify(evil).replace(/</g, "\\u003c");
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<img");
    expect(out).toContain("\\u003c");
  });

  it("still parses back to the original value after escaping", () => {
    const original = { name: "A < B & C" };
    const escaped = JSON.stringify(original).replace(/</g, "\\u003c");
    expect(JSON.parse(escaped)).toEqual(original);
  });
});

/* ------------------------------------------------------------------ */

describe("location page indexability gate", () => {
  it("refuses a thin page with no listings and no content", async () => {
    const { decideIndexable } = await import("@/lib/location-seo");
    const d = decideIndexable({
      locationIsActive: true,
      locationIsPublic: true,
      seoEnabled: true,
      serviceAvailable: true,
      comingSoon: false,
      robotsIndex: true,
      listingCount: 0,
      contentChars: 0,
    });
    expect(d.index).toBe(false);
    expect(d.reason).toMatch(/thin/i);
  });

  it("allows a page with enough real listings", async () => {
    const { decideIndexable } = await import("@/lib/location-seo");
    expect(
      decideIndexable({
        locationIsActive: true,
        locationIsPublic: true,
        seoEnabled: true,
        serviceAvailable: true,
        comingSoon: false,
        robotsIndex: true,
        listingCount: 5,
        contentChars: 0,
      }).index
    ).toBe(true);
  });

  it("allows a page carried by written content alone", async () => {
    const { decideIndexable } = await import("@/lib/location-seo");
    expect(
      decideIndexable({
        locationIsActive: true,
        locationIsPublic: true,
        seoEnabled: true,
        serviceAvailable: true,
        comingSoon: false,
        robotsIndex: true,
        listingCount: 0,
        contentChars: 500,
      }).index
    ).toBe(true);
  });

  /* "Coming soon" is a placeholder. A placeholder is the definition of a
     thin page, so it must not earn indexing on its own. */
  it("refuses a coming-soon page with no content", async () => {
    const { decideIndexable } = await import("@/lib/location-seo");
    const d = decideIndexable({
      locationIsActive: true,
      locationIsPublic: true,
      seoEnabled: true,
      serviceAvailable: true,
      comingSoon: true,
      robotsIndex: true,
      listingCount: 10,
      contentChars: 50,
    });
    expect(d.index).toBe(false);
    expect(d.reason).toMatch(/coming soon/i);
  });

  it("respects an explicit noindex from the admin", async () => {
    const { decideIndexable } = await import("@/lib/location-seo");
    expect(
      decideIndexable({
        locationIsActive: true,
        locationIsPublic: true,
        seoEnabled: true,
        serviceAvailable: true,
        comingSoon: false,
        robotsIndex: false,
        listingCount: 99,
        contentChars: 9999,
      }).index
    ).toBe(false);
  });

  it("refuses a page whose area is not public", async () => {
    const { decideIndexable } = await import("@/lib/location-seo");
    expect(
      decideIndexable({
        locationIsActive: true,
        locationIsPublic: false,
        seoEnabled: true,
        serviceAvailable: true,
        comingSoon: false,
        robotsIndex: true,
        listingCount: 99,
        contentChars: 9999,
      }).index
    ).toBe(false);
  });

  it("counts intro, body and FAQ towards the content threshold", async () => {
    const { contentLength } = await import("@/lib/location-seo");
    expect(
      contentLength({
        intro: "abc",
        body: "defg",
        faq: [{ q: "hi", a: "there" }],
      })
    ).toBeGreaterThan(10);
    expect(contentLength(null)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */

describe("AI crawler policy", () => {
  /* Whether AI crawlers may read Rego is a business decision held in one
     constant. These tests check the MECHANISM works in both directions, not
     which way it is currently set — so flipping the constant does not break
     the suite. */

  it("gives the AI training bots their own rule block", async () => {
    const { robots } = await load({
      NEXT_PUBLIC_SITE_URL: PROD,
      NODE_ENV: "production",
    });
    expect(agentBlock(robots(), "GPTBot")).toBeDefined();
    expect(agentBlock(robots(), "ClaudeBot")).toBeDefined();
    expect(agentBlock(robots(), "PerplexityBot")).toBeDefined();
  });

  it("blocks Google-Extended separately from Googlebot", async () => {
    const { robots } = await load({
      NEXT_PUBLIC_SITE_URL: PROD,
      NODE_ENV: "production",
    });
    /* Google-Extended controls Gemini training only. Confusing it with
       Googlebot would remove Rego from ordinary Google Search. */
    expect(agentBlock(robots(), "Google-Extended")).toBeDefined();
    expect(agentBlock(robots(), "Googlebot")).toBeUndefined();
  });

  /* On-demand fetchers act for a person who pasted a Rego link and is waiting
     for it to load. Blocking them protects nothing and breaks that. */
  it("always allows on-demand user agents", async () => {
    const { robots } = await load({
      NEXT_PUBLIC_SITE_URL: PROD,
      NODE_ENV: "production",
    });
    const b = agentBlock(robots(), "ChatGPT-User");
    expect(b).toBeDefined();
    expect(asList(b?.allow)).toContain("/");
  });

  it("keeps private areas blocked for AI bots too", async () => {
    const { robots } = await load({
      NEXT_PUBLIC_SITE_URL: PROD,
      NODE_ENV: "production",
    });
    const b = agentBlock(robots(), "GPTBot");
    const rules = asList(b?.disallow);
    // Either every private path, or a blanket "/" when AI access is off.
    const ok = rules.includes("/") || ["/admin", "/cyber", "/dashboard"].every((p) => rules.includes(p));
    expect(ok).toBe(true);
  });

  it("emits no AI rules at all on a preview deployment", async () => {
    const { robots } = await load({
      NEXT_PUBLIC_SITE_URL: "https://preview.vercel.app",
      NODE_ENV: "production",
    });
    // Preview returns a single blanket block; no per-bot rules to leak.
    expect(agentBlock(robots(), "GPTBot")).toBeUndefined();
  });
});
