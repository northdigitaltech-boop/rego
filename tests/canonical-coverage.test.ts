import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/* ============================================================
 * Canonical coverage — a static guard over the route tree.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS TEST EXISTS
 *
 * The root layout used to set `alternates: { canonical: "/" }`. In the App
 * Router that value is INHERITED by every page that does not set its own, so
 * a handful of public pages were telling Google they were duplicates of the
 * homepage. Prerendered HTML from an older build confirmed it:
 *
 *     .next/server/app/contact.html
 *       <link rel="canonical" href="https://rego.services"/>
 *
 * The layout no longer sets one, so today the failure mode is inverted: a new
 * public page with no canonical simply emits none. That is far safer — but it
 * is still a gap, and gaps like this are only ever found months later.
 *
 * So this walks the real route tree on every test run. Add a public page
 * without a canonical and this fails immediately, by name.
 *
 * It is a source-level check rather than a rendered-HTML check because
 * rendering requires a full production build, and this needs to run in
 * seconds on every commit.
 * ---------------------------------------------------------------------------
 */

const APP = path.join(process.cwd(), "src", "app");

/** Routes that are private, utility, or intentionally noindex. */
const EXEMPT = [
  "admin",
  "cyber",
  "dashboard",
  "signin",
  "signup",
  "reset-password",
  "offline",
  "wishlist",
  "pricing",
  "connect/setup",
  "connect/requests",
  "safarnama/create",
];

function routeOf(file: string): string {
  return file
    .replace(APP, "")
    .replace(/\\/g, "/")
    .replace(/\/page\.tsx$/, "")
    .replace(/^\/?/, "/");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === "page.tsx") out.push(p);
  }
  return out;
}

const pages = walk(APP);

const publicPages = pages.filter((f) => {
  const r = routeOf(f).replace(/^\//, "");
  return !EXEMPT.some((x) => r === x || r.startsWith(`${x}/`));
});

describe("canonical coverage across the route tree", () => {
  it("finds the app directory and some pages", () => {
    expect(pages.length).toBeGreaterThan(20);
  });

  it.each(publicPages.map((f) => [routeOf(f) || "/", f]))(
    "%s declares a canonical",
    (_route, file) => {
      const src = fs.readFileSync(file as string, "utf8");
      /* Either an explicit canonical inside `alternates`, or buildMetadata()
         with a `path`, which sets the canonical inside the helper.
         The pattern deliberately matches BOTH forms:
             alternates: { canonical: "/x" }
             alternates: { canonical }        ← ES6 shorthand, no colon
         The first version of this test only looked for a colon and reported
         two perfectly correct pages as broken. */
      const explicit = /alternates\s*:\s*\{[\s\S]{0,200}?\bcanonical\b/.test(src);
      const viaHelper = /buildMetadata\s*\(/.test(src) && /path\s*:/.test(src);
      expect(
        explicit || viaHelper,
        `${_route} has no canonical. Use buildMetadata({ path: "${_route}" }) from @/lib/seo.`
      ).toBe(true);
    }
  );
});

describe("the root layout must not set a site-wide canonical", () => {
  /* THE ORIGINAL BUG. If this line ever comes back, every page without its
     own canonical silently becomes a declared duplicate of the homepage. */
  it("does not declare alternates.canonical", () => {
    const layout = fs.readFileSync(path.join(APP, "layout.tsx"), "utf8");
    const active = layout
      .split("\n")
      // Ignore the comment block that explains why it is absent.
      .filter((l) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//"))
      .join("\n");
    expect(active).not.toMatch(/alternates\s*:\s*\{[^}]*canonical/);
  });
});

describe("private client routes carry a noindex layout", () => {
  /* These pages are "use client" and therefore cannot export metadata
     themselves — the noindex has to live in a sibling layout. Easy to forget,
     and the failure is invisible. */
  it.each([["connect/setup"], ["connect/requests"], ["safarnama/create"]])(
    "%s has a layout with noindex",
    (route) => {
      const file = path.join(APP, route, "layout.tsx");
      expect(fs.existsSync(file), `${route}/layout.tsx is missing`).toBe(true);
      const src = fs.readFileSync(file, "utf8");
      expect(src).toMatch(/noindexMetadata|index:\s*false/);
    }
  );
});
