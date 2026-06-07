// Wave 1228 / 1228b: 비회원 메인 선착순 안내 — 슬림 1줄 strip(피드 안 가리게, 차분한 톤).
//   숫자는 /plans 와 동일(membership-slots). server component.

import Link from "next/link";

import { type SlotSnapshot } from "@/lib/membership-slots";

export default function FeedScarcityBanner({ slot }: { slot: SlotSnapshot }) {
  const remaining = Math.max(0, slot.capacity - slot.filled);

  return (
    <div className="mx-auto w-full max-w-[680px] px-3 pt-2">
      <Link
        href="/plans"
        prefetch={false}
        aria-label={`300명 한정 지역별 선착순, 남은 ${remaining}자리 — 내 지역 자리 확인`}
        className="group flex items-center gap-2 rounded-xl border border-amber-200/90 bg-amber-50/70 px-3 py-2 transition hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20"
      >
        <span className="inline-flex shrink-0 items-center rounded-md bg-amber-500 px-1.5 py-[3px] text-[10px] font-black leading-none text-white">
          선착순
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-amber-900 dark:text-amber-100">
          300명 한정 · 지역별 선착순{" "}
          <span className="text-amber-700 dark:text-amber-300">
            남은 <span className="tabular-nums">{remaining}</span>자리
          </span>
        </span>
        <span className="shrink-0 whitespace-nowrap text-[12px] font-black text-amber-700 transition group-hover:translate-x-0.5 dark:text-amber-300">
          내 자리 ›
        </span>
      </Link>
    </div>
  );
}
