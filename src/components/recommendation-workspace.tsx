"use client";

import type { User } from "@supabase/supabase-js";
import { type ReactElement, useCallback, useEffect, useMemo, useState } from "react";
import CreditIcon from "@/components/credit-icon";
import {
  CoinsIcon,
  LightbulbIcon,
  PackageIcon,
  ScaleIcon,
  ShieldIcon,
  SwordsIcon,
  TargetIcon,
  WalletIcon,
  ZapIcon,
} from "@/components/icons";
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
const MAX_FRESH_HOURS = 72; // 3일
// Wave 93b: 슬라이더는 "left=strict, right=무제한" 직관에 맞춤.
//   sliderValue 1..72 → "최근 N시간 이내" (왼쪽일수록 엄격)
//   sliderValue 73   → "무제한" (오른쪽 끝, default)
// 내부 maxFreshHours: sliderValue >= 73 ? 0 (무제한) : sliderValue
const FRESH_SLIDER_MAX = MAX_FRESH_HOURS + 1; // 73 = 무제한 sentinel
function sliderToMaxFreshHours(v: number): number {
  return v >= FRESH_SLIDER_MAX ? 0 : Math.max(1, v);
}
function maxFreshHoursToSlider(h: number): number {
  return h <= 0 ? FRESH_SLIDER_MAX : Math.min(MAX_FRESH_HOURS, Math.max(1, h));
}

