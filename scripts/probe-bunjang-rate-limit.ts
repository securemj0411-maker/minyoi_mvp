// 2026-05-16: Bunjang detail API rate limit 실측.
// concurrency 단계별로 increase하면서 429/error 비율 측정.
// 결과 보고 lifecycle worker batch/concurrency 안전 한도 결정.
//
// 실행: npx tsx scripts/probe-bunjang-rate-limit.ts
//
// Phase 별 cool down 60초 박음 — 이전 phase에서 throttle 걸렸으면 회복 시간.
// 429 또는 error rate 10% 넘으면 자동 stop (서버 보호).

import fs from "node:fs";

// .env.local 직접 parse (dotenv 미설치 환경)
try {
  const env = fs.readFileSync(".env.local", "utf-8");
  for (const line of env.split("\n")) {
    const trim = line.trim();
    if (!trim || trim.startsWith("#")) continue;
    const eq = trim.indexOf("=");
    if (eq === -1) continue;
    const key = trim.slice(0, eq).trim();
    let value = trim.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // .env.local 없어도 시스템 env로 fall back
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BUNJANG_API = "https://api.bunjang.co.kr";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
  Origin: "https://m.bunjang.co.kr",
  Referer: "https://m.bunjang.co.kr/",
};

type FetchResult = {
  pid: string;
  status: number;
  ms: number;
  ok: boolean;
  retryAfter: string | null;
  errorName: string | null;
};

async function fetchDetailWithStats(pid: string): Promise<FetchResult> {
  const start = Date.now();
  const url = `${BUNJANG_API}/api/pms/v1/products/${pid}/detail/web`;
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8_000),
    });
    return {
      pid,
      status: res.status,
      ms: Date.now() - start,
      ok: res.ok,
      retryAfter: res.headers.get("retry-after"),
      errorName: null,
    };
  } catch (err) {
    return {
      pid,
      status: 0,
      ms: Date.now() - start,
      ok: false,
      retryAfter: null,
      errorName: err instanceof Error ? err.name : String(err),
    };
  }
}

