"use client";

// 2026-05-17 Phase 0 L4 가시화 — 매물 카드에 5축 잔여 risk 시각화.
// 득템잡이 차별화 = "보호받음 감정" — POOL_BLOCK 통과 매물의 잔여 신호를 사용자에게 명시.
// 3 화면 공유 (admin-pool-browser / pack-reveal-modal / user-reveal-dashboard).

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangleIcon, ShieldIcon } from "@/components/icons";
import {
  buildRiskScore,
  RISK_AXIS_LABEL,
  RISK_AXIS_LEVEL_CLASS,
  RISK_TONE_CLASS,
  type RiskAxisResult,
  type RiskScoreInput,
} from "@/lib/risk-score";

type Props = RiskScoreInput & {
  // showDetail: true = 문장형 버튼 + popover (admin-pool 상세 / pack-reveal 상세).
  showDetail?: boolean;
  // compact: true = mini-bar 없이 chip 만 (user-reveal-dashboard 좁은 영역).
  compact?: boolean;
  containerClassName?: string;
  triggerClassName?: string;
  triggerLabel?: string;
  triggerContent?: ReactNode;
  hideChevron?: boolean;
  portalDetail?: boolean;
};

function detailTriggerLabel(tone: "safe" | "caution" | "danger", hitCount: number) {
  if (tone === "safe") return "왜 이 제품이 안전한가요?";
  if (tone === "caution") return `주의 ${hitCount}건이 있어요`;
  return `위험 신호 ${hitCount}건 확인`;
}

function riskActionSummary(axis: RiskAxisResult): string | null {
  const reason = axis.reason ?? "";
  if (axis.level === 0) return null;
  if (axis.axis === "fraud") {
    if (reason.includes("시세")) return "가격이 시세보다 크게 낮아요. 정품 인증, 구매 영수증, 구성품 사진을 한 번 더 확인하세요.";
    if (reason.includes("AI")) return "AI 검수 잔여 신호가 있어요. 거래 전 상품 설명과 실사진을 다시 맞춰보는 게 좋아요.";
    return "가품/이상 거래로 이어질 수 있는 표현이 있어요. 정품 근거와 판매자 답변을 확인하세요.";
  }
  if (axis.axis === "lock") {
    return "잠금/할부 가능성이 있어요. IMEI/일련번호, 정상해지 여부, 할부 잔여 여부를 물어보세요.";
  }
  if (axis.axis === "battery") {
    if (reason.includes("미공개")) return "배터리 효율이 안 적혀 있어요. 효율 화면 캡처와 교체 이력을 요청하세요.";
    return "배터리 상태가 가격에 영향을 줄 수 있어요. 효율 수치와 충전 상태를 확인하세요.";
  }
  if (axis.axis === "seller") {
    if (reason.includes("후기 0")) return "후기가 0건인 신규 판매자예요. 안전결제나 직거래, 실물 인증 사진을 우선으로 보세요.";
    return "판매자 후기가 적거나 낮아요. 최근 거래 후기와 응답 태도를 확인하고 진행하세요.";
  }
  if (axis.axis === "photo") {
    if (reason.includes("1장")) return "사진이 1장뿐이에요. 다른 각도, 구성품, 시리얼/상태 사진을 더 요청하세요.";
    return "사진 근거가 부족해요. 거래 전 실사진을 더 받아 상태를 확인하세요.";
  }
  return null;
}

