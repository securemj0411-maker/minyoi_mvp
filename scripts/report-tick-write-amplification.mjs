import { mkdir, readFile, writeFile } from "node:fs/promises";
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

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pct(part, total, digits = 1) {
  if (!total) return "0%";
  return `${((n(part) / n(total)) * 100).toFixed(digits)}%`;
}

function num(value) {
  return Math.round(n(value)).toLocaleString("ko-KR");
}

function seconds(ms) {
  return `${(n(ms) / 1000).toFixed(1)}s`;
}

function dateStamp(date) {
  return date.toISOString().slice(0, 10);
}

function supabaseRestUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_URL 필요");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function authHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 필요");
  return { apikey: key, authorization: `Bearer ${key}` };
}

async function fetchJson(pathname, fallback = []) {
  try {
    const res = await fetch(`${supabaseRestUrl()}${pathname}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(restTimeoutMs),
    });
    if (res.status === 404) return fallback;
    if (!res.ok) throw new Error(`${pathname} ${res.status}: ${await res.text()}`);
    return res.json();
  } catch (err) {
    fetchIssues.push({
      path: pathname.slice(0, 260),
      error: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function stage(row, name) {
  return row.stage_stats?.stages?.[name] ?? {};
}

function timings(row) {
  const value = stage(row, "search")?.timingsMs;
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function timing(row, name) {
  return n(timings(row)[name]);
}

function workerName(row) {
  const meta = row.request_meta ?? {};
  const mode = typeof meta.pipelineMode === "string" ? meta.pipelineMode : "";
  if (mode) return mode;
  const value = row.request_path ?? "";
  if (value.includes("/deep-crawl")) return "deep_crawl";
  if (value.includes("/tick")) return "tick";
  return value || "unknown";
}

function percentile(values, p) {
  const filtered = values.map(n).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (filtered.length === 0) return 0;
  const idx = Math.min(filtered.length - 1, Math.max(0, Math.ceil((p / 100) * filtered.length) - 1));
  return filtered[idx];
}

function addTotals(target, source) {
  for (const [key, value] of Object.entries(source)) target[key] = n(target[key]) + n(value);
}

function ratioRow(label, part, total, note = "") {
  return [label, num(part), num(total), pct(part, total), note];
}

function classifyRun(row) {
  const unique = timing(row, "unique_items");
  const changed = timing(row, "changed_items");
  const marketChanged = timing(row, "market_changed_items");
  const rawFull = timing(row, "raw_full_upsert_rows");
  const rawTouch = timing(row, "raw_touch_active_rows") + timing(row, "raw_touch_terminal_rows");
  const observations = timing(row, "observation_rows");
  const sellersSeen = timing(row, "seller_seen_rows");
  const sellersUpserted = timing(row, "seller_upsert_rows");
  const sellersSkipped = timing(row, "seller_upsert_skipped_rows");
  const sellerRefreshWindowMs = timing(row, "seller_search_refresh_window_ms");
  const existingRawRequestedPids = timing(row, "load_existing_raw_requested_pids");
  const existingRawUniquePids = timing(row, "load_existing_raw_unique_pids");
  const existingRawChunks = timing(row, "load_existing_raw_chunks");
  const existingRawReturnedRows = timing(row, "load_existing_raw_returned_rows");
  const rawWriteRows = rawFull + rawTouch;
  const sellerTotal = sellersUpserted + sellersSkipped;
  const coalesceEligible = timing(row, "raw_touch_active_seen_coalesce_eligible_rows");
  const coalesceWouldSkip = timing(row, "raw_touch_active_seen_coalesce_would_skip_rows");
  const coalesceTouchNow = timing(row, "raw_touch_active_seen_coalesce_touch_now_rows");
  const coalesceProtected = timing(row, "raw_touch_active_seen_coalesce_protected_rows");
  const coalesceWindowMs = timing(row, "raw_touch_active_seen_coalesce_window_ms");
  const coalesceNonPoolWindowMs = timing(row, "raw_touch_active_seen_coalesce_non_pool_window_ms");
  const coalescePoolProtectedRows = timing(row, "raw_touch_active_seen_coalesce_pool_protected_rows");
  const coalesceNonPoolRows = timing(row, "raw_touch_active_seen_coalesce_non_pool_rows");
  const coalesceEnabled = timing(row, "raw_touch_active_seen_coalesce_enabled");
  return {
    id: row.id,
    started_at: row.started_at,
    worker: workerName(row),
    status: row.status,
    duration_ms: n(row.duration_ms),
    search_duration_ms: n(row.stage_stats?.stageDurationsMs?.search ?? row.stage_stats?.stageDurationsMs?.deep),
    api_fetch_ms: timing(row, "api_fetch"),
    configured_delay_ms: timing(row, "configured_delay"),
    load_existing_raw_ms: timing(row, "load_existing_raw"),
    existingRawRequestedPids,
    existingRawUniquePids,
    existingRawChunks,
    existingRawReturnedRows,
    touch_raw_listings_ms: timing(row, "touch_raw_listings"),
    upsert_raw_listings_ms: timing(row, "upsert_raw_listings"),
    insert_observations_ms: timing(row, "insert_observations"),
    load_existing_sellers_ms: timing(row, "load_existing_sellers"),
    upsert_sellers_ms: timing(row, "upsert_sellers"),
    unique,
    changed,
    marketChanged,
    rawFull,
    rawTouch,
    rawTouchSeen: timing(row, "raw_touch_active_seen_rows"),
    rawTouchReset: timing(row, "raw_touch_active_reset_rows"),
    rawTouchTerminal: timing(row, "raw_touch_terminal_rows"),
    rawWriteRows,
    coalesceEligible,
    coalesceWouldSkip,
    coalesceTouchNow,
    coalesceProtected,
    coalesceWindowMs,
    coalesceNonPoolWindowMs,
    coalescePoolProtectedRows,
    coalesceNonPoolRows,
    coalesceEnabled,
    observations,
    sellersSeen,
    sellersUpserted,
    sellersSkipped,
    sellerTotal,
    sellerRefreshWindowMs,
    detailRefreshItems: timing(row, "detail_refresh_items"),
    marketInvalidations: timing(row, "market_invalidations"),
  };
}

const windowHours = intArg("window-hours", 2, 1, 720);
const runLimit = intArg("run-limit", 120, 20, 1000);
const restTimeoutMs = intArg("rest-timeout-ms", 20_000, 3_000, 60_000);
const fetchIssues = [];
const now = new Date();
const cutoff = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
const cutoffIso = cutoff.toISOString();
const reportDir = path.join(appDir, "reports");
const outPath = arg("out", path.join(reportDir, `tick-write-amplification-${dateStamp(now)}.md`));
const summaryPath = outPath.replace(/\.md$/i, ".json");
const latestMd = path.join(reportDir, "tick-write-amplification-latest.md");
const latestJson = path.join(reportDir, "tick-write-amplification-latest.json");

const runs = await fetchJson(
  `/mvp_collect_runs?select=id,status,request_path,request_meta,duration_ms,stage_stats,error_message,started_at&started_at=gte.${encodeURIComponent(cutoffIso)}&order=started_at.desc&limit=${runLimit}`,
);

const searchRuns = runs
  .filter((row) => {
    const worker = workerName(row);
    const hasSearchTiming = Object.keys(timings(row)).length > 0;
    return hasSearchTiming && (worker === "tick" || worker === "deep_crawl");
  })
  .map(classifyRun);

const successfulSearchRuns = searchRuns.filter((row) => row.status !== "failed");
const totals = {};
for (const row of successfulSearchRuns) addTotals(totals, row);

const perRunDurations = successfulSearchRuns.map((row) => row.search_duration_ms || row.duration_ms);
const dbWriteMs = n(totals.touch_raw_listings_ms) + n(totals.upsert_raw_listings_ms) + n(totals.insert_observations_ms) + n(totals.upsert_sellers_ms);
const dbReadMs = n(totals.load_existing_raw_ms) + n(totals.load_existing_sellers_ms);
const networkOrDelayMs = n(totals.api_fetch_ms) + n(totals.configured_delay_ms);
const searchMeasuredMs = dbWriteMs + dbReadMs + networkOrDelayMs;

const rawWriteRows = n(totals.rawWriteRows);
const rawFullRows = n(totals.rawFull);
const rawTouchRows = n(totals.rawTouch);
const changedItems = n(totals.changed);
const uniqueItems = n(totals.unique);
const sellerUpserted = n(totals.sellersUpserted);
const sellerSkipped = n(totals.sellersSkipped);
const sellerTotal = n(totals.sellerTotal);
const sellerRefreshWindowMs = successfulSearchRuns.reduce((max, row) => Math.max(max, n(row.sellerRefreshWindowMs)), 0);
const existingRawUniquePids = n(totals.existingRawUniquePids);
const existingRawChunks = n(totals.existingRawChunks);
const existingRawReturnedRows = n(totals.existingRawReturnedRows);
const observations = n(totals.observations);
const coalesceEligible = n(totals.coalesceEligible);
const coalesceWouldSkip = n(totals.coalesceWouldSkip);
const coalesceTouchNow = n(totals.coalesceTouchNow);
const coalesceProtected = n(totals.coalesceProtected);
const coalescePoolProtectedRows = n(totals.coalescePoolProtectedRows);
const coalesceNonPoolRows = n(totals.coalesceNonPoolRows);
const coalesceEnabledSamples = n(totals.coalesceEnabled);
const coalesceWindowMs = successfulSearchRuns.reduce((max, row) => Math.max(max, n(row.coalesceWindowMs)), 0);
const coalesceNonPoolWindowMs = successfulSearchRuns.reduce((max, row) => Math.max(max, n(row.coalesceNonPoolWindowMs)), 0);

const findings = [];
if (successfulSearchRuns.length === 0) {
  findings.push("최근 window에 search timing이 포함된 성공 tick/deep run이 없습니다.");
}
if (rawTouchRows > rawFullRows * 3 && rawTouchRows > changedItems * 3) {
  findings.push(`raw write는 full upsert보다 last_seen touch가 지배적입니다: touch ${num(rawTouchRows)} / full ${num(rawFullRows)}.`);
}
if (rawWriteRows > 0 && changedItems / rawWriteRows < 0.25) {
  findings.push(`raw write 중 실제 changed_items 비율이 낮습니다: ${pct(changedItems, rawWriteRows)}.`);
}
if (sellerTotal > 0 && sellerSkipped / sellerTotal > 0.7) {
  findings.push(`seller refresh guard가 이미 대부분을 skip합니다: skipped ${pct(sellerSkipped, sellerTotal)}.`);
}
if (networkOrDelayMs > dbWriteMs + dbReadMs) {
  findings.push(`search 시간은 DB보다 API fetch/configured delay 비중이 큽니다: ${seconds(networkOrDelayMs)} vs DB ${seconds(dbWriteMs + dbReadMs)}.`);
}
if (dbWriteMs > networkOrDelayMs) {
  findings.push(`search 시간은 DB write 비중이 큽니다: write ${seconds(dbWriteMs)} vs API/delay ${seconds(networkOrDelayMs)}.`);
}
if (coalesceEligible > 0) {
  const modeLabel = coalesceEnabledSamples > 0 ? "active" : "dry-run";
  findings.push(`raw touch coalescing ${modeLabel}: eligible ${num(coalesceEligible)}, skip ${num(coalesceWouldSkip)} (${pct(coalesceWouldSkip, coalesceEligible)}).`);
}
if (coalesceNonPoolWindowMs > coalesceWindowMs && coalesceNonPoolRows > 0) {
  findings.push(
    `pool-protected coalescing active: candidate pool rows keep ${num(coalesceWindowMs)}ms window, non-pool rows use ${num(coalesceNonPoolWindowMs)}ms window.`,
  );
}
if (fetchIssues.length > 0) {
  findings.push(`Supabase REST fetch issue ${num(fetchIssues.length)}개가 있어 report 일부가 fallback일 수 있습니다.`);
}

const lastRunsRows = successfulSearchRuns.slice(0, 12).map((row) => [
  row.started_at,
  row.worker,
  seconds(row.search_duration_ms || row.duration_ms),
  num(row.unique),
  num(row.changed),
  num(row.rawFull),
  num(row.rawTouch),
  num(row.observations),
  `${num(row.sellersUpserted)}/${num(row.sellerTotal)}`,
]);

const summary = {
  generatedAt: now.toISOString(),
  windowHours,
  cutoff: cutoffIso,
  runLimit,
  runs: {
    fetched: runs.length,
    searchRuns: searchRuns.length,
    successfulSearchRuns: successfulSearchRuns.length,
    failedSearchRuns: searchRuns.filter((row) => row.status === "failed").length,
    p50SearchDurationMs: percentile(perRunDurations, 50),
    p95SearchDurationMs: percentile(perRunDurations, 95),
  },
  totals,
  ratios: {
    changedToUnique: uniqueItems ? changedItems / uniqueItems : 0,
    rawFullToUnique: uniqueItems ? rawFullRows / uniqueItems : 0,
    rawTouchToUnique: uniqueItems ? rawTouchRows / uniqueItems : 0,
    changedToRawWrites: rawWriteRows ? changedItems / rawWriteRows : 0,
    observationsToUnique: uniqueItems ? observations / uniqueItems : 0,
    sellerUpsertToSeen: sellerTotal ? sellerUpserted / sellerTotal : 0,
    sellerSkipToSeen: sellerTotal ? sellerSkipped / sellerTotal : 0,
    dbWriteMsToMeasuredSearchMs: searchMeasuredMs ? dbWriteMs / searchMeasuredMs : 0,
    dbReadMsToMeasuredSearchMs: searchMeasuredMs ? dbReadMs / searchMeasuredMs : 0,
    networkOrDelayMsToMeasuredSearchMs: searchMeasuredMs ? networkOrDelayMs / searchMeasuredMs : 0,
  },
  timings: {
    dbWriteMs,
    dbReadMs,
    networkOrDelayMs,
    searchMeasuredMs,
  },
  findings,
  fetchIssues,
  lastRuns: successfulSearchRuns.slice(0, 20),
};

const md = `# Tick Write Amplification Report

- generated_at: ${now.toISOString()}
- window: 최근 ${windowHours}시간
- run_limit: ${runLimit}
- scope: tick/deep search stage only
- mode: read-only diagnostic

## 결론

${findings.length === 0 ? "- 아직 명확한 write amplification 후보가 보이지 않습니다." : findings.map((item) => `- ${item}`).join("\n")}

## 핵심 숫자

${table(
  ["항목", "값"],
  [
    ["fetched runs", num(runs.length)],
    ["search timing runs", `${num(successfulSearchRuns.length)} 성공 / ${num(searchRuns.length)} 전체`],
    ["search duration p50 / p95", `${seconds(percentile(perRunDurations, 50))} / ${seconds(percentile(perRunDurations, 95))}`],
    ["unique items", num(uniqueItems)],
    ["changed items", `${num(changedItems)} (${pct(changedItems, uniqueItems)} of unique)`],
    ["market changed items", `${num(totals.marketChanged)} (${pct(totals.marketChanged, uniqueItems)} of unique)`],
    ["raw full upsert rows", `${num(rawFullRows)} (${pct(rawFullRows, uniqueItems)} of unique)`],
    ["raw touch rows", `${num(rawTouchRows)} (${pct(rawTouchRows, uniqueItems)} of unique)`],
    ["observation rows", `${num(observations)} (${pct(observations, uniqueItems)} of unique)`],
    ["seller upsert / seen", `${num(sellerUpserted)} / ${num(sellerTotal)} (${pct(sellerUpserted, sellerTotal)})`],
    ["seller skipped / seen", `${num(sellerSkipped)} / ${num(sellerTotal)} (${pct(sellerSkipped, sellerTotal)})`],
    ["seller refresh window", sellerRefreshWindowMs ? `${num(sellerRefreshWindowMs)}ms` : "-"],
    ["existing raw unique / returned", `${num(existingRawUniquePids)} / ${num(existingRawReturnedRows)} (${pct(existingRawReturnedRows, existingRawUniquePids)})`],
    ["existing raw read chunks", num(existingRawChunks)],
    ["coalesce mode", coalesceEnabledSamples > 0 ? `active (${num(coalesceEnabledSamples)} samples)` : "dry-run"],
    ["coalesce protected / non-pool window", coalesceNonPoolWindowMs > 0 ? `${num(coalesceWindowMs)}ms / ${num(coalesceNonPoolWindowMs)}ms` : `${num(coalesceWindowMs)}ms / -`],
    ["coalesce skip / eligible", `${num(coalesceWouldSkip)} / ${num(coalesceEligible)} (${pct(coalesceWouldSkip, coalesceEligible)})`],
    ["coalesce touch now", num(coalesceTouchNow)],
    ["coalesce protected", num(coalesceProtected)],
    ["coalesce pool-protected rows", num(coalescePoolProtectedRows)],
    ["coalesce non-pool rows", num(coalesceNonPoolRows)],
  ],
)}

## 시간 비중

${table(
  ["bucket", "duration", "share"],
  [
    ["API fetch + configured delay", seconds(networkOrDelayMs), pct(networkOrDelayMs, searchMeasuredMs)],
    ["DB reads", seconds(dbReadMs), pct(dbReadMs, searchMeasuredMs)],
    ["DB writes", seconds(dbWriteMs), pct(dbWriteMs, searchMeasuredMs)],
    ["measured total", seconds(searchMeasuredMs), "100%"],
  ],
)}

### DB read/write 세부

${table(
  ["substage", "duration", "rows/counter"],
  [
    ["load_existing_raw", seconds(totals.load_existing_raw_ms), `${num(uniqueItems)} unique items`],
    ["upsert_raw_listings", seconds(totals.upsert_raw_listings_ms), `${num(rawFullRows)} full rows`],
    ["touch_raw_listings", seconds(totals.touch_raw_listings_ms), `${num(rawTouchRows)} touch rows`],
    ["insert_observations", seconds(totals.insert_observations_ms), `${num(observations)} observation rows`],
    ["load_existing_sellers", seconds(totals.load_existing_sellers_ms), `${num(sellerTotal)} deduped/seen sellers`],
    ["upsert_sellers", seconds(totals.upsert_sellers_ms), `${num(sellerUpserted)} refreshed sellers`],
  ],
)}

## Amplification Ratios

${table(
  ["ratio", "part", "base", "share", "해석"],
  [
    ratioRow("changed_items / unique_items", changedItems, uniqueItems, "검색 관측 중 실제 core change 비율"),
    ratioRow("raw_full_upsert / unique_items", rawFullRows, uniqueItems, "가격/제목/source_updated_at 등 payload 갱신 비율"),
    ratioRow("raw_touch / unique_items", rawTouchRows, uniqueItems, "last_seen/state touch 비율"),
    ratioRow("changed_items / raw_write_rows", changedItems, rawWriteRows, "raw write 중 실제 변경으로 볼 수 있는 비율"),
    ratioRow("observations / unique_items", observations, uniqueItems, "observation insert 밀도"),
    ratioRow("seller_upsert / seller_seen", sellerUpserted, sellerTotal, "seller guard 통과 write 비율"),
    ratioRow("seller_skip / seller_seen", sellerSkipped, sellerTotal, "seller guard skip 비율"),
    ratioRow("coalesce_skip / coalesce_eligible", coalesceWouldSkip, coalesceEligible, coalesceEnabledSamples > 0 ? "activeSeenOnly 중 실제/계획 skip 비율" : "dry-run flag가 켜진 경우 skip 가능 추정"),
  ],
)}

## 최근 search run 샘플

${lastRunsRows.length === 0
  ? "- 샘플 없음"
  : table(
    ["started_at", "worker", "duration", "unique", "changed", "raw full", "raw touch", "obs", "seller upsert/seen"],
    lastRunsRows,
  )}

${fetchIssues.length > 0
  ? `## Fetch Issues\n\n${table(["path", "error"], fetchIssues.map((issue) => [issue.path, issue.error]))}\n`
  : ""}

## 판단

1. 이 report는 production table을 변경하지 않는다.
2. \`tick query rotation\`은 관측 해상도를 낮추므로 이 report만으로 바로 적용하지 않는다.
3. 다음 implementation 후보는 기능 보존형이어야 한다.
   - seller path는 이미 skip guard가 크면 후순위.
   - raw path는 \`last_seen_at\` 관측 의미를 보존하면서 write 빈도를 낮출 수 있는지 별도 설계가 필요하다.
   - observation insert는 sold velocity/lifecycle 근거라 삭제보다 event coalescing 가능성만 검토한다.
4. 다음 단계는 이 report를 기준으로 "raw touch coalescing" 또는 "observation event coalescing" 중 하나만 feature-flag 설계한다.
`;

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, md, "utf-8");
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");
await writeFile(latestMd, md, "utf-8");
await writeFile(latestJson, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");

console.log(`report saved  -> ${outPath}`);
console.log(`summary saved -> ${summaryPath}`);
console.log(`latest saved  -> ${latestMd}`);
console.log(`runs=${runs.length} searchRuns=${successfulSearchRuns.length}/${searchRuns.length}`);
if (findings.length > 0) console.log(`top finding: ${findings[0]}`);
