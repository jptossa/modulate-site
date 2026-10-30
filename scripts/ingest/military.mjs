// Loads the O*NET Military Crosswalk (military occupation codes -> O*NET-SOC roles) into Supabase.
//   node --env-file=.env scripts/ingest/military.mjs --dry-run     parse and print counts only (reads occupations from the database)
//   node --env-file=.env scripts/ingest/military.mjs               replace the crosswalk in the database (service role)
// Needs milx0724.csv from https://onetcenter.org/dl_files/2019/military_crosswalk.zip in data/onet-military/extracted/military_crosswalk
// (see data/README.md), the O*NET ingest to have run, and migration 20261030000000_military_crosswalk.sql applied.
// Source: O*NET Military Crosswalk, built on the Defense Manpower Data Center MOC crosswalk. CC BY 4.0.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseCsv } from "./csv.mjs";

const FILE = process.env.MILITARY_FILE ?? "data/onet-military/extracted/military_crosswalk/milx0724.csv";
const dryRun = process.argv.includes("--dry-run");

// SVC letters that hold occupational codes. Left out: G (OPM civil service series), D (DoD conversion codes), K (NSPS).
const BRANCH = {
  A: "army", J: "army", Q: "army",
  N: "navy", P: "navy", S: "navy", V: "navy",
  F: "air_force", X: "air_force", Y: "air_force", Z: "air_force",
  M: "marine_corps",
  C: "coast_guard",
  H: "space_force", L: "space_force", O: "space_force", U: "space_force",
};
const CATEGORY = { E: "enlisted", O: "officer", W: "warrant" };

const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });

// Only occupations O*NET rated are loaded, so only those can be linked.
const { data: occ, error: occError } = await db.from("occupations").select("soc_code").limit(5000);
if (occError) throw new Error(`occupations: ${occError.message}`);
const ours = new Set(occ.map((o) => o.soc_code));

const records = parseCsv(readFileSync(FILE, "utf8"));
for (const col of ["SVC", "MPC", "MOC", "MOC_TITLE", "STATUS", "SDATE", "EDATE", "ONET1", "ONET2", "ONET3", "ONET4"]) {
  if (!(col in (records[0] ?? {}))) throw new Error(`${FILE}: column ${col} not found`);
}

// O*NET-SOC "29-2043.00" (or a detail code "15-1299.08") -> the 6-digit SOC the rest of the app keys on, with its title.
const linksOf = (r) =>
  [1, 2, 3, 4]
    .filter((n) => /^\d\d-\d{4}\.\d\d$/.test(r[`ONET${n}`]))
    .map((n) => ({ soc: r[`ONET${n}`].slice(0, 7), title: r[`ONET${n}_TITLE`].trim() }));

// A code the services reuse has an active and an obsolete record with different meanings: the active one wins.
// A code with only obsolete records keeps the most recently retired one, flagged inactive.
const groups = new Map();
for (const r of records) {
  const branch = BRANCH[r.SVC];
  const category = CATEGORY[r.MPC];
  if (!branch || !category || !r.MOC.trim()) continue;
  const key = `${branch}|${category}|${r.MOC.trim()}`;
  if (!groups.has(key)) groups.set(key, { branch, category, code: r.MOC.trim(), rows: [] });
  groups.get(key).rows.push(r);
}

