"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import CreditIcon from "@/components/credit-icon";
import PackRevealModal, { type RevealResult } from "@/components/pack-reveal-modal";
import { loadClientCredits } from "@/lib/client-credits";
import { dispatchPackRevealsUpdated } from "@/lib/pack-events";
import { computeCostBreakdown, type CostFilters } from "@/lib/pack-cost";
import type { InventorySnapshot, PackBand, RevealFeedbackType, RevealListingDetail } from "@/lib/pack-open";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { getOrCreateUserRef, userRefForAuthUser } from "@/lib/user-ref";

type PackDef = {
  band: PackBand;
  cost: number;
  ctaTone: "sky" | "emerald" | "amber";
};

type PackOpenRequest = {
  pack: PackDef;
  requestedCards: number;
  tokenCost: number;
};

const MIN_REQUESTED_CARDS = 2;
const MAX_REQUESTED_CARDS = 30;
const MIN_PROFIT_MANWON = 1;
const MAX_PROFIT_MANWON = 10;
const HIGH_PROFIT_WARNING_SESSION_KEY = "minyoi-hide-high-profit-warning-v1";

// Wave 79: Risk preset (한국 부업/리셀러 현실 기반)
type RiskProfile = "safe" | "balanced" | "aggressive";
type AdvancedFilters = {
  priceMaxManwon: number; // 매물가 상한 (만원). 0 = 무제한
  minProfitManwon: number;
  minConfidencePct: number; // 0~100
  categories: string[]; // empty = 전체
  maxFreshHours: number; // 0 = 무제한
};
type RiskPreset = {
  band: PackBand;
  filters: AdvancedFilters;
  label: string;
  emoji: string;
  desc: string;
};
const RISK_PRESETS: Record<RiskProfile, RiskPreset> = {
  safe: {
    band: 1, label: "안전", emoji: "🛡️",
    desc: "≤15만 · 1만+ · 80%↑ · 입문자",
    filters: { priceMaxManwon: 15, minProfitManwon: 1, minConfidencePct: 80, categories: [], maxFreshHours: 1 },
  },
  balanced: {
    band: 2, label: "균형", emoji: "⚖️",
    desc: "≤30만 · 2만+ · 70%↑ · 주력 부업",
    filters: { priceMaxManwon: 30, minProfitManwon: 2, minConfidencePct: 70, categories: [], maxFreshHours: 2 },
  },
  aggressive: {
    band: 3, label: "공격", emoji: "⚔️",
    desc: "≤80만 · 5만+ · 60%↑ · 고수익",
    filters: { priceMaxManwon: 80, minProfitManwon: 5, minConfidencePct: 60, categories: [], maxFreshHours: 6 },
  },
};
const CATEGORY_OPTIONS = [
  { id: "earphone", label: "이어폰" },
  { id: "smartwatch", label: "워치(스마트)" },
  { id: "watch", label: "시계" },
  { id: "monitor", label: "모니터" },
  { id: "speaker", label: "스피커" },
  { id: "camera", label: "카메라" },
  { id: "desktop", label: "데스크탑" },
  { id: "laptop", label: "노트북" },
  { id: "tablet", label: "태블릿" },
  { id: "smartphone", label: "스마트폰" },
  { id: "game_console", label: "게임기" },
  { id: "home_appliance", label: "가전" },
  { id: "sport_golf", label: "골프" },
];

type PreviewInventoryResp = {
  band: PackBand | null;
  matchingCount: number;
  freshUnder2h: number;
  byCategory: Record<string, number>;
};

type PackOpenApiResult = (RevealResult & {
  tokensRemaining?: number;
  infiniteCredits?: boolean;
}) | {
  result: "error";
  message?: string;
  error?: string;
  tokensRefunded?: number;
  tokensRemaining?: number;
  infiniteCredits?: boolean;
};

const PACKS: PackDef[] = [
  {
    band: 1,
    cost: 1,
    ctaTone: "sky",
  },
  {
    band: 2,
    cost: 2,
    ctaTone: "emerald",
  },
  {
    band: 3,
    cost: 3,
    ctaTone: "amber",
  },
];

