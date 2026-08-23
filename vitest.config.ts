import { defineConfig } from "vitest/config";
import path from "node:path";

/* ============================================================
 * Vitest — added in the SEO Phase 1 work.
 *
 * Scope is deliberately narrow: PURE FUNCTIONS ONLY.
 *
 * Canonical URL construction, robots rules, indexability
 * decisions and JSON-LD escaping are all pure, and they are
 * exactly the things that fail silently — a wrong canonical
 * costs traffic for months before anyone notices, because
 * nothing on screen looks broken.
 *
 * React component and end-to-end testing needs jsdom or
 * Playwright and a lot more setup. That is a separate piece of
 * work, not something to bolt on here.
 * ============================================================ */

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
