"use client";

import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isAdminUser } from "@/lib/auth-users";
import {
  RESELL_SHIPPING_FEE,
  SAFETY_BUFFER,
  SELLING_FEE_RATE,
  cashoutHint,
  compareCandidates,
  estimatedBuyCostGeneral,
  expectedProfitAverage,
  expectedProfitMax,
  expectedProfitMin,
  generalShippingFee,
  hasPrecisionRisk,
  hasShippingRange,
  isHighPrecisionCandidate,
  netGapAfterGeneralShipping,
  positiveSignals,
  profitBreakdown,
  reviewSignals,
  scoreLabel,
  sellingFee,
} from "@/lib/profit";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
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
type Filter = "precision" | "all" | "strong" | "interested" | "hold" | "review" | "hidden";
type ThemeMode = "system" | "light" | "dark";
type ProfitFloor = 0 | 10000 | 30000 | 50000;
type CategoryFilter = "all" | "airpods" | "applewatch" | "galaxywatch" | "laptop" | "smartphone";

const filters: { id: Filter; label: string }[] = [
  { id: "precision", label: "정밀 후보" },
  { id: "all", label: "전체" },
  { id: "strong", label: "고순익" },
  { id: "interested", label: "관심" },
  { id: "hold", label: "보류" },
  { id: "review", label: "검토필요" },
  { id: "hidden", label: "숨김" },
];

