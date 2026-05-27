"use client";

// Wave 775 (2026-05-27): mock PG processing 페이지 — manual-deposit-client.tsx 의 자매.
//   manual page 의 "토스 앱으로 송금하기" 클릭 → 이 페이지로 navigate.
//   페이지 진입 즉시 토스 deep link 호출 (iOS 는 user gesture 우회 — 일부 차단 가능).
//   "토스 다시 열기" 버튼 fallback (사용자 클릭) + "송금 완료, 입금 확인" CTA.
//   카톡 닉네임 (displayNameForUser) 자동 사용 — depositorName input 제거.
//   submit + realtime + polling logic 은 manual-deposit-client 와 동일 (logic 추출은 추후 refactor).

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { displayNameForUser } from "@/lib/auth-users";
import { formatKrw, planForKey, type PlanKey } from "@/lib/plan-config";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { openKakaopayQr, openTossSend } from "@/lib/toss-deeplink";

type PaymentMethod = "toss" | "kakaopay";

const CREDIT_PACKAGE_TO_PLAN: Record<string, Exclude<PlanKey, "free">> = {
  "1": "single",
  "5": "trial",
  "20": "starter",
  "45": "plus",
  "130": "pro",
};
const VALID: Exclude<PlanKey, "free">[] = ["single", "trial", "starter", "plus", "pro"];

