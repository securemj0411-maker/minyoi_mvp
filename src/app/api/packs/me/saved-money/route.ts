// Wave 182 (2026-05-17): Saved Money Counter API.
// 사업 보고서 retention #1 — loss aversion ×2.5. "안 잃은 돈"이 "번 돈"보다 sticky.
//
// 응답:
// - earnedThisMonth: 본인 'bought' 표시 매물의 expected_profit_min 합 (보수적)
// - savedThisMonthSiteWide: 사이트 전체 차단된 위험 매물 수 × 평균 손해율 추정
// - blockedCount: 사이트 전체 차단 매물 수 (이번 달)
// - boughtCount: 본인 매수 표시 수
// - compensationGrantedThisMonth: 본인 신고/손해 보상으로 받은 토큰 수
//
// 사용자 본인 매수가 없으면 earnedThisMonth=0 + 안내 메시지.

import { NextResponse } from "next/server";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { requireSupabaseUser } from "@/lib/supabase-server-auth";
import { userRefForAuthUser } from "@/lib/user-ref";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 차단된 매물 1건당 추정 손해 회피 (보수적 — 가품/잠금 평균 손해율 기반).
// 가품 평균 -28만, 잠금 -45만 (사업 보고서). 절반 가중 = 약 35만. 보수적 30만 박음.
const AVG_LOSS_PER_BLOCKED_LISTING_KRW = 300_000;

// "차단된 매물" 정의 — mvp_listing_analysis 의 강한 risk flag.
const BLOCK_FLAGS = [
  "extreme_discount_review",
  "risk_keyword_review",
  "ai_escrow_held",
  "condition_review",
  "weak_description",
  "option_parse_review",
  "market_stat_missing",
];

const COMPENSATION_FEEDBACK_TYPES = ["loss_report", "inaccurate_report"] as const;

export async function GET(req: Request) {
  const auth = await requireSupabaseUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userRef = userRefForAuthUser(auth.user.id);

  // 이번 달 1일 (UTC) — Supabase date_trunc 와 동일.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthStartIso = monthStart.toISOString();

  try {
    // 1. 본인 bought feedback (이번 달) — pid list
    const boughtRes = await restFetch(
      `${tableUrl("mvp_reveal_feedback")}?select=pid&user_ref=eq.${encodeURIComponent(userRef)}&feedback_type=eq.bought&created_at=gte.${encodeURIComponent(monthStartIso)}`,
      { headers: serviceHeaders() },
    );
    const boughtRows = (await boughtRes.json()) as Array<{ pid: number }>;
    const boughtPids = boughtRows.map((r) => Number(r.pid)).filter((n) => Number.isFinite(n) && n > 0);

    // 2. bought 매물의 expected_profit_min 합 (candidate_pool 에 있는 매물만)
    let earnedKrw = 0;
    if (boughtPids.length > 0) {
      const profitRes = await restFetch(
        `${tableUrl("mvp_candidate_pool")}?select=pid,expected_profit_min&pid=in.(${boughtPids.join(",")})`,
        { headers: serviceHeaders() },
      );
      const profitRows = (await profitRes.json()) as Array<{ pid: number; expected_profit_min: number }>;
      for (const row of profitRows) {
        earnedKrw += Math.max(0, Number(row.expected_profit_min ?? 0));
      }
    }

    // 3. 사이트 전체 차단 위험 매물 수 (이번 달) — count=exact 헤더.
    const blockedFlagsCsv = BLOCK_FLAGS.map((f) => `"${f}"`).join(",");
    const blockedRes = await restFetch(
      // PostgREST `&&` (overlap) 연산자 = `ov`. score_flags 가 array 컬럼.
      `${tableUrl("mvp_listing_analysis")}?select=id&updated_at=gte.${encodeURIComponent(monthStartIso)}&score_flags=ov.{${BLOCK_FLAGS.join(",")}}&limit=1`,
      { headers: { ...serviceHeaders(), Prefer: "count=exact" } },
    );
    const blockedRange = blockedRes.headers.get("content-range") ?? "0-0/0";
    const blockedCount = Number(blockedRange.split("/")[1] ?? 0);
    void blockedFlagsCsv;

    // 4. 본인 신고/손해 보상 토큰 합 (이번 달)
    const compensationRes = await restFetch(
      `${tableUrl("mvp_reveal_feedback")}?select=compensation_granted_tokens&user_ref=eq.${encodeURIComponent(userRef)}&feedback_type=in.(${COMPENSATION_FEEDBACK_TYPES.join(",")})&created_at=gte.${encodeURIComponent(monthStartIso)}`,
      { headers: serviceHeaders() },
    );
    const compRows = (await compensationRes.json()) as Array<{ compensation_granted_tokens: number | null }>;
    const compensationGrantedThisMonth = compRows.reduce((s, r) => s + Math.max(0, Number(r.compensation_granted_tokens ?? 0)), 0);

    return NextResponse.json({
      earnedThisMonthKrw: earnedKrw,
      savedThisMonthSiteWideKrw: blockedCount * AVG_LOSS_PER_BLOCKED_LISTING_KRW,
      blockedCountThisMonth: blockedCount,
      boughtCountThisMonth: boughtPids.length,
      compensationGrantedThisMonth,
      monthLabel: `${monthStart.getUTCFullYear()}년 ${monthStart.getUTCMonth() + 1}월`,
      // UI 가이드 (사용자 친화 메시지)
      hints: {
        hasBought: boughtPids.length > 0,
        boughtPrompt: boughtPids.length === 0
          ? "구매한 매물이 있으면 [매수했어요] 표시. 자동으로 차익 누적됩니다."
          : null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[saved-money] failed", { err: message, userRef });
    return NextResponse.json({ error: "saved_money_failed" }, { status: 500 });
  }
}
