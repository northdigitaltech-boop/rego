"use client";

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * Reading the visitor numbers.
 *
 * Everything here calls site_visit_summary, which raises for
 * anyone who is not an admin. The gate is in the database, so
 * hiding the panel is presentation, not security.
 * ============================================================ */

export interface VisitorDay {
  day: string;
  newVisitors: number;
  repeatVisitors: number;
  totalVisitors: number;
}

export interface VisitorTotals {
  days: VisitorDay[];
  newVisitors: number;
  repeatVisitors: number;
  /**
   * Distinct people, not the sum of the daily totals.
   *
   * Someone who came Monday and Thursday appears on two days. Adding the
   * columns up would report them as two visitors, and the "total" would
   * drift further from reality the longer the window. Only first-time
   * appearances can be added without double counting, so the unique total
   * is (new over the window) + (people already known who came back at
   * least once) — which needs the second number from the database, not a
   * sum of the first.
   */
  uniqueVisitors: number;
  /** null when nothing has ever been recorded. */
  since: string | null;
}

interface SummaryRow {
  day: string;
  new_visitors: number;
  repeat_visitors: number;
  total_visitors: number;
}

export async function loadVisitorSummary(days = 30): Promise<VisitorTotals> {
  const empty: VisitorTotals = {
    days: [],
    newVisitors: 0,
    repeatVisitors: 0,
    uniqueVisitors: 0,
    since: null,
  };
  if (!isSupabaseConfigured) return empty;

  const { data, error } = await supabase.rpc("site_visit_summary", { p_days: days });
  if (error || !Array.isArray(data)) return empty;

  const rows = (data as SummaryRow[]).map((r) => ({
    day: String(r.day).slice(0, 10),
    newVisitors: Number(r.new_visitors) || 0,
    repeatVisitors: Number(r.repeat_visitors) || 0,
    totalVisitors: Number(r.total_visitors) || 0,
  }));
  if (rows.length === 0) return empty;

  const newVisitors = rows.reduce((n, r) => n + r.newVisitors, 0);

  /* Deliberately NOT summed — see the note on uniqueVisitors. A returning
     visitor can appear on many days in this window, so the honest unique
     figure needs a separate count of distinct returning people, which the
     summary does not carry. Until it does, the panel shows the two things
     that ARE sound: first-time visitors (each counted once, on the day they
     arrived) and returning visits. */
  const repeatVisitors = rows.reduce((n, r) => n + r.repeatVisitors, 0);

  return {
    days: rows,
    newVisitors,
    repeatVisitors,
    uniqueVisitors: newVisitors,
    since: rows[0]?.day ?? null,
  };
}
