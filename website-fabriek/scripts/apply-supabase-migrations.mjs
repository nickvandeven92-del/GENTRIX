/**
 * Voert alle .sql-bestanden in supabase/migrations uit (alfabetisch = migratievolgorde).
 *
 * Authenticatie (kies één):
 * - DATABASE_URL (Postgres-URI uit Supabase → Database → URI, direct :5432)
 * - Of los: SUPABASE_DB_HOST, SUPABASE_DB_PASSWORD, optioneel SUPABASE_DB_USER (default postgres),
 *   SUPABASE_DB_PORT (5432), SUPABASE_DB_NAME (postgres) — handig als je wachtwoord @, #, etc. bevat.
 *
 * Gebruik:
 *   npm run db:migrate
 *   npm run db:migrate -- --from 20260406143000     (alleen bestanden met naam >= dit prefix)
 *   npm run db:migrate -- --only 20260406160000_client_appointments_booker.sql
 *   npm run db:migrate -- --help
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const migrationsDir = path.join(repoRoot, "supabase", "migrations");

/** Deze keys uit .env.local altijd toepassen (wint van Windows-gebruikersomgeving). */
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

function listMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Map ontbreekt: ${migrationsDir}`);
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/**
 * @param {string[]} argv
 */
function parseMigrateCliArgs(argv) {
  let from = null;
  let only = null;
  let help = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") help = true;
    else if (a === "--from") {
      const v = argv[++i];
      if (!v) {
        console.error("--from vereist een waarde, bv. 20260406143000");
        process.exit(1);
      }
      from = v;
    } else if (a === "--only") {
      const v = argv[++i];
      if (!v) {
        console.error("--only vereist een bestandsnaam uit supabase/migrations/");
        process.exit(1);
      }
      only = v;
    }
  }
  if (from && only) {
    console.error("Gebruik óf --from óf --only, niet beide.");
    process.exit(1);
  }
  return { from, only, help };
}

/**
 * @param {string[]} all
 * @param {{ from: string | null; only: string | null }} opts
 */
function resolveMigrationFiles(all, opts) {
  if (opts.only) {
    const exact = all.find((f) => f === opts.only);
    if (exact) return [exact];
    const matches = all.filter((f) => f === opts.only || f.endsWith(opts.only));
    if (matches.length === 1) return matches;
    console.error(
      `--only "${opts.only}": ${matches.length === 0 ? "geen" : "meerdere"} treffers. Gebruik de exacte bestandsnaam.`,
    );
    if (matches.length > 1) console.error("Mogelijkheden:", matches.join(", "));
    process.exit(1);
  }
  if (opts.from) {
    return all.filter((f) => f >= opts.from);
  }
  return all;
}

/** Supabase Postgres vereist TLS. */
const supabaseSsl = { rejectUnauthorized: false };

/**
 * @param {string} connStr
 * @returns {{ host: string; user: string } | null}
 */
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

/**
 * Korte samenvatting voor foutmeldingen (geen wachtwoord).
 * @param {import('pg').ClientConfig} config
 */
function describeClientConfig(config) {
  if (config.connectionString) {
    const p = tryParseConnUrlUserHost(config.connectionString);
    if (!p) return "DATABASE_URL (parse mislukt — check speciale tekens in URL)";
    return `user="${p.user}" host=${p.host} port=${p.port}`;
  }
  return `user="${config.user}" host=${config.host} port=${config.port}`;
}

/**
 * Session pooler weigert vaak user "postgres"; vereist postgres.<project-ref>.
 * @param {import('pg').ClientConfig} config
 */
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
  console.error(`
Je DATABASE_URL / SUPABASE_* wijst naar de pooler (*.pooler.supabase.com), maar de gebruikersnaam is nog "postgres".

Voor Session pooler moet de user exact zijn:  postgres.<project-ref>
Bijvoorbeeld:  postgres.ugbropmbxwuveobskoss
(Zo staat het in Supabase → Connect → Session pooler → URI.)

Of zet in .env.local:
  SUPABASE_DB_HOST=aws-0-….pooler.supabase.com
  SUPABASE_DB_USER=postgres.<project-ref>
  SUPABASE_DB_PASSWORD=<database password uit Project Settings → Database>
`.trim());
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
    console.error(
      "Geen database-configuratie. Zet in .env.local:\n" +
        "  DATABASE_URL=postgresql://postgres:…@db.<ref>.supabase.co:5432/postgres\n" +
        "of (aanbevolen bij speciale tekens in wachtwoord):\n" +
        "  SUPABASE_DB_HOST=db.<ref>.supabase.co\n" +
        "  SUPABASE_DB_PASSWORD=…\n",
    );
    process.exit(1);
  }

  if (
    /\[YOUR-PASSWORD\]/i.test(url) ||
    /:YOUR-PASSWORD@/i.test(url) ||
    /\[.*\]\s*@/.test(url)
  ) {
    console.error(
      "DATABASE_URL bevat nog een placeholder ([YOUR-PASSWORD]). Vervang die door je echte database-wachtwoord, of gebruik SUPABASE_DB_HOST + SUPABASE_DB_PASSWORD.",
    );
    process.exit(1);
  }

  // sslmode=require in de URI wordt door recente `pg` als strikte cert-check geïnterpreteerd
  // → "self-signed certificate in certificate chain" bij Supabase. TLS via onderstaand ssl-object.
  url = url.replace(/([?&])sslmode=[^&]*/gi, "$1").replace(/[?&]$/g, "");
  url = url.replace(/\?&/g, "?").replace(/&&+/g, "&");
  if (url.endsWith("?")) url = url.slice(0, -1);

  const cfg = { connectionString: url, ssl: supabaseSsl };
  assertPoolerUsername(cfg);
  return cfg;
}

async function main() {
  loadEnvLocal();

  const cli = parseMigrateCliArgs(process.argv);
  if (cli.help) {
    console.log(`apply-supabase-migrations.mjs

  npm run db:migrate
      Alle bestanden in supabase/migrations (alfabetisch).

  npm run db:migrate -- --from <prefix>
      Alleen bestanden waarvan de naam >= prefix (tijdstamp), bv.:
      npm run db:migrate -- --from 20260406143000

  npm run db:migrate -- --only <bestand.sql>
      Eén migratie, bv.:
      npm run db:migrate -- --only 20260406160000_client_appointments_booker.sql

