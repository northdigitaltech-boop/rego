/* Name casing — the cases that decide whether this helper is safe to put on
   every form on the site.

   NOT YET RUN. Run with:
     npx tsx scripts/test-text-case.mjs

   The ones that matter most are the NEGATIVES: names it must NOT touch.
   A helper that tidies "gilgit tours" is nice. A helper that turns "PIA"
   into "Pia" or "McDonald" into "Mcdonald" is actively damaging, because it
   corrupts real business and person names at the moment they are typed.
*/

import { toTitleCase, toPersonName, normalizeEmail } from "../src/lib/text-case.ts";

let failed = false;
const eq = (label, got, want) => {
  const ok = got === want;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) {
    failed = true;
    console.log(`       got  ${JSON.stringify(got)}`);
    console.log(`       want ${JSON.stringify(want)}`);
  }
};

console.log("shouting and lazy typing — these SHOULD be tidied:");
eq("all caps", toTitleCase("GILGIT TOURS"), "Gilgit Tours");
eq("all lower", toTitleCase("hunza rides and rentals"), "Hunza Rides and Rentals");
eq("all caps person", toTitleCase("MUHAMMAD ALI KHAN"), "Muhammad Ali Khan");
eq("collapses spaces", toTitleCase("  skardu   valley  "), "Skardu Valley");

console.log("\ndeliberate casing — these must NOT be touched:");
eq("mixed case brand", toTitleCase("K2 Trekking and Expedition"), "K2 Trekking and Expedition");
eq("McDonald stays", toTitleCase("McDonald Travels"), "McDonald Travels");
eq("iPhone-style", toTitleCase("iTravel Pakistan"), "iTravel Pakistan");
eq("DHA Phase 6", toTitleCase("DHA Phase 6"), "DHA Phase 6");

console.log("\nshort tokens — acronyms must survive even in all-caps input:");
eq("PIA alone", toTitleCase("PIA"), "PIA");
eq("PIA in a caps name", toTitleCase("PIA TOURS"), "PIA Tours");
eq("NLI", toTitleCase("NLI MARKET"), "NLI Market");
eq("K2 in caps", toTitleCase("K2 EXPEDITIONS"), "K2 Expeditions");

console.log("\ninside a word:");
eq("apostrophe", toTitleCase("o'brien travels"), "O'Brien Travels");
eq("hyphen", toTitleCase("abdul-rehman khan"), "Abdul-Rehman Khan");
eq("mc lowercase", toTitleCase("mcdonald travels"), "McDonald Travels");

console.log("\nminor words stay lowercase, except first:");
eq("of/the", toTitleCase("ROOF OF THE WORLD TOURS"), "Roof of the World Tours");
eq("first word minor", toTitleCase("THE KARAKORAM CLUB"), "The Karakoram Club");
eq("bin mid-name", toTitleCase("MUHAMMAD BIN QASIM"), "Muhammad bin Qasim");

console.log("\nedges:");
eq("empty", toTitleCase(""), "");
eq("spaces only", toTitleCase("   "), "");
eq("single letter", toTitleCase("a"), "a");
eq("numbers survive", toTitleCase("HOTEL 786"), "Hotel 786");

console.log("\nperson names:");
eq("trailing punctuation", toPersonName("ALI KHAN."), "Ali Khan");

console.log("\nemail:");
eq("lowercased", normalizeEmail("  Ali@Gmail.COM "), "ali@gmail.com");

console.log(failed ? "\nFAILED" : "\nall good");
process.exit(failed ? 1 : 0);
