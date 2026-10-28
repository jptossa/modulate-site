// Loads O*NET occupations, skills and knowledge into Supabase.
//   node --env-file=.env scripts/ingest/onet.mjs --dry-run     parse and print counts only
//   node --env-file=.env scripts/ingest/onet.mjs               upsert into the database (service role)
// Needs the unzipped O*NET text database in data/onet-31-0/extracted/db_31_0_text (see data/README.md).
// Run migration 20261028000200_centered_similarity.sql first: this writes skills.mean_weight.
import { createClient } from "@supabase/supabase-js";
import { parseOnet } from "./onet-parse.mjs";

const DIR = process.env.ONET_DIR ?? "data/onet-31-0/extracted/db_31_0_text";
const dryRun = process.argv.includes("--dry-run");

const { occupations, vectors } = parseOnet(DIR);

// Only occupations O*NET actually rated can be matched, so only those are loaded (the rest are "All Other" catch-alls).
const socs = [...vectors.keys()].sort();

// Skill list, with each skill's mean importance x level across the loaded occupations (missing = 0).
const skills = new Map(); // "kind|name" -> {kind, name, sum}
for (const soc of socs) {
  for (const [key, e] of vectors.get(soc)) {
    const s = skills.get(key) ?? { kind: e.kind, name: e.name, sum: 0 };
    s.sum += e.importance * e.level;
    skills.set(key, s);
  }
}
const skillRows = [...skills.values()].map((s) => ({ kind: s.kind, name: s.name, mean_weight: s.sum / socs.length }));
const ratingCount = socs.reduce((n, s) => n + vectors.get(s).size, 0);

console.log(`occupations: ${socs.length} (of ${occupations.size} SOCs; ${occupations.size - socs.length} unrated skipped)`);
console.log(`skills: ${skillRows.length} (${skillRows.filter((s) => s.kind === "skill").length} skill, ${skillRows.filter((s) => s.kind === "knowledge").length} knowledge)`);
console.log(`occupation_skills: ${ratingCount}`);
if (dryRun) process.exit(0);

const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false } });

async function upsertAll(table, rows, onConflict, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + size), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`upserted ${rows.length} into ${table}`);
}

await upsertAll(
  "occupations",
  socs.map((soc) => ({ soc_code: soc, title: occupations.get(soc).title, description: occupations.get(soc).description })),
  "soc_code",
);
await upsertAll("skills", skillRows, "kind,name");

const { data: skillIds, error } = await db.from("skills").select("id,kind,name");
if (error) throw new Error(`skills: ${error.message}`);
const idOf = new Map(skillIds.map((s) => [`${s.kind}|${s.name}`, s.id]));

const rows = [];
for (const soc of socs) {
  for (const [key, e] of vectors.get(soc)) {
    rows.push({ soc_code: soc, skill_id: idOf.get(key), importance: e.importance, level: e.level });
  }
}
await upsertAll("occupation_skills", rows, "soc_code,skill_id", 1000);

for (const table of ["occupations", "skills", "occupation_skills"]) {
  const { count } = await db.from(table).select("*", { count: "exact", head: true });
  console.log(`${table}: ${count} rows in database`);
}
