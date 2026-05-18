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
};

export function LiquidityCurveMini({ compact = false, ...input }: Props) {
  const curve = buildLiquidityCurve(input);
  const positionClass = LIQUIDITY_POSITION_CLASS[curve.position];
  const positionLabel = LIQUIDITY_POSITION_LABEL[curve.position];
  const estimated = liquidityHoursLabel(curve.estimatedHours);

  if (compact || curve.position === "unknown") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${positionClass}`}
        title={curve.confident
          ? `이 가격이면 비슷한 상품이 보통 ${estimated} 안에 팔렸어요. 기준 ${curve.soldSampleCount}건`
          : "판매 속도 데이터가 부족해서 추정이 불확실해요."}
      >
        ⚡ {positionLabel} · {estimated}
      </span>
    );
  }

  // full 시각화
  return (
    <div className="rounded-lg border border-[#e2d9cb] bg-[#fffaf1] p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-black text-[#223127] dark:text-zinc-100">
          ⚡ 이 가격이면 얼마나 빨리 팔릴까?
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
        비슷한 상품은 보통 <span className="text-emerald-700 dark:text-emerald-300">{estimated}</span> 안에 팔렸어요
      </div>

      {(curve.estimatedHoursAt5PctDiscount != null || curve.estimatedHoursAt5PctMarkup != null) && (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[10px]">
          {curve.estimatedHoursAt5PctDiscount != null && (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <span className="font-bold text-emerald-800 dark:text-emerald-300">5% 싸게 팔면</span>
              <span className="ml-1 text-emerald-900 dark:text-emerald-200">{liquidityHoursLabel(curve.estimatedHoursAt5PctDiscount)}</span>
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
        {curve.confident
          ? `비슷한 상품 판매 ${curve.soldSampleCount}건을 보고 추정했어요. 실제 판매 시간은 달라질 수 있어요.`
          : `비슷한 상품 판매 기록이 ${curve.soldSampleCount ?? 0}건이라 아직 참고용이에요.`}
      </div>
    </div>
  );
}
