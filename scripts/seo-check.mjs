#!/usr/bin/env node
/**
 * Live SEO verification.
 *
 *   node scripts/seo-check.mjs                      # checks https://rego.services
 *   node scripts/seo-check.mjs http://localhost:3000
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * `npm test` proves the CODE is right. It cannot prove the DEPLOY is right —
 * a stale build, a missing env var, or a Vercel domain setting will all pass
 * the unit tests and still break SEO in production.
 *
 * So this fetches the real site and reads the real HTML. Every check prints
 * what it expected and what it got, so a failure tells you what to fix rather
 * than just that something is wrong.
 *
 * It checks facts, not opinions. It cannot tell you whether your content is
 * good — only whether the technical plumbing is doing what it claims.
 * ---------------------------------------------------------------------------
 */

const BASE = (process.argv[2] || "https://rego.services").replace(/\/$/, "");

let pass = 0;
let fail = 0;
let warn = 0;

const G = "\x1b[32m";
const R = "\x1b[31m";
const Y = "\x1b[33m";
const D = "\x1b[2m";
const X = "\x1b[0m";

function ok(label, detail = "") {
  pass++;
  console.log(`  ${G}PASS${X}  ${label}${detail ? `  ${D}${detail}${X}` : ""}`);
}
function bad(label, expected, got) {
  fail++;
  console.log(`  ${R}FAIL${X}  ${label}`);
  console.log(`        expected: ${expected}`);
  console.log(`        got:      ${got}`);
}
function caution(label, detail) {
  warn++;
  console.log(`  ${Y}WARN${X}  ${label}  ${D}${detail}${X}`);
}

async function get(path) {
  const url = path.startsWith("http") ? path : BASE + path;
  try {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": "rego-seo-check" },
    });
    const body = res.status < 300 || res.status >= 400 ? await res.text() : "";
    return { status: res.status, headers: res.headers, body, url };
  } catch (e) {
    return { status: 0, headers: new Headers(), body: "", url, error: String(e) };
  }
}

const canonicalOf = (html) =>
  html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? null;
const robotsOf = (html) =>
  html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? null;
const titleOf = (html) => html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null;
const descOf = (html) =>
  html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? null;
const ogOf = (html, prop) =>
  html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']*)["']`, "i"))?.[1] ?? null;

/* ------------------------------------------------------------------ */

console.log(`\nSEO check — ${BASE}\n${"=".repeat(60)}`);

/* 0. Reachability — before anything else.
 *
 * status 0 means the fetch itself failed: no DNS, no network, wrong host.
 * The first version of this script treated that as "no noindex problem
 * found" and printed PASS for every private page. A checker that reports
 * success when it could not connect is worse than no checker at all, so
 * an unreachable base URL is now a hard stop. */
{
  const probe = await get("/");

  /* A redirecting base URL means every check below would be run against the
     wrong host and report nonsense — which is exactly what happened the first
     time this ran: 16 "failures" that were really one wrong starting URL. */
  if (probe.status >= 300 && probe.status < 400) {
    const target = probe.headers.get("location") || "(no Location header)";
    console.log(`\n  ${Y}${BASE} REDIRECTS (${probe.status})${X}`);
    console.log(`  ${D}→ ${target}${X}\n`);
    console.log("  This is not the canonical host, so nothing below would be");
    console.log("  meaningful. Re-run against the host that serves the site:\n");
    try {
      console.log(`      npm run seo:check -- ${new URL(target, BASE).origin}\n`);
    } catch {
      console.log(`      npm run seo:check -- <the URL above>\n`);
    }
    console.log(`  ${D}Then make sure NEXT_PUBLIC_SITE_URL matches that host —${X}`);
    console.log(`  ${D}otherwise every canonical tag points at a redirect.${X}\n`);
    process.exit(2);
  }

  if (probe.status === 0) {
    console.log(`\n  ${R}CANNOT REACH ${BASE}${X}`);
    console.log(`  ${D}${probe.error ?? "network error"}${X}\n`);
    console.log("  Nothing below could be verified. Common causes:");
    console.log("    • the site is not deployed yet");
    console.log("    • no network access from where you ran this");
    console.log("    • wrong URL — pass it as an argument:");
    console.log(`        node scripts/seo-check.mjs http://localhost:3000\n`);
    process.exit(2);
  }
  ok(`${BASE} reachable`, `HTTP ${probe.status}`);
}

