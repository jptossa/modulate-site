// Loads annual national employment per occupation (OEWS, May 2019–2025) into occupation_series.
//   node --env-file=.env scripts/ingest/oews-series.mjs --dry-run
//   node --env-file=.env scripts/ingest/oews-series.mjs
// Needs data/bls/oews-20YY/oesmYYnat/national_MYYYY_dl.xlsx for each year (see data/README.md).
// Caveat (BLS): OEWS is not designed for time-series use. Estimates pool six semiannual panels, the estimation method
// changed in May 2021, wage processing in May 2022, and May 2020–21 had lower response. Present these as annual
// estimates, never as precise year-over-year change. Source: https://www.bls.gov/oes/ (public domain).
import { createClient } from "@supabase/supabase-js";
import readXlsxFile from "read-excel-file/node";

const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
const dryRun = process.argv.includes("--dry-run");

const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });
const { data: occupations, error } = await db.from("occupations").select("soc_code,title").limit(5000);
if (error) throw new Error(error.message);
const ours = new Map(occupations.map((o) => [o.soc_code, o.title]));

const byYear = new Map(); // year -> Map<soc, employment>
for (const year of YEARS) {
  const file = `data/bls/oews-${year}/oesm${String(year).slice(2)}nat/national_M${year}_dl.xlsx`;
  const [sheet] = await readXlsxFile(file);
  const [header, ...body] = sheet.data;
  const idx = (name) => {
    const i = header.findIndex((h) => String(h).toUpperCase() === name);
    if (i < 0) throw new Error(`${file}: column ${name} not found`);
    return i;
  };
  const [occ, group, emp] = [idx("OCC_CODE"), idx("O_GROUP"), idx("TOT_EMP")];
  const rows = new Map();
  for (const r of body) {
    if (String(r[group]).toLowerCase() !== "detailed") continue;
    const soc = String(r[occ]);
    if (!ours.has(soc)) continue;
    const n = typeof r[emp] === "number" ? r[emp] : Number(String(r[emp]).replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) rows.set(soc, Math.round(n));
  }
  byYear.set(year, rows);
  console.log(`${year}: ${rows.size} of ${ours.size} occupations matched`);
}

// Occupations with at least 4 years of data can draw a line.
const perOcc = new Map();
for (const [year, rows] of byYear) for (const [soc, n] of rows) (perOcc.get(soc) ?? perOcc.set(soc, []).get(soc)).push({ year, n });
const usable = [...perOcc].filter(([, pts]) => pts.length >= 4);
console.log(`occupations with 4+ years: ${usable.length}; all 7 years: ${[...perOcc].filter(([, p]) => p.length === 7).length}`);

// Flag big year-over-year moves, which usually mean a classification change rather than real change.
const jumps = [];
for (const [soc, pts] of usable) {
  pts.sort((a, b) => a.year - b.year);
  for (let i = 1; i < pts.length; i++) {
    const change = pts[i].n / pts[i - 1].n - 1;
    if (Math.abs(change) > 0.4 && pts[i].year - pts[i - 1].year === 1) jumps.push({ soc, title: ours.get(soc), year: pts[i].year, change });
  }
}
console.log(`year-over-year moves above 40%: ${jumps.length}`);
for (const j of jumps.slice(0, 10)) console.log(`  ${j.soc} ${j.title} ${j.year}: ${(j.change * 100).toFixed(0)}%`);
for (const soc of ["41-2031", "25-2021", "29-1141"]) {
  console.log(`${soc} ${ours.get(soc)}:`, (perOcc.get(soc) ?? []).sort((a, b) => a.year - b.year).map((p) => `${p.year}=${p.n}`).join(" "));
}

// A series with a 40%+ one-year swing is almost always survey noise or a reclassification, so it gets no history line.
const noisy = new Set(jumps.map((j) => j.soc));
const loadable = usable.filter(([soc]) => !noisy.has(soc));
console.log(`loading ${loadable.length} occupations; leaving out ${usable.length - loadable.length} noisy series`);

if (!dryRun) {
  const rows = loadable.flatMap(([soc, pts]) => pts.map((p) => ({ soc_code: soc, year: p.year, employment: p.n })));
  for (let i = 0; i < rows.length; i += 1000) {
    const { error: e } = await db.from("occupation_series").upsert(rows.slice(i, i + 1000), { onConflict: "soc_code,year" });
    if (e) throw new Error("occupation_series: " + e.message);
  }
  const { count } = await db.from("occupation_series").select("*", { count: "exact", head: true });
  console.log(`occupation_series: ${count} rows in database`);
}
