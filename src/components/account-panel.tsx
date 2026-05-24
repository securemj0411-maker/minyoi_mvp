"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  loadClientPlan,
  type ClientPlanState,
} from "@/lib/client-billing";

function UsageBar({
  used,
  total,
  tone = "emerald",
  unlimited = false,
}: {
  used: number;
  total: number;
  tone?: "emerald" | "amber";
  unlimited?: boolean;
}) {
  if (unlimited) {
    return (
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#e5dccf] dark:bg-zinc-800">
        <div className="h-full w-full bg-gradient-to-r from-blue-400 to-blue-500" />
      </div>
    );
  }
  const safeTotal = Math.max(1, total);
  const safeUsed = Math.min(safeTotal, Math.max(0, used));
  const ratio = Math.round((safeUsed / safeTotal) * 100);
  const fill =
    tone === "amber"
      ? ratio >= 90
        ? "bg-red-500"
        : ratio >= 60
          ? "bg-amber-500"
          : "bg-amber-400"
      : ratio >= 90
        ? "bg-red-500"
        : ratio >= 60
          ? "bg-amber-500"
          : "bg-blue-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#e5dccf] dark:bg-zinc-800">
      <div
        className={`h-full ${fill} transition-all`}
        style={{ width: `${ratio}%` }}
      />
    </div>
  );
}

// Wave launch-89: formatPeriodEnd 제거 — 구독제 플랜 카드 없어지면서 사용처 없음.

export function AccountPanel({
  tokens,
  infiniteCredits,
  variant = "desktop",
  onCloseAfterAction,
}: {
  tokens: number;
  infiniteCredits: boolean;
  variant?: "desktop" | "mobile";
  onCloseAfterAction?: () => void;
}) {
  const [plan, setPlan] = useState<ClientPlanState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const state = await loadClientPlan().catch(() => null);
    setPlan(state);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const handler = () => { void refresh(); };
    window.addEventListener("minyoi:credits-changed", handler);
    return () => window.removeEventListener("minyoi:credits-changed", handler);
  }, [refresh]);

  const wrap =
    variant === "desktop"
      ? "space-y-2.5 px-1 py-1"
      : "space-y-3";
  const card =
    variant === "desktop"
      ? "rounded-xl bg-[#fffaf1] px-3 py-2.5 dark:bg-zinc-900"
      : "rounded-xl bg-[#f6efe4] px-3 py-3 dark:bg-zinc-900";

  const monthlyTotal = plan?.monthlyCredits ?? 0;
  const monthlyUsed = monthlyTotal > 0 ? Math.max(0, monthlyTotal - tokens) : 0;
  const unlimited = infiniteCredits || plan?.dailyLimit === -1;

  // Wave launch-89 (사용자 정정 — "우리 지금 구독제 없어서 플랜이란게 없음"):
  //   "현재 플랜 / Free / 갱신 N월 N일" 카드 통째로 제거 — 구독제 무.
  //   대신 크레딧 카드 안에 "충전하기" CTA 통합.

  return (
    <div className={wrap}>
      {/* 카드 1 — 크레딧 + 충전 CTA */}
      <div className={card}>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">크레딧 사용</div>
        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#5d735f] dark:text-blue-400">
            <span>보유 크레딧</span>
            <span className="tabular-nums text-[#223127] dark:text-zinc-100">
              {unlimited ? "∞" : `${tokens} / ${monthlyTotal || tokens || "—"}`}
            </span>
          </div>
          <div className="mt-1.5">
            <UsageBar used={monthlyUsed} total={monthlyTotal} unlimited={unlimited || monthlyTotal === 0} />
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-[11px] font-semibold leading-5 text-[#7a8478] ring-1 ring-[#eadfce] dark:bg-zinc-950/50 dark:text-zinc-400 dark:ring-zinc-800">
          첫 3개 상품은 무료로 열리고, 이후 새 상품은 1크레딧씩 차감됩니다. 이미 본 상품은 다시 봐도 차감되지 않아요.
        </div>
        <Link
          href="/plans"
          onClick={onCloseAfterAction}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#3182f6] px-3 py-2.5 text-[13px] font-black text-white shadow-sm transition hover:bg-[#1c6fe8] active:scale-[0.99]"
        >
          크레딧 충전하기
          <span className="text-white/85">→</span>
        </Link>
      </div>

      {/* Wave 106: 회원 탈퇴 entry — 한국 개인정보보호법 의무 + 사용자 권리. 별도 페이지로 분리해 실수 방지. */}
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
