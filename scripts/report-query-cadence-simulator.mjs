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

async function fetchPaged(pathname, limit, pageSize = 1000) {
  const rows = [];
  for (let start = 0; start < limit; start += pageSize) {
    const end = Math.min(limit - 1, start + pageSize - 1);
    const separator = pathname.includes("?") ? "&" : "?";
    const page = await fetchJson(`${pathname}${separator}offset=${start}&limit=${end - start + 1}`, []);
    rows.push(...page);
    if (page.length < end - start + 1) break;
  }
  return rows;
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function queryFamily(query) {
  const q = String(query ?? "").toLowerCase();
  if (q.includes("에어팟")) return "earphone";
  if (q.includes("워치")) return "smartwatch";
  if (q.includes("아이폰") || q.includes("갤럭시 s")) return "smartphone";
  if (q.includes("아이패드") || q.includes("갤럭시탭")) return "tablet";
  if (q.includes("맥북")) return "laptop";
  return "unknown";
}

function currentCadenceFor(row, readinessByCategory) {
  const readyRate = row.observed ? row.poolReady / row.observed : 0;
  const poolRate = row.observed ? row.poolAny / row.observed : 0;
  const changeRate = row.observed ? row.changed / row.observed : 0;
  const family = queryFamily(row.query);
  const readiness = readinessByCategory?.get(family) ?? null;
  // mode='gather'는 표본/파서 미숙 카테고리(internal_only/blocked) 또는 query→family 매핑 실패.
  // yield 낮아도 cadence 늦추지 않는다 — 표본을 더 모아야 readiness가 'ready'로 올라간다.
  // mode='harvest'는 readiness='ready' 카테고리만. 비용 절감 downrank 적용 대상.
  const isHarvestable = readiness?.status === "ready";

  if (row.poolReady >= 2 || readyRate >= 0.0015) {
    return { cadence: "5m", reason: "ready_pool_yield", keepFresh: true, mode: "harvest" };
  }
  if ((family === "earphone" || family === "smartwatch") && row.poolAny > 0) {
    return { cadence: "10m", reason: "ready_family_pool_presence", keepFresh: true, mode: "harvest" };
  }

  if (!isHarvestable) {
    const status = readiness?.status ?? "unknown";
    return { cadence: "5m", reason: `gather_readiness=${status}`, keepFresh: true, mode: "gather" };
  }

  if (row.poolAny > 0 || poolRate >= 0.001 || changeRate >= 0.02) {
    return {
      cadence: "30m",
      reason: row.poolAny > 0 ? "some_pool_or_candidate_signal" : "high_change_rate",
      keepFresh: false,
      mode: "harvest",
    };
  }
  return { cadence: "60m", reason: "low_yield_broad_or_internal", keepFresh: false, mode: "harvest" };
}

function relaxedGatherCadenceFor(row, readinessByCategory) {
  const readyRate = row.observed ? row.poolReady / row.observed : 0;
  const poolRate = row.observed ? row.poolAny / row.observed : 0;
  const changeRate = row.observed ? row.changed / row.observed : 0;
  const family = queryFamily(row.query);
  const readiness = readinessByCategory?.get(family) ?? null;
  const status = readiness?.status ?? "unknown";
  const isHarvestable = readiness?.status === "ready";

  if (row.poolReady >= 2 || readyRate >= 0.0015) {
    return { cadence: "5m", reason: "ready_pool_yield", keepFresh: true, mode: "harvest" };
  }
  if ((family === "earphone" || family === "smartwatch") && row.poolAny > 0) {
    return { cadence: "10m", reason: "ready_family_pool_presence", keepFresh: true, mode: "harvest" };
  }

  if (!isHarvestable) {
    if (status === "blocked") {
      return { cadence: "60m", reason: "blocked_readiness_low_priority_gather", keepFresh: false, mode: "gather" };
    }
    if (row.poolAny > 0 || row.poolReady > 0) {
      return { cadence: "10m", reason: `gather_with_pool_signal_${status}`, keepFresh: true, mode: "gather" };
    }
    if (row.detailsDone < 40 || row.observed < 120) {
      return { cadence: "5m", reason: `gather_sample_build_${status}`, keepFresh: true, mode: "gather" };
    }
    if (changeRate >= 0.08 || row.changed >= 20) {
      return { cadence: "10m", reason: `gather_high_change_${status}`, keepFresh: true, mode: "gather" };
    }
    if (changeRate >= 0.03 || row.changed >= 8) {
      return { cadence: "30m", reason: `gather_mid_change_${status}`, keepFresh: false, mode: "gather" };
    }
    return { cadence: "60m", reason: `gather_low_yield_${status}`, keepFresh: false, mode: "gather" };
  }

  if (row.poolAny > 0 || poolRate >= 0.001 || changeRate >= 0.02) {
    return {
      cadence: "30m",
      reason: row.poolAny > 0 ? "some_pool_or_candidate_signal" : "high_change_rate",
      keepFresh: false,
      mode: "harvest",
    };
  }
  return { cadence: "60m", reason: "low_yield_broad_or_internal", keepFresh: false, mode: "harvest" };
}

function costMultiplier(cadence) {
  if (cadence === "5m") return 1;
  if (cadence === "10m") return 0.5;
  if (cadence === "30m") return 1 / 6;
  if (cadence === "60m") return 1 / 12;
  return 1;
}

const windowHours = intArg("window-hours", 1, 1, 168);
const rawLimit = intArg("raw-limit", 50_000, 1_000, 100_000);
const poolLimit = intArg("pool-limit", 20_000, 1_000, 100_000);
const restTimeoutMs = intArg("rest-timeout-ms", 20_000, 3_000, 60_000);
const fetchIssues = [];
const now = new Date();
const cutoff = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
const cutoffIso = cutoff.toISOString();
const reportDir = path.join(appDir, "reports");
const outPath = arg("out", path.join(reportDir, `query-cadence-simulator-${dateStamp(now)}.md`));
const summaryPath = outPath.replace(/\.md$/i, ".json");
const latestMd = path.join(reportDir, "query-cadence-simulator-latest.md");
const latestJson = path.join(reportDir, "query-cadence-simulator-latest.json");

const [rawRows, poolRows, readinessRows] = await Promise.all([
  fetchPaged(
    `/mvp_raw_listings?select=pid,query,last_seen_at,last_changed_at,listing_state,detail_status,listing_type,sku_id,sku_name,price&last_seen_at=gte.${encodeURIComponent(cutoffIso)}&order=last_seen_at.desc`,
    rawLimit,
  ),
  fetchPaged("/mvp_candidate_pool?select=pid,status,profit_band,category,updated_at", poolLimit),
  fetchJson("/mvp_category_readiness?select=category,status,label", []),
]);

const readinessByCategory = new Map();
for (const row of readinessRows) {
  readinessByCategory.set(String(row.category), { status: row.status, label: row.label });
}

const poolByPid = new Map();
for (const row of poolRows) poolByPid.set(Number(row.pid), row);

const byQuery = new Map();
const unknownQueryKey = "(unknown)";
for (const row of rawRows) {
  const query = String(row.query || unknownQueryKey).trim() || unknownQueryKey;
  const current = byQuery.get(query) ?? {
    query,
    family: queryFamily(query),
    observed: 0,
    active: 0,
    changed: 0,
    poolAny: 0,
    poolReady: 0,
    poolReserved: 0,
    poolSpent: 0,
    detailsPending: 0,
    detailsDone: 0,
    normalType: 0,
    latestSeenAt: null,
  };
  current.observed += 1;
  if (row.listing_state === "active") current.active += 1;
  if (row.detail_status === "pending") current.detailsPending += 1;
  if (row.detail_status === "done") current.detailsDone += 1;
  if (row.listing_type === "normal") current.normalType += 1;
  if (row.last_changed_at && Date.parse(row.last_changed_at) >= Date.parse(cutoffIso)) current.changed += 1;
  if (!current.latestSeenAt || Date.parse(row.last_seen_at) > Date.parse(current.latestSeenAt)) {
    current.latestSeenAt = row.last_seen_at;
  }
  const pool = poolByPid.get(Number(row.pid));
  if (pool) {
    current.poolAny += 1;
    if (pool.status === "ready") current.poolReady += 1;
    if (pool.status === "reserved") current.poolReserved += 1;
    if (pool.status === "spent") current.poolSpent += 1;
  }
  byQuery.set(query, current);
}

function buildScenario(name, planner) {
  const queryRows = [...byQuery.values()]
    .map((row) => {
      const decision = planner(row, readinessByCategory);
      const multiplier = costMultiplier(decision.cadence);
      const readiness = readinessByCategory.get(row.family) ?? null;
      return {
        ...row,
        readyRate: row.observed ? row.poolReady / row.observed : 0,
        poolRate: row.observed ? row.poolAny / row.observed : 0,
        changeRate: row.observed ? row.changed / row.observed : 0,
        cadence: decision.cadence,
        reason: decision.reason,
        keepFresh: decision.keepFresh,
        mode: decision.mode,
        readinessStatus: readiness?.status ?? "unknown",
        estimatedObservedAfterCadence: row.observed * multiplier,
      };
    })
    .sort((a, b) => {
      const order = { "5m": 0, "10m": 1, "30m": 2, "60m": 3 };
      return order[a.cadence] - order[b.cadence] || b.poolReady - a.poolReady || b.observed - a.observed;
    });

  const totals = queryRows.reduce((acc, row) => {
    acc.observed += row.observed;
    acc.changed += row.changed;
    acc.poolAny += row.poolAny;
    acc.poolReady += row.poolReady;
    acc.estimatedObservedAfterCadence += row.estimatedObservedAfterCadence;
    acc[row.cadence] = (acc[row.cadence] ?? 0) + 1;
    acc.modes[row.mode] = (acc.modes[row.mode] ?? 0) + 1;
    return acc;
  }, { observed: 0, changed: 0, poolAny: 0, poolReady: 0, estimatedObservedAfterCadence: 0, modes: {} });

  const estimatedReduction = Math.max(0, totals.observed - totals.estimatedObservedAfterCadence);
  const topYield = [...queryRows]
  .sort((a, b) => b.poolReady - a.poolReady || b.poolAny - a.poolAny || b.changed - a.changed || b.observed - a.observed)
  .slice(0, 18);
  const lowYield = [...queryRows]
  .filter((row) => row.cadence === "60m")
  .sort((a, b) => b.observed - a.observed)
  .slice(0, 18);

  return {
    name,
    queryRows,
    totals,
    estimatedReduction,
    estimatedReductionRate: totals.observed ? estimatedReduction / totals.observed : 0,
    topYield,
    lowYield,
  };
}

const baseline = buildScenario("baseline", currentCadenceFor);
const relaxedGather = buildScenario("relaxed_gather", relaxedGatherCadenceFor);

const summary = {
  generatedAt: now.toISOString(),
  windowHours,
  cutoffIso,
  rawRows: rawRows.length,
  poolRows: poolRows.length,
  queryCount: baseline.queryRows.length,
  scenarios: {
    baseline,
    relaxedGather,
  },
  fetchIssues,
};

function scenarioSection(title, scenario) {
  return `## ${title}

- query groups: ${num(scenario.queryRows.length)}
- ready pool 기여 row: ${num(scenario.totals.poolReady)}
- any pool 기여 row: ${num(scenario.totals.poolAny)}
- changed rows: ${num(scenario.totals.changed)} (${pct(scenario.totals.changed, scenario.totals.observed)})
- cadence simulator 기준 관측량 절감 추정: ${num(scenario.estimatedReduction)} / ${num(scenario.totals.observed)} (${pct(scenario.estimatedReduction, scenario.totals.observed)})

### Cadence 분포

${table(["cadence", "query count"], [
  ["5m", num(scenario.totals["5m"] ?? 0)],
  ["10m", num(scenario.totals["10m"] ?? 0)],
  ["30m", num(scenario.totals["30m"] ?? 0)],
  ["60m", num(scenario.totals["60m"] ?? 0)],
])}

### Mode 분포

- harvest: readiness='ready' 카테고리. yield 기반 cadence 조정 대상.
- gather: internal_only/blocked/unknown. 표본 축적 목적 query.

${table(["mode", "query count"], [
  ["harvest", num(scenario.totals.modes.harvest ?? 0)],
  ["gather", num(scenario.totals.modes.gather ?? 0)],
])}

### Top Yield Queries

${table(
  ["query", "family", "cadence", "reason", "observed", "changed", "pool any", "pool ready", "ready rate"],
  scenario.topYield.map((row) => [
    row.query,
    row.family,
    row.cadence,
    row.reason,
    num(row.observed),
    `${num(row.changed)} (${pct(row.changed, row.observed)})`,
    num(row.poolAny),
    num(row.poolReady),
    pct(row.poolReady, row.observed, 2),
  ]),
)}

### Low Yield / Cadence Downrank Candidates

${table(
  ["query", "family", "suggested", "observed", "changed", "pool any", "pool ready", "reason"],
  scenario.lowYield.map((row) => [
    row.query,
    row.family,
    row.cadence,
    num(row.observed),
    `${num(row.changed)} (${pct(row.changed, row.observed)})`,
    num(row.poolAny),
    num(row.poolReady),
    row.reason,
  ]),
)}

### 전체 Query Table

${table(
  ["query", "family", "readiness", "mode", "cadence", "observed", "changed", "active", "normal", "detail pending", "pool any", "pool ready", "pool reserved", "pool spent", "reason"],
  scenario.queryRows.map((row) => [
    row.query,
    row.family,
    row.readinessStatus,
    row.mode,
    row.cadence,
    num(row.observed),
    `${num(row.changed)} (${pct(row.changed, row.observed)})`,
    num(row.active),
    num(row.normalType),
    num(row.detailsPending),
    num(row.poolAny),
    num(row.poolReady),
    num(row.poolReserved),
    num(row.poolSpent),
    row.reason,
  ]),
)}`;
}

const markdown = `# Query Cadence Simulator

- generated_at: ${summary.generatedAt}
- window: 최근 ${windowHours}시간
- mode: read-only / no runtime change
- caveat: 현재 stage log에 per-query API time은 없으므로, 최근 raw row의 \`query\`별 관측량/변경률/후보풀 기여도로 cadence를 시뮬레이션합니다.
- scenarios:
  - \`baseline\`: 현재 보수 정책. gather는 5m 유지.
  - \`relaxed_gather\`: internal_only/blocked/unknown 중 low-yield query만 단계적으로 10m/30m/60m downrank.

## 결론

- 최근 raw rows: ${num(rawRows.length)}
- baseline 절감 추정: ${num(baseline.estimatedReduction)} / ${num(baseline.totals.observed)} (${pct(baseline.estimatedReduction, baseline.totals.observed)})
- relaxed_gather 절감 추정: ${num(relaxedGather.estimatedReduction)} / ${num(relaxedGather.totals.observed)} (${pct(relaxedGather.estimatedReduction, relaxedGather.totals.observed)})
- relaxed_gather 추가 절감: ${num(relaxedGather.estimatedReduction - baseline.estimatedReduction)} row

${scenarioSection("Scenario A - Baseline", baseline)}

${scenarioSection("Scenario B - Relaxed Gather", relaxedGather)}

## 판단

1. 이 리포트는 production table을 변경하지 않는다.
2. \`baseline\`은 현재 보수 정책의 하한선이다.
3. \`relaxed_gather\`는 ready family는 그대로 유지하고, gather 쿼리 중 low-yield/internal_only/blocked 축만 완화했을 때의 추가 절감 폭을 본다.
4. 다음 runtime 변경은 이 리포트를 24시간 window로 재생성한 뒤, \`PIPELINE_SEARCH_QUERIES\`를 줄이는 방식이 아니라 query registry/cadence gate로 설계해야 한다.

${fetchIssues.length > 0 ? `## Fetch Issues\n\n${table(["path", "error"], fetchIssues.map((issue) => [issue.path, issue.error]))}\n` : ""}
`;

await mkdir(reportDir, { recursive: true });
await writeFile(outPath, markdown);
await writeFile(summaryPath, JSON.stringify(summary, null, 2));
await writeFile(latestMd, markdown);
await writeFile(latestJson, JSON.stringify(summary, null, 2));

console.log(`wrote ${outPath}`);
console.log(`baseline estimated reduction ${pct(baseline.estimatedReduction, baseline.totals.observed)} (${num(baseline.estimatedReduction)} / ${num(baseline.totals.observed)})`);
console.log(`relaxed_gather estimated reduction ${pct(relaxedGather.estimatedReduction, relaxedGather.totals.observed)} (${num(relaxedGather.estimatedReduction)} / ${num(relaxedGather.totals.observed)})`);
