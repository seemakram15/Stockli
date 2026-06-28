#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

loadEnvFile(".env.local");

const requiredTabs = ["overview", "latest", "income", "balance", "cashflow", "ratios"];
const keyPrefix = "stock-fundamentals:v4:";
const shouldPurge = process.argv.includes("--purge-incomplete");

const redisConfigs = [
  {
    name: "primary",
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  },
  {
    name: "fallback",
    url: process.env.UPSTASH_REDIS_FALLBACK_REST_URL,
    token: process.env.UPSTASH_REDIS_FALLBACK_REST_TOKEN,
  },
].filter((config) => looksReal(config.url) && looksReal(config.token));

if (!redisConfigs.length) {
  console.error("No Redis cache is configured.");
  process.exit(1);
}

let totalKeys = 0;
let totalComplete = 0;
let totalIncomplete = 0;
let totalPurged = 0;

for (const config of redisConfigs) {
  const redis = new Redis({ url: config.url, token: config.token });
  const keys = await scanKeys(redis, `${keyPrefix}*`);
  const report = {
    keys: keys.length,
    complete: 0,
    incomplete: 0,
    purged: 0,
    samples: [],
  };

  for (const key of keys) {
    const envelope = await redis.get(key);
    const value = envelope?.value;
    const missingTabs = getMissingTabs(value);
    if (!value || missingTabs.length > 0) {
      report.incomplete += 1;
      if (report.samples.length < 20) {
        report.samples.push({
          symbol: key.replace(keyPrefix, ""),
          missingTabs: missingTabs.length ? missingTabs : requiredTabs,
        });
      }
      if (shouldPurge) {
        await redis.del(key);
        report.purged += 1;
      }
    } else {
      report.complete += 1;
    }
  }

  totalKeys += report.keys;
  totalComplete += report.complete;
  totalIncomplete += report.incomplete;
  totalPurged += report.purged;

  console.log(
    `[${config.name}] keys=${report.keys} complete=${report.complete} incomplete=${report.incomplete} purged=${report.purged}`
  );
  if (report.samples.length) {
    console.log(`[${config.name}] incomplete samples:`);
    for (const sample of report.samples) {
      console.log(`  ${sample.symbol}: missing ${sample.missingTabs.join(", ")}`);
    }
  }
}

console.log(
  `Totals: keys=${totalKeys} complete=${totalComplete} incomplete=${totalIncomplete} purged=${totalPurged}`
);

function getMissingTabs(value) {
  if (!value?.company || !value?.tabs) return requiredTabs;
  return requiredTabs.filter((tabId) => !tabIsCachedSection(value.tabs[tabId]));
}

function tabIsCachedSection(tab) {
  return Boolean(tab && tab.status !== "error");
}

async function scanKeys(redis, match) {
  let cursor = 0;
  const keys = [];
  do {
    const result = await redis.scan(cursor, { match, count: 500 });
    cursor = Number(result[0]);
    keys.push(...result[1]);
  } while (cursor !== 0);
  return keys;
}

function looksReal(value) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized) && !normalized.includes("your-") && !normalized.includes("demo");
}

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
