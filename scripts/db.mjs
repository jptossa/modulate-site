// Small Postgres helper for a hosted Supabase project (no CLI/Docker needed).
//   node --env-file=.env scripts/db.mjs inspect     list public tables and applied migrations
//   node --env-file=.env scripts/db.mjs migrate     apply supabase/migrations/*.sql not yet applied
// Uses DB_PASS and the project ref from NEXT_PUBLIC_SUPABASE_URL. Override the host with DB_HOST if needed
// (for example the pooler host from Dashboard > Connect, if the direct host is IPv6-only on your network).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pass = process.env.DB_PASS;
if (!url || !pass) throw new Error("NEXT_PUBLIC_SUPABASE_URL and DB_PASS must be set in .env");

const ref = new URL(url).hostname.split(".")[0];
const host = process.env.DB_HOST ?? `db.${ref}.supabase.co`;
const user = process.env.DB_USER ?? "postgres";

const client = new pg.Client({
  host,
  port: Number(process.env.DB_PORT ?? 5432),
  user,
  password: pass,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

async function inspect() {
  const tables = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' order by 1",
  );
  console.log("public tables:", tables.rows.map((r) => r.table_name).join(", ") || "(none)");
  const applied = await client
    .query("select version from supabase_migrations.schema_migrations order by 1")
    .then((r) => r.rows.map((x) => x.version))
    .catch(() => []);
  console.log("applied migrations:", applied.join(", ") || "(none)");
  return { tables: tables.rows.map((r) => r.table_name), applied };
}

async function migrate() {
  const { tables, applied } = await inspect();
  const dir = "supabase/migrations";
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const pending = files.filter((f) => !applied.includes(f.split("_")[0]));
  if (!pending.length) return console.log("nothing to apply");
  if (tables.length && !applied.length) {
    throw new Error("public schema already has tables but no recorded migrations; refusing to apply over it");
  }
  await client.query("create schema if not exists supabase_migrations");
  await client.query(
    "create table if not exists supabase_migrations.schema_migrations (version text primary key, name text, statements text[])",
  );
  for (const f of pending) {
    const [version, ...rest] = f.replace(/\.sql$/, "").split("_");
    const sql = readFileSync(join(dir, f), "utf8");
    console.log("applying", f);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)", [
        version,
        rest.join("_"),
      ]);
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  }
  console.log("done");
}

const command = process.argv[2];
try {
  await client.connect();
  console.log(`connected to ${host} as ${user}`);
  if (command === "inspect") await inspect();
  else if (command === "migrate") await migrate();
  else console.log("usage: db.mjs inspect | migrate");
} catch (e) {
  console.error("error:", e.code ?? "", e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
