// Generates styles/tokens.css from design-system/tokens.json.
// Run: npm run tokens
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(readFileSync(join(root, "design-system/tokens.json"), "utf8"));

const firstTheme = tokens.color.themes[0].id;
const pick = (v) => (typeof v === "string" ? v : v[firstTheme]);
const resolve = (v) => pick(v).replace(/^\{([^}]+)\}$/, "var(--$1)");

const vars = [];
for (const t of tokens.color.tokens) vars.push(`  --${t.name}: ${resolve(t.value)};`);
for (const family of ["spacing", "radius", "shadow"]) {
  for (const t of tokens[family]?.tokens ?? []) vars.push(`  --${t.name}: ${t.value};`);
}
for (const [name, stack] of Object.entries(tokens.type.families)) {
  vars.push(`  --font-${name}: ${stack};`);
}

const camelToKebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const classes = [];
for (const group of tokens.type.groups) {
  for (const s of group.styles) {
    const family = s.family ?? group.family;
    const decls = [`font-family: var(--font-${family})`];
    for (const [k, v] of Object.entries(s)) {
      if (["name", "family", "sample", "usage"].includes(k)) continue;
      decls.push(`${camelToKebab(k)}: ${v}`);
    }
    classes.push(`.type-${s.name} { ${decls.join("; ")}; }`);
  }
}

const css = `/* ${tokens.name} — generated from design-system/tokens.json by scripts/build-tokens.mjs. Do not edit. */
:root {
${vars.join("\n")}
}

${classes.join("\n")}
`;

writeFileSync(join(root, "styles/tokens.css"), css);
console.log(`styles/tokens.css: ${vars.length} variables, ${classes.length} type classes`);
