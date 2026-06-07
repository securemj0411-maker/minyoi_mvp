// Wave 1228: 비회원 메인 최상단 선착순 긴급성 배너.
//   광고 유입이 로그인 전에 "선착순 300명·지역 한정"을 느끼게. 숫자는 /plans 와 동일(membership-slots).
//   server component (page.tsx 비로그인 분기에서 slot 계산 후 prop 전달).

import Link from "next/link";

import { type SlotSnapshot } from "@/lib/membership-slots";

export default function FeedScarcityBanner({ slot }: { slot: SlotSnapshot }) {
  const { filled, capacity } = slot;
  const remaining = Math.max(0, capacity - filled);
  const pct = Math.max(0, Math.min(100, Math.round((filled / capacity) * 100)));

  return (
    <section aria-label="선공개 선착순 안내" className="mx-auto mt-3 w-full max-w-[680px] px-3 sm:mt-4">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 px-4 py-4 text-white shadow-[0_16px_44px_rgba(234,88,12,0.3)] sm:px-5 sm:py-5">
        <div className="text-[12px] font-black uppercase tracking-[0.12em] text-amber-50">
          🔥 선공개 베타 · 지역별 선착순
        </div>
        <h2 className="mt-1.5 break-keep text-[21px] font-black leading-tight sm:text-[25px]">
          전국 <span className="tabular-nums">300명</span>만 받아요 — 지역마다 자리가 따로 있어요
        </h2>

        <div className="mt-3 rounded-xl bg-black/15 p-3 ring-1 ring-white/20">
          <div className="flex items-end justify-between gap-2">
            <span className="text-[13px] font-bold text-amber-50">지금까지 채워진 자리</span>
            <span className="font-mono text-[16px] font-black tabular-nums">
              {filled.toLocaleString("ko-KR")} / {capacity.toLocaleString("ko-KR")}
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/25">
            <div className="h-full rounded-full bg-white/95" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 text-[12px] font-bold text-amber-50">
            {pct}% 마감 · 남은 자리 <span className="tabular-nums">{remaining.toLocaleString("ko-KR")}</span>석 — 마감되면 다음 기수까지 대기예요.
          </div>
        </div>

        <Link
          href="/plans"
          prefetch={false}
          className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-white px-4 text-[15px] font-black text-orange-700 shadow-lg transition hover:bg-amber-50"
        >
          내 지역 남은 자리 확인하기 →
        </Link>
        <p className="mt-2 text-center text-[11px] font-bold text-amber-50/90">
          내 지역 자리는 시작하면 바로 보여요. 선착순이라 지금 자리도 곧 닫힐 수 있어요.
        </p>
      </div>
    </section>
  );
}
