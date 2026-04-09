/**
 * Voert scripts/clear-all-client-sites.sql uit tegen de database uit .env.local.
 *
 *   node scripts/run-clear-client-sites.mjs --yes
 *
 * Zonder --yes: alleen uitleg, geen wijzigingen.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

const MIGRATE_ENV_KEYS = new Set([
  "DATABASE_URL",
  "SUPABASE_DB_HOST",
  "SUPABASE_DB_USER",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_DB_PORT",
  "SUPABASE_DB_NAME",
]);

function loadEnvLocal() {
  const p = path.join(repoRoot, ".env.local");
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (MIGRATE_ENV_KEYS.has(key)) {
      process.env[key] = val;
    } else if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

const supabaseSsl = { rejectUnauthorized: false };

function tryParseConnUrlUserHost(connStr) {
  try {
    const normalized = connStr.replace(/^postgres(ql)?:\/\//i, "http://");
    const u = new URL(normalized);
    const port = u.port ? parseInt(u.port, 10) : 5432;
    return {
      host: u.hostname,
      user: decodeURIComponent(u.username || ""),
      port: Number.isFinite(port) ? port : 5432,
    };
  } catch {
    return null;
  }
}

function assertPoolerUsername(config) {
  let host = config.host;
  let user = config.user;
  if (config.connectionString) {
    const p = tryParseConnUrlUserHost(config.connectionString);
    if (!p) return;
    host = p.host;
    user = p.user;
  }
  if (!host?.includes("pooler.supabase.com")) return;
  if (user !== "postgres") return;
  console.error(
    "Session pooler vereist user postgres.<project-ref> (zie apply-supabase-migrations.mjs).",
  );
  process.exit(1);
}

function buildClientConfig() {
  const host = process.env.SUPABASE_DB_HOST?.trim();
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (host && password) {
    const user = process.env.SUPABASE_DB_USER?.trim() || "postgres";
    const port = parseInt(process.env.SUPABASE_DB_PORT?.trim() || "5432", 10);
    const database = process.env.SUPABASE_DB_NAME?.trim() || "postgres";
    const cfg = {
      host,
      port: Number.isFinite(port) && port > 0 ? port : 5432,
      user,
      password,
      database,
      ssl: supabaseSsl,
    };
    assertPoolerUsername(cfg);
    return cfg;
  }

  let url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("Geen DATABASE_URL of SUPABASE_DB_* in .env.local.");
    process.exit(1);
  }
  url = url.replace(/([?&])sslmode=[^&]*/gi, "$1").replace(/[?&]$/g, "");
  url = url.replace(/\?&/g, "?").replace(/&&+/g, "&");
  if (url.endsWith("?")) url = url.slice(0, -1);
  const cfg = { connectionString: url, ssl: supabaseSsl };
  assertPoolerUsername(cfg);
  return cfg;
}

async function main() {
  const yes = process.argv.includes("--yes");
  if (!yes) {
    console.log(`Dit verwijdert ALLE rijen in public.clients en gerelateerde data.
Voer uit met:  node scripts/run-clear-client-sites.mjs --yes
SQL-bestand:   scripts/clear-all-client-sites.sql`);
    process.exit(0);
  }

  loadEnvLocal();

  /** Losse queries (zelfde kern als clear-all-client-sites.sql). */
  const statements = [
    `DELETE FROM public.sales_tasks WHERE linked_entity_type IN ('client', 'website')`,
    `UPDATE public.clients SET draft_snapshot_id = NULL, published_snapshot_id = NULL`,
    `DELETE FROM public.clients`,
  ];

  const client = new pg.Client(buildClientConfig());
  await client.connect();
  try {
    for (const st of statements) {
      await client.query(st);
    }
    const { rows: c } = await client.query("select count(*)::int as n from public.clients");
    const { rows: s } = await client.query("select count(*)::int as n from public.site_snapshots");
    console.log("Database: clients=", c[0]?.n, " site_snapshots=", s[0]?.n);
  } finally {
    await client.end();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && sr) {
    const sb = createClient(url, sr);
    const n = await emptySiteAssetsBucket(sb);
    console.log("Storage site-assets: verwijderd", n, "bestand(en).");
  } else {
    console.log("Geen NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — storage niet geleegd.");
  }
}

/** Recursief: uploads staan onder `{slug}/…` in bucket site-assets. */
async function emptySiteAssetsBucket(sb) {
  const bucket = "site-assets";
  let removed = 0;

  async function walk(prefix) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) {
      console.warn("Storage list", prefix || "/", error.message);
      return;
    }
    if (!data?.length) return;

    const filePaths = [];
    for (const item of data) {
      const rel = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.metadata != null && Object.keys(item.metadata).length > 0) {
        filePaths.push(rel);
      } else {
        await walk(rel);
      }
    }
    if (filePaths.length) {
      const { error: rmErr } = await sb.storage.from(bucket).remove(filePaths);
      if (rmErr) console.warn("Storage remove", rmErr.message);
      else removed += filePaths.length;
    }
  }

  await walk("");
  return removed;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
