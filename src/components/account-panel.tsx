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
        <div className="h-full w-full bg-gradient-to-r from-emerald-400 to-emerald-500" />
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
          : "bg-emerald-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#e5dccf] dark:bg-zinc-800">
      <div
        className={`h-full ${fill} transition-all`}
        style={{ width: `${ratio}%` }}
      />
    </div>
  );
}

function formatPeriodEnd(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return "—";
  }
}

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
  const dailyLimit = plan?.dailyLimit ?? 0;
  const dailyUsed = plan?.dailyUsed ?? 0;
  const unlimited = infiniteCredits || dailyLimit < 0;
  const planLabel = plan?.planName ?? (loading ? "불러오는 중…" : "Free");
  const cancelled = plan?.cancelAtPeriodEnd === true;
  const isPaidPlan = plan?.planKey === "starter" || plan?.planKey === "plus" || plan?.planKey === "pro";

  return (
    <div className={wrap}>
      {/* 카드 1 — 크레딧 (월 + 일일 사용량) */}
      <div className={card}>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">크레딧 사용</div>
        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#5d735f] dark:text-emerald-400">
            <span>월 크레딧</span>
            <span className="tabular-nums text-[#223127] dark:text-zinc-100">
              {unlimited ? "∞" : `${tokens} / ${monthlyTotal || tokens || "—"}`}
            </span>
          </div>
          <div className="mt-1.5">
            <UsageBar used={monthlyUsed} total={monthlyTotal} unlimited={unlimited || monthlyTotal === 0} />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#8b6914] dark:text-amber-400">
            <span>오늘 열람</span>
            <span className="tabular-nums text-[#223127] dark:text-zinc-100">
              {unlimited ? "∞" : `${dailyUsed} / ${dailyLimit || "—"}`}
            </span>
          </div>
          <div className="mt-1.5">
            <UsageBar used={dailyUsed} total={dailyLimit} tone="amber" unlimited={unlimited || dailyLimit <= 0} />
          </div>
          {!unlimited && dailyLimit > 0 && dailyUsed >= dailyLimit ? (
            <div className="mt-1.5 text-[11px] font-bold text-red-600">오늘 한도를 모두 사용했어요. 내일 다시 열 수 있습니다.</div>
          ) : null}
        </div>
      </div>

      {/* 카드 2 — 플랜 (정보만. 카드 전체 클릭 → /plans 페이지에서 관리) */}
      <Link
        href="/plans"
        onClick={onCloseAfterAction}
        className={`block ${card} group cursor-pointer transition hover:bg-[var(--brand-accent-soft)] dark:hover:bg-zinc-800`}
      >
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">현재 플랜</div>
          {cancelled ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">취소 예약</span>
          ) : isPaidPlan ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">활성</span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 truncate text-base font-black text-[#223127] dark:text-zinc-100">{planLabel}</div>
          <span className="shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-[var(--brand-accent-strong)]">→</span>
        </div>
        {plan?.currentPeriodEnd ? (
          <div className="mt-1 text-[11px] font-bold text-[#7a8478]">
            {cancelled ? "종료 " : "갱신 "}{formatPeriodEnd(plan.currentPeriodEnd)}
          </div>
        ) : null}
        <div className="mt-1.5 text-[11px] font-semibold text-[#7a8478] dark:text-zinc-500">
          {isPaidPlan ? "탭해서 변경 · 구독 취소" : "탭해서 요금제 보기"}
        </div>
      </Link>

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
