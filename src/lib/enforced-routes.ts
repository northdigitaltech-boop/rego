/* ============================================================
 * Routes that enforce IP blocks.
 *
 * Kept in its own module with NO imports so the Emergency page —
 * a client component — can display the list without pulling
 * ip-block.ts into the browser bundle. That file creates a
 * service-role Supabase client and belongs on the server only.
 *
 * Update this list whenever enforceIpBlock() is added to or
 * removed from a route, or the Emergency page will overstate
 * what containment actually covers.
 * ============================================================ */
export const ENFORCED_ROUTES = [
  "/api/rego-ai",
  "/api/admin/broadcast",
  "/api/admin/delete-user",
  "/api/admin/update-user",
  "/api/cyber/ingest",
  "/api/flights/search",
] as const;
