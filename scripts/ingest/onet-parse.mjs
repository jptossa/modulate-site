// Parses the O*NET text database (tab-delimited) into 6-digit-SOC occupations with skill/knowledge vectors.
// Source: O*NET 31.0 Database, CC BY 4.0, https://www.onetcenter.org/database.html
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const ONET_VERSION = "31.0";
export const ONET_RELEASE_DATE = "2026-08-01"; // "August 2026 Release" (Read Me.txt)

function table(dir, name) {
  const lines = readFileSync(join(dir, `${name}.txt`), "utf8").split(/\r?\n/).filter(Boolean);
  const header = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const cells = line.split("\t");
    return Object.fromEntries(header.map((h, i) => [h, cells[i]]));
  });
}

const soc6 = (onetCode) => onetCode.slice(0, 7); // "11-1011.03" -> "11-1011"
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Normalised per-element rating: importance 1..5 -> 0..1, level 0..7 -> 0..1. */
const SCALE = { IM: (v) => (v - 1) / 4, LV: (v) => v / 7 };

/**
 * Returns { occupations: Map<soc, {title, description, onetCodes}>, vectors: Map<soc, Map<"kind|name", {kind,name,importance,level}>> }.
 * One O*NET-SOC code ending in .00 is the SOC's base occupation: when present only it is used, otherwise the
 * detailed O*NET codes under that SOC are averaged.
 */
export function parseOnet(dir) {
  const occRows = table(dir, "Occupation Data");
  const byOnet = new Map(occRows.map((r) => [r["O*NET-SOC Code"], r]));

  const groups = new Map(); // soc -> onet codes
  for (const code of byOnet.keys()) {
    const s = soc6(code);
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s).push(code);
  }

  const occupations = new Map();
  const chosen = new Map(); // onet code -> soc, the codes whose ratings are used
  for (const [soc, codes] of groups) {
    const base = codes.find((c) => c.endsWith(".00"));
    const used = base ? [base] : codes;
    const first = byOnet.get(used[0]);
    occupations.set(soc, {
      title: first.Title,
      description: first.Description,
      onetCodes: used,
      hasBase: !!base,
    });
    for (const c of used) chosen.set(c, soc);
  }

  // Ratings: onet code -> "kind|name" -> {IM, LV}
  const ratings = new Map();
  const sources = [
    ["Essential Skills", "skill"],
    ["Transferable Skills", "skill"],
    ["Knowledge", "knowledge"],
  ];
  for (const [file, kind] of sources) {
    for (const r of table(dir, file)) {
      const code = r["O*NET-SOC Code"];
      if (!chosen.has(code)) continue;
      if (r["Recommend Suppress"] === "Y") continue;
      if (r["Scale ID"] !== "IM" && r["Scale ID"] !== "LV") continue;
      if (r["Scale ID"] === "LV" && r["Not Relevant"] === "Y") continue;
      const key = `${kind}|${r["Element Name"]}`;
      const perCode = ratings.get(code) ?? new Map();
      ratings.set(code, perCode);
      const cell = perCode.get(key) ?? {};
      cell[r["Scale ID"]] = SCALE[r["Scale ID"]](Number(r["Data Value"]));
      perCode.set(key, cell);
    }
  }

  const vectors = new Map();
  for (const [soc, occ] of occupations) {
    const acc = new Map(); // key -> {importance: [], level: []}
    for (const code of occ.onetCodes) {
      for (const [key, cell] of ratings.get(code) ?? []) {
        if (cell.IM === undefined || cell.LV === undefined) continue;
        const a = acc.get(key) ?? { importance: [], level: [] };
        a.importance.push(cell.IM);
        a.level.push(cell.LV);
        acc.set(key, a);
      }
    }
    const vec = new Map();
    for (const [key, a] of acc) {
      const [kind, ...name] = key.split("|");
      vec.set(key, { kind, name: name.join("|"), importance: mean(a.importance), level: mean(a.level) });
    }
    if (vec.size) vectors.set(soc, vec);
  }
  return { occupations, vectors };
}
