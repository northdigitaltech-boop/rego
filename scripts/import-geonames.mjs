#!/usr/bin/env node
/**
 * Import GeoNames places into public.geo_reference.
 *
 *   node scripts/import-geonames.mjs PK        # Pakistan
 *   node scripts/import-geonames.mjs PK --dry  # parse and report, write nothing
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IMPORTS, AND WHY NOT EVERYTHING
 *
 * GeoNames' Pakistan file has tens of thousands of rows, most of them hamlets
 * and field names that will never be a Rego destination. Importing all of it
 * makes the admin's search box useless — you type "sk" and get four hundred
 * results.
 *
 * So it keeps:
 *   • administrative divisions (province, district, tehsil)
 *   • populated places above a population floor, plus every admin seat
 *   • tourism features regardless of population — valleys, lakes, passes,
 *     glaciers, peaks
 *
 * That last group is the point for Rego. A valley with no population is
 * exactly the kind of place this marketplace sells, and a population filter
 * alone would drop every one of them.
 *
 * ---------------------------------------------------------------------------
 * SECURITY
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY, read from .env.local. It is never printed,
 * never passed as an argument, and never written anywhere. Run this locally —
 * not in CI, not on a shared machine.
 * ---------------------------------------------------------------------------
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const COUNTRY = (process.argv[2] || "PK").toUpperCase();
const DRY = process.argv.includes("--dry");

/* Population floor for ordinary populated places. Admin seats and tourism
   features bypass it entirely. */
const MIN_POPULATION = 1000;

/* Feature codes kept regardless of population.
   A = administrative, T/H/L = the terrain features a traveller searches for. */
const ALWAYS_KEEP = new Set([
  // administrative
  "ADM1", "ADM2", "ADM3", "ADM4",
  "PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4",
  // terrain worth selling
  "VAL",   // valley
  "LK",    // lake
  "MT",    // mountain
  "MTS",   // mountains
  "PK",    // peak
  "PASS",  // pass
  "GLCR",  // glacier
  "RESV",  // reservoir
  "PRK",   // park
  "RESN",  // reserve
  "SPNG",  // spring
  "FLLS",  // waterfall
]);

/* Codes to drop outright — administrative noise, not places. */
const NEVER_KEEP = new Set(["PPLX", "PPLL", "PPLQ", "PPLW", "PPLH"]);

const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", D = "\x1b[2m", X = "\x1b[0m";

/* ------------------------------------------------------------------ */

function loadEnv() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) {
    console.error(`${R}.env.local not found.${X} Run this from the project root.`);
    process.exit(1);
  }
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

/* ------------------------------------------------------------------ */

async function main() {
  console.log(`\nGeoNames import — ${COUNTRY}${DRY ? `  ${Y}(dry run)${X}` : ""}\n${"=".repeat(50)}`);

  const tmp = path.join(os.tmpdir(), `geonames-${COUNTRY}`);
  fs.mkdirSync(tmp, { recursive: true });
  const zip = path.join(tmp, `${COUNTRY}.zip`);
  const txt = path.join(tmp, `${COUNTRY}.txt`);

  /* ---- download ---- */
  if (!fs.existsSync(txt)) {
    const url = `https://download.geonames.org/export/dump/${COUNTRY}.zip`;
    console.log(`Downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`${R}Download failed: HTTP ${res.status}${X}`);
      console.error(`Check the country code — it must be ISO 3166-1 alpha-2 (PK, IN, NP…).`);
      process.exit(1);
    }
    fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    console.log(`${G}Downloaded${X} ${(fs.statSync(zip).size / 1024 / 1024).toFixed(1)} MB`);

    try {
      // tar handles zip on Windows 10+ and on modern Linux/macOS.
      execFileSync("tar", ["-xf", zip, "-C", tmp], { stdio: "ignore" });
    } catch {
      console.error(`${R}Could not unzip.${X} Extract ${zip} by hand and re-run.`);
      process.exit(1);
    }
  } else {
    console.log(`${D}Using cached ${txt}${X}`);
  }

  /* ---- parse ----
     Tab-separated, no header. Column order is fixed by GeoNames' readme. */
  const rows = [];
  let total = 0, skipped = 0;

  for (const line of fs.readFileSync(txt, "utf8").split("\n")) {
    if (!line.trim()) continue;
    total++;

    const c = line.split("\t");
    const featureCode = c[7];
    const population = Number(c[14]) || 0;

    if (NEVER_KEEP.has(featureCode)) { skipped++; continue; }
    if (!ALWAYS_KEEP.has(featureCode) && population < MIN_POPULATION) { skipped++; continue; }

    rows.push({
      geonameid: Number(c[0]),
      name: c[1],
      ascii_name: c[2] || null,
      // Truncated: some places carry hundreds of alternates in every script.
      alt_names: (c[3] || "").slice(0, 500) || null,
      latitude: Number(c[4]) || null,
      longitude: Number(c[5]) || null,
      feature_class: c[6] || null,
      feature_code: featureCode || null,
      country_code: c[8] || COUNTRY,
      admin1_code: c[10] || null,
      admin2_code: c[11] || null,
      admin3_code: c[12] || null,
      population: population || null,
      elevation: Number(c[15]) || null,
      timezone: c[17] || null,
    });
  }

  console.log(`\nParsed  ${total.toLocaleString()} rows`);
  console.log(`Keeping ${G}${rows.length.toLocaleString()}${X}  ${D}(skipped ${skipped.toLocaleString()})${X}`);

  /* What did we actually get? Useful for spotting a filter that is too harsh. */
  const byCode = {};
  for (const r of rows) byCode[r.feature_code] = (byCode[r.feature_code] || 0) + 1;
  const top = Object.entries(byCode).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log(`\n${D}By feature code:${X}`);
  for (const [code, n] of top) console.log(`  ${code.padEnd(6)} ${n}`);

  /* Sanity check against a filter that silently dropped what matters. */
  const valleys = rows.filter((r) => r.feature_code === "VAL").length;
  console.log(`\n${valleys > 0 ? G : Y}Valleys kept: ${valleys}${X}`);
  if (valleys === 0) {
    console.log(`${Y}No valleys found. GeoNames coverage of small valleys is thin —`);
    console.log(`you will still be adding places like Bilamik and Basho by hand.${X}`);
  }

  if (DRY) {
    console.log(`\n${Y}Dry run — nothing written.${X}\n`);
    return;
  }

  /* ---- upsert ---- */
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(`\n${R}NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env.local${X}\n`);
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const BATCH = 500;
  let done = 0;
  console.log(`\nWriting to geo_reference…`);

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await sb.from("geo_reference").upsert(chunk, { onConflict: "geonameid" });
    if (error) {
      console.error(`\n${R}Failed at row ${i}: ${error.message}${X}`);
      if (error.message.includes("does not exist")) {
        console.error(`Run supabase/phase83-geo-reference.sql first.`);
      }
      process.exit(1);
    }
    done += chunk.length;
    process.stdout.write(`\r  ${done.toLocaleString()} / ${rows.length.toLocaleString()}`);
  }

  console.log(`\n\n${G}Done.${X} ${done.toLocaleString()} places available in the Add Location search.`);
  console.log(`${D}Source: GeoNames (https://www.geonames.org), CC BY 4.0.${X}\n`);
}

main().catch((e) => {
  console.error(`\n${R}${e?.message ?? e}${X}\n`);
  process.exit(1);
});
