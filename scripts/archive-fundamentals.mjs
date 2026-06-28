#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

loadEnvFile(".env.local");

const defaultBaseUrl = "http://localhost:3001";
const baseUrl = (
  process.env.STOCKLI_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : defaultBaseUrl)
).replace(/\/+$/, "");
const cronSecret = process.env.CRON_SECRET;
const batchLimit = Number(process.env.FUNDAMENTALS_ARCHIVE_LIMIT || 25);

if (!cronSecret) {
  console.error("CRON_SECRET is required to archive fundamentals.");
  process.exit(1);
}

let offset = Number(process.env.FUNDAMENTALS_ARCHIVE_OFFSET || 0);
let totalStored = 0;
let totalFailed = 0;

while (true) {
  const url = new URL("/api/cron/fundamentals-archive", baseUrl);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(batchLimit));

  console.log(`Archiving fundamentals batch offset=${offset} limit=${batchLimit}`);
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${cronSecret}`,
      accept: "application/json",
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    console.error(payload);
    process.exit(1);
  }

  totalStored += payload.stored ?? 0;
  totalFailed += payload.failed?.length ?? 0;
  console.log(
    `Stored ${payload.stored}/${payload.limit}. Failed ${payload.failed?.length ?? 0}. Next offset: ${
      payload.nextOffset ?? "done"
    }`
  );
  for (const failure of (payload.failed ?? []).slice(0, 10)) {
    console.log(`  ${failure.symbol}: ${failure.error}`);
  }

  if (payload.nextOffset === null || payload.nextOffset === undefined) break;
  offset = payload.nextOffset;
}

console.log(`Fundamentals archive complete. Stored=${totalStored}, failed=${totalFailed}`);

function loadEnvFile(filename) {
  const filePath = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}