export function RiskScoreBar({
  showDetail = false,
  compact = false,
  containerClassName = "",
  triggerClassName,
  triggerLabel,
  triggerContent,
  hideChevron = false,
  portalDetail = false,
  ...input
}: Props) {
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const score = buildRiskScore(input);
  const toneClass = RISK_TONE_CLASS[score.tone];
  const detailLabel = detailTriggerLabel(score.tone, score.hitCount);
  const DetailIcon = score.tone === "safe" ? ShieldIcon : AlertTriangleIcon;
  const actionSummaries = score.axes
    .map((axis) => riskActionSummary(axis))
    .filter((text): text is string => Boolean(text));
  useEffect(() => {
    setPortalReady(true);
  }, []);
  const backdropClassName = portalDetail
    ? "fixed inset-0 z-[190] bg-zinc-950/24 backdrop-blur-[1px]"
    : "fixed inset-0 z-[120] bg-zinc-950/24 backdrop-blur-[1px] sm:bg-transparent sm:backdrop-blur-0";
  const dialogClassName = portalDetail
    ? "risk-detail-dialog fixed left-1/2 top-[72px] z-[200] max-h-[calc(100dvh-156px)] w-[calc(100vw-28px)] max-w-[430px] -translate-x-1/2 overflow-hidden rounded-2xl border border-[#ddd6ca] bg-[#fffdf9] shadow-2xl shadow-zinc-950/22 dark:border-zinc-700 dark:bg-zinc-900 sm:top-[96px] sm:max-w-[460px]"
    : "risk-detail-dialog fixed left-1/2 top-[72px] z-[130] max-h-[calc(100dvh-156px)] w-[calc(100vw-28px)] max-w-[430px] -translate-x-1/2 overflow-hidden rounded-2xl border border-[#ddd6ca] bg-[#fffdf9] shadow-2xl shadow-zinc-950/22 dark:border-zinc-700 dark:bg-zinc-900 sm:absolute sm:left-0 sm:top-6 sm:w-[30rem] sm:max-w-none sm:translate-x-0 sm:rounded-xl";
  const detailLayer: ReactNode = open ? (
    <>
      <div
        className={backdropClassName}
        onClick={(e) => { e.stopPropagation(); setOpen(false); }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="위험 신호 점검"
        onClick={(e) => e.stopPropagation()}
        className={dialogClassName}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#e8dfd2] bg-[#fffdf9]/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 sm:px-5">
          <div>
            <div className="text-sm font-black text-zinc-950 dark:text-zinc-50">
              위험 신호 점검
            </div>
            <div className="mt-0.5 text-xs font-semibold leading-4 text-zinc-500 dark:text-zinc-400">
              추천 전에 걸러낸 뒤, 남은 확인 포인트만 보여드려요.
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${toneClass}`}>
              {score.label}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-bold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              닫기
            </button>
          </div>
        </div>
        <div className="max-h-[calc(100dvh-232px)] overflow-y-auto px-4 py-3 sm:max-h-[calc(74vh-76px)] sm:px-5 sm:py-4">
          <div className="space-y-2.5">
            {score.axes.map((a) => (
              <div
                key={a.axis}
                className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-[#ebe3d8] bg-white px-3 py-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/35"
              >
                <span className="text-xs font-black text-zinc-600 dark:text-zinc-400">
                  {RISK_AXIS_LABEL[a.axis]}
                </span>
                <span className="min-w-0">
                  <span className="mb-1 flex items-center gap-1">
                    {[0, 1, 2].map((lv) => (
                      <span
                        key={lv}
                        aria-hidden="true"
                        className={`block h-2.5 w-5 rounded-full ${
                          lv < 3 - a.level
                            ? RISK_AXIS_LEVEL_CLASS[a.level]
                            : "bg-zinc-200 dark:bg-zinc-700"
                        }`}
                      />
                    ))}
                  </span>
                  <span className="block text-[13px] font-bold leading-5 text-zinc-800 dark:text-zinc-200">
                    {a.reason ?? <span className="text-zinc-400 dark:text-zinc-500">정상</span>}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-[#d8eadf] bg-[#f3fbf6] px-3.5 py-3 text-sm font-semibold leading-5 text-zinc-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-zinc-200">
            <div className="mb-1.5 text-sm font-black text-zinc-950 dark:text-zinc-50">
              확인하면 좋아요
            </div>
            {actionSummaries.length > 0 ? (
              <ul className="space-y-1.5">
                {actionSummaries.map((summary) => (
                  <li key={summary} className="pl-2 before:mr-1.5 before:content-['·']">
                    {summary}
                  </li>
                ))}
              </ul>
            ) : (
              <div>
                강한 잔여 신호는 없어요. 그래도 거래 전 실사진, 구성품, 판매완료 여부는 마지막으로 확인하세요.
              </div>
            )}
          </div>
          <div className="mt-3 rounded-xl border border-[#ebe3d8] bg-white px-3.5 py-3 text-xs font-semibold leading-5 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/35 dark:text-zinc-400">
            득템잡이는 가품 의심, 잠금/할부 의심처럼 강한 차단 신호가 있는 매물은 추천 풀에 넣지 않아요. 이 화면은 통과한 매물에서 남은 확인 포인트만 보여줘요. 신호가 0이어도 거래 전 실사진과 안전결제는 마지막으로 확인하세요.
          </div>
        </div>
      </div>
      <style jsx global>{`
        @keyframes riskSheetSettle {
          from {
            opacity: 0;
            transform: translate(-50%, -8px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        @media (min-width: 640px) {
          @keyframes riskSheetSettle {
            from {
              opacity: 0;
              transform: translateY(-6px);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        }

        .risk-detail-dialog {
          animation: riskSheetSettle 130ms ease-out;
        }
      `}</style>
    </>
  ) : null;
  const renderedDetailLayer =
    portalDetail && portalReady && typeof document !== "undefined"
      ? createPortal(detailLayer, document.body)
      : detailLayer;

  return (
    <span className={`relative inline-flex items-center gap-1.5 ${containerClassName}`}>
      {showDetail ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className={triggerClassName ?? `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black leading-none shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}
          aria-expanded={open}
          aria-label={`${score.label} 상세 보기`}
          title={detailLabel}
        >
          {triggerContent ?? (
            <>
              <DetailIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{triggerLabel ?? detailLabel}</span>
              {!hideChevron ? <span aria-hidden="true" className="text-[11px]">›</span> : null}
            </>
          )}
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

      {showDetail ? renderedDetailLayer : null}
    </span>
  );
}
