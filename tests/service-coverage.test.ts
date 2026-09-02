import { describe, it, expect } from "vitest";

import {
  COVERAGE_TABLES,
  diffCoverage,
  isCoverageTable,
  type CoverageRow,
} from "@/lib/service-coverage";

const row = (id: string, location_id: string, relation_type: string): CoverageRow => ({
  id,
  listing_table: "tour_companies",
  listing_id: "listing-1",
  location_id,
  relation_type,
});

describe("isCoverageTable", () => {
  it("accepts the tables phase99 allows", () => {
    expect(isCoverageTable("tour_companies")).toBe(true);
    expect(isCoverageTable("expedition_professionals")).toBe(true);
  });

  it("rejects anything else, including a table that exists", () => {
    /* profiles is a real table and must never be writable through this path. */
    expect(isCoverageTable("profiles")).toBe(false);
    expect(isCoverageTable("")).toBe(false);
    expect(isCoverageTable("tour_companies; drop table hotels --")).toBe(false);
  });

  it("matches the list in the migration exactly", () => {
    // If these drift, the database refuses writes the app thinks are fine.
    expect(COVERAGE_TABLES).toContain("hotels");
    expect(COVERAGE_TABLES).toContain("media_services");
    expect(COVERAGE_TABLES.length).toBe(18);
  });
});

describe("diffCoverage", () => {
  it("adds what is new", () => {
    const { toAdd, toRemoveIds } = diffCoverage([], ["skardu", "hunza"], "service_area");
    expect(toAdd.sort()).toEqual(["hunza", "skardu"]);
    expect(toRemoveIds).toEqual([]);
  });

  it("removes what was dropped", () => {
    const current = [row("r1", "skardu", "service_area"), row("r2", "hunza", "service_area")];
    const { toAdd, toRemoveIds } = diffCoverage(current, ["skardu"], "service_area");
    expect(toAdd).toEqual([]);
    expect(toRemoveIds).toEqual(["r2"]);
  });

  it("does nothing when nothing changed", () => {
    /* A form saved twice must not write twice — the unique constraint would
       reject the batch and the provider would see a failure for a no-op. */
    const current = [row("r1", "skardu", "service_area")];
    const { toAdd, toRemoveIds } = diffCoverage(current, ["skardu"], "service_area");
    expect(toAdd).toEqual([]);
    expect(toRemoveIds).toEqual([]);
  });

  it("leaves other relation types completely alone", () => {
    /* The whole point of relation_type. Editing service areas must not delete
       the listing's base location, which a different field owns. */
    const current = [
      row("r1", "islamabad", "base"),
      row("r2", "skardu", "service_area"),
    ];
    const { toAdd, toRemoveIds } = diffCoverage(current, ["hunza"], "service_area");
    expect(toAdd).toEqual(["hunza"]);
    expect(toRemoveIds).toEqual(["r2"]);
    // "r1" is untouched — it is not in either list.
    expect(toRemoveIds).not.toContain("r1");
  });

  it("collapses duplicates in the input", () => {
    // Two inserts of the same row would break the unique constraint.
    const { toAdd } = diffCoverage([], ["skardu", "skardu"], "service_area");
    expect(toAdd).toEqual(["skardu"]);
  });

  it("ignores empty ids rather than writing them", () => {
    const { toAdd } = diffCoverage([], ["", "skardu"], "service_area");
    expect(toAdd).toEqual(["skardu"]);
  });

  it("clearing everything removes every row for that relation only", () => {
    const current = [
      row("r1", "islamabad", "base"),
      row("r2", "skardu", "service_area"),
      row("r3", "hunza", "service_area"),
    ];
    const { toAdd, toRemoveIds } = diffCoverage(current, [], "service_area");
    expect(toAdd).toEqual([]);
    expect(toRemoveIds.sort()).toEqual(["r2", "r3"]);
  });

  it("never removes and re-adds the same location", () => {
    /* The reason this is a diff and not delete-then-insert: a listing must
       never pass through covering nowhere, because an interrupted save would
       leave it there. */
    const current = [row("r1", "skardu", "service_area")];
    const { toAdd, toRemoveIds } = diffCoverage(
      current,
      ["skardu", "hunza"],
      "service_area"
    );
    expect(toAdd).toEqual(["hunza"]);
    expect(toRemoveIds).toEqual([]);
  });
});
