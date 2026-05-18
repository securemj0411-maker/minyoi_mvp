"use client";

// 2026-05-17 Phase 0 L4 가시화 — 매물 카드에 5축 잔여 risk 시각화.
// 득템잡이 차별화 = "보호받음 감정" — POOL_BLOCK 통과 매물의 잔여 신호를 사용자에게 명시.
// 3 화면 공유 (admin-pool-browser / pack-reveal-modal / user-reveal-dashboard).

import { useState } from "react";
import {
  buildRiskScore,
  RISK_AXIS_LABEL,
  RISK_AXIS_LEVEL_CLASS,
  RISK_TONE_CLASS,
  type RiskScoreInput,
} from "@/lib/risk-score";

type Props = RiskScoreInput & {
  // showDetail: true = 문장형 버튼 + popover (admin-pool 상세 / pack-reveal 상세).
  showDetail?: boolean;
  // compact: true = mini-bar 없이 chip 만 (user-reveal-dashboard 좁은 영역).
  compact?: boolean;
};

function detailTriggerLabel(tone: "safe" | "caution" | "danger", hitCount: number) {
  if (tone === "safe") return "🛡️ 왜 안전한가요?";
  if (tone === "caution") return `⚠️ 주의 ${hitCount}건이 있어요`;
  return `🚨 위험 신호 ${hitCount}건 확인`;
}

export function RiskScoreBar({ showDetail = false, compact = false, ...input }: Props) {
  const [open, setOpen] = useState(false);
  const score = buildRiskScore(input);
  const toneClass = RISK_TONE_CLASS[score.tone];
  const detailLabel = detailTriggerLabel(score.tone, score.hitCount);

  return (
    <span className="relative inline-flex items-center gap-1.5">
      {showDetail ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}
          aria-expanded={open}
          aria-label={`${score.label} 상세 보기`}
          title={detailLabel}
        >
          <span>{detailLabel}</span>
          <span aria-hidden="true" className="text-[11px]">›</span>
        </button>
      ) : (
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}
          title={score.label}
        >
          {score.label}
        </span>
      )}

      {!compact && (
        <span
          className="inline-flex items-center gap-[2px]"
          aria-label="위험 신호 5축 점수"
        >
          {score.axes.map((a) => (
            <span
              key={a.axis}
              title={`${RISK_AXIS_LABEL[a.axis]}: ${a.reason ?? "정상"}`}
              className={`block h-2 w-2 rounded-sm ${RISK_AXIS_LEVEL_CLASS[a.level]}`}
            />
          ))}
        </span>
      )}

      {showDetail && (
        <>
          {open && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setOpen(false)}
              />
              <div className="absolute left-0 top-5 z-50 w-80 rounded-lg border border-zinc-300 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100">
                    🔍 위험 신호 점검
                  </div>
                  <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${toneClass}`}>
                    {score.label}
                  </span>
                </div>
                <div className="space-y-1.5 text-[10px]">
                  {score.axes.map((a) => (
                    <div key={a.axis} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-zinc-600 dark:text-zinc-400">
                        {RISK_AXIS_LABEL[a.axis]}
                      </span>
                      <span className="flex shrink-0 items-center gap-[2px]">
                        {[0, 1, 2].map((lv) => (
                          <span
                            key={lv}
                            className={`block h-2 w-2 rounded-sm ${
                              lv <= a.level
                                ? RISK_AXIS_LEVEL_CLASS[a.level]
                                : "bg-zinc-200 dark:bg-zinc-700"
                            }`}
                          />
                        ))}
                      </span>
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {a.reason ?? <span className="text-zinc-400 dark:text-zinc-500">정상</span>}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 border-t border-zinc-200 pt-2 text-[9px] text-zinc-500 dark:border-zinc-700">
                  득템잡이는 hard-block 필터 (POOL_BLOCK_FLAGS) 통과한 매물만 풀에 박힙니다. 위 점수는 <b>통과한 매물의 잔여 신호</b> — 0 이라도 100% 안전 보장은 아니지만, 신호 강하면 사용자가 한 번 더 셀러 문의 권고.
                </div>
              </div>
            </>
          )}
        </>
      )}
    </span>
  );
}
