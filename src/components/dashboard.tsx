"use client";

import { useEffect, useMemo, useState } from "react";
import {
  RESELL_SHIPPING_FEE,
  SAFETY_BUFFER,
  SELLING_FEE_RATE,
  cashoutHint,
  compareCandidates,
  estimatedBuyCostGeneral,
  expectedProfitMax,
  expectedProfitMin,
  generalShippingFee,
  hasShippingRange,
  netGapAfterGeneralShipping,
  positiveSignals,
  profitBreakdown,
  reviewSignals,
  scoreLabel,
  sellingFee,
} from "@/lib/profit";
import type { CandidateBand, CandidateSignal, ListingCandidate } from "@/lib/types";

type Props = {
  generatedAt: string;
  candidates: ListingCandidate[];
};

type CandidateStatus = "interested" | "hold" | "hidden";
type CandidateAction = {
  status?: CandidateStatus;
  openedCount: number;
  updatedAt?: string;
};
type CandidateActions = Record<string, CandidateAction>;
type Filter = "all" | "strong" | "interested" | "hold" | "review" | "hidden";

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "strong", label: "고순익 후보" },
  { id: "interested", label: "관심" },
  { id: "hold", label: "보류" },
  { id: "review", label: "검토필요" },
  { id: "hidden", label: "숨김" },
];

const STORAGE_KEY = "minyoi-candidate-actions-v1";
function krw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function shippingLabel(item: ListingCandidate) {
  if (!hasShippingRange(item)) return krw(item.shippingFee);
  return `최저 ${krw(item.shippingFee)} / 일반 ${krw(generalShippingFee(item))}`;
}

function buyCostLabel(item: ListingCandidate) {
  if (!hasShippingRange(item)) return krw(item.estimatedBuyCost);
  return `${krw(item.estimatedBuyCost)} ~ ${krw(estimatedBuyCostGeneral(item))}`;
}

function netGapLabel(item: ListingCandidate) {
  if (!hasShippingRange(item)) return krw(item.netGapAfterShipping);
  return `${krw(netGapAfterGeneralShipping(item))} ~ ${krw(item.netGapAfterShipping)}`;
}

function profitLabel(item: ListingCandidate) {
  const min = expectedProfitMin(item);
  const max = expectedProfitMax(item);
  if (min === max) return krw(max);
  return `${krw(min)} ~ ${krw(max)}`;
}

function cashoutHintClass(item: ListingCandidate) {
  const hint = cashoutHint(item);
  if (hint === "빠름") return "text-emerald-700";
  if (hint === "보통") return "text-sky-700";
  return "text-zinc-600";
}

function labelClass(label: CandidateBand) {
  if (label === "고순익 후보") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (label === "순익 후보") return "bg-sky-100 text-sky-800 ring-sky-200";
  if (label === "검토필요") return "bg-amber-100 text-amber-800 ring-amber-200";
  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function barColor(value: number) {
  if (value >= 0.75) return "bg-emerald-500";
  if (value >= 0.45) return "bg-sky-500";
  return "bg-zinc-400";
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span>{percent(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
        <div className={`h-full rounded-full ${barColor(value)}`} style={{ width: percent(value) }} />
      </div>
    </div>
  );
}

function AlertPreview({ item }: { item: ListingCandidate }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-950 p-4 font-mono text-xs leading-6 text-zinc-100">
      <div>🔥 리셀갭 후보 발견</div>
      <div>{item.name}</div>
      <br />
      <div>가격: {krw(item.price)}</div>
      <div>배송비: {shippingLabel(item)}</div>
      <div>예상 구매비: {buyCostLabel(item)}</div>
      <div>시세: {krw(item.skuMedian)}</div>
      <div>배송 후 갭: {netGapLabel(item)}</div>
      <div>예상 순익: {profitLabel(item)}</div>
      <div>시세갭: {percent(item.priceGap)}</div>
      <div>관심도: {item.velocity >= 0.75 ? "상위권" : "보통"}</div>
      <div>예상 현금화: {cashoutHint(item)}</div>
      <br />
      <div>바로 보기: {item.url}</div>
    </div>
  );
}

function loadActions(): CandidateActions {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CandidateActions) : {};
  } catch {
    return {};
  }
}

function statusLabel(status?: CandidateStatus) {
  if (status === "interested") return "관심";
  if (status === "hold") return "보류";
  if (status === "hidden") return "숨김";
  return "";
}

function statusClass(status?: CandidateStatus) {
  if (status === "interested") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (status === "hold") return "bg-indigo-50 text-indigo-800 ring-indigo-200";
  if (status === "hidden") return "bg-zinc-100 text-zinc-600 ring-zinc-200";
  return "";
}

