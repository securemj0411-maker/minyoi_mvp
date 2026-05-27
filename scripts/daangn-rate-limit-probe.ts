// Wave 775 (2026-05-27): Daangn category-firehose rate-limit local probe.
//
// 목적: production deploy 전 로컬에서 fetch 수 × 카테고리 × region 다양한 조합으로
//       당근 rate-limit / IP 차단 임계치 검증.
//
// 단계별 ramp-up:
//   Phase 1: 10 region × 8 카테고리 = 80 fetch parallel
//   Phase 2: 30 region × 8 = 240 fetch parallel
//   Phase 3: 100 region × 8 = 800 fetch parallel
//   Phase 4: 267 region × 8 = 2136 fetch parallel (사용자 진짜 target)
//
// 측정: 응답 상태, 응답 시간, blockedSignal (403/429/captcha/empty).
// 비파괴: DB write 안 함, fetch만 수행.
//
// 실행: npx tsx scripts/daangn-rate-limit-probe.ts --phase=1

import { DEFAULT_DAANGN_REGION_SEEDS, buildDaangnSearchUrl, fetchDaangnText } from "../src/lib/daangn";

// 사용자 mapping (Wave 775 — script self-contained 위해 inline 정의).
const DAANGN_TARGET_CATEGORIES = [
  { id: 1, name: "디지털기기" },
  { id: 2, name: "취미/게임/음반" },
  { id: 3, name: "스포츠/레저" },
  { id: 5, name: "여성의류" },
  { id: 6, name: "뷰티/미용" },
  { id: 14, name: "남성패션/잡화" },
  { id: 31, name: "여성잡화" },
  { id: 172, name: "생활가전" },
];

const PHASES = {
  1: { regions: 10, label: "Phase 1 — 10 region × 8 cat = 80 fetch", firehoseOnly: false },
  2: { regions: 30, label: "Phase 2 — 30 region × 8 cat = 240 fetch", firehoseOnly: false },
  3: { regions: 100, label: "Phase 3 — 100 region × 8 cat = 800 fetch", firehoseOnly: false },
  4: { regions: 267, label: "Phase 4 — 267 region × 8 cat = 2136 fetch (TARGET)", firehoseOnly: false },
  5: { regions: 267, label: "Phase 5 — 267 region × 1 firehose = 267 fetch (전국 5분 신선도 TARGET)", firehoseOnly: true },
} as const;

type ProbeResult = {
  regionId: string;
  regionName: string;
  categoryId: number;
  categoryName: string;
  ok: boolean;
  status: number | null;
  durationMs: number;
  contentLength: number | null;
  blocked: boolean;
  blockReason: string | null;
  error: string | null;
};

const BLOCK_SIGNALS = [
  { pattern: /access denied/i, reason: "access_denied" },
  { pattern: /forbidden/i, reason: "forbidden" },
  { pattern: /captcha/i, reason: "captcha" },
  { pattern: /rate.limit/i, reason: "rate_limit" },
  { pattern: /too many request/i, reason: "too_many_requests" },
  { pattern: /<title>403/i, reason: "html_403" },
  { pattern: /<title>429/i, reason: "html_429" },
];

async function probeOne(regionId: string, regionName: string, categoryId: number, categoryName: string): Promise<ProbeResult> {
  const start = Date.now();
  const url = buildDaangnSearchUrl({ regionId, categoryId, search: "" });
  try {
    const result = await fetchDaangnText(url, 10_000);
    const durationMs = Date.now() - start;
    const body = result.body || "";
    const contentLength = body.length;
    let blocked = !result.ok;
    let blockReason: string | null = blocked ? `http_${result.status}` : null;
    if (!blocked && contentLength < 1000) {
      blocked = true;
      blockReason = "empty_or_tiny_response";
    }
    if (!blocked) {
      for (const sig of BLOCK_SIGNALS) {
        if (sig.pattern.test(body)) {
          blocked = true;
          blockReason = sig.reason;
          break;
        }
      }
    }
    if (result.blockSignal && result.blockSignal.blocked) {
      blocked = true;
      blockReason = `daangn_${result.blockSignal.reason || "blocked"}`;
    }
    return {
      regionId, regionName, categoryId, categoryName,
      ok: result.ok, status: result.status, durationMs, contentLength,
      blocked, blockReason, error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      regionId, regionName, categoryId, categoryName,
      ok: false, status: null, durationMs: Date.now() - start, contentLength: null,
      blocked: true, blockReason: "fetch_error", error: message,
    };
  }
}

