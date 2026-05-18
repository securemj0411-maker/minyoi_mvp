"use client";

// Wave 139d (2026-05-16): 메인 페이지 nav 아래 얇은 toggle bar.
// "오늘 득템잡이 AI가 차단한 상품 수: N건  [상세 ▼]"
// 사용자 코멘트:
//   - "글이 너무 길잖아 그냥 예쁘게 ... 그냥 /me처럼 해줘 상세보기 할수잇도록"
//   - "근데 /me쪽은 너무 세로가 두껍고 이건 가벼운느낌으로 대신 상세 누르기 가능"
// 평소: 한 줄 (높이 ~32px) — nav 바 아래 얇은 띠.
// 클릭: 같은 카테고리 breakdown 펼침 (/me badge 재사용 패턴).

import { useEffect, useState, type ReactNode } from "react";

type SafetyStats = {
  total_blocked_7d: number;
  fake_or_lock_7d?: number;
  carrier_mismatch_7d?: number;
  suspicious_price_7d?: number;
  price_dummy_7d?: number;
  pool_invalidated_7d?: number;
  profit_low_7d?: number;
  lifecycle_gone_7d?: number;
  thin_market_7d?: number;
  stat_missing_7d?: number;
  wholesaler_total_7d?: number;
  wholesaler_comment_7d?: number;
  wholesaler_qty_7d?: number;
  seller_multi_listings_7d?: number;
  multi_id_fraud_group_7d?: number;
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

const ICON_CLASS = "h-3 w-3 flex-shrink-0";

function ShieldIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg className={`h-2.5 w-2.5 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-2.5 w-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const SAFETY_MARQUEE_HIDE_KEY = "minyoi-hide-safety-stats-marquee-until";
const HIDE_FOR_MS = 7 * 24 * 60 * 60 * 1000;

function isHiddenUntilActive(key: string) {
  if (typeof window === "undefined") return false;
  const until = Number(window.localStorage.getItem(key) ?? 0);
  return Number.isFinite(until) && until > Date.now();
}

function StatRow({ label, count }: { label: string; count: number }) {
  if (count <= 0) return null;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-emerald-800/85 dark:text-emerald-300/85">{label}</span>
      <span className="font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
        {count.toLocaleString("ko-KR")}건
      </span>
    </div>
  );
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div className="mt-1.5 border-t border-emerald-200/60 pt-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-400">
      {label}
    </div>
  );
}

export default function SafetyStatsMarquee() {
  const [stats, setStats] = useState<SafetyStats | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (isHiddenUntilActive(SAFETY_MARQUEE_HIDE_KEY)) {
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
    window.localStorage.setItem(SAFETY_MARQUEE_HIDE_KEY, String(Date.now() + HIDE_FOR_MS));
    setHidden(true);
  }

  // 2026-05-16 (사용자 코멘트): 데이터 로드 전 빈 상태 → 갑자기 숫자 등장 = jarring.
  // skeleton placeholder — frame 은 첫 paint 부터 보이고 숫자만 fade-in.
  if (hidden) return null;
  if (!stats) {
    return (
      <div className="border-b border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/30">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800/70 dark:text-emerald-300/70">
            <span className="text-emerald-600/70 dark:text-emerald-400/70"><ShieldIcon /></span>
            <span>오늘 득템잡이가 차단한 매물:</span>
            <span className="inline-block h-3 w-12 animate-pulse rounded bg-emerald-200/80 align-middle dark:bg-emerald-900/60" />
          </span>
          <span className="flex items-center gap-0.5 rounded-full bg-emerald-600/40 px-2 py-0.5 text-[9px] font-black text-white/70">
            상세
            <ChevronDownIcon open={false} />
          </span>
        </div>
      </div>
    );
  }
  if ((stats.total_blocked_7d ?? 0) === 0) return null;

  const total = stats.total_blocked_7d;
  const collectionStageTotal = stats.collection_stage_total_7d ?? 0;
  const parserMissTotal = stats.needs_review_7d ?? 0;
  const productRiskTotal =
    (stats.fake_or_lock_7d ?? 0) + (stats.carrier_mismatch_7d ?? 0) + (stats.suspicious_price_7d ?? 0);
  const marketMismatchTotal =
    (stats.price_dummy_7d ?? 0) + (stats.profit_low_7d ?? 0) +
    (stats.lifecycle_gone_7d ?? 0) + (stats.thin_market_7d ?? 0) + (stats.stat_missing_7d ?? 0);
  const wholesalerTotal = stats.wholesaler_total_7d ?? 0;

  return (
    <div className="border-b border-emerald-100 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/30">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-1.5 transition-colors hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30">
        <button
          type="button"
          onClick={() => setShowDetail((s) => !s)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[11px] font-bold text-emerald-800 dark:text-emerald-300"
          aria-expanded={showDetail}
        >
          <span className="text-emerald-600 dark:text-emerald-400"><ShieldIcon /></span>
          <span className="truncate">오늘 득템잡이가 차단한 매물:</span>
          <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
            {total.toLocaleString("ko-KR")}건
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setShowDetail((s) => !s)}
            className="flex items-center gap-0.5 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[9px] font-black text-white"
          >
            {showDetail ? "접기" : "상세"}
            <ChevronDownIcon open={showDetail} />
          </button>
          <button
            type="button"
            onClick={hideForWeek}
            className="flex items-center gap-0.5 rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-black text-emerald-800 hover:bg-white dark:bg-zinc-900/70 dark:text-emerald-200"
            aria-label="차단 통계 7일 숨김"
          >
            <XIcon />
            숨김
          </button>
        </div>
      </div>
      {showDetail && (
        <div className="mx-auto max-w-6xl border-t border-emerald-200/70 bg-emerald-50/40 px-4 py-2.5 text-[10px] dark:border-emerald-900/70 dark:bg-emerald-950/20">
          <div className="grid gap-x-6 gap-y-0.5 md:grid-cols-2 lg:grid-cols-3">
            {collectionStageTotal > 0 && (
              <div className="space-y-0.5">
                <GroupHeader label="매물 분류 단계 차단" />
                <StatRow label="부품·단품만 판매" count={stats.listing_parts_7d ?? 0} />
                <StatRow label="액세서리·구성품만" count={stats.listing_accessory_7d ?? 0} />
                <StatRow label="손상·파손 매물" count={stats.listing_damaged_7d ?? 0} />
                <StatRow label="광고·홍보·매크로" count={stats.listing_callout_7d ?? 0} />
                <StatRow label="상업·전문 판매업자" count={stats.listing_commercial_7d ?? 0} />
                <StatRow label="매입 요청 글" count={stats.listing_buying_7d ?? 0} />
                <StatRow label="다중 상품 묶음" count={stats.listing_multi_7d ?? 0} />
              </div>
            )}
            {(parserMissTotal > 0 || marketMismatchTotal > 0) && (
              <div className="space-y-0.5">
                {parserMissTotal > 0 && (
                  <>
                    <GroupHeader label="모델 식별 실패" />
                    <StatRow label="모델·옵션 식별 불충분" count={parserMissTotal} />
                  </>
                )}
                {marketMismatchTotal > 0 && (
                  <>
                    <GroupHeader label="거래·시세 불일치" />
                    <StatRow label="거래 거부 표시 가격" count={stats.price_dummy_7d ?? 0} />
                    <StatRow label="차익 미달 매물" count={stats.profit_low_7d ?? 0} />
                    <StatRow label="거래 종료·사라진 매물" count={stats.lifecycle_gone_7d ?? 0} />
                    <StatRow label="시세 표본 부족" count={stats.thin_market_7d ?? 0} />
                    <StatRow label="시세 미산정 매물" count={stats.stat_missing_7d ?? 0} />
                  </>
                )}
              </div>
            )}
            {(productRiskTotal > 0 || wholesalerTotal > 0) && (
              <div className="space-y-0.5">
                {productRiskTotal > 0 && (
                  <>
                    <GroupHeader label="상품 위험" />
                    <StatRow label="위조품·도난·잠금" count={stats.fake_or_lock_7d ?? 0} />
                    <StatRow label="사용 권한·잔여 채무" count={stats.carrier_mismatch_7d ?? 0} />
                    <StatRow label="비정상 할인 의심" count={stats.suspicious_price_7d ?? 0} />
                  </>
                )}
                {wholesalerTotal > 0 && (
                  <>
                    <GroupHeader label="업자·사기 그룹" />
                    <StatRow label="흥정 위주 호가" count={stats.wholesaler_comment_7d ?? 0} />
                    <StatRow label="대량 재고 매물" count={stats.wholesaler_qty_7d ?? 0} />
                    <StatRow label="동일 셀러 중복" count={stats.seller_multi_listings_7d ?? 0} />
                    <StatRow label="다중 ID 의심 그룹" count={stats.multi_id_fraud_group_7d ?? 0} />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
