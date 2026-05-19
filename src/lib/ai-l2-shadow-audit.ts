// Wave 238 (2026-05-19): AI L2 shadow audit — Option A 본체.
//
// 배경 (baseline 측정 2026-05-19):
//   - mvp_candidate_pool ready 매물 중 8.9% 만 AI L2 본 (mvp_listing_ai_classifications join).
//   - 91.1% catalog regex 가 "확신" 분류한 매물 → AI 우회 → fashion mismatch 의 근본 source.
//   - fashion 3 카테고리 (clothing/shoe/bag) 는 8.8% 만 AI 봄.
//
// 사용자 결정 (Option A + 학습 loop):
//   - ready promotion gate 통과 매물 중 AI 안 본 매물 강제 호출 (shadow audit)
//   - AI verdict reject/hold → learning queue 적재 (regex 후보 박음)
//   - Phase 1 = shadow only (status='ready' 유지, ai_audit_status 컬럼만 박음)
//   - Phase 2 별도 wave 에서 실제 차단 활성화
//
// 비용 cap (사용자 명시):
//   - AI_L2_DAILY_BUDGET_USD env ($10/일 default, 초과 시 disable)
//   - cache hit rate 측정 (content_hash 기준 — classifyWithCache 가 이미 처리)
//   - 비용 초과 → 자동 disable + reportCriticalIncident telegram 알림
//
// 정책 (사용자 명시):
//   - regex patch 금지 — AI 가 catch. 기존 regex 는 fallback 만.
//   - decision log 필수 (memory feedback_decision_log_required)
//   - 비파괴 — Phase 1 shadow only

import { classifyWithCache, aiSecondOpinionDecision, aiHasHardRisk, type PipelineRow } from "@/lib/pipeline";
import { enqueueLearningSignal } from "@/lib/ai-l2-learning-queue";
import { reportCriticalIncident } from "@/lib/operational-notifier";

const SUPABASE_URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY_ENV = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function supabaseRestBase(): string {
  return SUPABASE_URL_ENV.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

function supabaseHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_KEY_ENV,
    authorization: `Bearer ${SUPABASE_KEY_ENV}`,
    "content-type": "application/json",
  };
}

// ─── Configuration ─────────────────────────────────────────────────────────

// Daily budget cap (USD). 초과 시 자동 disable + telegram alert.
// default $10/일 (사용자 명시).
function getDailyBudgetUsd(): number {
  const raw = process.env.AI_L2_DAILY_BUDGET_USD;
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? v : 10;
}

// Shadow audit enabled — default true (Phase 1). disable 가능 (env=0).
function isShadowAuditEnabled(): boolean {
  const raw = process.env.AI_L2_SHADOW_AUDIT_ENABLED;
  return raw === undefined || raw === "1" || raw?.toLowerCase() === "true";
}

// Per-tick cap — 한 번 tick 안에서 audit 할 최대 매물 수. 기본 50.
// 너무 많으면 tick latency 폭발. 점진적 ramp.
function getPerTickCap(): number {
  const raw = process.env.AI_L2_SHADOW_AUDIT_PER_TICK_CAP;
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? v : 50;
}

// 동시성 — AI 호출 parallel 수. 기본 3 (rate limit 안전).
function getConcurrency(): number {
  const raw = process.env.AI_L2_SHADOW_AUDIT_CONCURRENCY;
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? v : 3;
}

// ─── Budget guard ─────────────────────────────────────────────────────────

let _budgetGuardCache: { day: string; spentUsd: number; checkedAt: number } | null = null;
const BUDGET_GUARD_TTL_MS = 60_000; // 1 min — tick 단위 fresh enough.

/**
 * 오늘 (UTC date) 누적 AI L2 비용 fetch. cache 1 분.
 * mvp_listing_ai_classifications.cost_usd 합산.
 */
