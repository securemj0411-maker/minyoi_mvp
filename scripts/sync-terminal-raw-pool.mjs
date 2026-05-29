import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

const TERMINAL_STATES = ["sold_confirmed", "disappeared", "archived", "missing_suspect"];
const POOL_STATUSES = ["ready", "reserved"];
const PAGE_SIZE = 1000;
const PID_CHUNK = 180;
const PATCH_CHUNK = 80;

async function loadEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      process.env[key] ??= rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Optional local env file.
  }
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`) || process.argv.includes(`--${name}=1`) || process.argv.includes(`--${name}=true`);
}

function arg(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function restBaseUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function headers(prefer) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    ...(prefer ? { prefer } : {}),
  };
}

function tableUrl(tableName) {
  return `${restBaseUrl()}/${tableName}`;
}

async function restFetch(url, init = {}) {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`Supabase REST failed ${res.status}: ${await res.text()}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function chunk(values, size) {
  const out = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

function countBy(rows, selector) {
  const out = {};
  for (const row of rows) {
    const key = selector(row) ?? "(null)";
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

async function fetchPoolRows() {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = `${tableUrl("mvp_candidate_pool")}?select=pid,status,category,profit_band,expected_profit_min,comparable_key&status=in.(${POOL_STATUSES.join(",")})&limit=${PAGE_SIZE}&offset=${offset}`;
    const page = await restFetch(url, { headers: headers() });
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function fetchTerminalRawRows(pids) {
  const rows = [];
  for (const part of chunk(pids, PID_CHUNK)) {
    const url = `${tableUrl("mvp_raw_listings")}?select=pid,name,source,listing_state,sale_status,detail_status,price,sku_id,sku_name&pid=in.(${part.join(",")})&listing_state=in.(${TERMINAL_STATES.join(",")})&limit=${part.length}`;
    rows.push(...await restFetch(url, { headers: headers() }));
  }
  return rows;
}

async function invalidatePoolRows(pids, reason) {
  const now = new Date().toISOString();
  for (const part of chunk(pids, PATCH_CHUNK)) {
    const url = `${tableUrl("mvp_candidate_pool")}?pid=in.(${part.join(",")})&status=in.(${POOL_STATUSES.join(",")})`;
    await restFetch(url, {
      method: "PATCH",
      headers: headers("return=minimal"),
      body: JSON.stringify({
        status: "invalidated",
        invalidated_reason: reason,
        reserved_until: null,
        updated_at: now,
      }),
    });
  }
}

function renderMarkdown(report) {
  const lines = [
    "# Terminal Raw Pool Sync",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    "",
    "## Totals",
    ...Object.entries(report.totals).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## By Source",
    ...Object.entries(report.bySource).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## By Listing State",
    ...Object.entries(report.byListingState).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## By Category",
    ...Object.entries(report.byCategory).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Samples",
    ...report.samples.map((row) => `- pid ${row.pid}: ${row.name} / ${row.source} / raw=${row.listingState}(${row.saleStatus ?? "-"}) / pool=${row.poolStatus} / category=${row.category} / profit=${row.expectedProfitMin}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const apply = hasFlag("apply");
  const reason = arg("reason", "terminal_raw_state_pool_sync").slice(0, 120);
  const poolRows = await fetchPoolRows();
  const poolByPid = new Map(poolRows.map((row) => [Number(row.pid), row]));
  const rawRows = await fetchTerminalRawRows(poolRows.map((row) => Number(row.pid)).filter(Number.isFinite));
  const candidates = rawRows
    .map((raw) => {
      const pool = poolByPid.get(Number(raw.pid));
      if (!pool) return null;
      return {
        pid: Number(raw.pid),
        name: raw.name,
        source: raw.source,
        listingState: raw.listing_state,
        saleStatus: raw.sale_status,
        detailStatus: raw.detail_status,
        price: raw.price,
        skuId: raw.sku_id,
        skuName: raw.sku_name,
        poolStatus: pool.status,
        category: pool.category,
        profitBand: pool.profit_band,
        expectedProfitMin: pool.expected_profit_min,
        comparableKey: pool.comparable_key,
      };
    })
    .filter(Boolean);

  if (apply && candidates.length > 0) {
    await invalidatePoolRows(candidates.map((row) => row.pid), reason);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    reason,
    totals: {
      scannedPoolRows: poolRows.length,
      terminalRawPoolRows: candidates.length,
      applied: apply,
    },
    bySource: countBy(candidates, (row) => row.source),
    byListingState: countBy(candidates, (row) => row.listingState),
    byCategory: countBy(candidates, (row) => row.category),
    samples: candidates.slice(0, 80),
  };

  const suffix = apply ? "apply" : "dry-run";
  const jsonPath = path.join(reportsDir, `terminal-raw-pool-sync-${suffix}-latest.json`);
  const mdPath = path.join(reportsDir, `terminal-raw-pool-sync-${suffix}-latest.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, renderMarkdown(report));
  console.log(JSON.stringify({ jsonPath, mdPath, totals: report.totals, bySource: report.bySource, byListingState: report.byListingState, byCategory: report.byCategory }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
