import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;
const root = process.cwd();
const migrationsDir = path.join(root, "supabase", "migrations");
const lockKey = 773214495;

loadDotEnvLocal();

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "";

if (!databaseUrl) {
  const message =
    "No DATABASE_URL/SUPABASE_DB_URL/POSTGRES_URL found; skipping DB migrations locally.";
  if (process.env.VERCEL || process.env.CI || process.env.REQUIRE_DB_MIGRATIONS === "true") {
    console.error(
      "Database migrations are required for deployment, but no Postgres connection URL is configured."
    );
    console.error("Add DATABASE_URL in Vercel Project Settings -> Environment Variables.");
    process.exit(1);
  }
  console.log(message);
  process.exit(0);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : false,
});

try {
  await client.connect();
  await client.query("select pg_advisory_lock($1)", [lockKey]);
  await ensureMigrationsTable();

  const migrations = await readMigrations();
  let appliedCount = 0;

  for (const migration of migrations) {
    const existing = await client.query(
      "select checksum from public.app_schema_migrations where id = $1",
      [migration.id]
    );

    if (existing.rowCount > 0) {
      if (existing.rows[0].checksum !== migration.checksum) {
        throw new Error(
          `Migration checksum mismatch for ${migration.id}. Do not edit already-applied migrations.`
        );
      }
      continue;
    }

    console.log(`Applying migration ${migration.id}`);
    await client.query("begin");
    try {
      await client.query(migration.sql);
      await client.query(
        "insert into public.app_schema_migrations (id, checksum) values ($1, $2)",
        [migration.id, migration.checksum]
      );
      await client.query("commit");
      appliedCount++;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }

  console.log(
    appliedCount === 0
      ? "Database migrations already up to date."
      : `Applied ${appliedCount} database migration${appliedCount === 1 ? "" : "s"}.`
  );
} finally {
  try {
    await client.query("select pg_advisory_unlock($1)", [lockKey]);
  } catch {
    /* connection may have failed before the lock was acquired */
  }
  await client.end().catch(() => undefined);
}

async function ensureMigrationsTable() {
  await client.query(`
    create table if not exists public.app_schema_migrations (
      id text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

async function readMigrations() {
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(
    files.map(async (file) => {
      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      return {
        id: file,
        sql,
        checksum: crypto.createHash("sha256").update(sql).digest("hex"),
      };
    })
  );
}

function loadDotEnvLocal() {
  if (process.env.VERCEL || process.env.CI) return;
  const file = path.join(root, ".env.local");
  if (!fsSync.existsSync(file)) return;
  const content = fsSync.readFileSync(file, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

function shouldUseSsl(url) {
  return !/localhost|127\.0\.0\.1|sslmode=disable/i.test(url);
}