async function fetchTodayAiL2CostUsd(): Promise<number> {
  if (!SUPABASE_URL_ENV || !SUPABASE_KEY_ENV) return 0;
  const today = new Date().toISOString().slice(0, 10);
  if (_budgetGuardCache && _budgetGuardCache.day === today
    && Date.now() - _budgetGuardCache.checkedAt < BUDGET_GUARD_TTL_MS) {
    return _budgetGuardCache.spentUsd;
  }
  try {
    const url = `${supabaseRestBase()}/rest/v1/mvp_listing_ai_classifications?select=cost_usd&classified_at=gte.${today}T00:00:00.000Z`;
    const res = await fetch(url, { headers: supabaseHeaders() });
    if (!res.ok) return _budgetGuardCache?.spentUsd ?? 0;
    const rows = await res.json() as Array<{ cost_usd: number | null }>;
    const spent = rows.reduce((sum, r) => sum + (Number(r.cost_usd) || 0), 0);
    _budgetGuardCache = { day: today, spentUsd: spent, checkedAt: Date.now() };
    return spent;
  } catch {
    return _budgetGuardCache?.spentUsd ?? 0;
  }
}

let _budgetAlertSent: { day: string; sent: boolean } = { day: "", sent: false };

/**
 * Budget cap 초과 시 telegram alert (per-day idempotent).
 */
async function alertBudgetExceeded(spentUsd: number, budgetUsd: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  if (_budgetAlertSent.day === today && _budgetAlertSent.sent) return;
  _budgetAlertSent = { day: today, sent: true };
  try {
    await reportCriticalIncident({
      source: "ai_l2_shadow_audit",
      summary: `Wave 238 AI L2 daily budget exceeded — shadow audit auto-disabled`,
      context: {
        spent_usd: spentUsd.toFixed(4),
        budget_usd: budgetUsd.toFixed(2),
        day: today,
        note: "Set AI_L2_SHADOW_AUDIT_ENABLED=0 to silence further alerts. Review mvp_listing_ai_classifications usage.",
      },
    });
  } catch (err) {
    console.warn("budget alert send failed (non-fatal)", err);
  }
}

// ─── Pool entry filter ─────────────────────────────────────────────────────

export type PoolEntryWithRowMeta = {
  pid: number;
  /** parser category (smartphone/clothing/shoe/bag etc.). */
  category: string | null;
  /** content hash (NULL = AI 안 본). */
  aiCacheSeen: boolean;
};

/**
 * pool entries 중 AI 안 본 매물 식별. mvp_listing_ai_classifications join.
 * 이 함수는 audit 대상 결정만 — 실제 AI 호출은 별도 step.
 */
export async function findUnauditedPoolEntries(
  poolEntries: Array<{ pid: number; category?: string | null }>,
): Promise<Set<number>> {
  if (poolEntries.length === 0) return new Set();
  if (!SUPABASE_URL_ENV || !SUPABASE_KEY_ENV) return new Set();
  const pids = poolEntries.map((e) => Number(e.pid)).filter(Number.isFinite);
  if (pids.length === 0) return new Set();

  try {
    // chunk pid list (URL length cap)
    const chunkSize = 200;
    const seen = new Set<number>();
    for (let i = 0; i < pids.length; i += chunkSize) {
      const chunk = pids.slice(i, i + chunkSize);
      const pidList = chunk.map((p) => String(p)).join(",");
      const url = `${supabaseRestBase()}/rest/v1/mvp_listing_ai_classifications?select=pid&pid=in.(${pidList})`;
      const res = await fetch(url, { headers: supabaseHeaders() });
      if (!res.ok) continue;
      const rows = await res.json() as Array<{ pid: number }>;
      for (const r of rows) seen.add(Number(r.pid));
    }
    const unaudited = new Set<number>();
    for (const p of pids) {
      if (!seen.has(p)) unaudited.add(p);
    }
    return unaudited;
  } catch (err) {
    console.warn("findUnauditedPoolEntries failed (non-fatal)", err);
    return new Set();
  }
}

// ─── Shadow audit core ─────────────────────────────────────────────────────

export type ShadowAuditStats = {
  enabled: boolean;
  budgetGuardOk: boolean;
  spentUsdToday: number;
  budgetUsd: number;
  candidates: number; // ready pool 매물 중 AI 안 본 매물 수
  audited: number;    // 실제 AI 호출 한 매물 수
  passCount: number;
  holdCount: number;
  rejectCount: number;
  skippedCap: number;
  skippedUnavailable: number;
  learningEnqueued: number;
  durationMs: number;
};

