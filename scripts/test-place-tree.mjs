/* The cascade behind the Region → District → City picker.

   Run with:
     npx tsx scripts/test-place-tree.mjs

   WHAT THESE TESTS ARE REALLY CHECKING

   The province's tree is not a tidy three levels. Districts hang off
   DIVISIONS, not off the region, so anything that walks by depth or by direct
   children returns the wrong thing while looking completely reasonable. And
   rows get mis-parented by hand in the admin — a district seeded directly
   under the region before divisions existed — which must not make it vanish
   from a dropdown.

   So the fixture below is deliberately messy: a proper region → division →
   district → city chain, a mis-parented district sitting beside the divisions,
   a second region that must never leak into the first one's list, and a
   duplicate name in different casing.
*/

import {
  regionsOf,
  districtsOf,
  placesOf,
  isDescendantOf,
  regionOfDistrict,
  findByName,
} from "../src/lib/place-tree.ts";

let failed = false;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) {
    failed = true;
    console.log(`       got  ${JSON.stringify(got)}`);
    console.log(`       want ${JSON.stringify(want)}`);
  }
};
const names = (rows) => rows.map((r) => r.name);

const n = (id, name, location_type, parent_id) => ({ id, name, location_type, parent_id });

const TREE = [
  n("pk", "Pakistan", "country", null),
  n("gb", "Gilgit-Baltistan", "region", "pk"),
  n("ajk", "Azad Jammu & Kashmir", "region", "pk"),

  // Proper chain: region -> division -> district -> city
  n("bal", "Baltistan Division", "division", "gb"),
  n("skd", "Skardu", "district", "bal"),
  n("shg", "Shigar", "district", "bal"),
  n("gil-div", "Gilgit Division", "division", "gb"),
  n("gil", "Gilgit", "district", "gil-div"),

  // Mis-parented: a district hanging straight off the region, beside the
  // divisions. Real, and it must still appear under its region.
  n("ast", "Astore", "district", "gb"),

  // Places under Skardu, of several types
  n("skd-city", "Skardu City", "city", "skd"),
  n("sadpara", "Sadpara", "village", "skd"),
  n("deosai", "Deosai Plains", "attraction", "skd"),
  n("kachura", "Kachura", "area", "skd"),

  // Another region's district — must never appear under Gilgit-Baltistan
  n("mzf", "Muzaffarabad", "district", "ajk"),
];

console.log("regions:");
eq("only rows typed region", names(regionsOf(TREE)), ["Azad Jammu & Kashmir", "Gilgit-Baltistan"]);
eq("country is not a region", regionsOf(TREE).some((r) => r.id === "pk"), false);

console.log("\ndistricts under a region — the division must be seen through:");
eq(
  "GB districts",
  names(districtsOf(TREE, "gb")),
  ["Astore", "Gilgit", "Shigar", "Skardu"]
);
eq("divisions are not offered as districts", names(districtsOf(TREE, "gb")).includes("Baltistan Division"), false);
eq("mis-parented district still appears", names(districtsOf(TREE, "gb")).includes("Astore"), true);
eq("other region does not leak in", names(districtsOf(TREE, "gb")).includes("Muzaffarabad"), false);
eq("AJK gets its own", names(districtsOf(TREE, "ajk")), ["Muzaffarabad"]);
eq("no region chosen offers every district", districtsOf(TREE, null).length, 5);

console.log("\nplaces under a district:");
eq(
  "all four types, alphabetical",
  names(placesOf(TREE, "skd")),
  ["Deosai Plains", "Kachura", "Sadpara", "Skardu City"]
);
eq("nothing until a district is chosen", placesOf(TREE, null), []);
eq("a district with no places returns empty", placesOf(TREE, "ast"), []);
eq("does not offer the district itself", names(placesOf(TREE, "skd")).includes("Skardu"), false);

console.log("\nancestry:");
eq("city is under its region", isDescendantOf(TREE, "sadpara", "gb"), true);
eq("city is under its district", isDescendantOf(TREE, "sadpara", "skd"), true);
eq("not under a sibling district", isDescendantOf(TREE, "sadpara", "gil"), false);
eq("not under the other region", isDescendantOf(TREE, "sadpara", "ajk"), false);
eq("a node is not its own ancestor", isDescendantOf(TREE, "skd", "skd"), false);

console.log("\nfilling the region in from a saved district:");
eq("proper chain", regionOfDistrict(TREE, "skd")?.name, "Gilgit-Baltistan");
eq("mis-parented district still resolves", regionOfDistrict(TREE, "ast")?.name, "Gilgit-Baltistan");
eq("other region", regionOfDistrict(TREE, "mzf")?.name, "Azad Jammu & Kashmir");
eq("nothing saved", regionOfDistrict(TREE, null), null);

console.log("\nmatching the text already in the database:");
const gbDistricts = districtsOf(TREE, "gb");
eq("exact", findByName(gbDistricts, "Skardu")?.id, "skd");
eq("shouting", findByName(gbDistricts, "SKARDU")?.id, "skd");
eq("lower case", findByName(gbDistricts, "skardu")?.id, "skd");
eq("padded", findByName(gbDistricts, "  Skardu  ")?.id, "skd");
eq("a value no longer in the tree is not invented", findByName(gbDistricts, "Ghanche"), null);
eq("blank", findByName(gbDistricts, ""), null);
eq("null", findByName(gbDistricts, null), null);

console.log("\nit must not hang on bad data:");
/* The database rejects cycles, but this walks rows it did not create. A loop
   that trusts its input is a loop that can freeze an admin's browser. */
const CYCLE = [n("a", "A", "district", "b"), n("b", "B", "district", "a")];
eq("cycle terminates", isDescendantOf(CYCLE, "a", "zzz"), false);
eq("empty tree", regionsOf([]), []);
eq("empty tree districts", districtsOf([], "gb"), []);

console.log(failed ? "\nFAILED" : "\nAll place-tree checks passed.");
process.exit(failed ? 1 : 0);
