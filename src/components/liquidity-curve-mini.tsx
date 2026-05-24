"use client";

// Wave 183 (2026-05-17): Liquidity 곡선 mini-chart.
// 사업 보고서 L6 — "회전 기간이 떡상점수보다 retention-critical". 자본 묶임 두려움 직접 해소.
//
// UI 패턴:
// - 5칸 mini-bar (very_fast → very_slow) + 매물 가격 위치 표시 (▲)
// - 추정 회전 시간 + sample count
// - "+5% 인하 → N시간 (더 빠름)" / "-5% 인상 → N시간 (더 느림)" 옵션 정보
//
// 사용:
//   <LiquidityCurveMini
//     price={card.price}
//     p25Price={...} medianPrice={...} p75Price={...}
//     p25Hours={...} medianHours={...} p75Hours={...}
//     soldSampleCount={...}
//   />

import {
  buildLiquidityCurve,
  liquidityHoursLabel,
  LIQUIDITY_BUCKET_CLASS,
  LIQUIDITY_POSITION_CLASS,
  LIQUIDITY_POSITION_LABEL,
  type LiquidityCurveInput,
} from "@/lib/liquidity-curve";

type Props = LiquidityCurveInput & {
  compact?: boolean; // true = chip 만 (좁은 영역)
  uiTestFallback?: boolean;
};

export function LiquidityCurveMini({ compact = false, uiTestFallback = false, ...input }: Props) {
  const curve = buildLiquidityCurve(input);
  const positionClass = LIQUIDITY_POSITION_CLASS[curve.position];
  const positionLabel = LIQUIDITY_POSITION_LABEL[curve.position];
  const estimated = liquidityHoursLabel(curve.estimatedHours);
  const hasSaleSpeedEstimate =
    curve.estimatedHours != null &&
    Number.isFinite(curve.estimatedHours) &&
    curve.estimatedHours > 0 &&
    ((curve.soldSampleCount ?? 0) > 0 || uiTestFallback);

  if (compact || curve.position === "unknown") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${positionClass}`}
        title={curve.confident
          ? `이 가격이면 비슷한 상품이 보통 ${estimated} 안에 팔렸어요. 기준 ${curve.soldSampleCount}건`
          : uiTestFallback
            ? "판매속도 표본이 부족해서 UI 확인용 2일 기준으로 보여줘요."
            : "판매 속도 데이터가 부족해서 추정이 불확실해요."}
      >
        {hasSaleSpeedEstimate ? `${positionLabel} · ${estimated}` : "판매 속도 표본 부족"}
      </span>
    );
  }

  if (!hasSaleSpeedEstimate) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
        <div className="font-black text-zinc-700 dark:text-zinc-200">판매 속도 표본 부족</div>
        <div className="mt-0.5">
          비슷한 상품 판매 기록이 {(curve.soldSampleCount ?? 0).toLocaleString("ko-KR")}건이라 아직 팔리는 시간을 추정하지 않았어요.
        </div>
      </div>
    );
  }

  // full 시각화
  return (
    <div className="rounded-lg border border-[#e2d9cb] bg-[#fffaf1] p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-black text-[#223127] dark:text-zinc-100">
          이 가격이면 얼마나 빨리 팔릴까?
        </span>
        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${positionClass}`}>
          {positionLabel}
        </span>
      </div>

      {/* 5칸 mini-bar + 위치 화살표 */}
      <div className="mt-2">
        <div className="flex h-3 gap-[2px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`flex-1 rounded-sm ${LIQUIDITY_BUCKET_CLASS[i]} ${
                i === curve.bucketIndex ? "ring-2 ring-zinc-700 dark:ring-zinc-100" : ""
              }`}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[9px] font-bold text-zinc-500 dark:text-zinc-400">
          <span>저렴 · 빨리 팔림</span>
          <span>시세 근처</span>
          <span>비쌈 · 오래 걸림</span>
        </div>
      </div>

      <div className="mt-2 text-[12px] font-black text-[#223127] dark:text-zinc-100">
        비슷한 상품은 보통 <span className="text-blue-700 dark:text-blue-300">{estimated}</span> 안에 팔렸어요
      </div>

      {(curve.estimatedHoursAt5PctDiscount != null || curve.estimatedHoursAt5PctMarkup != null) && (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[10px]">
          {curve.estimatedHoursAt5PctDiscount != null && (
            <div className="rounded border border-blue-200 bg-blue-50 px-2 py-1 dark:border-blue-900/40 dark:bg-blue-950/20">
              <span className="font-bold text-blue-800 dark:text-blue-300">5% 싸게 팔면</span>
              <span className="ml-1 text-blue-900 dark:text-blue-200">{liquidityHoursLabel(curve.estimatedHoursAt5PctDiscount)}</span>
            </div>
          )}
          {curve.estimatedHoursAt5PctMarkup != null && (
            <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1 dark:border-rose-900/40 dark:bg-rose-950/20">
              <span className="font-bold text-rose-800 dark:text-rose-300">5% 비싸게 팔면</span>
              <span className="ml-1 text-rose-900 dark:text-rose-200">{liquidityHoursLabel(curve.estimatedHoursAt5PctMarkup)}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-1.5 text-[9px] text-zinc-500 dark:text-zinc-400">
        {uiTestFallback
          ? "판매속도 표본이 부족해 UI 확인용 2일 기준으로 보여줘요."
          : curve.confident
          ? `비슷한 상품 판매 ${curve.soldSampleCount}건을 보고 추정했어요. 실제 판매 시간은 달라질 수 있어요.`
          : `비슷한 상품 판매 기록이 ${curve.soldSampleCount ?? 0}건이라 아직 참고용이에요.`}
      </div>
    </div>
  );
}
