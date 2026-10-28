// Loads BLS Employment Projections (2025–35) into occupation_market.
//   node --env-file=.env scripts/ingest/bls.mjs --dry-run
//   node --env-file=.env scripts/ingest/bls.mjs
// Needs data/bls/occupation.xlsx (download in a browser, see data/README.md) and the O*NET ingest to have run.
// Source: https://www.bls.gov/emp/ (Employment Projections, Table 1.2). Public domain (US government work).
import { createClient } from "@supabase/supabase-js";
import readXlsxFile from "read-excel-file/node";
import { trendFor } from "../../lib/market/trend.ts";

const FILE = process.env.BLS_EP_FILE ?? "data/bls/occupation.xlsx";
const dryRun = process.argv.includes("--dry-run");
const SOURCE = "BLS Employment Projections 2025–35";
// The workbook carries no release date, so as_of is the date we retrieved it.
const AS_OF = process.env.BLS_AS_OF ?? new Date().toISOString().slice(0, 10);

// O*NET occupations that BLS reports only as part of a combined matrix group. Beyond the mechanical rule below
// (last digit, then last two digits, replaced by 0) these are the merges BLS makes that code patterns can't find.
const CROSSWALK = {
  "21-1011": "21-1018",
  "21-1014": "21-1018",
  "25-2055": "25-2052",
  "25-2056": "25-2052",
  "25-9042": "25-9045",
  "25-9043": "25-9045",
  "51-2022": "51-2028",
  "51-2023": "51-2028",
  "53-1042": "53-1047",
  "53-1043": "53-1047",
  "53-1044": "53-1047",
};

const sheets = await readXlsxFile(FILE);
const table = sheets.find((s) => s.sheet === "Table 1.2");
if (!table) throw new Error('Sheet "Table 1.2" not found in ' + FILE);
const [, header, ...body] = table.data;
const col = (name) => {
  const i = header.findIndex((h) => String(h).startsWith(name));
  if (i < 0) throw new Error(`Column "${name}" not found`);
  return i;
};
const C = {
  title: 0,
  code: 1,
  type: 2,
  emp: col("Employment, 2025"),
  pct: col("Employment change, percent"),
  openings: col("Occupational openings"),
  wage: col("Median annual wage"),
};

const lines = new Map(); // matrix code -> row
for (const r of body) if (r[C.type] === "Line item") lines.set(r[1], r);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null); // "—" (wage above the cap) becomes null

const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });
const { data: occupations, error } = await db.from("occupations").select("soc_code,title").limit(5000);
if (error) throw new Error(error.message);

const rows = [];
const grouped = [];
const unmatched = [];
for (const { soc_code: soc, title } of occupations) {
  let row = lines.get(soc);
  let group = null;
  if (!row) {
    const code = CROSSWALK[soc] ?? [soc.slice(0, 6) + "0", soc.slice(0, 5) + "00"].find((c) => lines.has(c));
    if (code && lines.has(code)) {
      row = lines.get(code);
      group = code;
    }
  }
  if (!row) {
    unmatched.push(`${soc} ${title}`);
    continue;
  }
  const pct = num(row[C.pct]);
  const exact = group === null;
  if (!exact) grouped.push(`${soc} ${title} -> ${group} ${row[C.title]}`);
  rows.push({
    soc_code: soc,
    // Employment and openings of a combined group describe the whole group, not this occupation, so leave them empty.
    employment: exact && num(row[C.emp]) !== null ? Math.round(row[C.emp] * 1000) : null,
    annual_openings: exact && num(row[C.openings]) !== null ? Math.round(row[C.openings] * 1000) : null,
    projected_change_pct: pct,
    median_pay: num(row[C.wage]),
    trend: trendFor(pct),
    source: exact ? SOURCE : `${SOURCE} (reported for the group ${group} ${row[C.title]})`,
    as_of: AS_OF,
  });
}

const trendCounts = rows.reduce((m, r) => ((m[r.trend] = (m[r.trend] ?? 0) + 1), m), {});
console.log(`occupations in database: ${occupations.length}`);
console.log(`matched: ${rows.length} (${rows.length - grouped.length} exact, ${grouped.length} via a BLS group)`);
console.log("trend labels:", trendCounts);
console.log(`no median wage (BLS shows "—"): ${rows.filter((r) => r.median_pay === null).length}`);
if (unmatched.length) console.log("unmatched:\n  " + unmatched.join("\n  "));

if (!dryRun) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error: e } = await db.from("occupation_market").upsert(rows.slice(i, i + 500), { onConflict: "soc_code" });
    if (e) throw new Error("occupation_market: " + e.message);
  }
  const { count } = await db.from("occupation_market").select("*", { count: "exact", head: true });
  console.log(`occupation_market: ${count} rows in database`);
}
