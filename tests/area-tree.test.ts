import { describe, it, expect } from "vitest";

import type { AreaOption } from "@/lib/area-rules";
import {
  buildLevels,
  childrenOfArea,
  deepestSelected,
  levelLabel,
  pathAfterChange,
  selectionPath,
  visibleRoots,
} from "@/lib/area-tree";

/* Shaped like the real Gilgit-Baltistan tree phase74 seeds:
   region -> division -> district -> area. */
const area = (
  id: string,
  name: string,
  location_type: string,
  depth: number,
  parent_id: string | null
): AreaOption => ({ id, name, location_type, depth, parent_id, path: name });

const GB: AreaOption[] = [
  area("gb", "Gilgit-Baltistan", "region", 1, "pk"),
  area("bal", "Baltistan Division", "division", 2, "gb"),
  area("gil", "Gilgit Division", "division", 2, "gb"),
  area("skardu", "Skardu", "district", 3, "bal"),
  area("shigar", "Shigar", "district", 3, "bal"),
  area("hunza", "Hunza", "district", 3, "gil"),
  area("kachura", "Kachura", "area", 4, "skardu"),
  area("shangrila", "Shangrila", "area", 4, "skardu"),
  area("karimabad", "Karimabad", "area", 4, "hunza"),
];

describe("visibleRoots", () => {
  it("treats a location whose parent was filtered out as a root", () => {
    // "pk" is not in the list — the region is still the top of what we can show.
    expect(visibleRoots(GB).map((a) => a.id)).toEqual(["gb"]);
  });

  it("keeps an open area whose district was closed", () => {
    /* This is the case the whole module exists for. Openness is inherited but
       overridable, so a closed Skardu with an open Kachura inside it is a
       legitimate admin decision — and Kachura must not vanish from the form. */
    const openOnly = GB.filter((a) => a.id !== "skardu");
    const roots = visibleRoots(openOnly).map((a) => a.id);
    expect(roots).toContain("kachura");
    expect(roots).toContain("shangrila");
  });

  it("returns nothing for an empty list rather than throwing", () => {
    expect(visibleRoots([])).toEqual([]);
  });
});

describe("childrenOfArea", () => {
  it("returns only direct children, not the whole subtree", () => {
    expect(childrenOfArea(GB, "gb").map((a) => a.id)).toEqual(["bal", "gil"]);
    expect(childrenOfArea(GB, "skardu").map((a) => a.id)).toEqual([
      "kachura",
      "shangrila",
    ]);
  });

  it("returns nothing for a leaf", () => {
    expect(childrenOfArea(GB, "karimabad")).toEqual([]);
  });
});

describe("selectionPath", () => {
  it("walks up from a saved area to the visible root", () => {
    expect(selectionPath(GB, "kachura")).toEqual(["gb", "bal", "skardu", "kachura"]);
  });

  it("is empty for nothing selected", () => {
    expect(selectionPath(GB, null)).toEqual([]);
  });

  it("is empty when the saved area is no longer open", () => {
    /* A listing saved while an area was open, reopened after it closed. The
       form must render, not throw — the provider still has to be able to edit
       their phone number. */
    expect(selectionPath(GB, "somewhere-closed")).toEqual([]);
  });

  it("stops at the highest ancestor still in the list", () => {
    const noDivision = GB.filter((a) => a.id !== "bal");
    expect(selectionPath(noDivision, "kachura")).toEqual(["skardu", "kachura"]);
  });

  it("terminates on a cycle instead of hanging the form", () => {
    /* The database trigger rejects cycles, but this loop follows data it did
       not create, so it must not depend on that promise being kept. */
    const cyclic: AreaOption[] = [
      area("a", "A", "district", 1, "b"),
      area("b", "B", "district", 1, "a"),
    ];
    const path = selectionPath(cyclic, "a");
    expect(path.length).toBeLessThanOrEqual(cyclic.length + 1);
  });
});

describe("buildLevels", () => {
  it("offers one dropdown when nothing is chosen yet", () => {
    const levels = buildLevels(GB, []);
    expect(levels).toHaveLength(1);
    expect(levels[0].options.map((o) => o.id)).toEqual(["gb"]);
    expect(levels[0].selected).toBeNull();
  });

  it("adds a level for each choice made", () => {
    const levels = buildLevels(GB, ["gb", "bal"]);
    expect(levels).toHaveLength(3);
    expect(levels[1].options.map((o) => o.id)).toEqual(["bal", "gil"]);
    expect(levels[2].options.map((o) => o.id)).toEqual(["skardu", "shigar"]);
    expect(levels[2].selected).toBeNull();
  });

  it("stops at a leaf instead of showing an empty dropdown", () => {
    const levels = buildLevels(GB, ["gb", "gil", "hunza", "karimabad"]);
    // region, division, district, area — and nothing under Karimabad.
    expect(levels).toHaveLength(4);
    expect(levels[3].selected).toBe("karimabad");
  });

  it("builds nothing when there are no areas at all", () => {
    expect(buildLevels([], [])).toEqual([]);
  });
});

describe("pathAfterChange", () => {
  it("drops the levels below the one that changed", () => {
    /* Choosing a different district must not leave the previous district's
       village hanging underneath it. */
    const path = ["gb", "bal", "skardu", "kachura"];
    expect(pathAfterChange(path, 2, "shigar")).toEqual(["gb", "bal", "shigar"]);
  });

  it("truncates when a level is cleared", () => {
    const path = ["gb", "bal", "skardu"];
    expect(pathAfterChange(path, 1, null)).toEqual(["gb"]);
  });

  it("appends when choosing at the deepest level", () => {
    expect(pathAfterChange(["gb", "bal"], 2, "skardu")).toEqual([
      "gb",
      "bal",
      "skardu",
    ]);
  });
});

describe("deepestSelected", () => {
  it("saves the most specific choice the provider made", () => {
    expect(deepestSelected(["gb", "bal", "skardu"])).toBe("skardu");
  });

  it("saves a district when the provider stopped there", () => {
    // Partial precision is still true information, so it is kept.
    expect(deepestSelected(["gb", "bal"])).toBe("bal");
  });

  it("is null when nothing was chosen, so no location_id is written", () => {
    expect(deepestSelected([])).toBeNull();
  });
});

describe("levelLabel", () => {
  it("names the level from what it actually offers", () => {
    expect(levelLabel([GB[3], GB[4]])).toBe("District");
    expect(levelLabel([GB[0]])).toBe("Region / Province");
    expect(levelLabel([GB[1]])).toBe("Division");
  });

  it("falls back to Area for a mixed level", () => {
    /* Happens when a closed district pushes its open areas up to sit beside
       districts. Calling that row "District" would be a lie. */
    expect(levelLabel([GB[3], GB[6]])).toBe("Area");
  });

  it("falls back to Area for a type it has never seen", () => {
    expect(levelLabel([area("x", "X", "tehsil", 3, null)])).toBe("Area");
  });
});