// A code O*NET links only to roles we do not carry (mostly military-only ones such as "Infantry") is still loaded,
// with no roles and the titles in other_links, so the app can say so instead of finding nothing.
const stats = { unlinked: 0, droppedSocs: new Map(), inactive: 0, noRole: 0 };
const occupations = [];
for (const g of groups.values()) {
  const active = g.rows.filter((r) => r.STATUS === "A");
  const rows = active.length ? active : [g.rows.reduce((a, b) => (b.EDATE > a.EDATE ? b : a))];
  const roles = [];
  const otherLinks = [];
  for (const r of rows) {
    for (const { soc, title } of linksOf(r)) {
      if (ours.has(soc)) {
        if (!roles.includes(soc)) roles.push(soc);
      } else {
        stats.droppedSocs.set(soc, { title, n: (stats.droppedSocs.get(soc)?.n ?? 0) + 1 });
        if (!otherLinks.includes(title)) otherLinks.push(title);
      }
    }
  }
  if (!roles.length && !otherLinks.length) {
    stats.unlinked++;
    continue;
  }
  const newest = rows.reduce((a, b) => (b.SDATE > a.SDATE ? b : a));
  occupations.push({
    branch: g.branch,
    category: g.category,
    code: g.code,
    code_key: g.code.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    title: newest.MOC_TITLE.trim(),
    active: active.length > 0,
    other_links: roles.length ? [] : otherLinks,
    roles,
  });
  if (!active.length) stats.inactive++;
  if (!roles.length) stats.noRole++;
}

const perBranch = {};
for (const o of occupations) perBranch[o.branch] = (perBranch[o.branch] ?? 0) + 1;
console.log(`csv rows: ${records.length}, code groups: ${groups.size}, with no O*NET link at all (skipped): ${stats.unlinked}`);
console.log(`codes loaded: ${occupations.length} (${stats.inactive} inactive, ${stats.noRole} with no role we carry)`);
console.log("per branch:", perBranch);
console.log(`role links: ${occupations.reduce((n, o) => n + o.roles.length, 0)}, distinct roles: ${new Set(occupations.flatMap((o) => o.roles)).size}`);
const dropped = [...stats.droppedSocs].sort((a, b) => b[1].n - a[1].n);
console.log(`O*NET SOCs we do not carry: ${dropped.length} distinct, ${dropped.reduce((n, [, d]) => n + d.n, 0)} links. Most linked:`);
for (const [soc, d] of dropped.slice(0, 8)) console.log(`  ${soc} ${d.title} (${d.n})`);
for (const [branch, code] of [["army", "68W"], ["navy", "HM"], ["air_force", "3D032"], ["marine_corps", "0311"], ["coast_guard", "HS"]]) {
  for (const o of occupations.filter((x) => x.branch === branch && x.code === code)) {
    console.log(`  ${branch} ${o.category} ${o.code} "${o.title}" -> ${o.roles.join(", ") || `(none; O*NET lists ${o.other_links.join(", ")})`}`);
  }
}
if (dryRun) process.exit(0);

async function upsertAll(table, rows, onConflict, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + size), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`upserted ${rows.length} into ${table}`);
}

await upsertAll(
  "military_occupations",
  occupations.map((o) => ({ branch: o.branch, category: o.category, code: o.code, code_key: o.code_key, title: o.title, active: o.active, other_links: o.other_links })),
  "branch,category,code",
);

// Ids are generated, so read them back (a page at a time: the API returns at most 1000 rows per request).
const ids = new Map();
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from("military_occupations")
    .select("id,branch,category,code")
    .order("id")
    .range(from, from + 999);
  if (error) throw new Error(`military_occupations: ${error.message}`);
  for (const r of data) ids.set(`${r.branch}|${r.category}|${r.code}`, r.id);
  if (data.length < 1000) break;
}

// Replace the links wholesale so a reload with a newer file leaves no stale ones.
const { error: clearError } = await db.from("military_roles").delete().gte("position", 0);
if (clearError) throw new Error(`military_roles: ${clearError.message}`);
const links = occupations.flatMap((o) =>
  o.roles.map((soc, i) => ({ military_id: ids.get(`${o.branch}|${o.category}|${o.code}`), soc_code: soc, position: i + 1 })),
);
await upsertAll("military_roles", links, "military_id,soc_code", 1000);

for (const table of ["military_occupations", "military_roles"]) {
  const { count } = await db.from(table).select("*", { count: "exact", head: true });
  console.log(`${table}: ${count} rows in database`);
}