const profitFloors: { id: ProfitFloor; label: string }[] = [
  { id: 0, label: "전체" },
  { id: 10000, label: "1만+" },
  { id: 30000, label: "3만+" },
  { id: 50000, label: "5만+" },
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

function signedKrw(value: number) {
  return `+${Math.round(value).toLocaleString("ko-KR")}원`;
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
  return signedKrw(expectedProfitAverage(item));
}

function candidateImage(item: ListingCandidate) {
  return item.thumbnailUrl ?? null;
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
  if (hint === "빠름") return "text-blue-600 dark:text-blue-400";
  if (hint === "보통") return "text-sky-600 dark:text-sky-400";
  return "text-zinc-500";
}

function labelClass(label: CandidateBand) {
  if (label === "고순익 후보") return "bg-blue-100 text-blue-800 ring-blue-200";
  if (label === "순익 후보") return "bg-sky-100 text-sky-800 ring-sky-200";
  if (label === "검토필요") return "bg-amber-100 text-amber-800 ring-amber-200";
  if (label === "제외") return "bg-red-100 text-red-800 ring-red-200";
  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}

function barColor(value: number) {
  if (value >= 0.75) return "bg-blue-500";
  if (value >= 0.45) return "bg-sky-500";
  return "bg-zinc-400";
}

function statusLabel(status?: CandidateStatus) {
  if (status === "interested") return "관심";
  if (status === "hold") return "보류";
  if (status === "hidden") return "숨김";
  return "";
}

function statusClass(status?: CandidateStatus) {
  if (status === "interested") return "bg-blue-50 text-blue-800 ring-blue-200";
  if (status === "hold") return "bg-indigo-50 text-indigo-800 ring-indigo-200";
  if (status === "hidden") return "bg-zinc-100 text-zinc-600 ring-zinc-200";
  return "";
}

function AccentBar({ label }: { label: CandidateBand }) {
  if (label === "고순익 후보")
    return <div className="h-[3px] w-full flex-none bg-gradient-to-r from-blue-400 to-blue-600" />;
  if (label === "순익 후보")
    return <div className="h-[3px] w-full flex-none bg-gradient-to-r from-sky-400 to-sky-500" />;
  if (label === "검토필요")
    return <div className="h-[3px] w-full flex-none bg-gradient-to-r from-amber-400 to-amber-500" />;
  return <div className="h-[3px] w-full flex-none bg-zinc-200 dark:bg-zinc-700" />;
}

function loadActions(): CandidateActions {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CandidateActions) : {};
  } catch {
    return {};
  }
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
    <div className="flex rounded-lg border border-zinc-200 bg-white p-1 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-800">
      {[
        ["system", "시스템"],
        ["light", "라이트"],
        ["dark", "다크"],
      ].map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value as ThemeMode)}
          className={`rounded-md px-2.5 py-1.5 transition ${
            theme === value
              ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
              : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Navbar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUser(data.user ?? null);
    }).catch(() => undefined);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const admin = isAdminUser(user);

  return (
    <nav className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-sm font-black text-white shadow-md shadow-blue-500/30">
            M
          </div>
          <span className="font-black tracking-tight text-zinc-900 dark:text-white">득템잡이</span>
          <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:ring-blue-900">
            Beta
          </span>
        </div>
        <div className="flex items-center gap-3">
          {admin ? (
            <Link
              href="/debug"
              className="text-sm font-medium text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              운영 로그
            </Link>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

function CandidateImage({
  item,
  priority = false,
  className = "",
}: {
  item: ListingCandidate;
  priority?: boolean;
  className?: string;
}) {
  const src = candidateImage(item);
  return (
    <div className={`relative aspect-[4/3] overflow-hidden bg-zinc-100 dark:bg-zinc-800 ${className}`}>
      {src ? (
        <Image
          src={src}
          alt={item.name}
          fill
          sizes="(min-width: 1280px) 260px, (min-width: 768px) 33vw, 50vw"
          priority={priority}
          className="object-cover transition duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="flex h-full min-h-32 items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 text-xs font-semibold text-zinc-400 dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-600">
          이미지 대기
        </div>
      )}
    </div>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span className="font-semibold">{percent(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
        <div className={`h-full rounded-full transition-all ${barColor(value)}`} style={{ width: percent(value) }} />
      </div>
    </div>
  );
}

function SignalPills({ signals, tone }: { signals: CandidateSignal[]; tone: "good" | "watch" }) {
  if (signals.length === 0) return null;
  const className =
    tone === "good"
      ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-400"
      : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-400";

  return (
    <div className="flex flex-wrap gap-1.5">
      {signals.map((signal) => (
        <span
          key={`${signal.source}-${signal.label}`}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
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
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="text-sm font-bold text-zinc-950 dark:text-zinc-50">순익 계산</div>
      </div>
      <div className="space-y-2.5 p-4 text-sm">
        {[
          { label: "예상 판매가", value: krw(breakdown.expectedSalePrice), sign: "" },
          { label: "예상 구매비", value: buyCost, sign: "-" },
          { label: "판매 수수료", value: krw(breakdown.sellingFee), sign: "-" },
          { label: "재판매 배송비", value: krw(breakdown.resellShippingFee), sign: "-" },
          { label: "안전 버퍼", value: krw(breakdown.safetyBuffer), sign: "-" },
        ].map(({ label, value, sign }) => (
          <div key={label} className="flex justify-between gap-3">
            <span className="text-zinc-500">{label}</span>
            <span className="font-medium">{sign ? `${sign} ${value}` : value}</span>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-zinc-200 pt-2.5 dark:border-zinc-700">
          <span className="font-bold text-zinc-950 dark:text-zinc-50">예상 순익</span>
          <span className="font-bold text-blue-600 dark:text-blue-400">{profit}</span>
        </div>
      </div>
    </div>
  );
}

function AlertPreview({ item }: { item: ListingCandidate }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-6 text-zinc-100">
      <div className="text-blue-400">리셀갭 후보 발견</div>
      <div className="font-semibold">{item.name}</div>
      <br />
      <div>가격: {krw(item.price)}</div>
      <div>배송비: {shippingLabel(item)}</div>
      <div>예상 구매비: {buyCostLabel(item)}</div>
      {/* Wave 246 (2026-05-19): skuMedian=0 가드 — landing demo alert preview. */}
      <div>시세: {item.skuMedian && item.skuMedian > 0 ? krw(item.skuMedian) : "확인중"}</div>
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
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-zinc-950 dark:text-zinc-50">가격 추이</div>
            <div className="text-xs text-zinc-500">7~14일 데이터 누적 후 실제 그래프 연결</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500">현재 갭</div>
            <div className="font-bold text-zinc-950 dark:text-zinc-50">{percent(item.priceGap)}</div>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="flex h-20 items-end gap-1.5 border-b border-l border-zinc-200 px-2 pb-2 dark:border-zinc-700">
          {points.map((value, index) => (
            <div
              key={`${value}-${index}`}
              className="flex-1 rounded-t bg-zinc-200 dark:bg-zinc-700"
              style={{ height: `${Math.max(14, value * 100)}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-zinc-400">
          <span>과거</span>
          <span>현재</span>
        </div>
      </div>
    </div>
  );
}

