/* ============================================================
 * Card variants and their grid classes.
 *
 * NO "use client" — deliberately.
 *
 * These are a type and a pure string function. They lived inside
 * service-cards.tsx, which IS a client module, and that made them
 * unreachable from the server: a server component importing
 * gridForVariant() gets
 *
 *   "Attempted to call gridForVariant() from the server but
 *    gridForVariant is on the client."
 *
 * which is a build failure, not a type error — `tsc` passes and
 * `next build` does not.
 *
 * Splitting them out means either side can use them. Anything
 * added here must stay free of hooks, handlers and browser APIs,
 * or the same problem comes back wearing a different name.
 * ============================================================ */

export type ServiceCardVariant =
  | "default"
  | "person"
  | "brand"
  | "spec"
  | "journey"
  | "food";

/**
 * Grid column classes tuned per card form — and per how many items exist, so
 * a single listing fills the row instead of leaving half the section empty.
 */
export function gridForVariant(v: ServiceCardVariant, count = 4): string {
  if (v === "spec" || v === "journey") {
    return count <= 1
      ? "grid grid-cols-1 gap-3"
      : "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5";
  }
  if (count === 1) return "grid grid-cols-1 gap-3 sm:max-w-sm";
  if (count === 2) return "grid grid-cols-2 gap-3 sm:gap-5 lg:max-w-3xl";
  return "grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4";
}