export type ShadowAuditInput = {
  /** AI L2 통과한 (or 통과 후) PipelineRow 들 — applyAiReview 결과 rows. */
  rows: PipelineRow[];
  /** buildCandidatePoolRows 가 만든 ready entries (pid 만 필요). */
  poolEntries: Array<{ pid: number; category?: string | null }>;
  /** SKU id resolver — row.skuId 가 비어있을 수 있어 fallback. */
  resolveSkuId?: (pid: number) => string | null;
};

/**
 * Phase 1 shadow audit. ready pool entries 중 AI 안 본 매물 → AI L2 호출 + queue 적재.
 *
 * Side effects:
 *   - mvp_listing_ai_classifications upsert (classifyWithCache 가 처리).
 *   - mvp_catalog_learning_queue upsert (reject/hold verdict 매물).
 *   - mvp_candidate_pool.ai_audit_status PATCH.
 *
 * Phase 1 = NON-BLOCKING — pool 차단 X. status='ready' 그대로 유지.
 * ai_audit_status 만 박음. Phase 2 별도 wave 에서 차단 활성화.
 */
export async function runShadowAudit(input: ShadowAuditInput): Promise<ShadowAuditStats> {
  const t0 = Date.now();
  const budgetUsd = getDailyBudgetUsd();
  const stats: ShadowAuditStats = {
    enabled: isShadowAuditEnabled(),
    budgetGuardOk: false,
    spentUsdToday: 0,
    budgetUsd,
    candidates: 0,
    audited: 0,
    passCount: 0,
    holdCount: 0,
    rejectCount: 0,
    skippedCap: 0,
    skippedUnavailable: 0,
    learningEnqueued: 0,
    durationMs: 0,
  };

  if (!stats.enabled) {
    stats.durationMs = Date.now() - t0;
    return stats;
  }

  // 1. Budget guard.
  const spent = await fetchTodayAiL2CostUsd();
  stats.spentUsdToday = spent;
  stats.budgetGuardOk = spent < budgetUsd;
  if (!stats.budgetGuardOk) {
    await alertBudgetExceeded(spent, budgetUsd);
    stats.durationMs = Date.now() - t0;
    return stats;
  }

  // 2. AI 안 본 ready pool 매물 식별.
  const unaudited = await findUnauditedPoolEntries(input.poolEntries);
  stats.candidates = unaudited.size;
  if (stats.candidates === 0) {
    stats.durationMs = Date.now() - t0;
    return stats;
  }

  // 3. PipelineRow lookup (pid → row).
  const rowByPid = new Map<number, PipelineRow>();
  for (const r of input.rows) {
    const pid = Number(r.pid);
    if (Number.isFinite(pid) && unaudited.has(pid)) {
      rowByPid.set(pid, r);
    }
  }
  const auditTargets = Array.from(rowByPid.values());
  if (auditTargets.length === 0) {
    stats.durationMs = Date.now() - t0;
    return stats;
  }

  // 4. Per-tick cap — 너무 많으면 tick latency 폭발. fashion 우선 (사용자 우려).
  const perTickCap = getPerTickCap();
  const FASHION = new Set(["clothing", "shoe", "bag"]);
  const prioritized = auditTargets
    .slice()
    .sort((a, b) => {
      // fashion 우선
      const af = FASHION.has(a.skuName ?? "") ? 1 : 0;
      const bf = FASHION.has(b.skuName ?? "") ? 1 : 0;
      if (af !== bf) return bf - af;
      // score 높은 순 (사용자 노출 가능성 높은 매물 먼저)
      return b.score - a.score;
    })
    .slice(0, perTickCap);

  // 5. Concurrent AI 호출.
  const concurrency = Math.max(1, getConcurrency());
  const auditResults = new Map<number, "pass" | "hold" | "reject" | "skipped_unavailable">();
  const auditReasons = new Map<number, string>();

  let cursor = 0;
  async function workOne() {
    while (cursor < prioritized.length) {
      // budget re-check 중간 (긴 batch 안에서 cap 초과 가능).
      if (cursor % 10 === 0 && cursor > 0) {
        const recheck = await fetchTodayAiL2CostUsd();
        if (recheck >= budgetUsd) {
          stats.spentUsdToday = recheck;
          stats.budgetGuardOk = false;
          await alertBudgetExceeded(recheck, budgetUsd);
          // remaining → skippedCap
          const remaining = prioritized.length - cursor;
          stats.skippedCap += remaining;
          cursor = prioritized.length;
          break;
        }
      }
      const idx = cursor++;
      const row = prioritized[idx];
      if (!row) break;
      const pid = Number(row.pid);
      try {
        const { result, source } = await classifyWithCache(row);
        if (!result) {
          auditResults.set(pid, "skipped_unavailable");
          stats.skippedUnavailable += 1;
          continue;
        }
        const decision = aiSecondOpinionDecision(result);
        const hardRisk = aiHasHardRisk(result);
        let verdict: "pass" | "hold" | "reject";
        if (decision === "pass" && result.listingType === "normal" && result.confidence === "high" && !hardRisk) {
          verdict = "pass";
        } else if (decision === "reject" && result.confidence !== "low") {
          verdict = "reject";
        } else {
          verdict = "hold";
        }
        auditResults.set(pid, verdict);
        auditReasons.set(pid, result.reason ?? "");

        if (verdict === "pass") stats.passCount += 1;
        else if (verdict === "hold") stats.holdCount += 1;
        else stats.rejectCount += 1;

        stats.audited += 1;

        // Learning queue — reject/hold 만.
        if (verdict !== "pass") {
          const skuId = (row.skuId && row.skuId.length > 0)
            ? row.skuId
            : input.resolveSkuId?.(pid) ?? null;
          if (skuId) {
            const conf = result.confidence === "high" ? 0.9 : result.confidence === "medium" ? 0.65 : 0.4;
            const enq = await enqueueLearningSignal({
              skuId,
              pid,
              aiClassification: verdict,
              aiConfidence: conf,
              aiReason: result.reason ?? null,
              listingTitle: row.name,
              listingDescriptionPreview: row.descriptionPreview ?? null,
            });
            if (enq.enqueued) stats.learningEnqueued += 1;
          }
        }
      } catch (err) {
        auditResults.set(pid, "skipped_unavailable");
        stats.skippedUnavailable += 1;
        console.warn(`shadow audit classify failed pid=${pid} (non-fatal)`, err);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, workOne));

  // 6. ai_audit_status 박음 (Phase 1 = shadow, status='ready' 유지).
  await persistAuditStatus(auditResults, auditReasons);

  stats.durationMs = Date.now() - t0;
  return stats;
}

async function persistAuditStatus(
  results: Map<number, "pass" | "hold" | "reject" | "skipped_unavailable">,
  reasons: Map<number, string>,
): Promise<void> {
  if (results.size === 0) return;
  if (!SUPABASE_URL_ENV || !SUPABASE_KEY_ENV) return;
  const now = new Date().toISOString();
  // chunked PATCH — pid IN (...).
  const byVerdict = new Map<string, number[]>();
  for (const [pid, v] of results) {
    const list = byVerdict.get(v) ?? [];
    list.push(pid);
    byVerdict.set(v, list);
  }
  for (const [verdict, pids] of byVerdict) {
    const chunkSize = 200;
    for (let i = 0; i < pids.length; i += chunkSize) {
      const chunk = pids.slice(i, i + chunkSize);
      const pidList = chunk.map((p) => String(p)).join(",");
      const url = `${supabaseRestBase()}/rest/v1/mvp_candidate_pool?pid=in.(${pidList})`;
      // per-pid reason 다르므로 verdict 별로 batch + reason 은 첫 매물 만 박음 (대표값).
      // 상세 reason 은 mvp_listing_ai_classifications.reason 으로 join 가능.
      const body: Record<string, unknown> = {
        ai_audit_status: verdict === "skipped_unavailable" ? "skipped_unavailable" : verdict,
        ai_audit_at: now,
      };
      const sampleReason = reasons.get(chunk[0]) ?? "";
      if (sampleReason.length > 0) body.ai_audit_reason = sampleReason.slice(0, 200);
      try {
        const res = await fetch(url, {
          method: "PATCH",
          headers: supabaseHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          console.warn(`persistAuditStatus PATCH failed status=${res.status}`, t.slice(0, 100));
        }
      } catch (err) {
        console.warn("persistAuditStatus exception (non-fatal)", err);
      }
    }
  }
}