Handig als je database al deels bestaat en opnieuw "already exists" geeft.
`);
    process.exit(0);
  }

  const allFiles = listMigrationFiles();
  if (allFiles.length === 0) {
    console.error("Geen .sql-bestanden in supabase/migrations.");
    process.exit(1);
  }

  const files = resolveMigrationFiles(allFiles, cli);
  if (files.length === 0) {
    console.error("Geen migraties om uit te voeren (--from filter te hoog of leeg).");
    process.exit(1);
  }
  if (cli.from) {
    console.error(`Filter --from ${cli.from}: ${files.length} bestand(en) (van ${allFiles.length} totaal).`);
  }
  if (cli.only) {
    console.error(`Filter --only: 1 bestand.`);
  }

  const clientConfig = buildClientConfig();
  const client = new pg.Client(clientConfig);
  try {
    await client.connect();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const err = /** @type {{ code?: string; address?: string }} */ (e);
    const ipv6ish =
      typeof err?.address === "string" && err.address.includes(":") && !/^\d{1,3}(\.\d{1,3}){3}$/.test(err.address);
    const timedOut = err?.code === "ETIMEDOUT" || /ETIMEDOUT/i.test(msg);
    if (timedOut || ipv6ish) {
      console.error(`
Verbinding time-out → vaak IPv6. Supabase "Direct" (db…supabase.co:5432) gebruikt standaard IPv6; veel thuis-/Windows-netwerken krijgen dan geen route.

Gebruik Session pooler (IPv4 + IPv6):
  Dashboard → Connect → "Session pooler" (niet Direct).
  • Host: aws-0-<regio>.pooler.supabase.com
  • Poort: 5432
  • Gebruiker: postgres.<project-ref>  (voorbeeld: postgres.ugbropmbxwuveobskoss)
  • Wachtwoord: database-wachtwoord

Zet dat in .env.local als DATABASE_URL of als:
  SUPABASE_DB_HOST=aws-0-….pooler.supabase.com
  SUPABASE_DB_USER=postgres.<project-ref>
  SUPABASE_DB_PASSWORD=…

https://supabase.com/docs/guides/database/connecting-to-postgres#pooler-session-mode
`.trim());
    }
    if (err?.code === "28P01" || /password authentication failed/i.test(msg)) {
      const profile = describeClientConfig(clientConfig);
      console.error(`
PostgreSQL meldt: wachtwoord / gebruiker wordt geweigerd (28P01).

Wat dit script nu probeerde: ${profile}

Checklist:
  • Host eindigt op  *.pooler.supabase.com  en poort 5432? → user moet  postgres.<project-ref>  zijn (Session pooler).
  • Host is  db….supabase.co  en poort 6543? → user is  postgres  (Transaction pooler); dan is bijna altijd het wachtwoord fout.
  • Host is  db….supabase.co  en poort 5432? → user  postgres  (direct); zelfde wachtwoord als hierboven.

Wachtwoord ALLEEN uit: Supabase → Project Settings → Database → Database password.
(Niet anon key, niet service_role.) Reset het wachtwoord daar, kopieer het meteen, en zet het opnieuw in .env.local.

Aanbevolen in .env.local (geen URL-encoding):
  SUPABASE_DB_HOST=<exact uit Connect>
  SUPABASE_DB_USER=postgres   of   postgres.<project-ref>   (zie boven)
  SUPABASE_DB_PASSWORD=<nieuw na reset>
  SUPABASE_DB_PORT=5432   of   6543
  Verwijder of commentarieer DATABASE_URL tijdelijk als je deze methode gebruikt.

Let op: voor dit script wint .env.local boven oude DATABASE_URL in Windows-systeemomgeving.
`.trim());
    }
    console.error("Connect mislukte:", msg);
    process.exit(1);
  }

  console.error(`Verbonden. ${files.length} migratie(s)…`);
  console.error(
    "Let op: dit draait elke .sql opnieuw. Bestaat je schema al deels, kan Postgres klagen (already exists). Voer dan alleen ontbrekende bestanden handmatig uit of los het conflict op.",
  );

  try {
    for (const name of files) {
      const full = path.join(migrationsDir, name);
      const sql = fs.readFileSync(full, "utf8");
      process.stderr.write(`  → ${name}\n`);
      await client.query(sql);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Migratie faalde:", msg);
    if (/already exists/i.test(msg)) {
      console.error(`
Tip: schema bestond al. Draai alleen neuere / ontbrekende migraties, bijv.:
  npm run db:migrate -- --from 20260406143000
of één bestand:
  npm run db:migrate -- --only 20260406160000_client_appointments_booker.sql
Zie ook: npm run db:migrate -- --help
`);
    }
    process.exit(1);
  } finally {
    await client.end();
  }

  console.error("Klaar.");
}

await main();