type Stage = "ready" | "submitting" | "waiting" | "approved" | "error";

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ProcessingClient() {
  const params = useSearchParams();
  const router = useRouter();
  const creditPackageParam = params.get("credits");
  const planKeyParam = (params.get("plan") ?? "").toLowerCase();
  const methodParam = (params.get("method") ?? "toss").toLowerCase();
  const method: PaymentMethod = methodParam === "kakaopay" ? "kakaopay" : "toss";
  const planKey =
    creditPackageParam && CREDIT_PACKAGE_TO_PLAN[creditPackageParam]
      ? CREDIT_PACKAGE_TO_PLAN[creditPackageParam]
      : VALID.includes(planKeyParam as Exclude<PlanKey, "free">)
        ? (planKeyParam as Exclude<PlanKey, "free">)
        : "starter";
  const plan = planForKey(planKey);

  const [stage, setStage] = useState<Stage>("ready");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState<"loading" | "authed" | "guest">("loading");
  const [user, setUser] = useState<User | null>(null);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(180);
  const [approvedBy, setApprovedBy] = useState<"admin" | "auto" | null>(null);
  const autoFiredRef = useRef(false);

  const autoDepositorName = displayNameForUser(user);

  // auth + user 정보 fetch
  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthReady("guest");
      return;
    }
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUser(data.user ?? null);
      setAuthReady(data.user ? "authed" : "guest");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 페이지 로드 시 method 에 맞는 deep link 자동 호출 (1회만).
  //   iOS 는 user gesture 없으면 일부 차단 가능 — fallback 으로 "다시 열기" 버튼 제공.
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (authReady === "loading") return;
    autoFiredRef.current = true;
    const t = window.setTimeout(() => {
      if (method === "kakaopay") {
        openKakaopayQr(plan.priceKrw);
      } else {
        openTossSend(plan.priceKrw);
      }
    }, 300); // 페이지 transition 끝나고 호출
    return () => window.clearTimeout(t);
  }, [authReady, method, plan.priceKrw]);

  // waiting countdown
  useEffect(() => {
    if (stage !== "waiting") return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [stage]);

  // realtime + polling fallback (manual-deposit-client.tsx 와 동일 logic)
  useEffect(() => {
    if (stage !== "waiting" || requestId == null) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;

    const handleStatusUpdate = (status: string, decidedBy: string | null) => {
      if (cancelled) return;
      if (status === "approved" || status === "auto_approved") {
        setApprovedBy(decidedBy === "admin" ? "admin" : "auto");
        setStage("approved");
        window.dispatchEvent(new CustomEvent("minyoi:credits-changed"));
        window.setTimeout(() => router.push("/"), 2400);
      } else if (status === "rejected") {
        setErrorMessage("운영자가 신청을 거절했어요. 입금이 확인되지 않아요.");
        setStage("error");
      }
    };

    const channel = supabase
      .channel(`manual-deposit-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mvp_manual_deposit_requests",
          filter: `id=eq.${requestId}`,
        },
        (payload) => {
          const row = payload.new as { status?: string; decided_by?: string | null } | null;
          if (!row?.status) return;
          handleStatusUpdate(row.status, row.decided_by ?? null);
        },
      )
      .subscribe();

    const fallbackPoll = async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const token = session?.access_token ?? null;
        const res = await fetch(`/api/billing/manual-deposit/${requestId}`, {
          cache: "no-store",
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string; decidedBy?: string | null };
        if (data.status) handleStatusUpdate(data.status, data.decidedBy ?? null);
      } catch {
        /* swallow */
      }
    };
    void fallbackPoll();
    const timer = window.setInterval(fallbackPoll, 10000);

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      window.clearInterval(timer);
    };
  }, [stage, requestId, router]);

  async function handleConfirm() {
    setErrorMessage(null);
    const cleanName = autoDepositorName.trim().slice(0, 40);
    if (cleanName.length < 1) {
      setErrorMessage("로그인이 필요해요. 다시 로그인 후 시도해주세요.");
      return;
    }
    setStage("submitting");
    try {
      const supabase = getSupabaseBrowserClient();
      const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
      const res = await fetch("/api/billing/manual-deposit", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ planKey, depositorName: cleanName }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        requestId?: number;
        etaSeconds?: number;
      };
      if (!res.ok || !data.ok) {
        const friendly = data.message ?? "충전 신청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.";
        setErrorMessage(friendly);
        setStage("error");
        return;
      }
      const reqId = Number(data.requestId);
      if (!Number.isFinite(reqId) || reqId <= 0) {
        setErrorMessage("신청 ID를 받지 못했어요.");
        setStage("error");
        return;
      }
      setRequestId(reqId);
      setSecondsLeft(Math.max(60, Math.min(300, Number(data.etaSeconds ?? 180))));
      setStage("waiting");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "네트워크 오류가 발생했어요.");
      setStage("error");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-3 py-3 dark:bg-zinc-950 sm:px-5 sm:py-7">
      <div className="mx-auto w-full max-w-[560px]">
        {/* Header — PG 결제 처리 중 느낌 */}
        <section className="rounded-[18px] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Link
            href="/billing/manual"
            className="inline-flex items-center gap-1 text-[12px] font-bold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← 충전 안내로 돌아가기
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ebf2ff] text-[#3182f6] dark:bg-blue-950/40 dark:text-blue-300">
              {stage === "approved" ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
            </span>
            <div>
              <h1 className="text-[20px] font-black leading-tight tracking-tight text-zinc-950 dark:text-zinc-50">
                {stage === "approved" ? "결제 완료" : "결제 처리 중"}
              </h1>
              <p className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400">
                {plan.monthlyCredits.toLocaleString("ko-KR")} 크레딧 · {formatKrw(plan.priceKrw)}
              </p>
            </div>
          </div>
        </section>

        {/* method 별 안내 + 다시 열기 */}
        {stage === "ready" || stage === "submitting" || stage === "error" ? (
          <section className="mt-3 rounded-[16px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            {method === "kakaopay" ? (
              <>
                <div className="text-[13px] font-black text-zinc-950 dark:text-zinc-50">카카오페이가 열렸나요?</div>
                <p className="mt-1.5 break-keep text-[12px] font-medium leading-5 text-zinc-600 dark:text-zinc-300">
                  카카오페이 송금 화면에 <b>{formatKrw(plan.priceKrw)}</b> 가 자동으로 채워져 있어요. 메모에 카톡 닉네임을 적어주시면 매칭이 빨라요.
                </p>
              </>
            ) : (
              <>
                <div className="text-[13px] font-black text-zinc-950 dark:text-zinc-50">토스 앱이 열렸나요?</div>
                <p className="mt-1.5 break-keep text-[12px] font-medium leading-5 text-zinc-600 dark:text-zinc-300">
                  토스 송금 화면에서 <b>"받는 분에게 표시"</b> 항목을 카톡 닉네임으로 바꿔주시면 매칭이 빨라요.
                  아래 입금자명과 같은 이름이면 자동 확인돼요.
                </p>
              </>
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => (method === "kakaopay" ? openKakaopayQr(plan.priceKrw) : openTossSend(plan.priceKrw))}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#cfddf7] bg-[#f5f9ff] text-[13px] font-black text-[#3182f6] transition hover:bg-[#ebf2ff] dark:border-zinc-700 dark:bg-blue-950/24 dark:text-blue-300 dark:hover:bg-blue-950/40"
              >
                {method === "kakaopay" ? "카카오페이 다시 열기" : "토스 다시 열기"}
              </button>
              <button
                type="button"
                onClick={() => {
                  // 다른 method 로 전환 — autoFiredRef 리셋해서 다시 열림
                  autoFiredRef.current = false;
                  const otherMethod = method === "kakaopay" ? "toss" : "kakaopay";
                  router.replace(`/billing/processing?credits=${plan.monthlyCredits}&plan=${planKey}&method=${otherMethod}`);
                }}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white text-[12.5px] font-black text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {method === "kakaopay" ? "토스로 바꾸기" : "카카오페이로 바꾸기"}
              </button>
            </div>

            {/* 카톡 닉네임 자동 안내 */}
            {authReady === "authed" && autoDepositorName ? (
              <div className="mt-3 rounded-[14px] bg-[#f5f9ff] px-3.5 py-2.5 dark:bg-blue-950/24">
                <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">입금자명 (자동 — 카톡 닉네임)</div>
                <div className="mt-0.5 text-[14px] font-black text-zinc-950 dark:text-zinc-50">{autoDepositorName}</div>
              </div>
            ) : null}

            {/* "입금 확인" 큰 CTA */}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={authReady !== "authed" || stage === "submitting"}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#3182f6] text-[14.5px] font-black text-white shadow-[0_10px_22px_rgba(49,130,246,0.28)] transition hover:bg-[#1c6fe8] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {stage === "submitting" ? (
                <>
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:-0.32s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:-0.16s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white" />
                </>
              ) : (
                <>송금 완료 — 입금 확인하기</>
              )}
            </button>
            <p className="mt-2 break-keep text-[11px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
              버튼을 누르면 운영자가 3분 안에 입금을 확인하고 크레딧이 자동으로 들어와요.
            </p>

            {errorMessage ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {errorMessage}
              </div>
            ) : null}

            {authReady === "guest" ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                로그인이 필요해요. <Link href="/login" className="underline">로그인하기</Link>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* waiting — 3분 카운트다운 */}
        {stage === "waiting" ? (
          <section className="mt-3 rounded-[16px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff7e6] text-[#b7791f] dark:bg-amber-950/40 dark:text-amber-300">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              </span>
              <div>
                <div className="text-[14px] font-black text-zinc-950 dark:text-zinc-50">입금 확인 중</div>
                <p className="text-[12px] font-bold text-zinc-500 dark:text-zinc-400">
                  {formatCountdown(secondsLeft)} 안에 크레딧이 자동 지급돼요.
                </p>
              </div>
            </div>
            <p className="mt-3 break-keep text-[11.5px] font-medium leading-5 text-zinc-600 dark:text-zinc-300">
              운영자가 입금을 확인하면 즉시 크레딧이 지급돼요. 시간이 지나도 자동으로 처리됩니다.
            </p>
          </section>
        ) : null}

        {/* approved */}
        {stage === "approved" ? (
          <section className="mt-3 rounded-[16px] border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/24">
            <div className="text-[14px] font-black text-emerald-700 dark:text-emerald-300">
              ✓ {plan.monthlyCredits.toLocaleString("ko-KR")} 크레딧이 지급됐어요
            </div>
            <p className="mt-1 text-[12px] font-bold text-emerald-700/80 dark:text-emerald-300/80">
              {approvedBy === "admin" ? "운영자가 즉시 승인했어요." : "자동으로 승인됐어요."} 잠시 후 홈으로 이동합니다.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
