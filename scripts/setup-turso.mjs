#!/usr/bin/env node
/**
 * Setup script: creates schema and seeds data in Turso.
 * Runs automatically during Vercel build (via package.json build script).
 */
import { createClient } from "@libsql/client";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually if running outside Vercel/Next
const envPath = join(__dirname, "..", ".env");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("Missing TURSO_DATABASE_URL");
  process.exit(1);
}

const db = createClient({ url, authToken });

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS "Hymn" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BACKLOG',
    "source" TEXT NOT NULL DEFAULT '2020',
    "hasDemo" BOOLEAN NOT NULL DEFAULT false,
    "tag" TEXT,
    "hymnaryNumber" INTEGER,
    "composer" TEXT,
    "version" TEXT,
    "hymnType" TEXT,
    "soloistNote" TEXT,
    "inConference2021" BOOLEAN NOT NULL DEFAULT false,
    "partituraPdfUrl" TEXT,
    "audioGeneralUrl" TEXT,
    "audioGeneralType" TEXT,
    "audioSopranoUrl" TEXT,
    "audioContraaltoUrl" TEXT,
    "audioTenorUrl" TEXT,
    "audioBajoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
`;

async function setup() {
  console.log("Conectando a Turso...");

  // Create table
  await db.execute(CREATE_TABLE);
  console.log("✓ Tabla Hymn creada (o ya existía)");

  // Check if already seeded
  const count = await db.execute("SELECT COUNT(*) as n FROM Hymn");
  const existing = Number(count.rows[0].n);
  if (existing > 0) {
    console.log(`⚠ La DB ya tiene ${existing} himnos. Nada que hacer.`);
    db.close();
    return;
  }

  // Load seed data
  const seedPath = join(__dirname, "seed-data.json");
  const hymns = JSON.parse(readFileSync(seedPath, "utf-8"));
  console.log(`Sembrando ${hymns.length} himnos...`);

  // Insert in batches of 50
  const BATCH = 50;
  for (let i = 0; i < hymns.length; i += BATCH) {
    const batch = hymns.slice(i, i + BATCH);
    const statements = batch.map((h) => ({
      sql: `INSERT INTO Hymn (title, status, source, hasDemo, tag, hymnaryNumber, composer, version, hymnType, soloistNote, inConference2021, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      args: [
        h.title,
        h.status,
        h.source,
        h.hasDemo ? 1 : 0,
        h.tag ?? null,
        h.hymnaryNumber ?? null,
        h.composer ?? null,
        h.version ?? null,
        h.hymnType ?? null,
        h.soloistNote ?? null,
        h.inConference2021 ? 1 : 0,
      ],
    }));
    await db.batch(statements);
    console.log(`  ${Math.min(i + BATCH, hymns.length)}/${hymns.length}...`);
  }

  const final = await db.execute("SELECT COUNT(*) as n FROM Hymn");
  console.log(`✓ Total en DB: ${final.rows[0].n} himnos`);
  db.close();
}

setup().catch((err) => {
  // On Vercel this should never fail. Locally it may fail due to network.
  if (process.env.VERCEL) {
    console.error("Error crítico en Vercel:", err.message);
    process.exit(1);
  } else {
    console.warn("⚠ setup-turso: no se pudo conectar (normal en entornos sin red):", err.message);
    process.exit(0);
  }
});
