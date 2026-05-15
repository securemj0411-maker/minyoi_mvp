"use client";

// Wave 139d (2026-05-16): 메인 페이지 네비게이션 바 아래 marquee.
// "오늘 미뇨이 AI가 차단한 의심 매물 X건 — 부품 단품 N · 액세서리만 N · ..." 우→좌 흐름.
// 사용자 명령: "네비게이션 바로 밑에 우→좌 흐르는 문구 — 사이트 신뢰 시그널".

import { useEffect, useState } from "react";

type SafetyStats = {
  total_blocked_7d: number;
  listing_parts_7d?: number;
  listing_damaged_7d?: number;
  listing_accessory_7d?: number;
  listing_callout_7d?: number;
  listing_commercial_7d?: number;
  listing_buying_7d?: number;
  listing_multi_7d?: number;
  needs_review_7d?: number;
  wholesaler_qty_7d?: number;
  seller_multi_listings_7d?: number;
  multi_id_fraud_group_7d?: number;
  wholesaler_comment_7d?: number;
  fake_or_lock_7d?: number;
  suspicious_price_7d?: number;
  profit_low_7d?: number;
  lifecycle_gone_7d?: number;
  thin_market_7d?: number;
  stat_missing_7d?: number;
};

function ShieldIcon() {
  return (
    <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function fmt(n: number | undefined | null): string {
  return (n ?? 0).toLocaleString("ko-KR");
}

export default function SafetyStatsMarquee() {
  const [stats, setStats] = useState<SafetyStats | null>(null);

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

  if (!stats || (stats.total_blocked_7d ?? 0) === 0) return null;

  // breakdown 텍스트 만들기 (각 카테고리 0 이상만 포함)
  const items: string[] = [];
  const push = (label: string, n: number | undefined) => {
    const v = n ?? 0;
    if (v > 0) items.push(`${label} ${fmt(v)}건`);
  };
  push("부품·단품만", stats.listing_parts_7d);
  push("액세서리·구성품만", stats.listing_accessory_7d);
  push("손상·파손", stats.listing_damaged_7d);
  push("광고·매크로", stats.listing_callout_7d);
  push("상업·전문 판매업자", stats.listing_commercial_7d);
  push("매입 요청 글", stats.listing_buying_7d);
  push("다중 상품 묶음", stats.listing_multi_7d);
  push("모델 식별 실패", stats.needs_review_7d);
  push("위조·도난·잠금", stats.fake_or_lock_7d);
  // price_dummy_7d 는 type에 없는 컬럼이라 카운트 X (필요시 추가). profit_low 만 한 번.
  push("차익 미달 매물", stats.profit_low_7d);
  push("비정상 할인 의심", stats.suspicious_price_7d);
  push("거래 종료·사라짐", stats.lifecycle_gone_7d);
  push("시세 표본 부족", stats.thin_market_7d);
  push("시세 미산정", stats.stat_missing_7d);
  push("흥정 호가 매물", stats.wholesaler_comment_7d);
  push("대량 재고 매물", stats.wholesaler_qty_7d);
  push("동일 셀러 중복", stats.seller_multi_listings_7d);
  push("다중 ID 사기 그룹", stats.multi_id_fraud_group_7d);

  const headline = `오늘 미뇨이 AI가 차단한 의심 매물 ${fmt(stats.total_blocked_7d)}건`;
  const tail = items.join(" · ");
  // 한 번 흐름 후 반복되어 자연스럽게 보이도록 동일 텍스트를 두 번 연결
  const fullText = `${headline}  —  ${tail}`;

  return (
    <div
      className="w-full overflow-hidden border-b border-emerald-100 bg-emerald-50/80 py-1.5 dark:border-emerald-900 dark:bg-emerald-950/40"
      aria-label="오늘 차단된 의심 매물 통계"
    >
      <div className="marquee-track flex whitespace-nowrap text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
        {/* duplicate for seamless loop */}
        <span className="mx-6 flex items-center gap-1.5">
          <ShieldIcon />
          <span>{fullText}</span>
        </span>
        <span className="mx-6 flex items-center gap-1.5" aria-hidden="true">
          <ShieldIcon />
          <span>{fullText}</span>
        </span>
      </div>
      <style jsx>{`
        .marquee-track {
          animation: marqueeScroll 60s linear infinite;
          will-change: transform;
        }
        @keyframes marqueeScroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        /* 호버 시 정지 (사용자가 텍스트 읽기 편하게) */
        .marquee-track:hover {
          animation-play-state: paused;
        }
        /* 모션 민감 사용자 배려 */
        @media (prefers-reduced-motion: reduce) {
          .marquee-track {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
