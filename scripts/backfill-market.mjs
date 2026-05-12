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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const base = arg("base", "http://localhost:3000").replace(/\/$/, "");
const defaultSecret = /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(base)
  ? "minyoi-cron-2026"
  : process.env.CRON_SECRET ?? "minyoi-cron-2026";
const secret = arg("secret", defaultSecret);
const pages = intArg("pages", 10, 1, 30);
const detailRounds = intArg("detail-rounds", 8, 0, 60);
const detailDelayMs = intArg("detail-delay-ms", 1500, 0, 30_000);
const pageDelayMs = intArg("page-delay-ms", 1500, 0, 30_000);
const retries = intArg("retries", 1, 0, 5);

async function call(pathname, timeoutMs = 90_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(`${base}${pathname}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      signal: ctrl.signal,
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 500) };
    }
    if (!res.ok) {
      throw new Error(`${pathname} ${res.status}: ${text.slice(0, 800)}`);
    }
    return { status: res.status, ms: Date.now() - started, body };
  } finally {
    clearTimeout(timer);
  }
}

async function callWithRetry(label, pathname, timeoutMs = 90_000) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await call(pathname, timeoutMs);
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({
        label,
        attempt: attempt + 1,
        maxAttempts: retries + 1,
        error: message.slice(0, 500),
      }));
      if (attempt < retries) await sleep(2000 * (attempt + 1));
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  return {
    status: 0,
    ms: 0,
    body: {
      result: {
        error: message.slice(0, 500),
        timedOut: /abort|timeout/i.test(message),
      },
    },
  };
}

function summarize(label, result) {
  const r = result.body?.result ?? {};
  console.log(JSON.stringify({
    label,
    status: result.status,
    ms: result.ms,
    collected: r.collected,
    queued: r.queued,
    detailQueueSkipped: r.detailQueueSkipped,
    enriched: r.enriched,
    scored: r.scored,
    poolUpserted: r.poolUpserted,
    poolSkipped: r.poolSkipped,
    timedOut: r.timedOut,
    error: r.error,
    stageDurationsMs: r.stageDurationsMs,
  }));
}

console.log(`market backfill start base=${base} pages=${pages} detailRounds=${detailRounds}`);

for (let page = 1; page <= pages; page += 1) {
  const result = await callWithRetry(`deep-crawl:page-${page}`, `/api/cron/deep-crawl?wait=1&page=${page}`);
  summarize(`deep-crawl:page-${page}`, result);
  if (pageDelayMs > 0) await sleep(pageDelayMs);
}

for (let round = 1; round <= detailRounds; round += 1) {
  const result = await callWithRetry(`detail-worker:${round}`, "/api/cron/detail-worker?wait=1");
  summarize(`detail-worker:${round}`, result);
  if (detailDelayMs > 0) await sleep(detailDelayMs);
}

const score = await callWithRetry("tick:score-refresh", "/api/cron/tick?wait=1");
summarize("tick:score-refresh", score);

const warm = await callWithRetry("pool-warmer", "/api/cron/pool-warmer?wait=1");
summarize("pool-warmer", warm);

const clean = await callWithRetry("housekeeper", "/api/cron/housekeeper?wait=1", 45_000);
summarize("housekeeper", clean);

console.log("market backfill done");
