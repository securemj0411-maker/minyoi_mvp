import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

async function loadEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional env file
  }
}

await loadEnvFile(path.join(appDir, ".env.local"));
await loadEnvFile(path.join(appDir, ".env"));

function arg(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function intArg(name, fallback, min, max) {
  const parsed = Number.parseInt(arg(name, String(fallback)), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

const base = arg("base", "http://localhost:3000").replace(/\/$/, "");
const defaultSecret = /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(base)
  ? "minyoi-cron-2026"
  : process.env.CRON_SECRET ?? "minyoi-cron-2026";
const secret = arg("secret", defaultSecret);
const limit = intArg("limit", 1000, 1, 20_000);
const batch = intArg("batch", 200, 1, 1000);
const reclassify = process.argv.includes("--reclassify");

async function call(offset, take) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(take),
    ...(reclassify ? { reclassify: "1" } : {}),
  });
  const res = await fetch(`${base}/api/debug/reparse-listings?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`reparse ${res.status}: ${text.slice(0, 800)}`);
  return JSON.parse(text);
}

let offset = 0;
let total = 0;
let needsReview = 0;
let noComparableKey = 0;
let skuRecovered = 0;
let reclassified = 0;
const criticalUnknown = new Map();

while (offset < limit) {
  const take = Math.min(batch, limit - offset);
  const result = await call(offset, take);
  const summary = result.summary ?? {};
  total += Number(summary.total ?? 0);
  needsReview += Number(summary.needsReview ?? 0);
  noComparableKey += Number(summary.noComparableKey ?? 0);
  skuRecovered += Number(summary.skuRecovered ?? 0);
  reclassified += Number(summary.reclassified ?? 0);
  for (const [key, value] of Object.entries(summary.criticalUnknown ?? {})) {
    criticalUnknown.set(key, (criticalUnknown.get(key) ?? 0) + Number(value));
  }
  console.log(`offset=${offset} reparsed=${summary.total} needsReview=${summary.needsReview} noKey=${summary.noComparableKey} skuRecovered=${summary.skuRecovered ?? 0} reclassified=${summary.reclassified ?? 0}`);
  if (Number(summary.total ?? 0) < take) break;
  offset += take;
}

console.log(JSON.stringify({
  total,
  needsReview,
  noComparableKey,
  skuRecovered,
  reclassified,
  criticalUnknown: Object.fromEntries([...criticalUnknown.entries()].sort((a, b) => b[1] - a[1])),
}, null, 2));