async function runPhase(phaseNum: 1 | 2 | 3 | 4) {
  const phase = PHASES[phaseNum];
  if (!phase) {
    console.error(`Unknown phase: ${phaseNum}`);
    process.exit(1);
  }

  const regions = DEFAULT_DAANGN_REGION_SEEDS.slice(0, phase.regions);
  // Phase 5: firehose mode (no category filter, sentinel id=0).
  const categories = phase.firehoseOnly
    ? [{ id: 0, name: "전체(firehose)" }]
    : DAANGN_TARGET_CATEGORIES;
  const totalFetch = regions.length * categories.length;

  console.log(`\n=== ${phase.label} ===`);
  console.log(`regions=${regions.length} categories=${categories.length} total=${totalFetch}`);
  console.log(`first region: ${regions[0]?.name}, last region: ${regions[regions.length - 1]?.name}`);
  console.log(`Starting parallel fetch...\n`);

  const start = Date.now();
  const tasks: Promise<ProbeResult>[] = [];
  for (const region of regions) {
    for (const cat of categories) {
      tasks.push(probeOne(region.id, region.name, cat.id, cat.name));
    }
  }
  const results = await Promise.all(tasks);
  const totalDuration = Date.now() - start;

  const ok = results.filter((r) => r.ok && !r.blocked).length;
  const blocked = results.filter((r) => r.blocked).length;
  const errors = results.filter((r) => !r.ok).length;
  const avgMs = Math.round(results.reduce((sum, r) => sum + r.durationMs, 0) / results.length);
  const maxMs = Math.max(...results.map((r) => r.durationMs));

  console.log(`[summary] ${totalDuration}ms total | parallel ${totalFetch} fetches`);
  console.log(`  OK: ${ok}/${totalFetch} (${Math.round(ok / totalFetch * 100)}%)`);
  console.log(`  BLOCKED: ${blocked}/${totalFetch} (${Math.round(blocked / totalFetch * 100)}%)`);
  console.log(`  ERROR: ${errors}/${totalFetch}`);
  console.log(`  avg ${avgMs}ms / max ${maxMs}ms per fetch`);

  if (blocked > 0) {
    console.log(`\n⚠️  BLOCK SIGNALS DETECTED:`);
    const blockReasons = new Map<string, number>();
    for (const r of results.filter((x) => x.blocked)) {
      blockReasons.set(r.blockReason || "unknown", (blockReasons.get(r.blockReason || "unknown") || 0) + 1);
    }
    for (const [reason, count] of Array.from(blockReasons)) {
      console.log(`  - ${reason}: ${count}`);
    }
    console.log(`\n❌ STOP — phase ${phaseNum} 차단 임계치 검출. 이전 단계가 안전 max.`);
    process.exit(2);
  } else {
    console.log(`\n✅ Phase ${phaseNum} safe — next phase 진행 가능.`);
  }
}

const arg = process.argv.find((a) => a.startsWith("--phase="));
const phaseNum = arg ? Number(arg.split("=")[1]) : 1;
if (![1, 2, 3, 4, 5].includes(phaseNum)) {
  console.error("Usage: npx tsx scripts/daangn-rate-limit-probe.ts --phase={1|2|3|4|5}");
  process.exit(1);
}

runPhase(phaseNum as 1 | 2 | 3 | 4 | 5).catch((err) => {
  console.error(err);
  process.exit(1);
});
