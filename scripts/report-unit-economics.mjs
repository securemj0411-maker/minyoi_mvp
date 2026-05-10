import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

const QSTASH_FREE_MESSAGES_PER_DAY = 1000;
const QSTASH_PAID_USD_PER_100K_MESSAGES = 1;
const OPENAI_CLASSIFIER_INPUT_USD_PER_1M = Number(process.env.OPENAI_CLASSIFIER_INPUT_USD_PER_1M ?? 0.4);
const OPENAI_CLASSIFIER_OUTPUT_USD_PER_1M = Number(process.env.OPENAI_CLASSIFIER_OUTPUT_USD_PER_1M ?? 1.6);

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
  const res = await fetch(`${supabaseRestUrl()}${pathname}`, { headers: authHeaders() });
  if (res.status === 404) return fallback;
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${await res.text()}`);
  return res.json();
}

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyKrw(value) {
  return `${Math.round(n(value)).toLocaleString("ko-KR")}원`;
}

function usd(value, digits = 4) {
  return `$${n(value).toFixed(digits)}`;
}

function pct(part, total, digits = 1) {
  if (!total) return "0%";
  return `${((n(part) / n(total)) * 100).toFixed(digits)}%`;
}

function perDay(value, windowHours) {
  if (!windowHours) return 0;
  return n(value) * (24 / windowHours);
}

function perMonth(valuePerDay) {
  return n(valuePerDay) * 30;
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function inc(map, key, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function mapRows(map, limit = 20) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([key, count]) => [key, count.toLocaleString("ko-KR")]);
}

function workerName(pathname) {
  const value = pathname ?? "";
  if (value.includes("/detail-worker")) return "detail-worker";
  if (value.includes("/deep-crawl")) return "deep-crawl";
  if (value.includes("/market-worker")) return "market-worker";
  if (value.includes("/pool-warmer")) return "pool-warmer";
  if (value.includes("/housekeeper")) return "housekeeper";
  if (value.includes("/lifecycle-worker")) return "lifecycle-worker";
  if (value.includes("/tick")) return "tick";
  return value || "unknown";
}

function isQstashRun(row) {
  const source = String(row.trigger_source ?? "");
  const ua = String(row.request_user_agent ?? "");
  return source.includes("Upstash") || ua.includes("Upstash") || ua.includes("QStash");
}

function stage(row, name) {
  return row.stage_stats?.stages?.[name] ?? {};
}

function detailClaimCount(row) {
  const detail = stage(row, "detail");
  return Math.max(n(detail.claimed), n(detail.enriched), n(row.enriched_count));
}

function detailEnrichedCount(row) {
  const detail = stage(row, "detail");
  return Math.max(n(detail.enriched), n(row.enriched_count));
}

function sum(rows, pick) {
  return rows.reduce((total, row) => total + n(pick(row)), 0);
}

function percentile(values, p) {
  const filtered = values.map(n).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (filtered.length === 0) return 0;
  const idx = Math.min(filtered.length - 1, Math.max(0, Math.ceil((p / 100) * filtered.length) - 1));
  return filtered[idx];
}

function dateStamp(date) {
  return date.toISOString().slice(0, 10);
}

const windowHours = intArg("window-hours", 24, 1, 720);
const stableWindowHours = Math.min(windowHours, intArg("stable-window-hours", 2, 1, 24));
const now = new Date();
const cutoff = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
const cutoffIso = cutoff.toISOString();
const stableCutoff = new Date(now.getTime() - stableWindowHours * 60 * 60 * 1000);
const stableCutoffIso = stableCutoff.toISOString();
const reportDir = path.join(appDir, "reports");
const outPath = arg("out", path.join(reportDir, `unit-economics-${dateStamp(now)}.md`));
const summaryPath = outPath.replace(/\.md$/i, ".json");

const [
  runs,
  aiRows,
  packOpens,
  feedbackRows,
  poolRows,
  queueRows,
  marketQueueRows,
] = await Promise.all([
  fetchJson(
    `/mvp_collect_runs?select=id,status,trigger_source,request_path,request_user_agent,duration_ms,collected_count,title_normal_count,enriched_count,scored_count,ai_review_requested,ai_api_calls,ai_cache_hits,ai_filtered_count,upserted_count,stage_stats,error_message,started_at&started_at=gte.${encodeURIComponent(cutoffIso)}&order=started_at.desc&limit=5000`,
  ),
  fetchJson(
    `/mvp_listing_ai_classifications?select=pid,input_tokens,output_tokens,cost_usd,listing_type,confidence,classified_at&classified_at=gte.${encodeURIComponent(cutoffIso)}&limit=10000`,
  ),
  fetchJson(
    `/mvp_pack_opens?select=id,result,tokens_spent,tokens_refunded,duration_ms,attempted_pids,revealed_pids,opened_at&opened_at=gte.${encodeURIComponent(cutoffIso)}&order=opened_at.desc&limit=5000`,
  ),
  fetchJson(
    `/mvp_reveal_feedback?select=feedback_type,created_at,updated_at&updated_at=gte.${encodeURIComponent(cutoffIso)}&limit=5000`,
  ),
  fetchJson(
    "/mvp_candidate_pool?select=profit_band,status,category,confidence,expected_profit_min,expected_profit_max&limit=20000",
  ),
  fetchJson(
    "/mvp_detail_queue?select=status,attempts,created_at,updated_at&limit=20000",
  ),
  fetchJson(
    "/mvp_market_key_invalidation?select=status,event_count,priority,last_event_at&limit=20000",
  ),
]);

const succeededRuns = runs.filter((row) => row.status === "succeeded");
const failedRuns = runs.filter((row) => row.status === "failed");
const qstashRuns = runs.filter(isQstashRun);
const durations = runs.map((row) => row.duration_ms).filter((value) => value != null);
const stableRuns = runs.filter((row) => Date.parse(row.started_at) >= stableCutoff.getTime());
const stableFailedRuns = stableRuns.filter((row) => row.status === "failed");

function failureBucket(row) {
  const raw = String(row.error_message ?? "unknown").trim();
  if (raw.includes("schema cache") || raw.includes("PGRST204") || raw.includes("PGRST205")) {
    return "supabase_schema_cache";
  }
  if (raw.includes("fetch failed")) return "fetch_failed";
  if (raw.includes("timeout")) return "timeout";
  return raw.slice(0, 90) || "unknown";
}

const failureReasons = new Map();
const stableFailureReasons = new Map();
for (const row of failedRuns) inc(failureReasons, failureBucket(row));
for (const row of stableFailedRuns) inc(stableFailureReasons, failureBucket(row));

function metricsFor(rowsForWindow, hours) {
  const failed = rowsForWindow.filter((row) => row.status === "failed");
  const qstash = rowsForWindow.filter(isQstashRun);
  return {
    runs: rowsForWindow.length,
    failed: failed.length,
    failureRate: rowsForWindow.length ? failed.length / rowsForWindow.length : 0,
    qstash: qstash.length,
    qstashPerDay: perDay(qstash.length, hours),
    searchCalls: sum(rowsForWindow, (row) => stage(row, "search").searchSucceeded),
    detailClaimed: sum(rowsForWindow, detailClaimCount),
    detailEnriched: sum(rowsForWindow, detailEnrichedCount),
    scored: sum(rowsForWindow, (row) => stage(row, "score").scored || row.scored_count),
    poolUpserted: sum(rowsForWindow, (row) => stage(row, "score").poolUpserted),
    functionSeconds: sum(rowsForWindow, (row) => row.duration_ms) / 1000,
  };
}

const stableMetrics = metricsFor(stableRuns, stableWindowHours);

const workerStats = new Map();
for (const row of runs) {
  const name = workerName(row.request_path);
  const item = workerStats.get(name) ?? {
    total: 0,
    succeeded: 0,
    failed: 0,
    durationMs: 0,
    collected: 0,
    searchCalls: 0,
    queued: 0,
    detailClaimed: 0,
    detailEnriched: 0,
    scored: 0,
    poolUpserted: 0,
    aiCalls: 0,
    aiCache: 0,
    upserted: 0,
  };
  item.total += 1;
  if (row.status === "succeeded") item.succeeded += 1;
  if (row.status === "failed") item.failed += 1;
  item.durationMs += n(row.duration_ms);
  item.collected += n(row.collected_count);
  item.upserted += n(row.upserted_count);
  const search = stage(row, "search");
  const score = stage(row, "score");
  item.searchCalls += n(search.searchSucceeded);
  item.queued += n(search.queued);
  item.detailClaimed += detailClaimCount(row);
  item.detailEnriched += detailEnrichedCount(row);
  item.scored += n(score.scored) || n(row.scored_count);
  item.poolUpserted += n(score.poolUpserted);
  item.aiCalls += n(row.ai_api_calls);
  item.aiCache += n(row.ai_cache_hits);
  workerStats.set(name, item);
}

const totalSearchCalls = sum(runs, (row) => stage(row, "search").searchSucceeded);
const totalQueued = sum(runs, (row) => stage(row, "search").queued);
const totalDetailClaimed = sum(runs, detailClaimCount);
const totalDetailEnriched = sum(runs, detailEnrichedCount);
const totalDetailFailed = sum(runs, (row) => stage(row, "detail").detailFailed);
const totalScored = sum(runs, (row) => stage(row, "score").scored || row.scored_count);
const totalPoolUpserted = sum(runs, (row) => stage(row, "score").poolUpserted);
const totalFunctionSeconds = sum(runs, (row) => row.duration_ms) / 1000;
const totalAiCalls = sum(runs, (row) => row.ai_api_calls);
const totalAiCacheHits = sum(runs, (row) => row.ai_cache_hits);
const totalAiReviewRequested = sum(runs, (row) => row.ai_review_requested);
const aiInputTokens = sum(aiRows, (row) => row.input_tokens);
const aiOutputTokens = sum(aiRows, (row) => row.output_tokens);
const recordedAiCostUsd = sum(aiRows, (row) => row.cost_usd);
const estimatedAiCostUsd = (
  (aiInputTokens * OPENAI_CLASSIFIER_INPUT_USD_PER_1M) +
  (aiOutputTokens * OPENAI_CLASSIFIER_OUTPUT_USD_PER_1M)
) / 1_000_000;
const aiCostUsd = recordedAiCostUsd > 0 ? recordedAiCostUsd : estimatedAiCostUsd;
const aiCostSource = recordedAiCostUsd > 0 ? "recorded_cost_usd" : "token_estimate";

const packSuccess = packOpens.filter((row) => row.result === "success");
const packRefunded = packOpens.filter((row) => row.result === "refunded");
const packFailed = packOpens.filter((row) => row.result === "failed");
const revealedCards = sum(packOpens, (row) => Array.isArray(row.revealed_pids) ? row.revealed_pids.length : 0);
const attemptedCards = sum(packOpens, (row) => Array.isArray(row.attempted_pids) ? row.attempted_pids.length : 0);
const tokensSpent = sum(packOpens, (row) => row.tokens_spent);
const tokensRefunded = sum(packOpens, (row) => row.tokens_refunded);

const poolStatus = new Map();
const poolBand = new Map();
const poolCategory = new Map();
let readyPool = 0;
let readyProfitSum = 0;
for (const row of poolRows) {
  inc(poolStatus, row.status ?? "unknown");
  inc(poolBand, `band${row.profit_band}:${row.status}`);
  inc(poolCategory, `${row.category ?? "unknown"}:${row.status}`);
  if (row.status === "ready") {
    readyPool += 1;
    readyProfitSum += (n(row.expected_profit_min) + n(row.expected_profit_max)) / 2;
  }
}

const queueStatus = new Map();
for (const row of queueRows) inc(queueStatus, row.status ?? "unknown");
const marketQueueStatus = new Map();
let marketEvents = 0;
for (const row of marketQueueRows) {
  inc(marketQueueStatus, row.status ?? "unknown");
  marketEvents += n(row.event_count);
}

const feedbackTypes = new Map();
for (const row of feedbackRows) inc(feedbackTypes, row.feedback_type ?? "unknown");
const positiveFeedback = (feedbackTypes.get("interested") ?? 0) + (feedbackTypes.get("bought") ?? 0);
const negativeFeedback = (feedbackTypes.get("missed_sold") ?? 0) + (feedbackTypes.get("bad_pick") ?? 0);

const qstashMessagesPerDay = perDay(qstashRuns.length, windowHours);
const qstashOveragePerDay = Math.max(0, qstashMessagesPerDay - QSTASH_FREE_MESSAGES_PER_DAY);
const qstashPaidUsdPerDay = (qstashOveragePerDay / 100000) * QSTASH_PAID_USD_PER_100K_MESSAGES;
const aiCostPerDay = perDay(aiCostUsd, windowHours);
const runtimeSecondsPerDay = perDay(totalFunctionSeconds, windowHours);
const detailCallsPerDay = perDay(totalDetailClaimed, windowHours);
const searchCallsPerDay = perDay(totalSearchCalls, windowHours);

const risks = [];
if (qstashMessagesPerDay > QSTASH_FREE_MESSAGES_PER_DAY) {
  risks.push(`QStash projected ${Math.round(qstashMessagesPerDay).toLocaleString("ko-KR")}/day로 free ${QSTASH_FREE_MESSAGES_PER_DAY.toLocaleString("ko-KR")}/day 초과`);
}
if (stableMetrics.failureRate > 0.1) {
  risks.push(`최근 ${stableWindowHours}시간 cron 실패율 ${pct(stableMetrics.failed, stableMetrics.runs)}로 높음`);
} else if (failedRuns.length / Math.max(1, runs.length) > 0.1) {
  risks.push(`전체 ${windowHours}시간 실패율은 ${pct(failedRuns.length, runs.length)}지만 최근 ${stableWindowHours}시간은 ${pct(stableMetrics.failed, stableMetrics.runs)}라 과거 스키마/설정 실패 영향 가능성이 큼`);
}
if ((queueStatus.get("pending") ?? 0) > 500) {
  risks.push(`detail queue pending ${(queueStatus.get("pending") ?? 0).toLocaleString("ko-KR")}건으로 backlog 확인 필요`);
}
if (readyPool < 30) {
  risks.push(`ready pool ${readyPool.toLocaleString("ko-KR")}건으로 카드팩 풀이 얕음`);
}
if (packOpens.length > 0 && packRefunded.length / packOpens.length > 0.2) {
  risks.push(`팩 환불률 ${pct(packRefunded.length, packOpens.length)}로 높음`);
}
if (feedbackRows.length > 0 && negativeFeedback / feedbackRows.length > 0.25) {
  risks.push(`부정 피드백 ${pct(negativeFeedback, feedbackRows.length)}로 후보 품질 재점검 필요`);
}
if (recordedAiCostUsd === 0 && aiRows.length > 0) {
  risks.push("AI cost_usd가 비어 있어 토큰 기반 추정값을 사용 중");
} else if (aiRows.length === 0 && totalAiCalls > 0) {
  risks.push("AI 호출은 기록됐지만 토큰/비용 샘플이 없어 실제 AI 비용 추적 누락 가능");
}

const workerTable = table(
  ["worker", "runs", "fail", "avg sec", "search calls", "queued", "detail", "scored", "pool", "AI"],
  [...workerStats.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, row]) => [
      name,
      row.total.toLocaleString("ko-KR"),
      row.failed.toLocaleString("ko-KR"),
      (row.durationMs / Math.max(1, row.total) / 1000).toFixed(1),
      row.searchCalls.toLocaleString("ko-KR"),
      row.queued.toLocaleString("ko-KR"),
      `${row.detailEnriched.toLocaleString("ko-KR")}/${row.detailClaimed.toLocaleString("ko-KR")}`,
      row.scored.toLocaleString("ko-KR"),
      row.poolUpserted.toLocaleString("ko-KR"),
      `${row.aiCalls.toLocaleString("ko-KR")} (${row.aiCache.toLocaleString("ko-KR")} cache)`,
    ]),
);

const summary = {
  generatedAt: now.toISOString(),
  windowHours,
  cutoff: cutoffIso,
  runs: {
    total: runs.length,
    succeeded: succeededRuns.length,
    failed: failedRuns.length,
    qstash: qstashRuns.length,
    functionSeconds: totalFunctionSeconds,
    p95DurationMs: percentile(durations, 95),
    stableWindowHours,
    stable: stableMetrics,
    failureReasons: Object.fromEntries(failureReasons),
    stableFailureReasons: Object.fromEntries(stableFailureReasons),
  },
  pipeline: {
    searchCalls: totalSearchCalls,
    collected: sum(runs, (row) => row.collected_count),
    queued: totalQueued,
    detailClaimed: totalDetailClaimed,
    detailEnriched: totalDetailEnriched,
    detailFailed: totalDetailFailed,
    scored: totalScored,
    poolUpserted: totalPoolUpserted,
    aiReviewRequested: totalAiReviewRequested,
    aiApiCalls: totalAiCalls,
    aiCacheHits: totalAiCacheHits,
  },
  costs: {
    aiInputTokens,
    aiOutputTokens,
    aiCostSource,
    recordedAiCostUsd,
    estimatedAiCostUsd,
    aiCostUsd,
    aiCostPerDay,
    aiCostPerMonth: perMonth(aiCostPerDay),
    qstashMessagesPerDay,
    qstashPaidUsdPerDay,
    qstashPaidUsdPerMonth: perMonth(qstashPaidUsdPerDay),
    runtimeSecondsPerDay,
    detailCallsPerDay,
    searchCallsPerDay,
  },
  pack: {
    opens: packOpens.length,
    success: packSuccess.length,
    refunded: packRefunded.length,
    failed: packFailed.length,
    attemptedCards,
    revealedCards,
    tokensSpent,
    tokensRefunded,
  },
  feedback: {
    total: feedbackRows.length,
    positive: positiveFeedback,
    negative: negativeFeedback,
  },
  pool: {
    ready: readyPool,
    averageReadyProfit: readyPool ? Math.round(readyProfitSum / readyPool) : 0,
  },
  risks,
};

const md = `# 미뇨이 단위경제성 리포트