// 슬라이더 진행 비율 시각화. filled portion 색상 강조 → 0원~선택값 범위가 가시적.
function sliderTrackStyle(
  value: number,
  min: number,
  max: number,
  color: string,
  disabled = false,
): React.CSSProperties {
  if (disabled) {
    return { background: "#e5dccf" };
  }
  const ratio = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  const empty = "#d6cebd";
  return {
    background: `linear-gradient(to right, ${color} 0%, ${color} ${ratio}%, ${empty} ${ratio}%, ${empty} 100%)`,
  };
}
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
  Icon: (props: { className?: string }) => ReactElement;
  desc: string;
};
const RISK_PRESETS: Record<RiskProfile, RiskPreset> = {
  safe: {
    band: 1, label: "안전", Icon: ShieldIcon,
    desc: "15만원 이하 · 차익 1만원 이상 · 신뢰도 80% 이상",
    filters: { priceMaxManwon: 15, minProfitManwon: 1, minConfidencePct: 80, categories: [], maxFreshHours: 0 },
  },
  balanced: {
    band: 2, label: "균형", Icon: ScaleIcon,
    desc: "30만원 이하 · 차익 2만원 이상 · 신뢰도 70% 이상",
    filters: { priceMaxManwon: 30, minProfitManwon: 2, minConfidencePct: 70, categories: [], maxFreshHours: 0 },
  },
  aggressive: {
    band: 3, label: "공격", Icon: SwordsIcon,
    desc: "80만원 이하 · 차익 5만원 이상 · 신뢰도 60% 이상",
    filters: { priceMaxManwon: 80, minProfitManwon: 5, minConfidencePct: 60, categories: [], maxFreshHours: 0 },
  },
};
// Wave 106: disabled 카테고리는 ready pool 0건이라 실제 추천 불가.
// 옵션은 그대로 두고 "(준비중)" 표시 + 클릭 차단. 사용자에게 "어떤 카테고리 추가될지" 기대치 set.
// 향후 source 다양화 wave에서 ready 매물 들어오면 disabled=false로 활성.
const CATEGORY_OPTIONS = [
  { id: "earphone", label: "이어폰", disabled: false },
  { id: "smartwatch", label: "워치(스마트)", disabled: false },
  { id: "tablet", label: "태블릿", disabled: false },
  { id: "laptop", label: "노트북", disabled: false },
  { id: "game_console", label: "게임기", disabled: false },
  { id: "desktop", label: "데스크탑", disabled: false },
  { id: "speaker", label: "스피커", disabled: false }, // 빈약 (3건) but ready
  { id: "monitor", label: "모니터", disabled: true },
  { id: "camera", label: "카메라", disabled: true }, // Wave 66 internal_only 되돌림
  { id: "smartphone", label: "스마트폰", disabled: true }, // internal_only
  { id: "watch", label: "시계", disabled: true },
  { id: "home_appliance", label: "가전", disabled: true }, // small_appliance 차단
  { id: "sport_golf", label: "골프", disabled: true },
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
  isPro,
  planUsage,
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
  isPro: boolean;
  planUsage: { monthlyCredits: number; dailyUsed: number; dailyLimit: number } | null;
  onOpen: (pack: PackDef, requestedCards: number, filters?: CostFilters | null) => void;
  busy: boolean;
  inventoryLoading: boolean;
  isAuthenticated: boolean;
  onMinProfitChange: (value: number) => void;
  onRequestedCardsChange: (requestedCards: number) => void;
}) {
  const [warningOpen, setWarningOpen] = useState(false);
  const [hideWarningForSession, setHideWarningForSession] = useState(false);

  // Wave 104: 고수익 경고 모달 Esc 닫기 + body scroll lock (다른 모달과 일관성).
  useEffect(() => {
    if (!warningOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setWarningOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [warningOpen]);
  // Wave 79: easy mode 제거 — 단일 통합 UI
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("balanced");
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(RISK_PRESETS.balanced.filters);
  const [previewInventory, setPreviewInventory] = useState<PreviewInventoryResp | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  // Wave 93b: CTA를 위로 끌어올리기 위해 차익+신뢰도는 default 접힘.
  const [showAdvancedSliders, setShowAdvancedSliders] = useState(false);

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
  // Wave 93b: maxFreshHours 추가 (RPC에 전달, hard 필터 일관성).
  const activeFilters: CostFilters & { maxFreshHours?: number } = {
    minProfitManwon: advancedFilters.minProfitManwon,
    minConfidencePct: advancedFilters.minConfidencePct,
    priceMaxManwon: advancedFilters.priceMaxManwon,
    maxFreshHours: advancedFilters.maxFreshHours,
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
                className={`flex flex-col items-center justify-center rounded-2xl border px-2 py-2 transition ${active ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] text-[var(--brand-accent-strong)]" : "border-[#e0d6c5] bg-white text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"}`}
              >
                <preset.Icon className="h-4 w-4" />
                <div className="mt-1 text-xs font-black">{preset.label}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 text-center text-[11px] text-[#7a8478] dark:text-zinc-500">{RISK_PRESETS[riskProfile].desc}</div>

        {/* 압축 슬라이더 그룹 — 매입가 + 신선도는 항상, 차익 + 신뢰도는 자세히 옵션 안에. */}
        <div className="mt-3 space-y-2 rounded-[18px] bg-[#f6efe4] p-3 dark:bg-zinc-950/40">
          {/* 매입가 */}
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 font-black text-[#59665b] dark:text-zinc-300"><WalletIcon className="h-3.5 w-3.5" /> 매입가</span>
              <span className="font-black text-zinc-900 dark:text-zinc-50">
                {advancedFilters.priceMaxManwon === 0 ? "무제한" : `${advancedFilters.priceMaxManwon}만원 이하`}
              </span>
            </div>
            <input
              type="range" min={0} max={150} step={5}
              value={advancedFilters.priceMaxManwon}
              onChange={(e) => setAdvancedFilters(f => ({ ...f, priceMaxManwon: Number(e.target.value) }))}
              disabled={busy}
              style={sliderTrackStyle(advancedFilters.priceMaxManwon, 0, 150, "#4f6f58")}
              className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-full accent-[var(--brand-accent)] disabled:opacity-50"
            />
          </div>

          {/* 신선도 — 누구나 조정 가능, 단 3시간 미만은 Pro 전용 */}
          {/* slider min: Pro/admin = 1, 그 외 = 3 (3시간 미만은 못 잡음) */}
          {(() => {
            const freshSliderMin = isPro ? 1 : 3;
            return (
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 font-black text-[#59665b] dark:text-zinc-300">
                    <ZapIcon className="h-3.5 w-3.5" /> 신선도
                    {!isPro && (
                      <span className="ml-1.5 rounded-full bg-[#fff4d6] px-1.5 py-0.5 text-[9px] font-black text-[#7b5724] dark:bg-amber-900/30 dark:text-amber-300">
                        3시간 미만은 Pro
                      </span>
                    )}
                  </span>
                  <span className="font-black text-zinc-900 dark:text-zinc-50">
                    {advancedFilters.maxFreshHours === 0 ? "무제한" : `최근 ${advancedFilters.maxFreshHours}시간 이내`}
                  </span>
                </div>
                <input
                  type="range" min={freshSliderMin} max={FRESH_SLIDER_MAX} step={1}
                  value={Math.max(freshSliderMin, maxFreshHoursToSlider(advancedFilters.maxFreshHours))}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    const clamped = Math.max(freshSliderMin, raw);
                    setAdvancedFilters(f => ({ ...f, maxFreshHours: sliderToMaxFreshHours(clamped) }));
                  }}
                  disabled={busy}
                  style={sliderTrackStyle(
                    Math.max(freshSliderMin, maxFreshHoursToSlider(advancedFilters.maxFreshHours)),
                    freshSliderMin,
                    FRESH_SLIDER_MAX,
                    "#4f6f58",
                  )}
                  className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-full accent-[var(--brand-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            );
          })()}

          {/* 자세히 옵션 — 차익 + 신뢰도. 확장 시 sliders 위쪽, 토글은 하단에 위치 (UI 깔끔). */}
          {showAdvancedSliders && (
            <div className="space-y-2 border-t border-[#e8dec9] pt-2 dark:border-zinc-700/40">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 font-black text-[#59665b] dark:text-zinc-300"><CoinsIcon className="h-3.5 w-3.5" /> 차익</span>
                  <span className="font-black text-zinc-900 dark:text-zinc-50">{advancedFilters.minProfitManwon}만원 이상</span>
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
                  style={sliderTrackStyle(
                    advancedFilters.minProfitManwon,
                    MIN_PROFIT_MANWON,
                    MAX_PROFIT_MANWON,
                    selectedPack.band === 3 ? "#caab78" : "#4f6f58",
                  )}
                  className={`mt-1 h-2 w-full cursor-pointer appearance-none rounded-full ${rangeAccentClass(selectedPack.band)} disabled:opacity-50`}
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 font-black text-[#59665b] dark:text-zinc-300"><TargetIcon className="h-3.5 w-3.5" /> 신뢰도</span>
                  <span className="font-black text-zinc-900 dark:text-zinc-50">{advancedFilters.minConfidencePct}% 이상</span>
                </div>
                <input
                  type="range" min={50} max={95} step={5}
                  value={advancedFilters.minConfidencePct}
                  onChange={(e) => setAdvancedFilters(f => ({ ...f, minConfidencePct: Number(e.target.value) }))}
                  disabled={busy}
                  style={sliderTrackStyle(advancedFilters.minConfidencePct, 50, 95, "#4f6f58")}
                  className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-full accent-[var(--brand-accent)] disabled:opacity-50"
                />
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowAdvancedSliders((s) => !s)}
            className="flex w-full items-center justify-between rounded-md px-1 py-1 text-[11px] font-black text-[#7a8478] hover:text-[#59665b] dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            <span>{showAdvancedSliders ? "자세히 옵션 닫기" : "자세히 옵션 (차익 · 신뢰도)"}</span>
            <span>{showAdvancedSliders ? "▲" : "▼"}</span>
          </button>

          {!isPro && (
            <p className="rounded-md bg-[#fffaf1] px-2 py-1 text-[10px] font-bold leading-4 text-[#7b5724] dark:bg-zinc-800 dark:text-zinc-400">
              신선도 3시간 미만은 Pro 플랜부터 조정 가능합니다.
            </p>
          )}
        </div>

        {/* 카테고리 collapsible */}
        <button
          type="button"
          onClick={() => setShowCategories(s => !s)}
          className="mt-2 flex w-full items-center justify-between rounded-[16px] bg-[#f6efe4] px-3 py-2 text-xs font-black text-[#59665b] hover:bg-[#efe7d6] dark:bg-zinc-950/40 dark:text-zinc-300"
        >
          <span className="inline-flex items-center gap-1.5"><PackageIcon className="h-3.5 w-3.5" /> 카테고리 {advancedFilters.categories.length === 0 ? "(전체)" : `(${advancedFilters.categories.length}개 선택)`}</span>
          <span className="text-[10px]">{showCategories ? "▲" : "▼"}</span>
        </button>
        {showCategories ? (
          <div className="mt-1.5 flex flex-wrap gap-1 rounded-[16px] bg-[#fbf7ef] p-2 dark:bg-zinc-950/30">
            {CATEGORY_OPTIONS.map((opt) => {
              const active = advancedFilters.categories.includes(opt.id);
              const count = previewInventory?.byCategory[opt.id];
              const isDisabled = busy || opt.disabled;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { if (!opt.disabled) toggleCategory(opt.id); }}
                  disabled={isDisabled}
                  title={opt.disabled ? "아직 추천 매물이 없는 카테고리예요. 추후 source 다양화로 추가 예정." : undefined}
                  className={`rounded-full border px-2 py-0.5 text-[10.5px] font-black transition ${
                    opt.disabled
                      ? "cursor-not-allowed border-dashed border-[#dcd5c8] bg-[#f3ede2] text-zinc-400 line-through dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-600"
                      : active
                        ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] text-[var(--brand-accent-strong)]"
                        : "border-[#d8d2c4] bg-white text-zinc-500 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                  }`}
                >
                  {opt.label}{opt.disabled ? <span className="ml-0.5 no-underline opacity-70">(준비중)</span> : count ? <span className="ml-0.5 opacity-60">·{count}</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* 자세한 정보 collapsible */}
        <details className="mt-2 rounded-[14px] bg-[#f6efe4] px-3 py-1.5 dark:bg-zinc-950/40">
          <summary className="cursor-pointer text-[10.5px] font-black text-[#59665b] dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5"><LightbulbIcon className="h-3.5 w-3.5" /> 자세한 정보</span>
          </summary>
          <div className="mt-2 space-y-1 text-[10.5px] text-[#647064] dark:text-zinc-400">
            <div className="font-black text-[#3a4a3f] dark:text-zinc-300">계산식:</div>
            <div>· 기본 ({RISK_PRESETS[riskProfile].label}): <b>{costBreakdown.base}</b></div>
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
                <div className="flex items-baseline gap-1.5 text-sm font-black text-[#59665b] dark:text-zinc-300">
                  <span>추천 상품 수</span>
                  <span className="text-[11px] font-bold text-[#7a8478] dark:text-zinc-500">
                    {previewLoading
                      ? "(확인 중…)"
                      : previewInventory
                        ? `(현재 가능 ~${previewInventory.matchingCount}건)`
                        : inventoryLoading
                          ? "(확인 중…)"
                          : `(현재 가능 ~${totalPoolReady}건)`}
                  </span>
                </div>
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

          {/* 한도 경고 — 80% 이상일 때만 표시 (월/일 둘 중 하나라도). admin/Pro unlimited는 X. */}
          {(() => {
            if (!planUsage || infiniteCredits) return null;
            const { monthlyCredits, dailyUsed, dailyLimit } = planUsage;
            const monthlyTotal = monthlyCredits;
            const monthlyUsed = monthlyTotal > 0 ? Math.max(0, monthlyTotal - tokens) : 0;
            const monthlyPct = monthlyTotal > 0 ? (monthlyUsed / monthlyTotal) * 100 : 0;
            const dailyPct = dailyLimit > 0 ? (dailyUsed / dailyLimit) * 100 : 0;
            const monthWarn = monthlyTotal > 0 && monthlyPct >= 80;
            const dailyWarn = dailyLimit > 0 && dailyPct >= 80;
            if (!monthWarn && !dailyWarn) return null;
            const monthCritical = monthlyPct >= 100;
            const dailyCritical = dailyPct >= 100;
            const anyCritical = monthCritical || dailyCritical;
            return (
              <div
                className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[11px] font-black ${
                  anyCritical
                    ? "border border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                    : "border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>{anyCritical ? "한도 도달" : "한도 임박"}</span>
                </span>
                <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] tabular-nums">
                  {monthWarn ? <span>월 {monthlyUsed}/{monthlyTotal}</span> : null}
                  {dailyWarn ? <span>오늘 {dailyUsed}/{dailyLimit}</span> : null}
                </span>
              </div>
            );
          })()}

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
            <p>택배비 포함 수익 계산</p>
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
  const [isPro, setIsPro] = useState(false);
  const [planUsage, setPlanUsage] = useState<{ monthlyCredits: number; dailyUsed: number; dailyLimit: number } | null>(null);
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

  // Wave 93b: plan 정보 fetch (신선도 slider min + 사용량 한도 경고).
  useEffect(() => {
    if (!authUser) { setIsPro(false); setPlanUsage(null); return; }
    let cancelled = false;
    fetch("/api/billing/me", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        setIsPro(Boolean(data.isAdmin) || data.planKey === "pro");
        setPlanUsage({
          monthlyCredits: Number(data.monthlyCredits ?? 0),
          dailyUsed: Number(data.dailyUsed ?? 0),
          dailyLimit: Number(data.dailyLimit ?? 0),
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [authUser]);

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
          isPro={isPro || infiniteCredits}
          planUsage={planUsage}
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