function FilterPills<T extends string | number>({
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
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-bold text-zinc-400">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((item) => (
          <button
            key={String(item.id)}
            type="button"
            onClick={() => onChange(item.id)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
              value === item.id
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
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
  const [filter, setFilter] = useState<Filter>("precision");
  const [profitFloor, setProfitFloor] = useState<ProfitFloor>(0);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [selectedPid, setSelectedPid] = useState("");
  const [actions, setActions] = useState<CandidateActions>(() => {
    if (typeof window === "undefined") return {};
    return loadActions();
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  }, [actions]);

  useEffect(() => {
    if (!selectedPid) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedPid("");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedPid]);

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
      setSelectedPid("");
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
      const reviewNeeded = label === "검토필요" || label === "제외" || hasPrecisionRisk(item);
      if (filter !== "hidden" && action?.status === "hidden") return false;
      if (filter === "precision" && !isHighPrecisionCandidate(item)) return false;
      if (filter === "all" && label === "제외") return false;
      if (filter === "strong" && label !== "고순익 후보") return false;
      if (filter === "interested" && action?.status !== "interested") return false;
      if (filter === "hold" && action?.status !== "hold") return false;
      if (filter === "review" && !reviewNeeded) return false;
      if (filter === "hidden" && action?.status !== "hidden") return false;
      if (profitFloor > 0 && expectedProfitMax(item) < profitFloor) return false;
      if (categoryFilter !== "all" && categoryOf(item) !== categoryFilter) return false;
      return true;
    });
  }, [actions, candidates, categoryFilter, filter, profitFloor]);

  const selected = candidates.find((item) => item.pid === selectedPid) ?? null;
  const avgProfit = candidates.reduce((sum, item) => sum + expectedProfitMin(item), 0) / Math.max(1, candidates.length);
  const strongCount = candidates.filter((item) => scoreLabel(item) === "고순익 후보").length;
  const precisionCount = candidates.filter(isHighPrecisionCandidate).length;
  const precisionReviewCount = candidates.filter(hasPrecisionRisk).length;
  const interestedCount = Object.values(actions).filter((item) => item.status === "interested").length;
  const holdCount = Object.values(actions).filter((item) => item.status === "hold").length;
  const hiddenCount = Object.values(actions).filter((item) => item.status === "hidden").length;


  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#f4f6f8] dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">

          {/* Slim header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                오늘의 리셀갭 후보
              </h1>
              <p className="text-xs text-zinc-400">갱신 {generatedAt}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "후보", value: `${filtered.length}/${candidates.length}건` },
                { label: "정밀", value: `${precisionCount}건`, highlight: true },
                { label: "검토", value: `${precisionReviewCount}건` },
                { label: "평균 순익", value: compactKrw(avgProfit) },
                { label: "고순익", value: `${strongCount}건` },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="text-xs text-zinc-400">{label} </span>
                  <span className={`text-sm font-bold tabular-nums ${highlight ? "text-blue-600 dark:text-blue-400" : "text-zinc-800 dark:text-zinc-200"}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-zinc-200/80 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <FilterPills label="목록" value={filter} options={filters} onChange={setFilter} />
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 max-sm:hidden" />
            <FilterPills label="순익" value={profitFloor} options={profitFloors} onChange={setProfitFloor} />
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 max-sm:hidden" />
            <FilterPills label="카테고리" value={categoryFilter} options={categoryFilters} onChange={setCategoryFilter} />
          </section>

          {/* Status chips */}
          <section className="flex flex-wrap gap-2">
            {[
              { label: `관심 ${interestedCount}건`, cls: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-400" },
              { label: `보류 ${holdCount}건`, cls: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400" },
              { label: `숨김 ${hiddenCount}건`, cls: "border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400" },
            ].map(({ label, cls }) => (
              <span key={label} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${cls}`}>
                {label}
              </span>
            ))}
          </section>

          {/* Card grid */}
          <section className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((item, index) => {
              const label = scoreLabel(item);
              const action = actions[item.pid];
              const isPremium = label === "고순익 후보";
              return (
                <button
                  key={item.pid}
                  type="button"
                  onClick={() => setSelectedPid(item.pid)}
                  className={`group flex h-full flex-col overflow-hidden rounded-2xl border text-left transition-all duration-200 hover:-translate-y-1.5 ${
                    isPremium
                      ? "border-blue-200 bg-white shadow-lg shadow-blue-500/10 hover:border-blue-300 hover:shadow-2xl hover:shadow-blue-500/20 dark:border-blue-900/50 dark:bg-zinc-900 dark:shadow-blue-950/50 dark:hover:border-blue-800"
                      : "border-zinc-200/80 bg-white shadow-md hover:border-zinc-300 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                  }`}
                >
                  <AccentBar label={label} />

                  {/* Image block */}
                  <div className="relative flex-none overflow-hidden">
                    <CandidateImage item={item} priority={index < 6} className="aspect-[4/3] rounded-none" />

                    {/* Gradient overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-3 pt-12">
                      <div className="flex items-end justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-white/50">예상 순익</div>
                          <div className={`text-xl font-black leading-tight ${isPremium ? "text-blue-300" : "text-white"}`}>
                            {profitLabel(item)}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-black/60 px-2 py-1 text-xs font-bold text-white/80 backdrop-blur-sm">
                          #{index + 1}
                        </span>
                      </div>
                    </div>

                    {/* Label badge */}
                    <div className="absolute left-2 top-2">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ring-1 ${labelClass(label)}`}>
                        {label}
                      </span>
                    </div>

                    {/* Status badge */}
                    {action?.status ? (
                      <div className="absolute right-2 top-2">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ring-1 ${statusClass(action.status)}`}>
                          {statusLabel(action.status)}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* Card body */}
                  <div className="flex flex-1 flex-col gap-2.5 p-3">
                    <div>
                      <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {item.skuName}
                      </span>
                      <div className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-zinc-900 dark:text-zinc-100">
                        {item.name}
                      </div>
                    </div>

                    <div className="mt-auto flex items-end justify-between gap-2 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
                      <div>
                        <div className="text-[10px] font-medium text-zinc-400">매물가</div>
                        <div className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{compactKrw(item.price)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-medium text-zinc-400">시세갭</div>
                        <div className={`text-sm font-bold ${item.priceGap >= 0.15 ? "text-blue-600 dark:text-blue-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                          {percent(item.priceGap)}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </section>

          {/* Detail modal */}
          {selected ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6"
              role="dialog"
              aria-modal="true"
              onClick={() => setSelectedPid("")}
            >
              <div
                className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
                onClick={(event) => event.stopPropagation()}
              >
                {/* Modal header */}
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      리셀갭 상세
                    </div>
                    <div className="truncate text-sm font-bold text-zinc-950 dark:text-zinc-50">{selected.name}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPid("")}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    닫기
                  </button>
                </div>

                <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
                  {/* Left: image */}
                  <div className="bg-zinc-50 p-4 dark:bg-zinc-800/40 sm:p-6">
                    <CandidateImage item={selected} priority className="aspect-square rounded-xl" />
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                        <div className="text-xs text-zinc-400">찜</div>
                        <div className="font-bold">{selected.numFaved.toLocaleString("ko-KR")}개</div>
                      </div>
                      <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                        <div className="text-xs text-zinc-400">예상 현금화</div>
                        <div className={`font-bold ${cashoutHintClass(selected)}`}>{cashoutHint(selected)}</div>
                      </div>
                      <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                        <div className="text-xs text-zinc-400">안전도</div>
                        <div className="font-bold">{percent(selected.safety)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Right: details */}
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${labelClass(scoreLabel(selected))}`}>
                            {scoreLabel(selected)}
                          </span>
                          {actions[selected.pid]?.status ? (
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusClass(actions[selected.pid]?.status)}`}>
                              {statusLabel(actions[selected.pid]?.status)}
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-3 text-xl font-bold leading-7">{selected.name}</h2>
                        <div className="mt-1 text-sm text-zinc-500">{selected.skuName}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-3xl font-black text-blue-600 dark:text-blue-400">{profitLabel(selected)}</div>
                        <div className="text-xs text-zinc-400">예상 순익</div>
                      </div>
                    </div>

                    {hasPrecisionRisk(selected) ? (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                        <div className="font-bold">정밀도 낮음</div>
                        <div className="mt-1 text-xs leading-5">
                          같은 옵션 표본이 부족하거나 용량/칩/사이즈 파싱이 불확실합니다. 이런 후보는 기본 정밀 목록에서 제외하고 검토필요 탭에서만 확인합니다.
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-5 grid grid-cols-2 gap-2.5 text-sm">
                      {[
                        { label: "매물가", value: krw(selected.price) },
                        { label: "추정 시세", value: krw(selected.skuMedian) },
                        { label: "배송비", value: shippingLabel(selected) },
                        { label: "예상 구매비", value: buyCostLabel(selected) },
                        { label: "배송 후 갭", value: netGapLabel(selected) },
                        { label: "예상 현금화", value: cashoutHint(selected), cls: cashoutHintClass(selected) },
                      ].map(({ label, value, cls }) => (
                        <div key={label} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
                          <div className="text-xs text-zinc-400">{label}</div>
                          <div className={`mt-0.5 font-bold ${cls ?? ""}`}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 grid gap-3">
                      <MetricBar label="시세갭" value={selected.priceGap} />
                      <MetricBar label="관심도" value={selected.velocity} />
                      <MetricBar label="안전도" value={selected.safety} />
                    </div>

                    <div className="mt-5 grid gap-2.5">
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
                        <div className="text-sm font-bold">좋게 보는 이유</div>
                        <div className="mt-2.5">
                          <SignalPills signals={positiveSignals(selected)} tone="good" />
                          {positiveSignals(selected).length === 0 ? (
                            <div className="text-sm text-zinc-500">강한 긍정 신호는 아직 없음</div>
                          ) : null}
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
                        <div className="text-sm font-bold">확인할 점</div>
                        <div className="mt-2.5">
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

                    <div className="mt-4">
                      <ProfitBreakdown item={selected} />
                    </div>

                    <p className="mt-4 max-h-32 overflow-auto rounded-xl bg-zinc-50 p-3 text-sm leading-6 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
                      {selected.descriptionPreview}
                    </p>

                    <div className="mt-4">
                      <AlertPreview item={selected} />
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setStatus(selected.pid, "interested")}
                        className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-bold text-blue-800 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-950/60"
                      >
                        관심
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus(selected.pid, "hold")}
                        className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm font-bold text-indigo-800 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/60"
                      >
                        보류
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus(selected.pid, "hidden")}
                        className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        숨기기
                      </button>
                    </div>

                    {actions[selected.pid]?.status ? (
                      <button
                        type="button"
                        onClick={() => clearStatus(selected.pid)}
                        className="mt-2 w-full rounded-xl px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                      >
                        상태 해제
                      </button>
                    ) : null}

                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => logOpen(selected.pid)}
                      className="mt-4 block rounded-xl bg-blue-600 px-4 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 hover:shadow-blue-500/30"
                    >
                      번개장터에서 보기
                    </a>

                    <div className="mt-4 text-xs leading-5 text-zinc-400">
                      배송비 출처: {selected.shippingSource} · 수수료 {Math.round(SELLING_FEE_RATE * 1000) / 10}% (
                      {krw(sellingFee(selected))}) · 재배송 {krw(RESELL_SHIPPING_FEE)} · 버퍼 {krw(SAFETY_BUFFER)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