function SignalPills({ signals, tone }: { signals: CandidateSignal[]; tone: "good" | "watch" }) {
  if (signals.length === 0) return null;
  const className =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div className="flex flex-wrap gap-1.5">
      {signals.map((signal) => (
        <span key={`${signal.source}-${signal.label}`} className={`rounded-full border px-2 py-1 text-xs font-medium ${className}`}>
          {signal.label}
        </span>
      ))}
    </div>
  );
}

function ReasonSummary({ item }: { item: ListingCandidate }) {
  const good = positiveSignals(item).slice(0, 3);
  const watch = reviewSignals(item).slice(0, 2);

  return (
    <div className="mt-4 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="text-xs font-semibold text-zinc-500">판단 근거</div>
      <SignalPills signals={good} tone="good" />
      <SignalPills signals={watch} tone="watch" />
      {good.length === 0 && watch.length === 0 ? (
        <div className="text-xs text-zinc-500">특이 신호 없음</div>
      ) : null}
    </div>
  );
}

function ProfitBreakdown({ item }: { item: ListingCandidate }) {
  const breakdown = profitBreakdown(item);
  const profit =
    breakdown.expectedProfitMin === breakdown.expectedProfitMax
      ? krw(breakdown.expectedProfitMax)
      : `${krw(breakdown.expectedProfitMin)} ~ ${krw(breakdown.expectedProfitMax)}`;
  const buyCost =
    breakdown.buyCostMin === breakdown.buyCostMax
      ? krw(breakdown.buyCostMax)
      : `${krw(breakdown.buyCostMin)} ~ ${krw(breakdown.buyCostMax)}`;

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="text-sm font-semibold text-zinc-950">순익 계산</div>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-zinc-500">예상 판매가</span>
          <span className="font-medium">{krw(breakdown.expectedSalePrice)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-zinc-500">예상 구매비</span>
          <span className="font-medium">- {buyCost}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-zinc-500">판매 수수료</span>
          <span className="font-medium">- {krw(breakdown.sellingFee)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-zinc-500">재판매 배송비</span>
          <span className="font-medium">- {krw(breakdown.resellShippingFee)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-zinc-500">안전 버퍼</span>
          <span className="font-medium">- {krw(breakdown.safetyBuffer)}</span>
        </div>
        <div className="flex justify-between gap-3 border-t border-zinc-200 pt-2">
          <span className="font-semibold text-zinc-950">예상 순익</span>
          <span className="font-semibold text-emerald-700">{profit}</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ generatedAt, candidates }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedPid, setSelectedPid] = useState(candidates[0]?.pid ?? "");
  const [actions, setActions] = useState<CandidateActions>(() => {
    if (typeof window === "undefined") return {};
    return loadActions();
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  }, [actions]);

  function updateAction(pid: string, patch: Partial<CandidateAction>) {
    setActions((current) => ({
      ...current,
      [pid]: {
        ...current[pid],
        ...patch,
        openedCount: patch.openedCount ?? current[pid]?.openedCount ?? 0,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function setStatus(pid: string, status: CandidateStatus) {
    updateAction(pid, { status });
    if (status === "hidden" && selectedPid === pid) {
      const next = candidates.find((item) => item.pid !== pid && actions[item.pid]?.status !== "hidden");
      setSelectedPid(next?.pid ?? "");
    }
  }

  function clearStatus(pid: string) {
    setActions((current) => {
      const next = { ...current };
      const openedCount = next[pid]?.openedCount ?? 0;
      if (openedCount > 0) {
        next[pid] = { openedCount, updatedAt: new Date().toISOString() };
      } else {
        delete next[pid];
      }
      return next;
    });
  }

  function logOpen(pid: string) {
    updateAction(pid, { openedCount: (actions[pid]?.openedCount ?? 0) + 1 });
  }

  const filtered = useMemo(() => {
    return [...candidates].sort(compareCandidates).filter((item) => {
      const label = scoreLabel(item);
      const action = actions[item.pid];
      if (filter !== "hidden" && action?.status === "hidden") return false;
      if (filter === "strong") return label === "고순익 후보";
      if (filter === "interested") return action?.status === "interested";
      if (filter === "hold") return action?.status === "hold";
      if (filter === "review") return label === "검토필요";
      if (filter === "hidden") return action?.status === "hidden";
      return true;
    });
  }, [actions, candidates, filter]);

  const selected = filtered.find((item) => item.pid === selectedPid) ?? filtered[0] ?? candidates[0];
  const avgProfit = candidates.reduce((sum, item) => sum + expectedProfitMin(item), 0) / Math.max(1, candidates.length);
  const strongCount = candidates.filter((item) => scoreLabel(item) === "고순익 후보").length;
  const interestedCount = Object.values(actions).filter((item) => item.status === "interested").length;
  const holdCount = Object.values(actions).filter((item) => item.status === "hold").length;
  const hiddenCount = Object.values(actions).filter((item) => item.status === "hidden").length;
  const openedCount = Object.values(actions).filter((item) => item.openedCount > 0).length;

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">미뇨이 MVP v0</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
              오늘의 리셀갭 후보
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
              <div className="text-xs text-zinc-500">후보</div>
              <div className="font-semibold">{filtered.length}/{candidates.length}건</div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
              <div className="text-xs text-zinc-500">관심</div>
              <div className="font-semibold">{interestedCount}건</div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
              <div className="text-xs text-zinc-500">보류</div>
              <div className="font-semibold">{holdCount}건</div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
              <div className="text-xs text-zinc-500">바로가기</div>
              <div className="font-semibold">{openedCount}건</div>
            </div>
          </div>
        </header>

        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-1 rounded-md border border-zinc-200 bg-white p-1">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                  filter === item.id ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="text-sm text-zinc-500">
            마지막 갱신 {generatedAt} · 평균 순익 {krw(avgProfit)} · 고순익 {strongCount} · 숨김 {hiddenCount}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="grid gap-3">
            {filtered.map((item, index) => {
              const label = scoreLabel(item);
              const active = selected?.pid === item.pid;
              const action = actions[item.pid];
              return (
                <article
                  key={item.pid}
                  className={`rounded-md border bg-white p-4 text-left shadow-sm transition hover:border-zinc-400 ${
                    active ? "border-zinc-950 ring-2 ring-zinc-950/10" : "border-zinc-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedPid(item.pid)}
                    className="block w-full text-left"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-500">#{index + 1}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${labelClass(label)}`}>
                            {label}
                          </span>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                            {item.skuName}
                          </span>
                          {action?.status ? (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${statusClass(action.status)}`}>
                              {statusLabel(action.status)}
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-2 text-lg font-semibold leading-6 text-zinc-950">{item.name}</h2>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <div className="text-2xl font-semibold text-emerald-700 sm:text-3xl">{profitLabel(item)}</div>
                        <div className="text-xs text-zinc-500">예상 순익</div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div>
                        <div className="text-xs text-zinc-500">매물가</div>
                        <div className="font-semibold">{krw(item.price)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">배송비 최저</div>
                        <div className="font-semibold">{krw(item.shippingFee)}</div>
                        {hasShippingRange(item) ? (
                          <div className="text-xs text-zinc-500">일반 {krw(generalShippingFee(item))}</div>
                        ) : null}
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">예상 구매비</div>
                        <div className="font-semibold">{buyCostLabel(item)}</div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <div className="text-xs text-zinc-500">예상 순익</div>
                        <div className="font-semibold text-emerald-700">{profitLabel(item)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">추정 시세</div>
                        <div className="font-semibold">{krw(item.skuMedian)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">배송 후 갭</div>
                        <div className="font-semibold">{netGapLabel(item)}</div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <div className="text-xs text-zinc-500">찜</div>
                        <div className="font-semibold">{item.numFaved.toLocaleString("ko-KR")}개</div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">예상 현금화</div>
                        <div className={`font-semibold ${cashoutHintClass(item)}`}>{cashoutHint(item)}</div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <MetricBar label="시세갭" value={item.priceGap} />
                      <MetricBar label="관심도" value={item.velocity} />
                      <MetricBar label="안전도" value={item.safety} />
                    </div>

                    <ReasonSummary item={item} />
                  </button>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setStatus(item.pid, "interested")}
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                          action?.status === "interested"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border-zinc-200 text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
                        }`}
                      >
                        관심
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus(item.pid, "hold")}
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                          action?.status === "hold"
                            ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                            : "border-zinc-200 text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
                        }`}
                      >
                        보류
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus(item.pid, "hidden")}
                        className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50"
                      >
                        숨기기
                      </button>
                      {action?.status ? (
                        <button
                          type="button"
                          onClick={() => clearStatus(item.pid)}
                          className="rounded-md px-3 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-800"
                        >
                          해제
                        </button>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPid(item.pid)}
                        className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50"
                      >
                        자세히 보기
                      </button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => logOpen(item.pid)}
                        className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                      >
                        번개장터 바로가기
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {selected ? (
            <aside className="h-fit rounded-md border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${labelClass(scoreLabel(selected))}`}>
                    {scoreLabel(selected)}
                  </div>
                  {actions[selected.pid]?.status ? (
                    <div className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${statusClass(actions[selected.pid]?.status)}`}>
                      {statusLabel(actions[selected.pid]?.status)}
                    </div>
                  ) : null}
                  <h2 className="mt-3 text-xl font-semibold leading-7">{selected.name}</h2>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-semibold text-emerald-700">{profitLabel(selected)}</div>
                  <div className="text-xs text-zinc-500">예상 순익</div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-zinc-50 p-3">
                  <div className="text-xs text-zinc-500">매물가</div>
                  <div className="font-semibold">{krw(selected.price)}</div>
                </div>
                <div className="rounded-md bg-zinc-50 p-3">
                  <div className="text-xs text-zinc-500">시세</div>
                  <div className="font-semibold">{krw(selected.skuMedian)}</div>
                </div>
                <div className="rounded-md bg-zinc-50 p-3">
                  <div className="text-xs text-zinc-500">최저 배송비</div>
                  <div className="font-semibold">{krw(selected.shippingFee)}</div>
                </div>
                {hasShippingRange(selected) ? (
                  <div className="rounded-md bg-zinc-50 p-3">
                    <div className="text-xs text-zinc-500">일반 배송비</div>
                    <div className="font-semibold">{krw(generalShippingFee(selected))}</div>
                  </div>
                ) : null}
                <div className="rounded-md bg-zinc-50 p-3">
                  <div className="text-xs text-zinc-500">예상 구매비</div>
                  <div className="font-semibold">{buyCostLabel(selected)}</div>
                </div>
                <div className="rounded-md bg-zinc-50 p-3">
                  <div className="text-xs text-zinc-500">배송 후 갭</div>
                  <div className="font-semibold">{netGapLabel(selected)}</div>
                </div>
                <div className="rounded-md bg-emerald-50 p-3">
                  <div className="text-xs text-emerald-700">예상 순익</div>
                  <div className="font-semibold text-emerald-800">{profitLabel(selected)}</div>
                </div>
                <div className="rounded-md bg-zinc-50 p-3">
                  <div className="text-xs text-zinc-500">리뷰</div>
                  <div className="font-semibold">
                    {selected.reviewRating || "-"} / {selected.reviewCount}
                  </div>
                </div>
                <div className="rounded-md bg-zinc-50 p-3">
                  <div className="text-xs text-zinc-500">예상 현금화</div>
                  <div className={`font-semibold ${cashoutHintClass(selected)}`}>{cashoutHint(selected)}</div>
                </div>
                <div className="rounded-md bg-zinc-50 p-3">
                  <div className="text-xs text-zinc-500">위험 신호</div>
                  <div className="font-semibold">{selected.riskHits}개</div>
                </div>
                <div className="rounded-md bg-zinc-50 p-3">
                  <div className="text-xs text-zinc-500">리셀갭 점수</div>
                  <div className="font-semibold">{Math.round(selected.score)}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-zinc-500">
                배송비 출처: {selected.shippingSource} · 카드 계산은 최저 배송비 기준
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                순익 가정: 판매 수수료 {Math.round(SELLING_FEE_RATE * 1000) / 10}% (
                {krw(sellingFee(selected))}) · 재배송 {krw(RESELL_SHIPPING_FEE)} · 버퍼 {krw(SAFETY_BUFFER)}
              </div>

              <div className="mt-5">
                <ProfitBreakdown item={selected} />
              </div>

              <div className="mt-5 space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
                <div>
                  <div className="text-sm font-semibold text-zinc-950">좋게 보는 이유</div>
                  <div className="mt-2">
                    <SignalPills signals={positiveSignals(selected)} tone="good" />
                    {positiveSignals(selected).length === 0 ? (
                      <div className="text-sm text-zinc-500">강한 긍정 신호는 아직 없음</div>
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-950">확인할 점</div>
                  <div className="mt-2">
                    <SignalPills signals={reviewSignals(selected)} tone="watch" />
                    {reviewSignals(selected).length === 0 ? (
                      <div className="text-sm text-zinc-500">검토 신호 없음</div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <MetricBar label="시세갭" value={selected.priceGap} />
                <MetricBar label="관심도" value={selected.velocity} />
                <MetricBar label="안전도" value={selected.safety} />
              </div>

              {selected.scoreFlags.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {selected.scoreFlags.map((flag) => (
                    <span key={flag} className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                      {flag}
                    </span>
                  ))}
                </div>
              ) : null}

              <p className="mt-5 max-h-36 overflow-auto rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
                {selected.descriptionPreview}
              </p>

              <div className="mt-5">
                <AlertPreview item={selected} />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus(selected.pid, "interested")}
                  className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                >
                  관심
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(selected.pid, "hold")}
                  className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 transition hover:bg-indigo-100"
                >
                  보류
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(selected.pid, "hidden")}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  숨기기
                </button>
              </div>

              <a
                href={selected.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => logOpen(selected.pid)}
                className="mt-5 block rounded-md bg-zinc-950 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                번개장터에서 보기
              </a>
            </aside>
          ) : null}
        </section>
      </div>
    </main>
  );
}
