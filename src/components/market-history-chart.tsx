"use client";

// 2026-05-15: 시세 history chart. SVG inline (의존성 X). 30일 active/sold median 라인.
// comparable_key 없거나 history 0이면 "시세 없음" 표시.

import { useEffect, useState } from "react";

type Point = {
  date: string;
  active: number | null;
  sold: number | null;
  blended: number | null;
  activeCount: number;
  soldCount: number;
  confidence?: "high" | "medium" | "low";
};

type HistoryResp = {
  comparableKey: string;
  points: Point[];
};

function krwShort(value: number): string {
  if (value >= 10_000_000) return `${Math.round(value / 100_000) / 10}천만`;
  if (value >= 1_000_000) return `${Math.round(value / 10_000) / 100}백만`;
  if (value >= 10_000) return `${Math.round(value / 1000) / 10}만`;
  return `${Math.round(value / 1000)}천`;
}

function shortDateLabel(date: string): string {
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  return `${month}/${day}`;
}

function ChartSkeleton() {
  return (
    <div className="animate-pulse rounded-md bg-white px-2 py-2 dark:bg-zinc-900" aria-busy="true">
      <div className="flex items-center justify-between gap-2">
        <div className="h-3 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="flex gap-2">
          <div className="h-3 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
      <div className="mt-2 h-[150px] rounded bg-zinc-50 p-3 dark:bg-zinc-950/40">
        <div className="flex h-full items-end gap-2">
          {[48, 70, 58, 84, 66, 90, 74].map((height, idx) => (
            <div
              key={idx}
              className="flex-1 rounded-t bg-zinc-200 dark:bg-zinc-800"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="h-3 w-28 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

export type ChartState = "loading" | "available" | "empty" | "reference_only" | "error" | "no_key";

export default function MarketHistoryChart({
  comparableKey,
  currentPrice,
  conditionClass,
  priceSource,
  referencePrice,
  lazy = false,
  // Wave launch-83 (사용자 결정 — 데이터 부족 placeholder 미완성 인상 차단):
  //   nullOnEmpty=true 면 데이터 부족/모델 미분류/에러 시 텍스트 안내 박스 대신 null 반환.
  //   parent 가 onState 받아 wrapper section 자체 hide 가능.
  //   admin-pool-browser 같은 운영자 도구에서는 텍스트 안내가 유용 (기본 false).
  nullOnEmpty = false,
  onState,
}: {
  comparableKey: string | null;
  currentPrice?: number | null;
  conditionClass?: string | null;
  priceSource?: "reference" | "market" | "v3_pending_rematch" | null;
  referencePrice?: number | null;
  lazy?: boolean;
  nullOnEmpty?: boolean;
  onState?: (state: ChartState) => void;
}) {
  const [data, setData] = useState<Point[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(!lazy);

  useEffect(() => {
    if (!comparableKey || !opened) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    onState?.("loading");
    const isReferenceChart = priceSource === "reference";
    const chartConditionClass = isReferenceChart ? "unopened" : conditionClass;
    const ccQuery = chartConditionClass ? `&cc=${encodeURIComponent(chartConditionClass)}` : "";
    const strictQuery = isReferenceChart ? "&strict=1" : "";
    fetch(`/api/market/history?ck=${encodeURIComponent(comparableKey)}&days=30${ccQuery}${strictQuery}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: HistoryResp) => {
        if (!cancelled) setData(j.points ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "fetch failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [comparableKey, conditionClass, opened, priceSource, onState]);

  // Wave launch-83: data 상태 → parent 에 알림.
  //   data null = 아직 fetch 안 됨 (loading 별도 처리).
  //   data 빈 또는 1개 = empty (그래프 불가) — reference 매물은 "reference_only" 안내 가능.
  //   data 2+ = available.
  useEffect(() => {
    if (!comparableKey) { onState?.("no_key"); return; }
    if (error) { onState?.("error"); return; }
    if (data == null) return; // loading
    if (data.length >= 2) { onState?.("available"); return; }
    if (priceSource === "reference" && referencePrice != null && referencePrice > 0) {
      onState?.("reference_only");
      return;
    }
    onState?.("empty");
  }, [data, error, comparableKey, priceSource, referencePrice, onState]);

  if (!comparableKey) {
    if (nullOnEmpty) return null;
    return <div className="rounded-md bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">모델 분류 미완료 — 시세 그래프 없음</div>;
  }
  if (lazy && !opened) {
    return (
      <button
        type="button"
        onClick={() => setOpened(true)}
        className="w-full rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-left text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
      >
        시세 30일 추이 보기
      </button>
    );
  }
  if (loading) {
    return <ChartSkeleton />;
  }
  if (error) {
    if (nullOnEmpty) return null;
    const friendly = error.includes("429") ? "잠시 후 다시 시도해주세요 (요청 너무 빠름)" : "시세 history 불러오기 실패";
    return <div className="rounded-md bg-red-50 px-3 py-2 text-[11px] text-red-700">{friendly}</div>;
  }
  if (!data || data.length === 0) {
    if (priceSource === "reference" && referencePrice != null && referencePrice > 0) {
      return (
        <div className="rounded-md border border-blue-100 bg-blue-50/70 px-3 py-2 text-[11px] font-semibold text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
          다나와 새상품 기준 {krwShort(referencePrice)} · 번개 미개봉 거래 추이는 표본 누적 중
        </div>
      );
    }
    if (nullOnEmpty) return null;
    return <div className="rounded-md bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">시세 누적 중 — 아직 history 없어요 (매물 처음 등록)</div>;
  }
  // 2026-05-17 fix: 임계값 3 → 2 낮춤. 시스템 fresh start (5/16) 라 history 누적
  // 부족 — 사용자 대다수 매물 "그래프 없음" 텍스트만 봄. 2 점이면 라인 가능.
  // data.length === 1 (단일 시점) 만 텍스트 fallback.
  if (data.length < 2) {
    if (priceSource === "reference" && referencePrice != null && referencePrice > 0) {
      return (
        <div className="rounded-md border border-blue-100 bg-blue-50/70 px-3 py-2 text-[11px] font-semibold text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
          다나와 새상품 기준 {krwShort(referencePrice)} · 번개 미개봉 추이는 내일부터 더 선명해져요
        </div>
      );
    }
    if (nullOnEmpty) return null;
    return (
      <div className="rounded-md bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        시세 누적 1일째 — 내일부터 추이 그래프 자동 표시
      </div>
    );
  }

  // 좌표 계산. 우측은 가격 라벨 공간 확보 위해 padR 더 크게.
  // 하단 padBottom은 전체 기간 X축 라벨 공간.
  const width = 360;
  const height = 160;
  const padX = 28;
  const padR = 60;
  const padTop = 26;
  const padBottom = 28;
  const innerW = width - padX - padR;
  const innerH = height - padTop - padBottom;

  const allPrices: number[] = [];
  for (const p of data) {
    if (p.active != null && p.active > 0 && p.active < 100_000_000) allPrices.push(p.active);
    if (p.sold != null && p.sold > 0 && p.sold < 100_000_000) allPrices.push(p.sold);
  }
  // 2026-05-16: placeholder price (999999999, 111111111 등) 매물은 chart 표시 안 함.
  // currentPrice가 placeholder면 그래프 끌어올려 다른 점이 안 보임.
  const showCurrentPrice = currentPrice != null && currentPrice > 0 && currentPrice < 100_000_000;
  if (showCurrentPrice) allPrices.push(currentPrice as number);
  const showReferencePrice = priceSource === "reference" && referencePrice != null && referencePrice > 0 && referencePrice < 100_000_000;
  if (showReferencePrice) allPrices.push(referencePrice as number);

  if (allPrices.length === 0) {
    if (nullOnEmpty) return null;
    return <div className="rounded-md bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500">표본 부족 (가격 데이터 없음)</div>;
  }

  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const rangeP = Math.max(1, maxP - minP);

  function x(idx: number) {
    return padX + (idx / Math.max(1, data!.length - 1)) * innerW;
  }
  function y(price: number) {
    return padTop + innerH - ((price - minP) / rangeP) * innerH;
  }

  const linePath = (pickPrice: (point: Point) => number | null) => {
    let pathStarted = false;
    return data
      .map((p, i) => {
        const price = pickPrice(p);
        if (price == null) return null;
        const command = pathStarted ? "L" : "M";
        pathStarted = true;
        return `${command}${x(i)},${y(price)}`;
      })
      .filter(Boolean)
      .join(" ");
  };
  const activePath = linePath((p) => p.active);
  const soldPath = linePath((p) => p.sold);
  const xAxisTicks = (() => {
    const maxLabels = 5;
    if (data.length <= maxLabels) {
      return data.map((p, i) => ({ i, date: p.date }));
    }
    const lastIndex = data.length - 1;
    const indexes = new Set<number>();
    for (let step = 0; step < maxLabels; step += 1) {
      indexes.add(Math.round((step * lastIndex) / (maxLabels - 1)));
    }
    return [...indexes]
      .sort((a, b) => a - b)
      .map((i) => ({ i, date: data[i]!.date }));
  })();

  const latestActive = data[data.length - 1]?.active;
  const latestSold = data[data.length - 1]?.sold;
  const totalSoldCount = data.reduce((sum, p) => sum + p.soldCount, 0);
  // 2026-05-19 P0: "30일 추이" 거짓 카피 정직화. 5/16 incident로 historical 4일밖에 없는데
  // 30일이라 표기하면 사용자가 trend 풍부함으로 오인. 실제 data.length 기반 동적 표기.
  const daysSpan = data.length;
  // 2026-05-19 P1: 최신 confidence (high/medium/low) 뱃지 표시. API는 이미 confidence 컬럼 반환 중.
  const latestConfidence = data[data.length - 1]?.confidence ?? "low";
  const confidenceBadge: { label: string; cls: string } | null =
    latestConfidence === "high"
      ? { label: "✓ 신뢰 높음", cls: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300" }
      : latestConfidence === "medium"
        ? { label: "△ 신뢰 보통", cls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300" }
        : { label: "? 표본 부족", cls: "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400" };
  const baseTitle = priceSource === "reference"
    ? "다나와 · 번개 미개봉 추이"
    : `번개장터 시세 ${daysSpan}일 추이`;
  const title = baseTitle;
  const activeLabel = priceSource === "reference" ? "번개 미개봉 호가" : "번개장터 호가";
  const soldLabel = priceSource === "reference" ? "번개 미개봉 거래가" : "번개장터 거래가";
  const referenceLineY = showReferencePrice ? y(referencePrice as number) : null;
  const referenceLabelRectY = referenceLineY == null
    ? null
    : Math.max(5, Math.min(height - padBottom - 14, referenceLineY - 20));
  const referenceLabelTextY = referenceLabelRectY == null ? null : referenceLabelRectY + 10;

  return (
    <div className="rounded-md bg-white px-2 py-2 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          {title}
          {/* 2026-05-19 P1: 최신 confidence 뱃지. 사용자에게 시세 신뢰도 명시. */}
          {confidenceBadge ? (
            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${confidenceBadge.cls}`}>
              {confidenceBadge.label}
            </span>
          ) : null}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 justify-end">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-3 rounded bg-blue-500" />
            {activeLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-3 rounded bg-blue-500" />
            {soldLabel}
          </span>
          {showReferencePrice ? (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-[2px] w-3 bg-violet-500" style={{ borderTop: "2px dashed #8b5cf6", background: "transparent" }} />
              <span className="text-violet-600 dark:text-violet-300">다나와</span>
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-[2px] w-3 bg-red-500" style={{ borderTop: "2px dashed #ef4444", background: "transparent" }} />
            <span className="text-red-600 dark:text-red-400">내 매물</span>
          </span>
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 h-[150px] w-full overflow-visible">
        <style>
          {`
            @keyframes minyoiChartDraw {
              from { stroke-dashoffset: 1; }
              to { stroke-dashoffset: 0; }
            }
            @keyframes minyoiChartScaleX {
              from { opacity: 0.15; transform: scaleX(0); }
              to { opacity: 1; transform: scaleX(1); }
            }
            @keyframes minyoiChartPop {
              from { opacity: 0; transform: scale(0.72); }
              to { opacity: 1; transform: scale(1); }
            }
            .minyoi-chart-line {
              stroke-dasharray: 1;
              stroke-dashoffset: 1;
              animation: minyoiChartDraw 680ms ease-out forwards;
            }
            .minyoi-chart-line--sold { animation-delay: 120ms; }
            .minyoi-chart-price-line {
              transform-box: fill-box;
              transform-origin: left center;
              animation: minyoiChartScaleX 520ms ease-out forwards;
            }
            .minyoi-chart-pop {
              transform-box: fill-box;
              transform-origin: center;
              animation: minyoiChartPop 360ms ease-out both;
            }
            @media (prefers-reduced-motion: reduce) {
              .minyoi-chart-line,
              .minyoi-chart-price-line,
              .minyoi-chart-pop {
                animation: none !important;
                stroke-dashoffset: 0 !important;
                opacity: 1 !important;
                transform: none !important;
              }
            }
          `}
        </style>
        {/* y 가이드 */}
        <line x1={padX} y1={padTop} x2={padX} y2={height - padBottom} stroke="#e5e7eb" strokeWidth="0.5" />
        <line x1={padX} y1={height - padBottom} x2={width - padR} y2={height - padBottom} stroke="#e5e7eb" strokeWidth="0.5" />
        {/* min/max 라벨 */}
        <text x={4} y={padTop + 4} fontSize="9" fill="#9ca3af">{krwShort(maxP)}</text>
        <text x={4} y={height - padBottom} fontSize="9" fill="#9ca3af">{krwShort(minP)}</text>
        {/* 전체 기간 X축 라벨 — 거래가가 없는 왼쪽 구간도 어느 날짜인지 보이게 한다. */}
        {xAxisTicks.map((s) => {
          const xPos = x(s.i);
          return (
            <g key={s.date}>
              <line x1={xPos} y1={height - padBottom} x2={xPos} y2={height - padBottom + 3} stroke="#d1d5db" strokeWidth="0.75" />
              <text x={xPos} y={height - padBottom + 13} fontSize="9" fill="#9ca3af" textAnchor="middle">
                {shortDateLabel(s.date)}
              </text>
            </g>
          );
        })}
        {/* active 라인 (emerald) */}
        {activePath ? <path d={activePath} fill="none" stroke="#10b981" strokeWidth="1.5" pathLength={1} className="minyoi-chart-line" /> : null}
        {/* sold 라인 (blue) */}
        {soldPath ? <path d={soldPath} fill="none" stroke="#3b82f6" strokeWidth="1.5" pathLength={1} className="minyoi-chart-line minyoi-chart-line--sold" /> : null}
        {/* 거래가가 실제 관측된 날짜들. X축 라벨과 분리해 "전체 기간"과 "거래 관측일"을 혼동하지 않게 한다. */}
        {data.map((p, i) => p.sold != null ? (
          <circle key={`sold-${p.date}`} cx={x(i)} cy={y(p.sold)} r="2.5" fill="#3b82f6" stroke="white" strokeWidth="0.75" className="minyoi-chart-pop" style={{ animationDelay: `${180 + i * 24}ms` }} />
        ) : null)}
        {/* 현재 매물 가격 horizontal line — 가장 위에 그림 */}
        {showCurrentPrice ? (
          <line x1={padX} y1={y(currentPrice as number)} x2={width - padR} y2={y(currentPrice as number)} stroke="#ef4444" strokeWidth="2" strokeDasharray="4,3" className="minyoi-chart-price-line" style={{ animationDelay: "220ms" }} />
        ) : null}
        {showReferencePrice ? (
          <line x1={padX} y1={y(referencePrice as number)} x2={width - padR} y2={y(referencePrice as number)} stroke="#8b5cf6" strokeWidth="2" strokeDasharray="3,3" className="minyoi-chart-price-line" style={{ animationDelay: "260ms" }} />
        ) : null}

        {/* 우측 끝 라벨 — 호가(emerald) / 거래가(blue) / 내 매물(red) 각각 점 + 가격 박스 */}
        {latestActive != null ? (
          <>
            <circle cx={width - padR} cy={y(latestActive)} r="3" fill="#10b981" stroke="white" strokeWidth="1" className="minyoi-chart-pop" style={{ animationDelay: "360ms" }} />
            <text x={width - padR + 5} y={y(latestActive) + 3} fontSize="9" fill="#3182f6" fontWeight="bold">
              {krwShort(latestActive)}
            </text>
          </>
        ) : null}
        {latestSold != null ? (
          <>
            <circle cx={width - padR} cy={y(latestSold)} r="3" fill="#3b82f6" stroke="white" strokeWidth="1" className="minyoi-chart-pop" style={{ animationDelay: "420ms" }} />
            <text x={width - padR + 5} y={y(latestSold) + 3} fontSize="9" fill="#2563eb" fontWeight="bold">
              {krwShort(latestSold)}
            </text>
          </>
        ) : null}
        {showCurrentPrice ? (
          <>
            <circle cx={width - padR} cy={y(currentPrice as number)} r="3.5" fill="#ef4444" stroke="white" strokeWidth="1" className="minyoi-chart-pop" style={{ animationDelay: "460ms" }} />
            <rect x={width - padR + 3} y={y(currentPrice as number) - 7} width="50" height="13" rx="3" fill="#ef4444" className="minyoi-chart-pop" style={{ animationDelay: "480ms" }} />
            <text x={width - padR + 28} y={y(currentPrice as number) + 3} fontSize="9" fill="white" fontWeight="bold" textAnchor="middle" className="minyoi-chart-pop" style={{ animationDelay: "500ms" }}>
              {krwShort(currentPrice as number)}
            </text>
          </>
        ) : null}
        {showReferencePrice ? (
          <>
            <circle cx={width - padR} cy={referenceLineY as number} r="3.5" fill="#8b5cf6" stroke="white" strokeWidth="1" className="minyoi-chart-pop" style={{ animationDelay: "500ms" }} />
            <rect x={width - padR + 3} y={referenceLabelRectY as number} width="50" height="13" rx="3" fill="#8b5cf6" className="minyoi-chart-pop" style={{ animationDelay: "520ms" }} />
            <text x={width - padR + 28} y={referenceLabelTextY as number} fontSize="9" fill="white" fontWeight="bold" textAnchor="middle" className="minyoi-chart-pop" style={{ animationDelay: "540ms" }}>
              {krwShort(referencePrice as number)}
            </text>
          </>
        ) : null}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
        <span>
          {showReferencePrice ? `다나와 ${krwShort(referencePrice as number)}` : ""}
          {latestActive != null ? `${showReferencePrice ? " · " : ""}최근 ${activeLabel} ${krwShort(latestActive)}` : ""}
          {latestSold != null ? ` · 최근 ${soldLabel} ${krwShort(latestSold)}` : ""}
        </span>
        <span>
          {totalSoldCount > 0 ? `번개장터 거래 ${totalSoldCount}건 / 30일` : "번개장터 거래 0건 — 호가 추정"}
        </span>
      </div>
    </div>
  );
}
