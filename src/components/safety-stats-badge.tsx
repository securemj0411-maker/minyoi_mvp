"use client";

// Wave 129 (2026-05-16): 위험 매물 차단 카운터 badge — 사업 보고서 L4.
// "이번 주 위험 매물 X건 차단" retention killer.
// 2026-05-16 리팩토링 (사용자 코멘트):
//   - 이모지 → SVG icon
//   - 폰 specific 표현 제거 → generalize ("통신사 약정/할부" → 카테고리 무관 표현)
//   - 카테고리 통합 (8개 → 3 묶음): 상품 위험 / 거래 불일치 / 업자·사기 그룹
//   - 새 breakdown row 추가 (profit_low / lifecycle_gone / thin_market / stat_missing / suspicious_price)

import { useEffect, useState, type ReactNode } from "react";

type SafetyStats = {
  total_blocked_7d: number;
  price_dummy_7d: number;
  fake_or_lock_7d: number;
  carrier_mismatch_7d: number;
  pool_invalidated_7d: number;
  // 도매 업자/사기 그룹 차단 카운터
  wholesaler_total_7d?: number;
  wholesaler_comment_7d?: number;
  wholesaler_qty_7d?: number;
  seller_multi_listings_7d?: number;
  multi_id_fraud_group_7d?: number;
  // generalize breakdown (모든 카테고리)
  profit_low_7d?: number;
  lifecycle_gone_7d?: number;
  thin_market_7d?: number;
  stat_missing_7d?: number;
  suspicious_price_7d?: number;
  // 2026-05-16 (2차): 수집 단계 + 파싱 단계 차단 (진짜 큰 카테고리)
  collection_stage_total_7d?: number;
  listing_parts_7d?: number;
  listing_damaged_7d?: number;
  listing_accessory_7d?: number;
  listing_callout_7d?: number;
  listing_commercial_7d?: number;
  listing_buying_7d?: number;
  listing_multi_7d?: number;
  needs_review_7d?: number;
};

// ─── SVG icons (inline Lucide-style, 14x14) ─────────────────────────────
const ICON_CLASS = "h-3.5 w-3.5 flex-shrink-0";

function ShieldIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CoinsIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BanIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}

function TrendingDownIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg className={`h-3 w-3 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const SAFETY_BADGE_HIDE_KEY = "minyoi-hide-safety-stats-badge-until";
const HIDE_FOR_MS = 7 * 24 * 60 * 60 * 1000;

function isHiddenUntilActive(key: string) {
  if (typeof window === "undefined") return false;
  const until = Number(window.localStorage.getItem(key) ?? 0);
  return Number.isFinite(until) && until > Date.now();
}

// ─── breakdown row builder ────────────────────────────────────────────
type Row = { icon: ReactNode; label: string; count: number };

function StatRow({ icon, label, count }: Row) {
  if (count <= 0) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300/90">
        <span className="text-emerald-600 dark:text-emerald-400">{icon}</span>
        <span>{label}</span>
      </span>
      <span className="font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
        {count.toLocaleString("ko-KR")}건
      </span>
    </div>
  );
}

function GroupHeader({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="mt-2 flex items-center gap-1.5 border-t border-emerald-200 pt-2 dark:border-emerald-900">
      <span className="text-emerald-700 dark:text-emerald-400">{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
        {label}
      </span>
    </div>
  );
}

export default function SafetyStatsBadge() {
  const [stats, setStats] = useState<SafetyStats | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (isHiddenUntilActive(SAFETY_BADGE_HIDE_KEY)) {
      setHidden(true);
      return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/public/safety-stats", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { stats: SafetyStats };
        setStats(json.stats);
      } catch {
        // silent
      }
    })();
  }, []);

  function hideForWeek() {
    window.localStorage.setItem(SAFETY_BADGE_HIDE_KEY, String(Date.now() + HIDE_FOR_MS));
    setHidden(true);
  }

  // 2026-05-16 (사용자 코멘트): 데이터 로드 전 빈 상태 → 갑자기 카드 등장 = jarring.
  // skeleton placeholder — frame 첫 paint 부터 보이고 숫자만 fade-in.
  if (hidden) return null;
  if (!stats) {
    return (
      <div className="mb-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
        <div className="flex w-full items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700/80 dark:text-emerald-400/80">
              <ShieldIcon />
              <span>회원님 보호</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="inline-block h-7 w-20 animate-pulse rounded bg-emerald-200/80 dark:bg-emerald-900/60" />
              <span className="text-sm font-bold text-emerald-800/70 dark:text-emerald-300/70">이번 주 차단된 매물</span>
            </div>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-emerald-600/40 px-3 py-1 text-[10px] font-black text-white/70">상세<ChevronDownIcon open={false} /></span>
        </div>
      </div>
    );
  }
  if (stats.total_blocked_7d === 0) return null;

  const total = stats.total_blocked_7d;
  // 그룹 합 (헤더 표시 여부 결정용)
  const productRiskTotal =
    (stats.fake_or_lock_7d ?? 0) +
    (stats.carrier_mismatch_7d ?? 0) +
    (stats.suspicious_price_7d ?? 0);
  const marketMismatchTotal =
    (stats.price_dummy_7d ?? 0) +
    (stats.pool_invalidated_7d ?? 0) +
    (stats.profit_low_7d ?? 0) +
    (stats.lifecycle_gone_7d ?? 0) +
    (stats.thin_market_7d ?? 0) +
    (stats.stat_missing_7d ?? 0);
  const wholesalerTotal = stats.wholesaler_total_7d ?? 0;
  const collectionStageTotal = stats.collection_stage_total_7d ?? 0;
  const parserMissTotal = stats.needs_review_7d ?? 0;

  return (
    <div className="relative mb-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
      <button
        type="button"
        onClick={hideForWeek}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 text-[10px] font-bold text-emerald-800 transition hover:bg-white dark:bg-zinc-900/70 dark:text-emerald-200"
        aria-label="차단 통계 7일 숨김"
      >
        <XIcon />
        숨김
      </button>
      <button
        type="button"
        onClick={() => setShowDetail((s) => !s)}
        className="flex w-full items-center justify-between gap-3 pr-14 text-left"
      >
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
            <ShieldIcon />
            <span>회원님 보호</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-emerald-700 dark:text-emerald-300">
              {total.toLocaleString("ko-KR")}건
            </span>
            <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300/80">
              오늘 차단된 매물
            </span>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-black text-white">
          {showDetail ? "접기" : "상세"}
          <ChevronDownIcon open={showDetail} />
        </span>
      </button>
      {showDetail && (
        <div className="mt-3 grid gap-1.5 border-t border-emerald-200 pt-3 text-[11px] dark:border-emerald-900">
          {/* ─── 그룹 1: 매물 분류 단계 (수집 시점 차단) — 가장 큰 카테고리 ─────── */}
          {collectionStageTotal > 0 && (
            <>
              <GroupHeader icon={<FilterIcon />} label="매물 분류 단계 차단" />
              <StatRow
                icon={<FilterIcon />}
                label="부품·단품만 판매 매물"
                count={stats.listing_parts_7d ?? 0}
              />
              <StatRow
                icon={<FilterIcon />}
                label="액세서리·구성품만 매물"
                count={stats.listing_accessory_7d ?? 0}
              />
              <StatRow
                icon={<FilterIcon />}
                label="손상·파손 매물"
                count={stats.listing_damaged_7d ?? 0}
              />
              <StatRow
                icon={<FilterIcon />}
                label="광고·홍보·매크로 매물"
                count={stats.listing_callout_7d ?? 0}
              />
              <StatRow
                icon={<FilterIcon />}
                label="상업·전문 판매업자 매물"
                count={stats.listing_commercial_7d ?? 0}
              />
              <StatRow
                icon={<FilterIcon />}
                label="매입 요청 글 (판매 아님)"
                count={stats.listing_buying_7d ?? 0}
              />
              <StatRow
                icon={<FilterIcon />}
                label="다중 상품 묶음 매물"
                count={stats.listing_multi_7d ?? 0}
              />
            </>
          )}

          {/* ─── 그룹 2: 분류 신뢰 부족 (파싱 단계) ─────────────── */}
          {parserMissTotal > 0 && (
            <>
              <GroupHeader icon={<HelpIcon />} label="모델 식별 실패" />
              <StatRow
                icon={<HelpIcon />}
                label="모델·옵션 식별 불충분 매물"
                count={parserMissTotal}
              />
            </>
          )}

          {/* ─── 그룹 3: 상품 위험 (위조·도난·잠금·의심 할인) ─────────────── */}
          {productRiskTotal > 0 && (
            <>
              <GroupHeader icon={<AlertTriangleIcon />} label="상품 위험" />
              <StatRow
                icon={<BanIcon />}
                label="위조품·도난·잠금 매물"
                count={stats.fake_or_lock_7d ?? 0}
              />
              <StatRow
                icon={<BanIcon />}
                label="사용 권한·잔여 채무 매물"
                count={stats.carrier_mismatch_7d ?? 0}
              />
              <StatRow
                icon={<AlertTriangleIcon />}
                label="비정상 할인 의심 매물"
                count={stats.suspicious_price_7d ?? 0}
              />
            </>
          )}

          {/* ─── 그룹 2: 거래/시세 불일치 ─────────────── */}
          {marketMismatchTotal > 0 && (
            <>
              <GroupHeader icon={<CoinsIcon />} label="거래·시세 불일치" />
              <StatRow
                icon={<CoinsIcon />}
                label="거래 거부 표시 가격"
                count={stats.price_dummy_7d ?? 0}
              />
              <StatRow
                icon={<TrendingDownIcon />}
                label="차익 미달 매물"
                count={stats.profit_low_7d ?? 0}
              />
              <StatRow
                icon={<TrendingDownIcon />}
                label="거래 종료·사라진 매물"
                count={stats.lifecycle_gone_7d ?? 0}
              />
              <StatRow
                icon={<TrendingDownIcon />}
                label="시세 표본 부족"
                count={stats.thin_market_7d ?? 0}
              />
              <StatRow
                icon={<TrendingDownIcon />}
                label="시세 미산정 매물"
                count={stats.stat_missing_7d ?? 0}
              />
              {/* 기존 pool_invalidated_7d는 위 5개 합산에 포함됨 — 따로 표시 X (중복) */}
            </>
          )}

          {/* ─── 그룹 3: 업자·사기 그룹 ─────────────── */}
          {wholesalerTotal > 0 && (
            <>
              <GroupHeader icon={<UsersIcon />} label="업자·사기 그룹" />
              <StatRow
                icon={<UsersIcon />}
                label="흥정 위주 호가 매물"
                count={stats.wholesaler_comment_7d ?? 0}
              />
              <StatRow
                icon={<UsersIcon />}
                label="대량 재고 매물"
                count={stats.wholesaler_qty_7d ?? 0}
              />
              <StatRow
                icon={<UsersIcon />}
                label="동일 셀러 중복 매물"
                count={stats.seller_multi_listings_7d ?? 0}
              />
              <StatRow
                icon={<UsersIcon />}
                label="다중 ID 의심 그룹"
                count={stats.multi_id_fraud_group_7d ?? 0}
              />
            </>
          )}

          <div className="mt-2 text-[10px] leading-[1.5] text-emerald-700/70 dark:text-emerald-400/70">
            부품·액세서리만 매물 · 손상·파손 · 광고·매크로 · 위조·도난·잠금 · 거래 거부 가격 · 시세 검증 실패 · 대량 재고 업자 · 다중 ID 사기 그룹 등을 수집·분류·풀 진입 단계에서 사전 차단했습니다.
          </div>
        </div>
      )}
    </div>
  );
}
