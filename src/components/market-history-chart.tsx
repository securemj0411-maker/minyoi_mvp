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

export default function MarketHistoryChart({ comparableKey, currentPrice }: { comparableKey: string | null; currentPrice?: number | null }) {
  const [data, setData] = useState<Point[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!comparableKey) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/market/history?ck=${encodeURIComponent(comparableKey)}&days=30`, { cache: "no-store" })
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
  }, [comparableKey]);

  if (!comparableKey) {
    return <div className="rounded-md bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">모델 분류 미완료 — 시세 그래프 없음</div>;
  }
  if (loading) {
    return <div className="rounded-md bg-zinc-50 px-3 py-2 text-[11px] text-zinc-400 dark:bg-zinc-900">시세 history 불러오는 중…</div>;
  }
  if (error) {
    return <div className="rounded-md bg-red-50 px-3 py-2 text-[11px] text-red-700">시세 history 오류: {error}</div>;
  }
  if (!data || data.length === 0) {
    return <div className="rounded-md bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">시세 누적 중 — 아직 history 없어요 (매물 처음 등록)</div>;
  }
  if (data.length < 3) {
    return (
      <div className="rounded-md bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        시세 데이터 {data.length}일 — 3일 이상 누적되면 그래프 표시 (이후 자동 업데이트)
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
    if (p.active != null) allPrices.push(p.active);
    if (p.sold != null) allPrices.push(p.sold);
  }
  if (currentPrice != null) allPrices.push(currentPrice);

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
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 h-[130px] w-full">
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
        {currentPrice != null ? (
          <line x1={padX} y1={y(currentPrice)} x2={width - padR} y2={y(currentPrice)} stroke="#ef4444" strokeWidth="2" strokeDasharray="4,3" />
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
        {currentPrice != null ? (
          <>
            <circle cx={width - padR} cy={y(currentPrice)} r="3.5" fill="#ef4444" stroke="white" strokeWidth="1" />
            <rect x={width - padR + 3} y={y(currentPrice) - 7} width="50" height="13" rx="3" fill="#ef4444" />
            <text x={width - padR + 28} y={y(currentPrice) + 3} fontSize="9" fill="white" fontWeight="bold" textAnchor="middle">
              {krwShort(currentPrice)}
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
