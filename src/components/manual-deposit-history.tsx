"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { formatKrw } from "@/lib/plan-config";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ManualDepositStatus = "pending" | "approved" | "auto_approved" | "rejected" | string;

type ManualDepositHistoryItem = {
  id: number;
  planKey: string;
  credits: number;
  priceKrw: number;
  depositorName: string;
  status: ManualDepositStatus;
  scheduledAutoApproveAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  createdAt: string;
};

type LoadState = "loading" | "ready" | "guest" | "error";

const STATUS_COPY: Record<string, { label: string; className: string; helper: string }> = {
  pending: {
    label: "확인 중",
    className: "bg-blue-50 text-[#3182f6] ring-blue-100 dark:bg-blue-950/35 dark:text-blue-200 dark:ring-blue-900/60",
    helper: "입금 확인이 끝나면 상태가 바뀌어요.",
  },
  approved: {
    label: "승인 완료",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/35 dark:text-emerald-200 dark:ring-emerald-900/60",
    helper: "운영자가 확인하고 크레딧을 지급했어요.",
  },
  auto_approved: {
    label: "자동 지급",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/35 dark:text-emerald-200 dark:ring-emerald-900/60",
    helper: "대기 시간이 지나 크레딧이 지급됐어요.",
  },
  rejected: {
    label: "거절",
    className: "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/35 dark:text-rose-200 dark:ring-rose-900/60",
    helper: "입금 확인이 안 된 신청이에요. 다시 신청할 수 있어요.",
  },
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusMeta(status: ManualDepositStatus) {
  return STATUS_COPY[status] ?? {
    label: status,
    className: "bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
    helper: "처리 상태를 확인 중이에요.",
  };
}

export default function ManualDepositHistory() {
  const [state, setState] = useState<LoadState>("loading");
  const [requests, setRequests] = useState<ManualDepositHistoryItem[]>([]);

  const load = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setState("guest");
      return;
    }

    try {
      setState((prev) => (prev === "ready" ? "ready" : "loading"));
      const token = (await supabase.auth.getSession()).data.session?.access_token ?? null;
      if (!token) {
        setState("guest");
        setRequests([]);
        return;
      }
      const res = await fetch("/api/billing/manual-deposit/history", {
        cache: "no-store",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        setState("guest");
        setRequests([]);
        return;
      }
      if (!res.ok) throw new Error("history lookup failed");
      const data = (await res.json()) as { requests?: ManualDepositHistoryItem[] };
      setRequests(Array.isArray(data.requests) ? data.requests : []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener("minyoi:credits-changed", load);
    return () => window.removeEventListener("minyoi:credits-changed", load);
  }, [load]);

  return (
    <section className="mt-3 rounded-[16px] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-black text-zinc-950 dark:text-zinc-50">입금 신청 내역</h2>
          <p className="mt-1 break-keep text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
            승인·거절 상태를 여기서 확인할 수 있어요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex h-8 shrink-0 items-center rounded-full border border-zinc-200 bg-white px-3 text-[11px] font-black text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          새로고침
        </button>
      </div>

      {state === "loading" ? (
        <div className="mt-4 grid gap-2">
          {[0, 1].map((idx) => (
            <div key={idx} className="h-[74px] animate-pulse rounded-[14px] bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      ) : state === "guest" ? (
        <div className="mt-4 rounded-[14px] bg-[#f5f7fb] px-3.5 py-3 text-[12px] font-bold leading-5 text-zinc-600 dark:bg-zinc-950/55 dark:text-zinc-300">
          로그인하면 내 입금 신청 내역을 볼 수 있어요.{" "}
          <Link href="/login" className="font-black text-[#3182f6] hover:underline dark:text-blue-300">
            로그인하기
          </Link>
        </div>
      ) : state === "error" ? (
        <div className="mt-4 rounded-[14px] bg-rose-50 px-3.5 py-3 text-[12px] font-bold leading-5 text-rose-700 dark:bg-rose-950/35 dark:text-rose-200">
          내역을 불러오지 못했어요. 잠시 후 다시 확인해주세요.
        </div>
      ) : requests.length === 0 ? (
        <div className="mt-4 rounded-[14px] bg-[#f5f7fb] px-3.5 py-3 text-[12px] font-bold leading-5 text-zinc-600 dark:bg-zinc-950/55 dark:text-zinc-300">
          아직 입금 신청 내역이 없어요.
        </div>
      ) : (
        <div className="mt-4 divide-y divide-zinc-100 overflow-hidden rounded-[14px] border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {requests.map((request) => {
            const meta = statusMeta(request.status);
            const handledAt = request.decidedAt ?? (request.status === "pending" ? request.scheduledAutoApproveAt : null);
            const handledLabel = request.status === "pending" ? "예정" : "처리";
            return (
              <article key={request.id} className="bg-white px-3.5 py-3 dark:bg-zinc-950/35">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[14px] font-black text-zinc-950 dark:text-zinc-50">
                        {request.credits.toLocaleString("ko-KR")} 크레딧
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                      신청 {formatDateTime(request.createdAt)}
                      {handledAt ? ` · ${handledLabel} ${formatDateTime(handledAt)}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[13px] font-black text-zinc-950 dark:text-zinc-50">{formatKrw(request.priceKrw)}</div>
                    <div className="mt-1 text-[10px] font-bold text-zinc-400 dark:text-zinc-500">#{request.id}</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                  <span>입금자 {request.depositorName}</span>
                  <span className="text-zinc-300 dark:text-zinc-700">·</span>
                  <span>{meta.helper}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