/* 1. Canonical host --------------------------------------------------- */
console.log("\n1. Canonical host");
{
  const host = new URL(BASE).host;
  const alt = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
  const r = await get(`https://${alt}/`);

  if (r.status === 0) {
    caution(`https://${alt} unreachable`, "may simply not be configured — fine");
  } else if (r.status >= 300 && r.status < 400) {
    const loc = r.headers.get("location") || "";
    /* 308 is a permanent redirect that preserves the request method, and it
       is what Vercel emits by default. Google treats 301 and 308 the same.
       An earlier version of this script only accepted 301 and reported a
       perfectly correct setup as broken. */
    if ((r.status === 301 || r.status === 308) && loc.includes(host)) {
      ok(`${alt} → ${r.status} → ${host}`);
    } else if (loc.includes(host)) {
      caution(`${alt} redirects with ${r.status}`, "302/307 is temporary — use 301 or 308");
    } else {
      bad("alternate host redirect", `301/308 to ${host}`, `${r.status} → ${loc}`);
    }
  } else if (r.status === 200) {
    /* THE PROBLEM: both hosts serving 200 means the same content lives at two
       URLs and they compete with each other. */
    bad(`${alt} serves content`, `301 redirect to ${host}`, `HTTP 200 — duplicate site`);
  }

  if (BASE.startsWith("https://")) ok("HTTPS in use");
  else bad("scheme", "https://", BASE);
}

/* 2. robots.txt ------------------------------------------------------- */
console.log("\n2. robots.txt");
{
  const r = await get("/robots.txt");
  if (r.status !== 200) {
    bad("robots.txt reachable", "200", r.status);
  } else {
    const t = r.body;
    t.includes(`${BASE}/sitemap.xml`)
      ? ok("references the sitemap")
      : bad("sitemap reference", `${BASE}/sitemap.xml`, t.match(/Sitemap:.*/i)?.[0] ?? "none");

    for (const p of ["/admin", "/cyber", "/dashboard", "/api/", "/signin"]) {
      t.includes(`Disallow: ${p}`)
        ? ok(`blocks ${p}`)
        : bad(`blocks ${p}`, `Disallow: ${p}`, "not present");
    }
    /* A blanket disallow of "/" on production means the whole site is
       de-indexed — usually a wrong NEXT_PUBLIC_SITE_URL. */
    if (/^Disallow: \/$/m.test(t)) {
      bad("site-wide block", "public pages allowed", "Disallow: / — the WHOLE site is blocked");
    } else {
      ok("does not block the whole site");
    }
    t.includes("?") ? caution("query strings blocked", "this also blocks ?page=2") : ok("does not block query strings");
  }
}

