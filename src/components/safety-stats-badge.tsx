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

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg className={`h-3 w-3 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
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

  useEffect(() => {
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

  if (!stats || stats.total_blocked_7d === 0) return null;

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

  return (
    <div className="mb-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
      <button
        type="button"
        onClick={() => setShowDetail((s) => !s)}
        className="flex w-full items-center justify-between gap-3 text-left"
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
              이번 주 차단된 매물
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
          {/* ─── 그룹 1: 상품 위험 (위조·도난·잠금·의심 할인) ─────────────── */}
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
            위조·도난·잠금, 거래 거부 가격, 시세 검증 실패, 대량 재고 업자, 다중 ID 사기 그룹 등을 사전 차단했습니다.
          </div>
        </div>
      )}
    </div>
  );
}
