"use client";

import Link from "next/link";
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
type ThemeMode = "system" | "light" | "dark";
type ProfitFloor = 0 | 10000 | 30000 | 50000;
type CategoryFilter = "all" | "airpods" | "applewatch" | "galaxywatch" | "laptop" | "smartphone";

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "strong", label: "고순익" },
  { id: "interested", label: "관심" },
  { id: "hold", label: "보류" },
  { id: "review", label: "검토필요" },
  { id: "hidden", label: "숨김" },
];

const profitFloors: { id: ProfitFloor; label: string }[] = [
  { id: 0, label: "전체" },
  { id: 10000, label: "1만원+" },
  { id: 30000, label: "3만원+" },
  { id: 50000, label: "5만원+" },
];

const categoryFilters: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "airpods", label: "AirPods" },
  { id: "applewatch", label: "Apple Watch" },
  { id: "galaxywatch", label: "Galaxy Watch" },
  { id: "laptop", label: "Laptop" },
  { id: "smartphone", label: "Phone" },
];

const STORAGE_KEY = "minyoi-candidate-actions-v1";
const THEME_STORAGE_KEY = "minyoi-theme-v1";

function krw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function compactKrw(value: number) {
  const rounded = Math.round(value / 1000);
  return `${rounded.toLocaleString("ko-KR")}천원`;
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

function categoryOf(item: ListingCandidate): CategoryFilter {
  const sku = item.skuName.toLowerCase();
  if (sku.includes("galaxy watch")) return "galaxywatch";
  if (sku.includes("apple watch")) return "applewatch";
  if (sku.includes("macbook")) return "laptop";
  if (sku.includes("iphone") || sku.includes("galaxy s")) return "smartphone";
  if (sku.includes("airpods")) return "airpods";
  return "all";
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
  if (label === "제외") return "bg-red-100 text-red-800 ring-red-200";
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

function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

function loadTheme(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    return "system";
  }
  return "system";
}

function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    return loadTheme();
  });

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);

    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <div className="flex rounded-md border border-zinc-200 bg-white p-1 text-xs font-semibold">
      {[
        ["system", "시스템"],
        ["light", "라이트"],
        ["dark", "다크"],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value as ThemeMode)}
          className={`rounded px-2.5 py-1.5 transition ${
            theme === value ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
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
        <span
          key={`${signal.source}-${signal.label}`}
          className={`rounded-full border px-2 py-1 text-xs font-medium ${className}`}
        >
          {signal.label}
        </span>
      ))}
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

function AlertPreview({ item }: { item: ListingCandidate }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-950 p-4 font-mono text-xs leading-6 text-zinc-100">
      <div>리셀갭 후보 발견</div>
      <div>{item.name}</div>
      <br />
      <div>가격: {krw(item.price)}</div>
      <div>배송비: {shippingLabel(item)}</div>
      <div>예상 구매비: {buyCostLabel(item)}</div>
      <div>시세: {krw(item.skuMedian)}</div>
      <div>배송 후 갭: {netGapLabel(item)}</div>
      <div>예상 순익: {profitLabel(item)}</div>
      <div>예상 현금화: {cashoutHint(item)}</div>
      <br />
      <div>바로 보기: {item.url}</div>
    </div>
  );
}

function PriceHistoryPlaceholder({ item }: { item: ListingCandidate }) {
  const points = [0.62, 0.46, 0.52, 0.43, 0.55, 0.38, 0.49, 0.35, 0.41, 0.3];
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-950">가격 추이</div>
          <div className="text-xs text-zinc-500">7~14일 데이터 누적 후 실제 그래프 연결</div>
        </div>
        <div className="text-right text-xs text-zinc-500">
          현재 갭
          <div className="font-semibold text-zinc-950">{percent(item.priceGap)}</div>
        </div>
      </div>
      <div className="mt-5 flex h-24 items-end gap-1.5 border-b border-l border-zinc-200 px-2 pb-2">
        {points.map((value, index) => (
          <div
            key={`${value}-${index}`}
            className="flex-1 rounded-t bg-zinc-200"
            style={{ height: `${Math.max(14, value * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-zinc-500">
        <span>과거</span>
        <span>현재</span>
      </div>
    </div>
  );
}

function SegmentedControl<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-zinc-500">{label}</div>
      <div className="flex flex-wrap gap-1 rounded-md border border-zinc-200 bg-white p-1">
        {options.map((item) => (
          <button
            key={String(item.id)}
            type="button"
            onClick={() => onChange(item.id)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition ${
              value === item.id ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard({ generatedAt, candidates }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [profitFloor, setProfitFloor] = useState<ProfitFloor>(0);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
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
      if (filter === "all" && label === "제외") return false;
      if (filter === "strong" && label !== "고순익 후보") return false;
      if (filter === "interested" && action?.status !== "interested") return false;
      if (filter === "hold" && action?.status !== "hold") return false;
      if (filter === "review" && label !== "검토필요" && label !== "제외") return false;
      if (filter === "hidden" && action?.status !== "hidden") return false;
      if (profitFloor > 0 && expectedProfitMax(item) < profitFloor) return false;
      if (categoryFilter !== "all" && categoryOf(item) !== categoryFilter) return false;
      return true;
    });
  }, [actions, candidates, categoryFilter, filter, profitFloor]);

  const selected = filtered.find((item) => item.pid === selectedPid) ?? filtered[0] ?? candidates[0];
  const avgProfit = candidates.reduce((sum, item) => sum + expectedProfitMin(item), 0) / Math.max(1, candidates.length);
  const strongCount = candidates.filter((item) => scoreLabel(item) === "고순익 후보").length;
  const interestedCount = Object.values(actions).filter((item) => item.status === "interested").length;
  const holdCount = Object.values(actions).filter((item) => item.status === "hold").length;
  const hiddenCount = Object.values(actions).filter((item) => item.status === "hidden").length;
  const openedCount = Object.values(actions).filter((item) => item.openedCount > 0).length;

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">미뇨이 MVP v0</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
              리셀갭 후보 작업대
            </h1>
            <p className="mt-2 text-sm text-zinc-500">마지막 갱신 {generatedAt}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href="/debug"
                className="inline-flex rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400"
              >
                운영 로그
              </Link>
              <ThemeToggle />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
              <div className="text-xs text-zinc-500">후보</div>
              <div className="font-semibold">{filtered.length}/{candidates.length}건</div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
              <div className="text-xs text-zinc-500">평균 순익</div>
              <div className="font-semibold">{compactKrw(avgProfit)}</div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
              <div className="text-xs text-zinc-500">고순익</div>
              <div className="font-semibold">{strongCount}건</div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
              <div className="text-xs text-zinc-500">바로가기</div>
              <div className="font-semibold">{openedCount}건</div>
            </div>
          </div>
        </header>

        <section className="grid gap-3 rounded-md border border-zinc-200 bg-white p-3 xl:grid-cols-[1.4fr_1fr_1fr]">
          <SegmentedControl label="목록" value={filter} options={filters} onChange={setFilter} />
          <SegmentedControl label="최소 순익" value={profitFloor} options={profitFloors} onChange={setProfitFloor} />
          <SegmentedControl label="카테고리" value={categoryFilter} options={categoryFilters} onChange={setCategoryFilter} />
        </section>

        <section className="flex flex-wrap gap-2 text-xs text-zinc-500">
          <span className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5">관심 {interestedCount}건</span>
          <span className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5">보류 {holdCount}건</span>
          <span className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5">숨김 {hiddenCount}건</span>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <div className="grid grid-cols-[48px_minmax(240px,1fr)_128px_112px_92px_92px_116px] gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-500">
              <div>#</div>
              <div>매물</div>
              <div className="text-right">예상 순익</div>
              <div className="text-right">매입가</div>
              <div className="text-right">갭</div>
              <div className="text-right">현금화</div>
              <div className="text-right">액션</div>
            </div>
            <div className="divide-y divide-zinc-100">
              {filtered.map((item, index) => {
                const label = scoreLabel(item);
                const active = selected?.pid === item.pid;
                const action = actions[item.pid];
                return (
                  <button
                    key={item.pid}
                    type="button"
                    onClick={() => setSelectedPid(item.pid)}
                    className={`grid w-full grid-cols-[48px_minmax(240px,1fr)_128px_112px_92px_92px_116px] items-center gap-3 px-3 py-3 text-left transition hover:bg-zinc-50 ${
                      active ? "bg-emerald-50/60" : "bg-white"
                    }`}
                  >
                    <div className="text-sm font-semibold text-zinc-500">#{index + 1}</div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${labelClass(label)}`}>
                          {label}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                          {item.skuName}
                        </span>
                        {action?.status ? (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${statusClass(action.status)}`}>
                            {statusLabel(action.status)}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-zinc-950">{item.name}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        시세 {compactKrw(item.skuMedian)} · 찜 {item.numFaved.toLocaleString("ko-KR")} · 안전도 {percent(item.safety)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-semibold text-emerald-700">{profitLabel(item)}</div>
                      <div className="text-xs text-zinc-500">{scoreLabel(item) === "검토필요" ? "확인 필요" : "순익"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{compactKrw(item.price)}</div>
                      <div className="text-xs text-zinc-500">배송 {compactKrw(item.shippingFee)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{percent(item.priceGap)}</div>
                      <div className="text-xs text-zinc-500">{compactKrw(item.netGapAfterShipping)}</div>
                    </div>
                    <div className={`text-right text-sm font-semibold ${cashoutHintClass(item)}`}>
                      {cashoutHint(item)}
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <span className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600">
                        상세
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selected ? (
            <aside className="h-fit rounded-md border border-zinc-200 bg-white p-5 shadow-sm xl:sticky xl:top-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${labelClass(scoreLabel(selected))}`}>
                      {scoreLabel(selected)}
                    </span>
                    {actions[selected.pid]?.status ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${statusClass(actions[selected.pid]?.status)}`}>
                        {statusLabel(actions[selected.pid]?.status)}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-3 text-xl font-semibold leading-7">{selected.name}</h2>
                  <div className="mt-1 text-sm text-zinc-500">{selected.skuName}</div>
                </div>
                <div className="shrink-0 text-right">
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
                  <div className="text-xs text-zinc-500">추정 시세</div>
                  <div className="font-semibold">{krw(selected.skuMedian)}</div>
                </div>
                <div className="rounded-md bg-zinc-50 p-3">
                  <div className="text-xs text-zinc-500">배송비</div>
                  <div className="font-semibold">{shippingLabel(selected)}</div>
                </div>
                <div className="rounded-md bg-zinc-50 p-3">
                  <div className="text-xs text-zinc-500">예상 구매비</div>
                  <div className="font-semibold">{buyCostLabel(selected)}</div>
                </div>
                <div className="rounded-md bg-zinc-50 p-3">
                  <div className="text-xs text-zinc-500">배송 후 갭</div>
                  <div className="font-semibold">{netGapLabel(selected)}</div>
                </div>
                <div className="rounded-md bg-zinc-50 p-3">
                  <div className="text-xs text-zinc-500">예상 현금화</div>
                  <div className={`font-semibold ${cashoutHintClass(selected)}`}>{cashoutHint(selected)}</div>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <MetricBar label="시세갭" value={selected.priceGap} />
                <MetricBar label="관심도" value={selected.velocity} />
                <MetricBar label="안전도" value={selected.safety} />
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-sm font-semibold text-zinc-950">좋게 보는 이유</div>
                  <div className="mt-2">
                    <SignalPills signals={positiveSignals(selected)} tone="good" />
                    {positiveSignals(selected).length === 0 ? (
                      <div className="text-sm text-zinc-500">강한 긍정 신호는 아직 없음</div>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-sm font-semibold text-zinc-950">확인할 점</div>
                  <div className="mt-2">
                    <SignalPills signals={reviewSignals(selected)} tone="watch" />
                    {reviewSignals(selected).length === 0 ? (
                      <div className="text-sm text-zinc-500">검토 신호 없음</div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <PriceHistoryPlaceholder item={selected} />
              </div>

              <div className="mt-5">
                <ProfitBreakdown item={selected} />
              </div>

              <p className="mt-5 max-h-32 overflow-auto rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
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
              {actions[selected.pid]?.status ? (
                <button
                  type="button"
                  onClick={() => clearStatus(selected.pid)}
                  className="mt-2 w-full rounded-md px-3 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-800"
                >
                  상태 해제
                </button>
              ) : null}

              <a
                href={selected.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => logOpen(selected.pid)}
                className="mt-5 block rounded-md bg-zinc-950 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                번개장터에서 보기
              </a>

              <div className="mt-4 text-xs leading-5 text-zinc-500">
                배송비 출처: {selected.shippingSource} · 수수료 {Math.round(SELLING_FEE_RATE * 1000) / 10}% (
                {krw(sellingFee(selected))}) · 재배송 {krw(RESELL_SHIPPING_FEE)} · 버퍼 {krw(SAFETY_BUFFER)}
              </div>
            </aside>
          ) : null}
        </section>
      </div>
    </main>
  );
}
