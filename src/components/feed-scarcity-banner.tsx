// Wave 1228 / 1228e: 비회원 메인 선착순 피처드 카드 — 유튜브 '추천' 배너 톤(파스텔 카드 + 태그/헤드라인/CTA),
//   단 세로로 슬림한 가로형. 좌측 '남은 자리' 숫자가 비주얼 훅. 숫자는 /plans 와 동일(membership-slots).
//   CTA → 로그인(자리=로그인 후 payoff). server component.

import Link from "next/link";

import { type SlotSnapshot } from "@/lib/membership-slots";

export default function FeedScarcityBanner({ slot }: { slot: SlotSnapshot }) {
  const remaining = Math.max(0, slot.capacity - slot.filled);

  return (
    <div className="mx-auto w-full max-w-[680px] px-3 pt-2">
      <Link
        href="/login?next=/plans"
        prefetch={false}
        aria-label={`300명 한정 지역별 선착순, 남은 ${remaining}자리 — 로그인하고 내 지역 자리 확인`}
        className="group flex items-center gap-3.5 overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50 p-3 transition hover:shadow-[0_8px_24px_rgba(234,88,12,0.14)] dark:border-amber-900/40 dark:from-amber-950/30 dark:to-orange-950/15 sm:p-3.5"
      >
        {/* 좌측 비주얼 훅 — 남은 자리 숫자 */}
        <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-white/75 px-3.5 py-2 ring-1 ring-amber-200/70 dark:bg-zinc-900/50 dark:ring-amber-900/40">
          <div className="text-[22px] font-black leading-none tabular-nums text-orange-600 dark:text-orange-300">
            {remaining}
          </div>
          <div className="mt-1 text-[10px] font-black leading-none text-amber-700 dark:text-amber-300">자리 남음</div>
        </div>

        {/* 가운데 텍스트 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex shrink-0 items-center rounded-md bg-amber-500 px-1.5 py-[3px] text-[10px] font-black leading-none text-white">
              선착순
            </span>
            <span className="truncate text-[11px] font-bold text-amber-700 dark:text-amber-300">300명 한정 · 지역별</span>
          </div>
          <div className="mt-1 break-keep text-[15px] font-black leading-tight text-zinc-900 dark:text-white">
            지금 내 지역 자리 잡으세요
          </div>
          <div className="mt-0.5 truncate text-[11.5px] font-medium text-zinc-500 dark:text-zinc-400">
            마감되면 다음 기수까지 대기 · 로그인하면 내 지역 자리 바로 확인
          </div>
        </div>

        {/* CTA */}
        <span className="shrink-0 self-center whitespace-nowrap rounded-full bg-zinc-900 px-3.5 py-2 text-[12px] font-black text-white transition group-hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">
          내 자리 →
        </span>
      </Link>
    </div>
  );
}