/* 3. sitemap.xml ------------------------------------------------------ */
console.log("\n3. sitemap.xml");
{
  const r = await get("/sitemap.xml");
  if (r.status !== 200) {
    bad("sitemap reachable", "200", r.status);
  } else {
    const urls = [...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    urls.length > 0 ? ok(`${urls.length} URLs`) : bad("sitemap content", "at least 1 URL", "empty");

    const leaked = urls.filter((u) =>
      /\/(admin|cyber|dashboard|signin|signup|reset-password|wishlist|messages|offline)(\/|$)/.test(u)
    );
    leaked.length === 0
      ? ok("no private routes")
      : bad("private routes in sitemap", "none", leaked.slice(0, 5).join(", "));

    const wrongHost = urls.filter((u) => !u.startsWith(BASE));
    wrongHost.length === 0
      ? ok("every URL on the canonical host")
      : bad("host mismatch", BASE, wrongHost.slice(0, 3).join(", "));

    const dupes = urls.filter((u, i) => urls.indexOf(u) !== i);
    dupes.length === 0 ? ok("no duplicate URLs") : bad("duplicates", "none", dupes.slice(0, 3).join(", "));

    const q = urls.filter((u) => u.includes("?"));
    q.length === 0 ? ok("no filtered URLs") : bad("query-string URLs", "none", q.slice(0, 3).join(", "));
  }
}

/* 4. Public page metadata --------------------------------------------- */
console.log("\n4. Public pages");
{
  const pages = ["/", "/about", "/contact", "/how-it-works", "/partner", "/listings", "/destinations"];
  for (const p of pages) {
    const r = await get(p);
    if (r.status !== 200) {
      bad(`${p} reachable`, "200", r.status);
      continue;
    }
    const c = canonicalOf(r.body);
    const expected = BASE + (p === "/" ? "" : p);

    /* THE BUG THIS CATCHES: the root layout's canonical leaking onto every
       page, making them all declare themselves duplicates of the homepage. */
    if (!c) bad(`${p} canonical`, expected, "missing");
    else if (c.replace(/\/$/, "") === expected.replace(/\/$/, "")) ok(`${p} canonical`);
    else bad(`${p} canonical`, expected, c);

    const t = titleOf(r.body);
    const d = descOf(r.body);
    if (!t) bad(`${p} title`, "a title", "missing");
    else if (t.length > 65) caution(`${p} title is ${t.length} chars`, "may be truncated in results");
    if (!d) bad(`${p} description`, "a description", "missing");
    else if (d.length > 165) caution(`${p} description is ${d.length} chars`, "may be truncated");

    const rb = robotsOf(r.body) ?? "";
    if (rb.includes("noindex")) bad(`${p} indexable`, "indexable", rb);
  }
}

/* 5. Private pages ---------------------------------------------------- */
console.log("\n5. Private pages must be noindex");
{
  for (const p of ["/admin", "/cyber", "/dashboard", "/signin", "/wishlist", "/pricing", "/offline"]) {
    const r = await get(p);
    /* Never read a failed request as a pass — see the note in section 0. */
    if (r.status === 0) {
      bad(`${p} checked`, "any HTTP response", "request failed — NOT verified");
      continue;
    }
    if (r.status === 404) {
      ok(`${p} → 404`);
      continue;
    }
    if (r.status !== 200) {
      ok(`${p} → ${r.status}`, "not a public 200");
      continue;
    }
    const rb = robotsOf(r.body) ?? "";
    rb.includes("noindex")
      ? ok(`${p} noindex`)
      : bad(`${p} noindex`, "noindex", rb || "no robots meta — INDEXABLE");
  }
}

/* 6. Filtered listings ------------------------------------------------ */
console.log("\n6. Search & filter pages");
{
  const r = await get("/listings?q=hunza&sort=price");
  if (r.status === 200) {
    const rb = robotsOf(r.body) ?? "";
    rb.includes("noindex")
      ? ok("filtered /listings is noindex")
      : bad("filtered /listings", "noindex", rb || "none — creates duplicate pages");

    const c = canonicalOf(r.body);
    c && !c.includes("?")
      ? ok("filtered canonical is clean", c)
      : bad("filtered canonical", `${BASE}/listings`, c ?? "missing");
  } else {
    caution("/listings?q= unreachable", `status ${r.status}`);
  }
}

/* 7. Structured data -------------------------------------------------- */
console.log("\n7. Structured data (homepage)");
{
  const r = await get("/");
  const blocks = [...r.body.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  if (blocks.length === 0) {
    bad("JSON-LD present", "Organization + WebSite", "none");
  } else {
    ok(`${blocks.length} JSON-LD block(s)`);
    const types = [];
    for (const [, raw] of blocks) {
      try {
        const j = JSON.parse(raw);
        types.push(...(Array.isArray(j) ? j : [j]).map((x) => x["@type"]));
      } catch {
        bad("JSON-LD parses", "valid JSON", "parse error — check escaping");
      }
    }
    for (const t of ["Organization", "WebSite"]) {
      types.includes(t) ? ok(`${t} present`) : caution(`${t} missing`, "expected on the homepage");
    }
    /* Fabricated ratings are the fastest route to a manual action. */
    r.body.includes('"aggregateRating"')
      ? bad("no fabricated ratings", "none in phase 1", "aggregateRating found")
      : ok("no aggregateRating");
  }
}

/* 8. Open Graph ------------------------------------------------------- */
console.log("\n8. Open Graph");
{
  const r = await get("/");
  for (const p of ["title", "description", "image", "url"]) {
    const v = ogOf(r.body, p);
    v ? ok(`og:${p}`) : bad(`og:${p}`, "present", "missing");
  }
  const img = ogOf(r.body, "image");
  if (img) {
    const ir = await get(img);
    ir.status === 200
      ? ok("og:image loads")
      : bad("og:image loads", "200", `${ir.status} — social cards will be blank`);
  }
}

/* 9. 404 -------------------------------------------------------------- */
console.log("\n9. Error handling");
{
  const r = await get("/this-page-does-not-exist-" + Date.now());
  r.status === 404
    ? ok("unknown URL → 404")
    : bad("unknown URL", "404", `${r.status} — a soft 404 gets indexed as a real page`);
}

/* ------------------------------------------------------------------ */
console.log(`\n${"=".repeat(60)}`);
console.log(`${G}${pass} passed${X}   ${fail ? R : D}${fail} failed${X}   ${warn ? Y : D}${warn} warnings${X}\n`);

if (fail > 0) {
  console.log("Fix the FAIL lines above. WARN lines are worth a look but not blocking.\n");
  process.exit(1);
}
console.log("Technical SEO plumbing is doing what it claims.\n");
console.log(`${D}This checks facts, not content quality. Only Search Console\nshows whether Google agrees.${X}\n`);
