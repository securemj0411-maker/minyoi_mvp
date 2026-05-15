"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  cancelClientPlan,
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const state = await loadClientPlan().catch(() => null);
    setPlan(state);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => { void refresh(); };
    window.addEventListener("minyoi:credits-changed", handler);
    return () => window.removeEventListener("minyoi:credits-changed", handler);
  }, [refresh]);

  async function handleCancel() {
    if (busy) return;
    if (!window.confirm("구독을 취소할까요? 결제한 기간이 끝날 때까지는 계속 사용할 수 있습니다.")) return;
    setBusy(true);
    setMessage(null);
    try {
      await cancelClientPlan("cancel");
      setMessage("취소 예약됐어요. 기간 종료 시 무료 플랜으로 전환됩니다.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "취소 실패");
    } finally {
      setBusy(false);
    }
  }

  async function handleReactivate() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await cancelClientPlan("reactivate");
      setMessage("구독을 다시 활성화했어요.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "재활성 실패");
    } finally {
      setBusy(false);
    }
  }

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
      <div className={card}>
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">현재 플랜</div>
          {cancelled ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">취소 예약</span>
          ) : isPaidPlan ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">활성</span>
          ) : null}
        </div>
        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="text-base font-black text-[#223127] dark:text-zinc-100">{planLabel}</div>
          {plan?.currentPeriodEnd ? (
            <div className="text-[11px] font-bold text-[#7a8478]">
              {cancelled ? "종료 " : "갱신 "}{formatPeriodEnd(plan.currentPeriodEnd)}
            </div>
          ) : null}
        </div>

        {/* 월 크레딧 사용량 */}
        <div className="mt-3">
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

        {/* 일일 사용량 */}
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

      {/* 액션 */}
      <div className="flex flex-col gap-1.5">
        {isPaidPlan ? (
          cancelled ? (
            <button
              type="button"
              onClick={handleReactivate}
              disabled={busy}
              className="flex w-full items-center justify-between rounded-xl bg-[#edf3eb] px-3 py-2.5 text-sm font-black text-[#2c3f31] hover:bg-[#dfe9dc] disabled:opacity-60 dark:bg-emerald-950/30 dark:text-emerald-200"
            >
              <span>구독 재활성화</span>
              <span className="text-emerald-700">↺</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy}
              className="flex w-full items-center justify-between rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-[#a04545] hover:bg-red-100 disabled:opacity-60 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <span>{busy ? "처리 중…" : "구독 취소"}</span>
              <span>×</span>
            </button>
          )
        ) : null}
        <Link
          href="/plans"
          onClick={onCloseAfterAction}
          className="flex w-full items-center justify-between rounded-xl bg-[#fffaf1] px-3 py-2.5 text-sm font-bold text-[#344136] hover:bg-[var(--brand-accent-soft)] dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <span>{isPaidPlan ? "다른 플랜 보기" : "요금제 보기"}</span>
          <span className="text-zinc-400">↗</span>
        </Link>
      </div>

      {message ? (
        <div className="rounded-xl bg-[#f1ebe1] px-3 py-2 text-[11px] font-bold text-[#3a4f40] dark:bg-zinc-900 dark:text-zinc-300">
          {message}
        </div>
      ) : null}
    </div>
  );
}
