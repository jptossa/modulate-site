// Loads the latest OEWS estimates for the U.S., states, metropolitan and nonmetropolitan areas into
// areas and occupation_area_market.
//   node --env-file=.env scripts/ingest/oews-areas.mjs --dry-run
//   node --env-file=.env scripts/ingest/oews-areas.mjs
// Needs the national, state and metro/nonmetro workbooks for YEAR extracted under data/bls/oews-YYYY/
// (oesmYYnat, oesmYYst, oesmYYma; see data/README.md). Column names are looked up in the header row.
// Caveat (BLS): cells with too few reports are suppressed (* or **); they load as null, never zero. A median wage of
// "#" means a wage at or above $239,200 a year ($115.00 an hour); it loads as that cap with median_pay_top_coded set.
// Source: https://www.bls.gov/oes/ (public domain).
import { readdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import readXlsxFile from "read-excel-file/node";

const YEAR = 2025;
const dryRun = process.argv.includes("--dry-run");

// OEWS AREA_TYPE: 1 national, 2 state (and DC), 3 territory (Guam, Puerto Rico, Virgin Islands), 4 metropolitan,
// 6 nonmetropolitan. Territories are treated as states.
const TOP_CODED_PAY = 239200; // BLS's "#" annual wage, from the Field Descriptions sheet of each workbook
const KIND = { 1: "national", 2: "state", 3: "state", 4: "metro", 6: "nonmetro" };

const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });
const { data: occupations, error } = await db.from("occupations").select("soc_code").limit(5000);
if (error) throw new Error(error.message);
const ours = new Set(occupations.map((o) => o.soc_code));

const yy = String(YEAR).slice(2);
const dirs = [`oesm${yy}nat`, `oesm${yy}st`, `oesm${yy}ma`].map((d) => `data/bls/oews-${YEAR}/${d}`);

const num = (v) => {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return String(v ?? "").trim() === "" || !Number.isFinite(n) ? null : n; // "*", "**", "#" and blanks are not numbers
};

const areas = new Map(); // area_code -> row
const market = []; // occupation_area_market rows
const stateByAbbr = new Map(); // PRIM_STATE -> state area_code

// The zips extract into a folder of the same name, so look one level down. The metro zip holds two workbooks:
// MSA (metropolitan) and BOS (nonmetropolitan "balance of state" areas).
const files = dirs.flatMap((dir) => {
  const found = readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => /(^|[\\/])(national|state|msa|bos)_m\d{4}_dl\.xlsx$/i.test(f))
    .map((f) => `${dir}/${f.replaceAll("\\", "/")}`);
  if (found.length === 0) throw new Error(`${dir}: no OEWS workbook found`);
  return found;
});

for (const path of files) {
  const file = path.split("/").pop();
  const [sheet] = await readXlsxFile(path);
  const [header, ...body] = sheet.data;
  const idx = (name, optional = false) => {
    const i = header.findIndex((h) => String(h).toUpperCase() === name);
    if (i < 0 && !optional) throw new Error(`${file}: column ${name} not found (have ${header.join(", ")})`);
    return i;
  };
  const col = {
    area: idx("AREA"), title: idx("AREA_TITLE"), type: idx("AREA_TYPE"), state: idx("PRIM_STATE", true),
    occ: idx("OCC_CODE"), group: idx("O_GROUP"), emp: idx("TOT_EMP"), jobs: idx("JOBS_1000", true),
    lq: idx("LOC_QUOTIENT", true), median: idx("A_MEDIAN"),
  };
  const kinds = new Map();
  let rows = 0;
  for (const r of body) {
    const kind = KIND[Number(r[col.type])];
    if (!kind) continue;
    const code = String(r[col.area]);
    if (!areas.has(code)) {
      const abbr = col.state >= 0 && r[col.state] ? String(r[col.state]) : null;
      areas.set(code, { area_code: code, name: String(r[col.title]), kind, state_abbr: abbr, primary_state_code: null });
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
      if (kind === "state" && abbr) stateByAbbr.set(abbr, code);
    }
    if (String(r[col.group]).toLowerCase() !== "detailed") continue;
    const soc = String(r[col.occ]);
    if (!ours.has(soc)) continue;
    const topCoded = String(r[col.median]).trim() === "#";
    market.push({
      area_code: code, soc_code: soc,
      employment: num(r[col.emp]) === null ? null : Math.round(num(r[col.emp])),
      median_pay: topCoded ? TOP_CODED_PAY : num(r[col.median]) === null ? null : Math.round(num(r[col.median])),
      median_pay_top_coded: topCoded,
      location_quotient: col.lq >= 0 ? num(r[col.lq]) : null,
      jobs_per_1000: col.jobs >= 0 ? num(r[col.jobs]) : null,
      as_of_year: YEAR,
    });
    rows++;
  }
  console.log(`${file}: ${[...kinds].map(([k, n]) => `${n} ${k}`).join(", ")}; ${rows} occupation rows`);
}

// A metro's state is the one BLS lists first for it; the national and state rows have none.
for (const a of areas.values()) if (a.kind === "metro" || a.kind === "nonmetro") a.primary_state_code = stateByAbbr.get(a.state_abbr) ?? null;

const withData = market.filter((m) => m.employment !== null || m.median_pay !== null);
console.log(`areas: ${areas.size}; rows with a value: ${withData.length} of ${market.length}`);
const withoutState = [...areas.values()].filter((a) => (a.kind === "metro" || a.kind === "nonmetro") && !a.primary_state_code);
console.log(`metro/nonmetro areas with no matched state: ${withoutState.length}`);

if (!dryRun) {
  const { error: e1 } = await db.from("areas").upsert([...areas.values()], { onConflict: "area_code" });
  if (e1) throw new Error("areas: " + e1.message);
  for (let i = 0; i < withData.length; i += 1000) {
    const { error: e } = await db.from("occupation_area_market").upsert(withData.slice(i, i + 1000), { onConflict: "area_code,soc_code" });
    if (e) throw new Error("occupation_area_market: " + e.message);
  }
  const { count } = await db.from("occupation_area_market").select("*", { count: "exact", head: true });
  console.log(`occupation_area_market: ${count} rows in database`);
}