- 생성 시각: ${now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
- 분석 구간: 최근 ${windowHours}시간 (${cutoffIso} 이후)
- 안정 구간: 최근 ${stableWindowHours}시간 (${stableCutoffIso} 이후)
- 데이터 소스: Supabase 운영 로그, 후보팩 기록, AI 분류 비용 기록

## 한 줄 결론

${risks.length === 0
  ? "현재 관측 구간에서는 즉시 막아야 할 비용 폭발 신호는 없습니다. 다음 판단은 카드팩 성공률과 ready pool 깊이를 더 쌓아본 뒤 하면 됩니다."
  : `주의 신호 ${risks.length}개가 있습니다: ${risks[0]}.`}

## 안정 구간 판정

${table(
  ["항목", `전체 ${windowHours}h`, `최근 ${stableWindowHours}h`, "판정"],
  [
    ["cron 실패율", pct(failedRuns.length, runs.length), pct(stableMetrics.failed, stableMetrics.runs), stableMetrics.failureRate <= 0.05 ? "최근 안정" : "최근 실패 확인 필요"],
    ["QStash/day", Math.round(qstashMessagesPerDay).toLocaleString("ko-KR"), Math.round(stableMetrics.qstashPerDay).toLocaleString("ko-KR"), stableMetrics.qstashPerDay <= QSTASH_FREE_MESSAGES_PER_DAY ? "free 안쪽" : "free 초과"],
    ["detail claim/day", Math.round(detailCallsPerDay).toLocaleString("ko-KR"), Math.round(perDay(stableMetrics.detailClaimed, stableWindowHours)).toLocaleString("ko-KR"), "처리량 기준"],
    ["score/day", Math.round(perDay(totalScored, windowHours)).toLocaleString("ko-KR"), Math.round(perDay(stableMetrics.scored, stableWindowHours)).toLocaleString("ko-KR"), "pool 공급 기준"],
    ["pool upsert/day", Math.round(perDay(totalPoolUpserted, windowHours)).toLocaleString("ko-KR"), Math.round(perDay(stableMetrics.poolUpserted, stableWindowHours)).toLocaleString("ko-KR"), "후보 공급 기준"],
  ],
)}

### 실패 원인 Top

${failedRuns.length === 0
  ? "실패 로그 없음"
  : table(
      ["구간", "원인", "count"],
      [
        ...mapRows(failureReasons, 5).map(([reason, count]) => [`전체 ${windowHours}h`, reason, count]),
        ...mapRows(stableFailureReasons, 5).map(([reason, count]) => [`최근 ${stableWindowHours}h`, reason, count]),
      ],
    )}

## 운영 처리량

${table(
  ["항목", "최근 구간", "일 환산", "월 환산/참고"],
  [
    ["cron/worker 실행", runs.length.toLocaleString("ko-KR"), Math.round(perDay(runs.length, windowHours)).toLocaleString("ko-KR"), `실패율 ${pct(failedRuns.length, runs.length)}`],
    ["QStash 메시지", qstashRuns.length.toLocaleString("ko-KR"), Math.round(qstashMessagesPerDay).toLocaleString("ko-KR"), `free ${QSTASH_FREE_MESSAGES_PER_DAY.toLocaleString("ko-KR")}/day 기준`],
    ["검색 API 호출", totalSearchCalls.toLocaleString("ko-KR"), Math.round(searchCallsPerDay).toLocaleString("ko-KR"), "번개장터 rate-limit 예산"],
    ["수집된 검색 row", sum(runs, (row) => row.collected_count).toLocaleString("ko-KR"), Math.round(perDay(sum(runs, (row) => row.collected_count), windowHours)).toLocaleString("ko-KR"), "중복 포함 observation"],
    ["detail claim", totalDetailClaimed.toLocaleString("ko-KR"), Math.round(detailCallsPerDay).toLocaleString("ko-KR"), `성공 ${totalDetailEnriched.toLocaleString("ko-KR")} / 실패 ${totalDetailFailed.toLocaleString("ko-KR")}`],
    ["score 계산", totalScored.toLocaleString("ko-KR"), Math.round(perDay(totalScored, windowHours)).toLocaleString("ko-KR"), `pool upsert ${totalPoolUpserted.toLocaleString("ko-KR")}`],
    ["함수 실행 시간", `${totalFunctionSeconds.toFixed(1)}초`, `${runtimeSecondsPerDay.toFixed(1)}초/day`, `p95 ${(percentile(durations, 95) / 1000).toFixed(1)}초`],
  ],
)}

## Worker별 병목

${workerTable}

## 비용 모델

${table(
  ["비용 항목", "최근 구간", "일 환산", "월 환산", "해석"],
  [
    ["OpenAI 분류 비용", usd(aiCostUsd, 6), usd(aiCostPerDay, 6), usd(perMonth(aiCostPerDay), 4), `${aiCostSource === "recorded_cost_usd" ? "DB 기록값" : `토큰 추정값 (input $${OPENAI_CLASSIFIER_INPUT_USD_PER_1M}/1M, output $${OPENAI_CLASSIFIER_OUTPUT_USD_PER_1M}/1M)`}; ${aiRows.length.toLocaleString("ko-KR")}개 row, ${aiInputTokens.toLocaleString("ko-KR")} input / ${aiOutputTokens.toLocaleString("ko-KR")} output tokens`],
    ["QStash 초과 비용 추정", usd(qstashPaidUsdPerDay * (windowHours / 24), 6), usd(qstashPaidUsdPerDay, 6), usd(perMonth(qstashPaidUsdPerDay), 4), `free ${QSTASH_FREE_MESSAGES_PER_DAY.toLocaleString("ko-KR")}/day 초과분만 $${QSTASH_PAID_USD_PER_100K_MESSAGES}/100k 가정`],
    ["Vercel 함수 비용", "금액 미산정", `${runtimeSecondsPerDay.toFixed(1)}초/day`, `${perMonth(runtimeSecondsPerDay).toFixed(1)}초/month`, "플랜/메모리별 과금이라 시간 예산으로 추적"],
    ["Supabase 비용", "금액 미산정", `${Math.round(detailCallsPerDay + searchCallsPerDay).toLocaleString("ko-KR")} 주요 API/day`, "DB row/read/write 별도 관찰", "현재는 저장소/쿼리 병목 지표로 관리"],
  ],
)}

비용 가정:
- OpenAI 분류 모델 기본 단가: input $${OPENAI_CLASSIFIER_INPUT_USD_PER_1M}/1M tokens, output $${OPENAI_CLASSIFIER_OUTPUT_USD_PER_1M}/1M tokens. 실제 운영 단가는 \`OPENAI_CLASSIFIER_INPUT_USD_PER_1M\`, \`OPENAI_CLASSIFIER_OUTPUT_USD_PER_1M\` 환경변수로 덮어쓸 수 있습니다.
- QStash 기본 가정: free ${QSTASH_FREE_MESSAGES_PER_DAY.toLocaleString("ko-KR")}/day, 초과 $${QSTASH_PAID_USD_PER_100K_MESSAGES}/100k messages.
- Vercel/Supabase는 플랜별 과금 구조가 달라 지금은 금액보다 runtime seconds, API/detail calls, DB queue depth를 추적합니다.

## 카드팩 지표

${table(
  ["항목", "값"],
  [
    ["팩 오픈", packOpens.length.toLocaleString("ko-KR")],
    ["성공 / 환불 / 실패", `${packSuccess.length.toLocaleString("ko-KR")} / ${packRefunded.length.toLocaleString("ko-KR")} / ${packFailed.length.toLocaleString("ko-KR")}`],
    ["성공률", pct(packSuccess.length, packOpens.length)],
    ["시도 카드 / 공개 카드", `${attemptedCards.toLocaleString("ko-KR")} / ${revealedCards.toLocaleString("ko-KR")}`],
    ["토큰 사용 / 환불 / 순사용", `${tokensSpent.toLocaleString("ko-KR")} / ${tokensRefunded.toLocaleString("ko-KR")} / ${(tokensSpent - tokensRefunded).toLocaleString("ko-KR")}`],
    ["팩당 평균 OpenAI 비용", packOpens.length ? usd(aiCostUsd / packOpens.length, 6) : "데이터 없음"],
    ["팩당 평균 함수 시간", packOpens.length ? `${(totalFunctionSeconds / packOpens.length).toFixed(1)}초` : "데이터 없음"],
  ],
)}

## 후보 풀 / 큐 상태

${table(
  ["항목", "값"],
  [
    ["ready pool", `${readyPool.toLocaleString("ko-KR")}건`],
    ["ready 평균 예상 순익", moneyKrw(summary.pool.averageReadyProfit)],
    ["detail queue", mapRows(queueStatus, 8).map((row) => `${row[0]} ${row[1]}`).join(", ") || "없음"],
    ["market key queue", mapRows(marketQueueStatus, 8).map((row) => `${row[0]} ${row[1]}`).join(", ") || "없음"],
    ["market invalidation event", marketEvents.toLocaleString("ko-KR")],
  ],
)}

### Pool by Band

${table(["band:status", "count"], mapRows(poolBand, 20))}

### Pool by Category

${table(["category:status", "count"], mapRows(poolCategory, 20))}

## 사용자 피드백

${feedbackRows.length === 0
  ? "아직 reveal 피드백 표본이 없습니다. 카드팩 UX 검증 후 이 섹션이 핵심 품질 지표가 됩니다."
  : table(
      ["feedback", "count"],
      mapRows(feedbackTypes, 10),
    )}

## 리스크 플래그

${risks.length === 0 ? "- 없음" : risks.map((item) => `- ${item}`).join("\n")}

## 다음 액션

1. QStash 1~2시간 누적 후 이 리포트를 다시 실행해서 QStash/day, detail/day, pool ready 증가율을 비교합니다.
2. ready pool이 얕으면 수집량을 늘리는 게 아니라 comparable_key 시세 품질과 카테고리 readiness를 먼저 봅니다.
3. 팩 오픈 표본이 쌓이면 토큰 가격은 "팩당 실제 비용 + 환불률 + 부정 피드백률" 기준으로 재산정합니다.
`;

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, md, "utf-8");
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8");

console.log(`report saved  -> ${outPath}`);
console.log(`summary saved -> ${summaryPath}`);
console.log(`runs=${runs.length} qstash/day=${Math.round(qstashMessagesPerDay)} aiCost/day=${usd(aiCostPerDay, 6)} readyPool=${readyPool}`);
if (risks.length > 0) console.log(`risks=${risks.length}: ${risks[0]}`);
