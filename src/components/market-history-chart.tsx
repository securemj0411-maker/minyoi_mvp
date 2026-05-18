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

export default function MarketHistoryChart({
  comparableKey,
  currentPrice,
  conditionClass,
  lazy = false,
}: {
  comparableKey: string | null;
  currentPrice?: number | null;
  conditionClass?: string | null;
  // 2026-05-16 (사용자 코멘트): admin pool 처럼 한 페이지에 chart 10+ 개면 rate limit (30/60s/IP) 즉시 초과.
  // lazy=true → "시세 보기" 버튼 클릭 시만 fetch. admin-pool-browser 에서 사용.
  lazy?: boolean;
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
    // 2026-05-16 (사용자 코멘트 id 105): cc 옵션으로 condition_class 매칭 데이터만 fetch.
    const ccQuery = conditionClass ? `&cc=${encodeURIComponent(conditionClass)}` : "";
    fetch(`/api/market/history?ck=${encodeURIComponent(comparableKey)}&days=30${ccQuery}`, { cache: "no-store" })
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
  }, [comparableKey, conditionClass, opened]);

  if (!comparableKey) {
    return <div className="rounded-md bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">모델 분류 미완료 — 시세 그래프 없음</div>;
  }
  if (lazy && !opened) {
    return (
      <button
        type="button"
        onClick={() => setOpened(true)}
        className="w-full rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
      >
        📊 시세 30일 추이 보기
      </button>
    );
  }
  if (loading) {
    return <ChartSkeleton />;
  }
  if (error) {
    // 2026-05-16: rate limit 429 친절한 메시지로 변환. 외부 시스템 노출 차단.
    const friendly = error.includes("429") ? "잠시 후 다시 시도해주세요 (요청 너무 빠름)" : "시세 history 불러오기 실패";
    return <div className="rounded-md bg-red-50 px-3 py-2 text-[11px] text-red-700">{friendly}</div>;
  }
  if (!data || data.length === 0) {
    return <div className="rounded-md bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">시세 누적 중 — 아직 history 없어요 (매물 처음 등록)</div>;
  }
  // 2026-05-17 fix: 임계값 3 → 2 낮춤. 시스템 fresh start (5/16) 라 history 누적
  // 부족 — 사용자 대다수 매물 "그래프 없음" 텍스트만 봄. 2 점이면 라인 가능.
  // data.length === 1 (단일 시점) 만 텍스트 fallback.
  if (data.length < 2) {
    return (
      <div className="rounded-md bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        시세 누적 1일째 — 내일부터 추이 그래프 자동 표시
      </div>
    );
  }

  // 좌표 계산. 우측은 가격 라벨 공간 확보 위해 padR 더 크게.
  // 하단 padBottom은 sold 날짜 X축 라벨 공간.
  const width = 360;
  const height = 150;
  const padX = 28;
  const padR = 60;
  const padTop = 14;
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

  if (allPrices.length === 0) {
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

  const activePath = data
    .map((p, i) => (p.active != null ? `${i === 0 ? "M" : "L"}${x(i)},${y(p.active)}` : null))
    .filter(Boolean)
    .join(" ");
  const soldPath = data
    .map((p, i) => (p.sold != null ? `${i === 0 ? "M" : "L"}${x(i)},${y(p.sold)}` : null))
    .filter(Boolean)
    .join(" ");

  const latestActive = data[data.length - 1]?.active;
  const latestSold = data[data.length - 1]?.sold;
  const totalSoldCount = data.reduce((sum, p) => sum + p.soldCount, 0);

  return (
    <div className="rounded-md bg-white px-2 py-2 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
        <span>시세 30일 추이</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 justify-end">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-3 rounded bg-emerald-500" />
            호가
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-3 rounded bg-blue-500" />
            거래가
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-[2px] w-3 bg-red-500" style={{ borderTop: "2px dashed #ef4444", background: "transparent" }} />
            <span className="text-red-600 dark:text-red-400">내 매물</span>
          </span>
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 h-[150px] w-full">
        {/* y 가이드 */}
        <line x1={padX} y1={padTop} x2={padX} y2={height - padBottom} stroke="#e5e7eb" strokeWidth="0.5" />
        <line x1={padX} y1={height - padBottom} x2={width - padR} y2={height - padBottom} stroke="#e5e7eb" strokeWidth="0.5" />
        {/* min/max 라벨 */}
        <text x={4} y={padTop + 4} fontSize="9" fill="#9ca3af">{krwShort(maxP)}</text>
        <text x={4} y={height - padBottom} fontSize="9" fill="#9ca3af">{krwShort(minP)}</text>
        {/* 거래 날짜 X축 라벨 — sold 있는 날만 표시 (호가는 매일 누적이라 의미 X) */}
        {(() => {
          const soldDays = data
            .map((p, i) => (p.sold != null ? { i, date: p.date } : null))
            .filter((v): v is { i: number; date: string } => v !== null);
          // 너무 많으면 일부만 (균등 sampling, max 6개)
          const maxLabels = 6;
          const shown = soldDays.length <= maxLabels
            ? soldDays
            : soldDays.filter((_, idx) => idx % Math.ceil(soldDays.length / maxLabels) === 0).slice(0, maxLabels);
          return shown.map((s) => {
            const xPos = x(s.i);
            const month = Number(s.date.slice(5, 7));
            const day = Number(s.date.slice(8, 10));
            return (
              <g key={s.date}>
                <line x1={xPos} y1={height - padBottom} x2={xPos} y2={height - padBottom + 3} stroke="#3b82f6" strokeWidth="1" />
                <text x={xPos} y={height - padBottom + 13} fontSize="9" fill="#3b82f6" textAnchor="middle">
                  {month}/{day}
                </text>
              </g>
            );
          });
        })()}
        {/* active 라인 (emerald) */}
        {activePath ? <path d={activePath} fill="none" stroke="#10b981" strokeWidth="1.5" /> : null}
        {/* sold 라인 (blue) */}
        {soldPath ? <path d={soldPath} fill="none" stroke="#3b82f6" strokeWidth="1.5" /> : null}
        {/* 현재 매물 가격 horizontal line — 가장 위에 그림 */}
        {showCurrentPrice ? (
          <line x1={padX} y1={y(currentPrice as number)} x2={width - padR} y2={y(currentPrice as number)} stroke="#ef4444" strokeWidth="2" strokeDasharray="4,3" />
        ) : null}

        {/* 우측 끝 라벨 — 호가(emerald) / 거래가(blue) / 내 매물(red) 각각 점 + 가격 박스 */}
        {latestActive != null ? (
          <>
            <circle cx={width - padR} cy={y(latestActive)} r="3" fill="#10b981" stroke="white" strokeWidth="1" />
            <text x={width - padR + 5} y={y(latestActive) + 3} fontSize="9" fill="#059669" fontWeight="bold">
              {krwShort(latestActive)}
            </text>
          </>
        ) : null}
        {latestSold != null ? (
          <>
            <circle cx={width - padR} cy={y(latestSold)} r="3" fill="#3b82f6" stroke="white" strokeWidth="1" />
            <text x={width - padR + 5} y={y(latestSold) + 3} fontSize="9" fill="#2563eb" fontWeight="bold">
              {krwShort(latestSold)}
            </text>
          </>
        ) : null}
        {showCurrentPrice ? (
          <>
            <circle cx={width - padR} cy={y(currentPrice as number)} r="3.5" fill="#ef4444" stroke="white" strokeWidth="1" />
            <rect x={width - padR + 3} y={y(currentPrice as number) - 7} width="50" height="13" rx="3" fill="#ef4444" />
            <text x={width - padR + 28} y={y(currentPrice as number) + 3} fontSize="9" fill="white" fontWeight="bold" textAnchor="middle">
              {krwShort(currentPrice as number)}
            </text>
          </>
        ) : null}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
        <span>
          {latestActive != null ? `최근 호가 ${krwShort(latestActive)}` : ""}
          {latestSold != null ? ` · 최근 거래가 ${krwShort(latestSold)}` : ""}
        </span>
        <span>
          {totalSoldCount > 0 ? `총 거래 ${totalSoldCount}건 / 30일` : "거래 0건 — 호가 추정"}
        </span>
      </div>
    </div>
  );
}