function packCardClasses(band: PackBand) {
  // Wave 72: dark variant은 별도 arbitrary linear-gradient로 박아야 적용됨.
  // 기존 dark:from-*/to-*는 bg-gradient-to-b 용이라 arbitrary bg-[linear-gradient]와 미호환 → 흰색 잔존.
  if (band === 3)
    return "border-[#ead8a7] bg-[linear-gradient(180deg,rgba(255,251,243,0.98)_0%,rgba(251,245,230,0.96)_100%)] shadow-[0_24px_60px_rgba(183,143,54,0.12)] hover:shadow-[0_28px_70px_rgba(183,143,54,0.18)] dark:border-amber-800/60 dark:bg-[linear-gradient(180deg,rgba(31,25,18,0.98)_0%,rgba(24,20,15,0.98)_100%)] dark:shadow-amber-950/40";
  if (band === 2)
    return "border-[#d8dccd] bg-[linear-gradient(180deg,rgba(255,251,243,0.98)_0%,rgba(247,243,233,0.98)_100%)] shadow-[0_24px_60px_rgba(63,99,67,0.10)] hover:shadow-[0_28px_70px_rgba(63,99,67,0.16)] dark:border-emerald-900/40 dark:bg-[linear-gradient(180deg,rgba(18,28,22,0.98)_0%,rgba(15,22,18,0.98)_100%)]";
  return "border-[#d8e4e2] bg-[linear-gradient(180deg,rgba(255,251,243,0.98)_0%,rgba(242,247,247,0.98)_100%)] shadow-[0_24px_60px_rgba(73,113,126,0.10)] hover:shadow-[0_28px_70px_rgba(73,113,126,0.16)] dark:border-sky-900/40 dark:bg-[linear-gradient(180deg,rgba(15,22,28,0.98)_0%,rgba(12,18,22,0.98)_100%)]";
}

function ctaClasses(tone: PackDef["ctaTone"], disabled: boolean) {
  const base = "w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition";
  if (disabled) return `${base} cursor-not-allowed bg-zinc-300 text-zinc-500 dark:bg-zinc-800`;
  if (tone === "amber")
    return `${base} bg-gradient-to-r from-[#b8742f] to-[#a56325] shadow-[0_16px_36px_rgba(184,116,47,0.28)] hover:from-[#a56325] hover:to-[#8f541d]`;
  if (tone === "emerald")
    return `${base} bg-gradient-to-r from-[#395542] to-[#2f4737] shadow-[0_16px_36px_rgba(47,71,55,0.28)] hover:from-[#2f4737] hover:to-[#24382b]`;
  return `${base} bg-gradient-to-r from-[#4c7280] to-[#3f6170] shadow-[0_16px_36px_rgba(63,97,112,0.24)] hover:from-[#3f6170] hover:to-[#324c59]`;
}

function rangeAccentClass(band: PackBand) {
  if (band === 3) return "accent-amber-500";
  if (band === 2) return "accent-emerald-500";
  return "accent-sky-500";
}

function bandForMinProfit(value: number): PackBand {
  if (value >= 7) return 3;
  if (value >= 4) return 2;
  return 1;
}

function selectableCardLimit(usableReady: number) {
  const capped = Math.min(MAX_REQUESTED_CARDS, Math.max(usableReady, MIN_REQUESTED_CARDS));
  return capped % 2 === 0 ? capped : capped - 1;
}

function clampRequestedCards(value: number, maxCards = MAX_REQUESTED_CARDS) {
  const rounded = Number.isFinite(value) ? Math.round(value) : MIN_REQUESTED_CARDS;
  const capped = Math.max(MIN_REQUESTED_CARDS, Math.min(maxCards, rounded));
  return capped % 2 === 0 ? capped : capped - 1;
}

function needsHighProfitWarning(pack: PackDef) {
  return pack.band === 3;
}

function CostBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#f3eee5] px-2.5 py-1 text-xs font-black tabular-nums text-[var(--brand-accent-strong)] ring-1 ring-[#d9e3d7]">
      <CreditIcon size={18} className="shrink-0 drop-shadow-[0_1px_1px_rgba(63,42,10,0.25)]" />
      <span>{value}</span>
    </span>
  );
}

