"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { loadClientPlan, type ClientPlanState } from "@/lib/client-billing";

export function AccountPanel({
  variant = "desktop",
  onCloseAfterAction,
}: {
  variant?: "desktop" | "mobile";
  onCloseAfterAction?: () => void;
}) {
  const [plan, setPlan] = useState<ClientPlanState | null>(null);

  const refresh = useCallback(async () => {
    const state = await loadClientPlan().catch(() => null);
    setPlan(state);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const wrap = variant === "desktop" ? "space-y-2.5 px-1 py-1" : "space-y-3";
  const card = variant === "desktop"
    ? "rounded-xl bg-[#fffaf1] px-3 py-2.5 dark:bg-zinc-900"
    : "rounded-xl bg-[#f6efe4] px-3 py-3 dark:bg-zinc-900";
  const approved = plan?.planKey === "pro" || plan?.dailyLimit === -1 || plan?.isAdmin === true;

  return (
    <div className={wrap}>
      <div className={card}>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">멤버십</div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="text-[14px] font-black text-zinc-950 dark:text-zinc-100">
            {approved ? "멤버십 활성화" : "승인 대기"}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${
            approved
              ? "bg-blue-50 text-[#3182f6] dark:bg-blue-950/30 dark:text-blue-200"
              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          }`}>
            {approved ? "승인됨" : "신청 필요"}
          </span>
        </div>
        <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-[11px] font-semibold leading-5 text-[#7a8478] ring-1 ring-[#eadfce] dark:bg-zinc-950/50 dark:text-zinc-400 dark:ring-zinc-800">
          승인된 계정은 추천 피드와 상세 리포트를 멤버십 안에서 이용할 수 있어요.
        </div>
        <Link
          href={approved ? "/me" : "/plans"}
          onClick={onCloseAfterAction}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#3182f6] px-3 py-2.5 text-[13px] font-black text-white shadow-sm transition hover:bg-[#1c6fe8] active:scale-[0.99]"
        >
          {approved ? "내 상품 피드 보기" : "멤버십 신청하기"}
          <span className="text-white/85">→</span>
        </Link>
      </div>

      <div className="mt-3 border-t border-[#eee5d8] pt-2 dark:border-zinc-800">
        <Link
          href="/me/account/delete"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-400 transition hover:text-red-600 dark:text-zinc-600 dark:hover:text-red-400"
        >
          회원 탈퇴
        </Link>
      </div>
    </div>
  );
}
