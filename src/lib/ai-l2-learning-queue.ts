// Wave 238 (2026-05-19): AI L2 learning queue.
//
// AI verdict reject/hold 매물 → mvp_catalog_learning_queue 적재.
// 같은 sku_id + matched_text 패턴 발견 → frequency_count++ (upsert).
// admin 매주 review (SQL query) → catalog mustNotContain patch.
//
// 정책 (사용자 명시 + memory):
//   - AI = 학습 catalyst (단기), catalog = source-of-truth (영구)
//   - iPad/tech 패턴: 시간 지나면 AI 호출 비율 감소 (catalog 95%+ 자동 분류)
//   - regex patch 금지 → AI verdict 가 catalog 패턴 후보 박음, admin 검토 후 apply
//
// Phase 1 = shadow only. queue 적재만, catalog auto-patch 없음.
// Phase 2/3 별도 wave 에서 admin UI + auto-patch 활성화.

import { createHash } from "crypto";

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

export type LearningQueueInput = {
  skuId: string;
  pid: number | string;
  aiClassification: "reject" | "hold" | "pass";
  aiConfidence: number | null;
  aiReason: string | null;
  listingTitle: string;
  listingDescriptionPreview?: string | null;
};

export type LearningQueueResult = {
  enqueued: boolean;
  skipped: boolean;
  reason?: string;
};

// 간단 keyword extraction — AI reason 에서 가장 빈도 높은 토큰 (3+ char).
// 의도: "샘플슈즈" / "MM67" 같은 catalog 패턴 후보 박는 첫 단계.
// 정교한 NLP 는 admin review 가 담당. 여기는 후보만.
const STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "are", "was", "have", "has",
  "이건", "이것", "있는", "있음", "있다", "있고", "되는", "되어", "하는", "하다", "한다",
  "매물", "제품", "상품", "판매", "구매", "거래", "가격", "조건", "상태", "리뷰",
  "title", "description", "listing", "item", "product", "seller", "buyer",
  "정상", "양호", "사용", "신품", "구품",
]);

function extractKeywordCandidates(text: string | null | undefined, listingTitle: string): string[] {
  if (!text) return [];
  const combined = `${text} ${listingTitle ?? ""}`;
  // 한글 2자+ / 영문 3자+ 토큰 추출. brand/model code (대문자 + 숫자) 우선.
  const tokens = combined
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  const counts = new Map<string, number>();
  for (const t of tokens) {
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);
}

function makeMatchedTextSignature(skuId: string, candidates: string[], aiReason: string | null): string {
  if (candidates.length === 0) {
    // fallback: ai_reason 자체 hash (8 char). 단 동일 reason 중복 묶기 용.
    if (!aiReason) return `unknown-${skuId}`;
    return createHash("sha256").update(`${skuId}:${aiReason}`).digest("hex").slice(0, 12);
  }
  return candidates.join("+");
}

/**
 * AI verdict reject/hold 매물 → learning queue 적재 (upsert by sku_id + matched_text).
 * pass 매물은 skip (학습 시그널 X).
 *
 * 실패는 non-fatal — telegram alert 는 batch wrapper 에서 처리.
 */
export async function enqueueLearningSignal(input: LearningQueueInput): Promise<LearningQueueResult> {
  if (!SUPABASE_URL_ENV || !SUPABASE_KEY_ENV) {
    return { enqueued: false, skipped: true, reason: "supabase_env_missing" };
  }
  if (input.aiClassification === "pass") {
    return { enqueued: false, skipped: true, reason: "ai_pass_no_signal" };
  }
  if (!input.skuId) {
    return { enqueued: false, skipped: true, reason: "sku_id_missing" };
  }

  const candidates = extractKeywordCandidates(input.aiReason, input.listingTitle);
  const matchedText = makeMatchedTextSignature(input.skuId, candidates, input.aiReason);

  // upsert: 같은 (sku_id, matched_text) → frequency_count++.
  // PostgREST RPC 가 없으므로 raw SQL 통해 처리 (UPDATE first, INSERT on miss).
  // 동시성 race → unique constraint 안전망.
  try {
    const url = `${supabaseRestBase()}/rest/v1/mvp_catalog_learning_queue?on_conflict=sku_id,matched_text`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...supabaseHeaders(),
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([{
        sku_id: input.skuId,
        pid: Number(input.pid),
        ai_classification: input.aiClassification,
        ai_confidence: input.aiConfidence,
        ai_reason: input.aiReason,
        suggested_must_not_contain: candidates,
        matched_text: matchedText,
        frequency_count: 1,
        status: "pending",
      }]),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { enqueued: false, skipped: true, reason: `upsert_failed_${res.status}_${body.slice(0, 80)}` };
    }
    // PostgREST merge-duplicates 는 frequency_count++ 자동 X. 수동 increment.
    // upsert 가 INSERT 인지 UPDATE 인지 모르므로 별도 RPC 로 frequency 만 증가.
    // 간단화: 같은 sku/matched_text 가 있으면 RPC 가 frequency_count + 1 처리.
    await incrementFrequency(input.skuId, matchedText);
    return { enqueued: true, skipped: false };
  } catch (err) {
    return { enqueued: false, skipped: true, reason: `exception_${(err as Error).message?.slice(0, 60)}` };
  }
}

/**
 * 같은 (sku_id, matched_text) 패턴 frequency_count++ (있으면).
 * PostgREST PATCH — atomic 아니지만 race 시 약간 underflow 만 발생 (catastrophic X).
 */
async function incrementFrequency(skuId: string, matchedText: string): Promise<void> {
  if (!SUPABASE_URL_ENV || !SUPABASE_KEY_ENV) return;
  try {
    const url = `${supabaseRestBase()}/rest/v1/rpc/increment_learning_queue_frequency`;
    const res = await fetch(url, {
      method: "POST",
      headers: supabaseHeaders(),
      body: JSON.stringify({ p_sku_id: skuId, p_matched_text: matchedText }),
    });
    // RPC 가 아직 없으면 silent skip (Phase 2 에서 RPC 박을 예정).
    // PostgREST 404 = function not found.
    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => "");
      console.warn("increment_learning_queue_frequency failed (non-fatal)", res.status, body.slice(0, 80));
    }
  } catch (err) {
    console.warn("increment_learning_queue_frequency exception (non-fatal)", err);
  }
}