function PackSelectorCard({
  selectedPack,
  selectedInventory,
  totalPoolReady,
  minProfitManwon: _minProfitManwon,
  requestedCards,
  tokens,
  infiniteCredits,
  onOpen,
  busy,
  inventoryLoading,
  isAuthenticated,
  onMinProfitChange,
  onRequestedCardsChange,
}: {
  selectedPack: PackDef;
  selectedInventory?: InventorySnapshot;
  totalPoolReady: number;
  minProfitManwon?: number;
  requestedCards: number;
  tokens: number;
  infiniteCredits: boolean;
  onOpen: (pack: PackDef, requestedCards: number, filters?: CostFilters | null) => void;
  busy: boolean;
  inventoryLoading: boolean;
  isAuthenticated: boolean;
  onMinProfitChange: (value: number) => void;
  onRequestedCardsChange: (requestedCards: number) => void;
}) {
  const [warningOpen, setWarningOpen] = useState(false);
  const [hideWarningForSession, setHideWarningForSession] = useState(false);
  // Wave 79: easy mode 제거 — 단일 통합 UI
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("balanced");
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(RISK_PRESETS.balanced.filters);
  const [previewInventory, setPreviewInventory] = useState<PreviewInventoryResp | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  // Risk preset 변경 시 filters + band 자동 적용
  function applyRiskPreset(profile: RiskProfile) {
    setRiskProfile(profile);
    setAdvancedFilters(RISK_PRESETS[profile].filters);
    onMinProfitChange(RISK_PRESETS[profile].filters.minProfitManwon);
  }

  // Inventory pre-check (debounced) — 항상 활성
  useEffect(() => {
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const params = new URLSearchParams();
        const band = RISK_PRESETS[riskProfile].band;
        params.set("band", String(band));
        if (advancedFilters.priceMaxManwon > 0) params.set("priceMax", String(advancedFilters.priceMaxManwon * 10000));
        if (advancedFilters.minProfitManwon > 0) params.set("minProfit", String(advancedFilters.minProfitManwon * 10000));
        if (advancedFilters.minConfidencePct > 0) params.set("minConfidence", String(advancedFilters.minConfidencePct / 100));
        if (advancedFilters.categories.length > 0) params.set("categories", advancedFilters.categories.join(","));
        if (advancedFilters.maxFreshHours > 0) params.set("maxFreshHours", String(advancedFilters.maxFreshHours));
        const res = await fetch(`/api/packs/preview-inventory?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setPreviewInventory(data);
        }
      } catch {} finally { setPreviewLoading(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [riskProfile, advancedFilters]);

  function toggleCategory(id: string) {
    setAdvancedFilters(f => ({
      ...f,
      categories: f.categories.includes(id) ? f.categories.filter(c => c !== id) : [...f.categories, id],
    }));
  }
  const usableReady = selectedInventory?.usableReady ?? 0;
  const maxSelectableCards = selectableCardLimit(usableReady);
  const selectedCount = clampRequestedCards(requestedCards, maxSelectableCards);
  // Wave 79: 단일 모드 — 항상 dynamic cost 적용
  const activeFilters: CostFilters = {
    minProfitManwon: advancedFilters.minProfitManwon,
    minConfidencePct: advancedFilters.minConfidencePct,
    priceMaxManwon: advancedFilters.priceMaxManwon,
  };
  const costBreakdown = computeCostBreakdown(selectedPack.band, selectedCount, activeFilters);
  const totalCost = costBreakdown.totalCost;
  const loginRequired = !isAuthenticated;
  const insufficient = !infiniteCredits && tokens < totalCost;
  const sold = !inventoryLoading && usableReady < MIN_REQUESTED_CARDS;
  const disabled = busy || inventoryLoading || loginRequired || insufficient || sold;

  function handleOpenClick() {
    if (disabled) return;
    if (needsHighProfitWarning(selectedPack)) {
      const dismissed = window.sessionStorage.getItem(HIGH_PROFIT_WARNING_SESSION_KEY) === "1";
      if (!dismissed) {
        setHideWarningForSession(false);
        setWarningOpen(true);
        return;
      }
    }
    onOpen(selectedPack, selectedCount, activeFilters);
  }

  function handleConfirmHighProfitSearch() {
    if (hideWarningForSession) {
      window.sessionStorage.setItem(HIGH_PROFIT_WARNING_SESSION_KEY, "1");
    }
    setWarningOpen(false);
    onOpen(selectedPack, selectedCount, activeFilters);
  }

  return (
    <>
    <div className={`w-full max-w-[460px] overflow-hidden rounded-[28px] border p-4 shadow-[0_18px_36px_rgba(34,49,39,0.08)] transition sm:p-4.5 ${packCardClasses(selectedPack.band)}`}>
      <div>
        <h2 className="text-xl font-black tracking-tight text-[#223127] dark:text-zinc-50 sm:text-2xl">
          AI 추천 상품 찾기
        </h2>
        <p className="mt-1 text-sm font-semibold text-[#6b7269] dark:text-zinc-400">
          프로필을 고르고 세부 조건은 슬라이더로 조정합니다.
        </p>
      </div>

      {/* Wave 79: 통합 UI — easy/advanced 토글 제거 */}
      <div className="mt-3 rounded-[24px] border border-[#e6dccf] bg-[#fffaf1] p-3 backdrop-blur dark:border-zinc-700/60 dark:bg-zinc-900/55">
        {/* Risk profile preset */}
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(RISK_PRESETS) as RiskProfile[]).map((profile) => {
            const preset = RISK_PRESETS[profile];
            const active = riskProfile === profile;
            return (
              <button
                key={profile}
                type="button"
                onClick={() => applyRiskPreset(profile)}
                className={`rounded-2xl border px-2 py-2 text-center transition ${active ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] text-[var(--brand-accent-strong)]" : "border-[#e0d6c5] bg-white text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"}`}
              >
                <div className="text-base leading-none">{preset.emoji}</div>
                <div className="mt-0.5 text-xs font-black">{preset.label}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 text-center text-[11px] text-[#7a8478] dark:text-zinc-500">{RISK_PRESETS[riskProfile].desc}</div>

        {/* 압축 슬라이더 그룹 — 4개 한 박스 */}
        <div className="mt-3 space-y-2.5 rounded-[18px] bg-[#f6efe4] p-3 dark:bg-zinc-950/40">
          {/* 매입가격 */}
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-[#59665b] dark:text-zinc-300">💰 매입가</span>
              <span className="font-black text-zinc-900 dark:text-zinc-50">
                {advancedFilters.priceMaxManwon === 0 ? "무제한" : `≤${advancedFilters.priceMaxManwon}만원`}
              </span>
            </div>
            <input
              type="range" min={0} max={150} step={5}
              value={advancedFilters.priceMaxManwon}
              onChange={(e) => setAdvancedFilters(f => ({ ...f, priceMaxManwon: Number(e.target.value) }))}
              disabled={busy}
              className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-[var(--brand-accent)] disabled:opacity-50 dark:bg-zinc-700"
            />
          </div>
          {/* 차익 */}
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-[#59665b] dark:text-zinc-300">💵 차익</span>
              <span className="font-black text-zinc-900 dark:text-zinc-50">{advancedFilters.minProfitManwon}만원+</span>
            </div>
            <input
              type="range" min={MIN_PROFIT_MANWON} max={MAX_PROFIT_MANWON} step={1}
              value={advancedFilters.minProfitManwon}
              onChange={(e) => {
                const v = Number(e.target.value);
                setAdvancedFilters(f => ({ ...f, minProfitManwon: v }));
                onMinProfitChange(v);
              }}
              disabled={busy}
              className={`mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 ${rangeAccentClass(selectedPack.band)} disabled:opacity-50 dark:bg-zinc-700`}
            />
          </div>
          {/* 신뢰도 */}
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-[#59665b] dark:text-zinc-300">🎯 신뢰도</span>
              <span className="font-black text-zinc-900 dark:text-zinc-50">{advancedFilters.minConfidencePct}%+</span>
            </div>
            <input
              type="range" min={50} max={95} step={5}
              value={advancedFilters.minConfidencePct}
              onChange={(e) => setAdvancedFilters(f => ({ ...f, minConfidencePct: Number(e.target.value) }))}
              disabled={busy}
              className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-[var(--brand-accent)] disabled:opacity-50 dark:bg-zinc-700"
            />
          </div>
        </div>

        {/* 카테고리 collapsible */}
        <button
          type="button"
          onClick={() => setShowCategories(s => !s)}
          className="mt-2 flex w-full items-center justify-between rounded-[16px] bg-[#f6efe4] px-3 py-2 text-xs font-black text-[#59665b] hover:bg-[#efe7d6] dark:bg-zinc-950/40 dark:text-zinc-300"
        >
          <span>📦 카테고리 {advancedFilters.categories.length === 0 ? "(전체)" : `(${advancedFilters.categories.length}개 선택)`}</span>
          <span className="text-[10px]">{showCategories ? "▲" : "▼"}</span>
        </button>
        {showCategories ? (
          <div className="mt-1.5 flex flex-wrap gap-1 rounded-[16px] bg-[#fbf7ef] p-2 dark:bg-zinc-950/30">
            {CATEGORY_OPTIONS.map((opt) => {
              const active = advancedFilters.categories.includes(opt.id);
              const count = previewInventory?.byCategory[opt.id];
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleCategory(opt.id)}
                  disabled={busy}
                  className={`rounded-full border px-2 py-0.5 text-[10.5px] font-black transition ${active ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] text-[var(--brand-accent-strong)]" : "border-[#d8d2c4] bg-white text-zinc-500 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"}`}
                >
                  {opt.label}{count ? <span className="ml-0.5 opacity-60">·{count}</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* 한눈에 보이는 결과: 매물 funnel + 토큰 비용 한 줄 */}
        <div className="mt-3 flex items-stretch gap-2">
          <div className="flex-1 rounded-[18px] border-2 border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] px-3 py-2.5 text-center">
            <div className="text-[10px] font-black text-[var(--brand-accent-strong)]">추천 가능 매물 → 내 조건</div>
            <div className="mt-1 flex items-baseline justify-center gap-1.5">
              <span className="text-sm font-bold text-[#5d735f]">
                {inventoryLoading ? "..." : `${totalPoolReady}`}
              </span>
              <span className="text-xs text-[#9aa893]" aria-hidden>
                →
              </span>
              <span className="text-xl font-black tracking-tight text-[var(--brand-accent-strong)]">
                {previewLoading ? "..." : previewInventory ? `${previewInventory.matchingCount}` : "-"}
              </span>
              <span className="text-[10px] font-bold text-[#5d735f]">건</span>
              {previewInventory && totalPoolReady > 0 && previewInventory.matchingCount > 0 ? (
                <span className="text-[10px] font-bold text-[var(--brand-accent-strong)]">
                  ({Math.max(1, Math.round((previewInventory.matchingCount / totalPoolReady) * 100))}%)
                </span>
              ) : null}
            </div>
            {previewInventory && previewInventory.matchingCount > 0 ? (
              <div className="mt-0.5 text-[9.5px] text-[#5d735f]">신선 {previewInventory.freshUnder2h}건</div>
            ) : previewInventory && previewInventory.matchingCount === 0 ? (
              <div className="mt-0.5 text-[9.5px] text-[#a04545]">조건 완화 권장</div>
            ) : null}
          </div>
          <div className="flex-1 rounded-[18px] border-2 border-[#caab78] bg-[#fff8ea] px-3 py-2.5 text-center dark:border-amber-900/60 dark:bg-amber-950/20">
            <div className="text-[10px] font-black text-[#7b5724] dark:text-amber-200">카드 1매</div>
            <div className="inline-flex items-baseline gap-0.5 text-xl font-black text-[#7b5724] dark:text-amber-200">
              {costBreakdown.perCardStep}<span className="text-[10px]">토큰</span>
            </div>
            <div className="text-[9.5px] text-[#9a7f4f] dark:text-amber-200/70">
              {costBreakdown.base}×{costBreakdown.profitMult}×{costBreakdown.confidenceMult}×{costBreakdown.priceMult}
            </div>
          </div>
        </div>

        {/* 자세한 정보 collapsible */}
        <details className="mt-2 rounded-[14px] bg-[#f6efe4] px-3 py-1.5 dark:bg-zinc-950/40">
          <summary className="cursor-pointer text-[10.5px] font-black text-[#59665b] dark:text-zinc-400">
            💡 자세한 정보
          </summary>
          <div className="mt-2 space-y-1 text-[10.5px] text-[#647064] dark:text-zinc-400">
            <div className="font-black text-[#3a4a3f] dark:text-zinc-300">계산식:</div>
            <div>· 기본 ({RISK_PRESETS[riskProfile].emoji} {RISK_PRESETS[riskProfile].label}): <b>{costBreakdown.base}</b></div>
            <div>· 차익 ×<b>{costBreakdown.profitMult}</b> · 신뢰도 ×<b>{costBreakdown.confidenceMult}</b> · 가격 ×<b>{costBreakdown.priceMult}</b></div>
            <div>= 카드 2매당 <b>{costBreakdown.perCardStep}</b> 토큰 (raw {costBreakdown.rawPerCardStep.toFixed(2)})</div>
            <div className="pt-1 text-[10px] text-zinc-500">현금화 일수 (회전): <span className="rounded-full bg-zinc-200 px-1.5 text-[9px] dark:bg-zinc-800">곧 활성화</span></div>
            <div className="pt-1 text-[10px] text-[#7a8478] dark:text-zinc-500">
              ⓘ AI 시세 추정. 수익 보장 X — 매입 협상·판매 시점·구성품에 따라 달라집니다.
            </div>
          </div>
        </details>
      </div>

      <div className="mt-3 rounded-[24px] border border-[#e6dccf] bg-[#fffaf1] p-3.5 backdrop-blur dark:border-zinc-700/60 dark:bg-zinc-900/55">
        <div className="space-y-2.5">
          <div className="rounded-[20px] bg-[#f6efe4] p-3 dark:bg-zinc-950/40">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-black text-[#59665b] dark:text-zinc-300">추천 상품 수</div>
                <div className="mt-1 text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                  {selectedCount}
                  <span className="ml-1 text-base text-zinc-500 dark:text-zinc-400">건</span>
                </div>
              </div>
            </div>

            <div className="mt-2.5">
              <input
                type="range"
                min={MIN_REQUESTED_CARDS}
                max={maxSelectableCards}
                step={2}
                value={selectedCount}
                onChange={(event) => onRequestedCardsChange(clampRequestedCards(Number(event.target.value), maxSelectableCards))}
                disabled={busy || sold}
                aria-label="추천 상품 수 조절"
                className={`h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 ${rangeAccentClass(selectedPack.band)} disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-700`}
              />
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>{MIN_REQUESTED_CARDS}건</span>
                <span>최대 {maxSelectableCards}건</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenClick}
            disabled={disabled}
            className={ctaClasses(selectedPack.ctaTone, disabled)}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {busy
                ? "처리 중..."
                : inventoryLoading
                  ? "재고 확인 중..."
                  : loginRequired
                    ? "로그인하고 검색"
                    : sold
                      ? "추천 없음"
                      : insufficient
                        ? (
                            <>
                              <span>부족</span>
                              <CostBadge value={totalCost} />
                            </>
                          )
                        : (
                            <>
                              <span>검색하기</span>
                              <CostBadge value={totalCost} />
                            </>
                          )}
            </span>
          </button>

          {/* "재고 N건 남음" 박스 제거 — 위 funnel 박스에 통합됨 (band-only 옛 로직) */}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e7dece] pt-2.5 text-[11px] text-zinc-500 dark:border-zinc-700/60 dark:text-zinc-400">
            <p>같은 전체 본품 기준으로만 비교</p>
            <p>검증 실패 시 자동 환불</p>
          </div>
        </div>
      </div>
    </div>
    {warningOpen ? (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(31,40,34,0.48)] p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        onClick={() => setWarningOpen(false)}
      >
        <div
          className="w-full max-w-md rounded-[24px] border border-[#ddd4c7] bg-[#fffaf6] p-5 shadow-[0_24px_64px_rgba(34,49,39,0.20)] dark:border-zinc-800 dark:bg-zinc-900"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e4d6bd] bg-[#f7ecd8] px-3 py-1 text-xs font-black text-[#7b5724] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            <CostBadge value={totalCost} />
            고수익 검색
          </div>
          <h3 className="mt-4 text-xl font-black tracking-tight text-[#223127] dark:text-white">
            매입가도 높을 수 있어요
          </h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#626d61] dark:text-zinc-300">
            수익 구간이 높은 상품은 예상 차익이 큰 대신, 실제 매입가도 같이 높아질 수 있습니다.
            구매 전에는 판매 상태, 구성품, 판매자 리뷰를 한 번 더 확인해주세요.
          </p>
          <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-2xl border border-[#e7dece] bg-[#fffbf4] px-3 py-2 text-sm font-bold text-[#344136] dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-200">
            <input
              type="checkbox"
              checked={hideWarningForSession}
              onChange={(event) => setHideWarningForSession(event.target.checked)}
              className="h-4 w-4 accent-[var(--brand-accent-strong)]"
            />
            이번 세션에서는 다시 보지 않기
          </label>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setWarningOpen(false)}
              className="rounded-xl border border-[#ddd4c7] bg-[#fffaf6] px-4 py-3 text-sm font-black text-[#344136] transition hover:bg-[#f4eee3] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirmHighProfitSearch}
              className="rounded-xl bg-[var(--brand-accent-strong)] px-4 py-3 text-sm font-black text-[var(--brand-cream)] shadow-[0_14px_30px_rgba(49,66,56,0.22)] transition hover:bg-[#29382f]"
            >
              확인하고 검색
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}

type Props = {
  initialInventory: InventorySnapshot[];
};

export default function RecommendationWorkspace({ initialInventory }: Props) {
  const [inventory, setInventory] = useState<InventorySnapshot[]>(initialInventory);
  // Wave 74: CSR 전환 — initialInventory가 비었으면 mount 후 client fetch 동안 skeleton.
  const [inventoryLoading, setInventoryLoading] = useState(initialInventory.length === 0);
  const [tokens, setTokens] = useState<number>(0);
  const [infiniteCredits, setInfiniteCredits] = useState(false);
  const [userRef, setUserRef] = useState<string>(() => getOrCreateUserRef());
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [minProfitManwon, setMinProfitManwon] = useState<number>(4);
  const [requestedCards, setRequestedCards] = useState<number>(MIN_REQUESTED_CARDS);
  const [activeBand, setActiveBand] = useState<PackBand | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RevealResult | null>(null);
  const [lastRequest, setLastRequest] = useState<PackOpenRequest | null>(null);

  const refreshCredits = useCallback(async () => {
    const credits = await loadClientCredits().catch(() => null);
    if (!credits) {
      setTokens(0);
      setInfiniteCredits(false);
      return;
    }
    setTokens(credits.tokens);
    setInfiniteCredits(credits.infinite);
  }, []);

  useEffect(() => {
    const anonymousRef = getOrCreateUserRef();

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const nextUser = data.user ?? null;
      setAuthUser(nextUser);
      setUserRef(nextUser ? userRefForAuthUser(nextUser.id) : anonymousRef);
      if (nextUser) void refreshCredits();
    }).catch(() => undefined);
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setAuthUser(nextUser);
      setUserRef(nextUser ? userRefForAuthUser(nextUser.id) : anonymousRef);
      if (nextUser) {
        void refreshCredits();
      } else {
        setTokens(0);
        setInfiniteCredits(false);
      }
    });
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [refreshCredits]);

  const inventoryByBand = useMemo(() => {
    const map = new Map<PackBand, InventorySnapshot>();
    for (const snap of inventory) map.set(snap.band, snap);
    return map;
  }, [inventory]);
  // 추천 가능 매물 풀 전체 합 (band 1+2+3) — funnel 상단 표시용.
  // selectedInventory는 선택된 band만이지만 totalPoolReady는 전체 pool ready.
  const totalPoolReady = useMemo(
    () => inventory.reduce((sum, snap) => sum + snap.usableReady, 0),
    [inventory],
  );
  const selectedPack = useMemo(
    () => PACKS.find((pack) => pack.band === bandForMinProfit(minProfitManwon)) ?? PACKS[1],
    [minProfitManwon],
  );
  const selectedInventory = inventoryByBand.get(selectedPack.band);

  const refreshInventory = useCallback(async () => {
    try {
      const res = await fetch("/api/packs/inventory", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { inventory: InventorySnapshot[] };
      if (Array.isArray(data?.inventory)) setInventory(data.inventory);
    } catch {
      // ignore
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  useEffect(() => {
    // Wave 74: 페이지 mount 시 inventory client fetch (CSR).
    if (initialInventory.length === 0) void refreshInventory();
  }, [initialInventory.length, refreshInventory]);

  const openPack = useCallback(
    async (pack: PackDef, requestedCardsInput: number, filters?: CostFilters | null) => {
      if (loading) return;
      if (!authUser) {
        window.location.href = "/login";
        return;
      }
      const requestedCards = clampRequestedCards(requestedCardsInput);
      // Wave 78: filter 있으면 dynamic cost, 없으면 base × steps
      const tokenCost = computeCostBreakdown(pack.band, requestedCards, filters ?? null).totalCost;
      if (!infiniteCredits && tokens < tokenCost) return;
      setLastRequest({ pack, requestedCards, tokenCost });
      setActiveBand(pack.band);
      setLoading(true);
      setResult(null);
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("로그인이 필요해요.");
        const res = await fetch("/api/packs/open", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "x-user-ref": userRef,
          },
          body: JSON.stringify({
            band: pack.band,
            requestedCards,
            ...(filters ? { filters } : {}),
          }),
        });
        const openData = (await res.json()) as PackOpenApiResult;
        if (typeof openData.tokensRemaining === "number") setTokens(openData.tokensRemaining);
        if (typeof openData.infiniteCredits === "boolean") setInfiniteCredits(openData.infiniteCredits);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("minyoi:credits-changed"));
        }
        if (openData.result === "success") {
          dispatchPackRevealsUpdated({
            band: pack.band,
            reveals: openData.reveals,
          });
          setResult({
            result: "success",
            reveals: openData.reveals,
            attemptedCount: openData.attemptedCount,
            durationMs: openData.durationMs,
          });
        } else if (openData.result === "refunded") {
          const refunded = openData.tokensRefunded ?? tokenCost;
          setResult({
            result: "refunded",
            reason: openData.reason,
            tokensRefunded: refunded,
            durationMs: openData.durationMs,
          });
        } else if (openData.result === "unavailable") {
          setResult({
            result: "unavailable",
            reason: openData.reason,
            durationMs: openData.durationMs,
          });
        } else {
          setResult({
            result: "refunded",
            reason: openData.message ?? openData.error ?? "예상치 못한 응답이에요. 다시 시도해주세요.",
            tokensRefunded: tokenCost,
            durationMs: 0,
          });
        }
      } catch (err) {
        setResult({
          result: "refunded",
          reason: err instanceof Error ? err.message : "네트워크 오류",
          tokensRefunded: tokenCost,
          durationMs: 0,
        });
      } finally {
        setLoading(false);
        refreshCredits();
        refreshInventory();
      }
    },
    [authUser, loading, tokens, infiniteCredits, userRef, refreshCredits, refreshInventory],
  );

  const handleClose = useCallback(() => {
    setActiveBand(null);
    setResult(null);
    setLastRequest(null);
  }, []);

  const handleRetry = useCallback(() => {
    if (!lastRequest) {
      handleClose();
      return;
    }
    setResult(null);
    void openPack(lastRequest.pack, lastRequest.requestedCards);
  }, [lastRequest, openPack, handleClose]);

  const handleLinkClicked = useCallback((pid: number) => {
    if (!userRef) return;
    const supabase = getSupabaseBrowserClient();
    void supabase?.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;
      return fetch("/api/packs/reveals/click", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-user-ref": userRef,
      },
      body: JSON.stringify({ pid }),
      cache: "no-store",
      });
    }).catch(() => undefined);
  }, [userRef]);

  const handleFeedback = useCallback((pid: number, feedbackType: RevealFeedbackType, note?: string) => {
    if (!userRef) return;
    const supabase = getSupabaseBrowserClient();
    void supabase?.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;
      return fetch("/api/packs/reveals/feedback", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-user-ref": userRef,
      },
      body: JSON.stringify({ pid, feedbackType, note }),
      cache: "no-store",
      });
    }).catch(() => undefined);
  }, [userRef]);

  const handleLoadDetail = useCallback(async (pid: number): Promise<RevealListingDetail> => {
    if (!userRef) throw new Error("사용자 식별값이 아직 준비되지 않았어요.");
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("로그인이 필요해요.");
    const res = await fetch("/api/packs/reveals/detail", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-user-ref": userRef,
      },
      body: JSON.stringify({ pid }),
      cache: "no-store",
    });
    const detailData = (await res.json()) as { detail?: RevealListingDetail; error?: string };
    if (!res.ok || !detailData.detail) throw new Error(detailData.error ?? "상세 정보 요청 실패");
    return detailData.detail;
  }, [userRef]);

  return (
    <>
      <section className="flex justify-center">
        <PackSelectorCard
          selectedPack={selectedPack}
          selectedInventory={selectedInventory}
          totalPoolReady={totalPoolReady}
          minProfitManwon={minProfitManwon}
          requestedCards={requestedCards}
          tokens={tokens}
          infiniteCredits={infiniteCredits}
          onOpen={openPack}
          busy={loading}
          inventoryLoading={inventoryLoading}
          isAuthenticated={Boolean(authUser)}
          onMinProfitChange={setMinProfitManwon}
          onRequestedCardsChange={setRequestedCards}
        />
      </section>

      <PackRevealModal
        open={activeBand !== null}
        band={activeBand ?? 1}
        loading={loading}
        result={result}
        onClose={handleClose}
        onLinkClicked={handleLinkClicked}
        onFeedback={handleFeedback}
        onLoadDetail={handleLoadDetail}
        onRetry={handleRetry}
      />
    </>
  );
}
