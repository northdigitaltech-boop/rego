/* ============================================================
 * Optional per-room details (phase139):
 *   room_size · view_type · classification · wifi_climate
 *
 * Saving must not depend on the migration having been run. If the
 * database does not know a column yet, PostgREST refuses the whole
 * write (PGRST204) — and for homestay/hostel rooms, which are saved by
 * deleting and re-inserting, a refused insert would lose the rooms.
 * So writes go through withRoomDetailFallback(): try with the new
 * fields, and if the only problem is a missing column, try again
 * without them.
 * ============================================================ */

/** New in phase139 on every room table. */
export const NEW_ROOM_DETAIL_KEYS = ["view_type", "classification", "wifi_climate"] as const;

type PgErr = { code?: string; message?: string } | null | undefined;

export function isMissingColumnError(err: PgErr): boolean {
  if (!err) return false;
  if (err.code === "PGRST204" || err.code === "42703") return true;
  const m = (err.message ?? "").toLowerCase();
  return m.includes("column") && (m.includes("schema cache") || m.includes("does not exist"));
}

export function withoutKeys<T extends Record<string, unknown>>(obj: T, keys: readonly string[]): T {
  const out = { ...obj };
  for (const k of keys) delete (out as Record<string, unknown>)[k];
  return out;
}

/** Run a write; on a missing-column error, run it again with the extra keys removed. */
export async function withRoomDetailFallback<R extends { error: PgErr }>(
  write: (strip: boolean) => PromiseLike<R>
): Promise<R> {
  const first = await write(false);
  if (!isMissingColumnError(first.error)) return first;
  return write(true);
}

/** Trim and null out empty strings so an untouched field stores nothing. */
export function cleanDetail(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}