async function loadActivePids(limit: number): Promise<string[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE env 없음. .env.local 확인.");
  }
  const url = `${SUPABASE_URL}/rest/v1/mvp_raw_listings?select=pid&listing_state=eq.active&order=last_seen_at.desc&limit=${limit}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
  const rows = (await res.json()) as Array<{ pid: number | string }>;
  return rows.map((r) => String(r.pid));
}

async function runWave(pids: string[], concurrency: number): Promise<FetchResult[]> {
  const results: FetchResult[] = [];
  for (let i = 0; i < pids.length; i += concurrency) {
    const wave = pids.slice(i, i + concurrency);
    const r = await Promise.all(wave.map(fetchDetailWithStats));
    results.push(...r);
  }
  return results;
}

type PhaseSummary = {
  label: string;
  concurrency: number;
  totalCalls: number;
  elapsedMs: number;
  throughputRps: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  statusDistribution: Record<string, number>;
  errorCount: number;
  errorRate: number;
  rateLimitCount: number;
  rateLimitRate: number;
  fivexxCount: number;
  fivexxRate: number;
  retryAfters: string[];
};

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function summarize(label: string, concurrency: number, results: FetchResult[], elapsedMs: number): PhaseSummary {
  const statusGroups: Record<string, number> = {};
  const latencies: number[] = [];
  let errorCount = 0;
  let rateLimitCount = 0;
  let fivexxCount = 0;
  const retryAfters: string[] = [];

  for (const r of results) {
    const key = String(r.status);
    statusGroups[key] = (statusGroups[key] ?? 0) + 1;
    latencies.push(r.ms);
    if (!r.ok) errorCount += 1;
    if (r.status === 429) {
      rateLimitCount += 1;
      if (r.retryAfter) retryAfters.push(r.retryAfter);
    }
    if (r.status >= 500 && r.status < 600) fivexxCount += 1;
  }

  const summary: PhaseSummary = {
    label,
    concurrency,
    totalCalls: results.length,
    elapsedMs,
    throughputRps: Number((results.length / (elapsedMs / 1000)).toFixed(2)),
    avgLatencyMs: Math.round(latencies.reduce((s, v) => s + v, 0) / Math.max(1, latencies.length)),
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    p99LatencyMs: percentile(latencies, 99),
    statusDistribution: statusGroups,
    errorCount,
    errorRate: Number(((errorCount / results.length) * 100).toFixed(1)),
    rateLimitCount,
    rateLimitRate: Number(((rateLimitCount / results.length) * 100).toFixed(1)),
    fivexxCount,
    fivexxRate: Number(((fivexxCount / results.length) * 100).toFixed(1)),
    retryAfters,
  };

  console.log(`\n=== ${label} ===`);
  console.log(`Total: ${summary.totalCalls} / Elapsed: ${(elapsedMs / 1000).toFixed(1)}s / Throughput: ${summary.throughputRps} req/s`);
  console.log(`Latency — avg: ${summary.avgLatencyMs}ms / P50: ${summary.p50LatencyMs}ms / P95: ${summary.p95LatencyMs}ms / P99: ${summary.p99LatencyMs}ms`);
  console.log(`Status distribution:`, summary.statusDistribution);
  console.log(`Error rate: ${summary.errorRate}% (${summary.errorCount}/${summary.totalCalls})`);
  console.log(`Rate limited (429): ${summary.rateLimitRate}% (${summary.rateLimitCount}/${summary.totalCalls})`);
  console.log(`5xx rate: ${summary.fivexxRate}% (${summary.fivexxCount}/${summary.totalCalls})`);
  if (retryAfters.length > 0) {
    console.log(`Retry-After headers received:`, retryAfters.slice(0, 5));
  }

  return summary;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`Started: ${startedAt}`);
  console.log("Loading 100 active pids from DB...");
  const pids = await loadActivePids(100);
  console.log(`Loaded ${pids.length} pids.`);

  if (pids.length < 50) {
    console.error("Active pid 부족. 50건 이상 필요.");
    process.exit(1);
  }

  // Phase 정의: concurrency 단계별. 각 phase마다 같은 100건 호출.
  const phases = [
    { name: "Phase 1: concurrency 1 (baseline)", concurrency: 1, cooldownAfter: 30 },
    { name: "Phase 2: concurrency 3", concurrency: 3, cooldownAfter: 30 },
    { name: "Phase 3: concurrency 5", concurrency: 5, cooldownAfter: 30 },
    { name: "Phase 4: concurrency 10", concurrency: 10, cooldownAfter: 60 },
    { name: "Phase 5: concurrency 20", concurrency: 20, cooldownAfter: 60 },
    { name: "Phase 6: concurrency 30 (aggressive)", concurrency: 30, cooldownAfter: 0 },
  ];

  const phaseSummaries: PhaseSummary[] = [];
  let stoppedAt: string | null = null;
  let stopReason: string | null = null;

  for (const phase of phases) {
    console.log(`\n>>> Starting ${phase.name}`);
    const t0 = Date.now();
    const results = await runWave(pids, phase.concurrency);
    const elapsed = Date.now() - t0;
    const summary = summarize(phase.name, phase.concurrency, results, elapsed);
    phaseSummaries.push(summary);

    // 안전 stop 조건
    if (summary.rateLimitRate >= 10) {
      stopReason = `429 rate ${summary.rateLimitRate}% ≥ 10%`;
      stoppedAt = phase.name;
      console.log(`\n!!! STOP — ${stopReason}. 이전 phase가 안전 한도.`);
      break;
    }
    if (summary.errorRate >= 30) {
      stopReason = `error rate ${summary.errorRate}% ≥ 30%`;
      stoppedAt = phase.name;
      console.log(`\n!!! STOP — ${stopReason}. abnormal.`);
      break;
    }
    if (summary.fivexxRate >= 5) {
      stopReason = `5xx rate ${summary.fivexxRate}% ≥ 5%`;
      stoppedAt = phase.name;
      console.log(`\n!!! STOP — ${stopReason}. Bunjang server 부담.`);
      break;
    }
    const longRetryAfter = summary.retryAfters.some((v) => Number(v) >= 60);
    if (longRetryAfter) {
      stopReason = `Retry-After ≥ 60s 받음`;
      stoppedAt = phase.name;
      console.log(`\n!!! STOP — ${stopReason}. 강한 throttle.`);
      break;
    }

    if (phase.cooldownAfter > 0) {
      console.log(`Cool down ${phase.cooldownAfter}s before next phase...`);
      await sleep(phase.cooldownAfter * 1000);
    }
  }

  const finishedAt = new Date().toISOString();

  // 결과 JSON 저장
  const output = {
    startedAt,
    finishedAt,
    stoppedAt,
    stopReason,
    completedAllPhases: stoppedAt === null,
    phases: phaseSummaries,
  };
  const fs = await import("node:fs");
  const outPath = "scripts/probe-bunjang-rate-limit-results.json";
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\n\n결과 저장: ${outPath}`);

  // 권장 결론
  console.log("\n\n=== 권장 결론 ===");
  if (output.completedAllPhases) {
    console.log("✅ 시나리오 A: 모든 phase에서 429 < 10%. 매우 lenient.");
    console.log("   → batch 400 + concurrency 10 즉시 적용 가능 (throughput 5배).");
  } else if (stoppedAt?.includes("Phase 5") || stoppedAt?.includes("Phase 6")) {
    console.log("✅ 시나리오 B: concurrency 20+ 에서 한도 도달.");
    console.log("   → batch 200 + concurrency 5 안전 (throughput 2.5배).");
  } else if (stoppedAt?.includes("Phase 3") || stoppedAt?.includes("Phase 4")) {
    console.log("⚠️  시나리오 C: 중간 한도 (concurrency 10).");
    console.log("   → batch 150 + concurrency 3 보수적 적용 (throughput 1.5배).");
  } else {
    console.log("🚨 시나리오 D: 낮은 한도 (Phase 2 이전).");
    console.log("   → 현재 batch 80 유지 + cron 7→5분만 변경 (throughput +40%).");
  }
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
