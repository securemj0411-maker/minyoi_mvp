"use client";

// Wave launch-95 (사용자 결정 — 토스페이먼츠 가맹심사 중 임시 흐름):
//   카드결제 불가 → 계좌이체 안내 + 입금자명 input + 즉시 grant.
//   가맹 승인 후엔 /billing/checkout (PortOne) 흐름 복원.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { formatKrw, planForKey, type PlanKey } from "@/lib/plan-config";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const BANK_NAME = "우리은행";
const ACCOUNT_NUMBER = "1002-367-160511";
const ACCOUNT_RAW = "1002367160511";
const ACCOUNT_HOLDER = "이민제";

const CREDIT_PACKAGE_TO_PLAN: Record<string, Exclude<PlanKey, "free">> = {
  "20": "starter",
  "200": "plus",
  "500": "pro",
};
const VALID: Exclude<PlanKey, "free">[] = ["starter", "plus", "pro"];

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Wave launch-97: countdown 추가. "waiting" = 신청 후 3분 카운트다운 + status polling.
// "approved" = 운영자 승인 또는 자동 grant 완료.
type Stage = "ready" | "submitting" | "waiting" | "approved" | "error";

export default function ManualDepositClient() {
  const params = useSearchParams();
  const router = useRouter();
  const creditPackageParam = params.get("credits");
  const planKeyParam = (params.get("plan") ?? "").toLowerCase();
  const planKey =
    creditPackageParam && CREDIT_PACKAGE_TO_PLAN[creditPackageParam]
      ? CREDIT_PACKAGE_TO_PLAN[creditPackageParam]
      : VALID.includes(planKeyParam as Exclude<PlanKey, "free">)
        ? (planKeyParam as Exclude<PlanKey, "free">)
        : "plus";
  const plan = planForKey(planKey);

  const [depositorName, setDepositorName] = useState("");
  const [stage, setStage] = useState<Stage>("ready");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);
  const [authReady, setAuthReady] = useState<"loading" | "authed" | "guest">("loading");
  // Wave launch-97: 신청 → 카운트다운 + polling.
  const [requestId, setRequestId] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(180);
  const [approvedBy, setApprovedBy] = useState<"admin" | "auto" | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthReady("guest");
      return;
    }
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setAuthReady(data.user ? "authed" : "guest");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Wave launch-97: waiting 상태에서 countdown 1초마다 감소.
  useEffect(() => {
    if (stage !== "waiting") return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [stage]);

  // Wave launch-97 + launch-97b: waiting 상태에서 2초마다 status polling.
  //   status = approved | auto_approved → setStage("approved") + credits-changed event.
  //   token 가 stale 일 가능성 대비 — credentials:"include" 로 cookies 명시 + token fallback.
  useEffect(() => {
    if (stage !== "waiting" || requestId == null) return;
    let cancelled = false;
    let timer: number | null = null;
    const poll = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const session = supabase ? (await supabase.auth.getSession()).data.session : null;
        const token = session?.access_token ?? null;
        const res = await fetch(`/api/billing/manual-deposit/${requestId}`, {
          cache: "no-store",
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          console.warn("[manual-deposit poll] non-ok", res.status);
          return;
        }
        const data = (await res.json()) as { status?: string; decidedBy?: string | null };
        if (cancelled) return;
        if (data.status === "approved" || data.status === "auto_approved") {
          setApprovedBy(data.decidedBy === "admin" ? "admin" : "auto");
          setStage("approved");
          window.dispatchEvent(new CustomEvent("minyoi:credits-changed"));
          window.setTimeout(() => router.push("/"), 2400);
        } else if (data.status === "rejected") {
          setErrorMessage("운영자가 신청을 거절했어요. 입금이 확인되지 않아요.");
          setStage("error");
        }
      } catch (err) {
        console.warn("[manual-deposit poll] threw", err instanceof Error ? err.message : String(err));
      }
    };
    void poll();
    timer = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      if (timer != null) window.clearInterval(timer);
    };
  }, [stage, requestId, router]);

  async function copyAccountNumber() {
    try {
      await navigator.clipboard.writeText(ACCOUNT_RAW);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 1600);
    } catch {
      setCopyOk(false);
    }
  }

  async function handleConfirm() {
    setErrorMessage(null);
    const cleanName = depositorName.trim();
    if (cleanName.length < 1) {
      setErrorMessage("입금자 성명을 입력해주세요.");
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
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !data.ok) {
        // 사용자 결정: rate limit 메시지 — "30분 뒤" 표시 X. 일반 안내.
        const friendly = data.message ?? "충전 신청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.";
        setErrorMessage(friendly);
        setStage("error");
        return;
      }
      // Wave launch-96 + 97: 신청 row 생성 → 카운트다운 + polling 시작.
      const reqData = data as { ok?: boolean; requestId?: number; etaSeconds?: number };
      const reqId = Number(reqData.requestId);
      if (!Number.isFinite(reqId) || reqId <= 0) {
        setErrorMessage("신청 ID를 받지 못했어요.");
        setStage("error");
        return;
      }
      setRequestId(reqId);
      setSecondsLeft(Math.max(60, Math.min(300, Number(reqData.etaSeconds ?? 180))));
      setStage("waiting");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "네트워크 오류가 발생했어요.");
      setStage("error");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-3 py-3 dark:bg-zinc-950 sm:px-5 sm:py-7">
      <div className="mx-auto w-full max-w-[560px]">
        {/* Header */}
        <section className="rounded-[18px] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Link
            href="/plans"
            className="inline-flex items-center gap-1 text-[12px] font-bold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← 패키지 다시 고르기
          </Link>
          <h1 className="mt-2 text-[22px] font-black leading-tight tracking-tight text-zinc-950 dark:text-zinc-50">
            계좌이체로 충전
          </h1>
          <p className="mt-2 break-keep text-[12.5px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
            토스페이먼츠 카드결제 가맹심사 중이라 빠르면 이번 주 안에 정식 결제가 열려요.
            그전까지는 계좌이체로 도와드릴게요.
          </p>
        </section>

        {/* 패키지 요약 */}
        <section className="mt-3 rounded-[16px] border-2 border-[#a5c4f7] bg-[#ebf2ff] p-4 dark:border-blue-800 dark:bg-blue-950/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#3182f6] dark:text-blue-300">충전 패키지</div>
              <div className="mt-1 text-[22px] font-black leading-none text-zinc-950 dark:text-zinc-50">
                {plan.monthlyCredits.toLocaleString("ko-KR")} 크레딧
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">결제금액</div>
              <div className="mt-1 text-[22px] font-black leading-none text-[#3182f6] dark:text-blue-300">
                {formatKrw(plan.priceKrw)}
              </div>
            </div>
          </div>
        </section>

        {/* 계좌 정보 */}
        <section className="mt-3 rounded-[16px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[13px] font-black text-zinc-950 dark:text-zinc-50">아래 계좌로 입금해주세요</div>

          <div className="mt-3 rounded-[14px] bg-[#f5f7fb] p-3 dark:bg-zinc-950/55">
            <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">{BANK_NAME}</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="font-black tabular-nums text-[20px] tracking-tight text-zinc-950 dark:text-zinc-50">
                {ACCOUNT_NUMBER}
              </div>
              <button
                type="button"
                onClick={copyAccountNumber}
                aria-label="계좌번호 복사"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#3182f6] ring-1 ring-zinc-200 transition hover:bg-[#ebf2ff] active:scale-[0.96] dark:bg-zinc-900 dark:text-blue-300 dark:ring-zinc-700 dark:hover:bg-blue-950/40"
              >
                {copyOk ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2.5" />
                    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                  </svg>
                )}
              </button>
            </div>
            <div className="mt-1 text-[12px] font-bold text-zinc-700 dark:text-zinc-300">예금주 {ACCOUNT_HOLDER}</div>
            {copyOk ? (
              <div className="mt-2 text-[11px] font-black text-[#3182f6] dark:text-blue-300">계좌번호가 복사됐어요</div>
            ) : null}
          </div>

          {/* 입금자명 */}
          <div className="mt-4">
            <label htmlFor="depositor-name" className="text-[12px] font-bold text-zinc-700 dark:text-zinc-300">
              입금자 성명
            </label>
            <input
              id="depositor-name"
              type="text"
              value={depositorName}
              onChange={(e) => setDepositorName(e.target.value)}
              placeholder="입금하신 분의 성함"
              maxLength={40}
              disabled={stage === "submitting" || stage === "waiting" || stage === "approved"}
              className="mt-1.5 flex h-11 w-full items-center rounded-xl border border-zinc-200 bg-white px-3 text-[14px] font-bold text-zinc-950 placeholder:text-zinc-400 focus:border-[#3182f6] focus:outline-none focus:ring-2 focus:ring-[#3182f6]/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <p className="mt-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              입금자 성명과 입력하신 이름이 같아야 빠르게 확인이 돼요.
            </p>
          </div>

          {/* 입금 완료 button */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={authReady !== "authed" || stage === "submitting" || stage === "waiting" || stage === "approved"}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#3182f6] text-[14.5px] font-black text-white shadow-[0_10px_22px_rgba(49,130,246,0.28)] transition hover:bg-[#1c6fe8] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {stage === "submitting" ? (
              <>
                <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:-0.32s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:-0.16s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-white" />
              </>
            ) : stage === "waiting" || stage === "approved" ? (
              <>신청 접수됨 — 잠시만요</>
            ) : (
              <>입금 완료 — 즉시 {plan.monthlyCredits.toLocaleString("ko-KR")}크레딧 받기</>
            )}
          </button>
          {/* success overlay 는 main 끝에 fullscreen 으로 추가 (button 안 카피보다 prominent). */}

          {authReady === "guest" ? (
            <p className="mt-2 text-center text-[12px] font-bold text-rose-600 dark:text-rose-400">
              로그인 후 충전할 수 있어요.{" "}
              <Link href="/login" className="underline">로그인하러 가기</Link>
            </p>
          ) : null}
          {errorMessage ? (
            <p className="mt-2 text-center text-[12px] font-bold text-rose-600 dark:text-rose-400">{errorMessage}</p>
          ) : null}
        </section>

        {/* 안내 */}
        <section className="mt-3 rounded-[14px] border border-zinc-200 bg-white px-4 py-3 text-[11px] leading-5 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          입금 완료 버튼을 누르면 즉시 크레딧이 지급돼요.
          실제 입금이 확인되지 않으면 운영자가 크레딧을 회수하고 계정을 차단할 수 있어요.
          {" "}
          <Link href="/refund-policy" className="font-black text-[#3182f6] hover:underline dark:text-blue-300">
            환불정책
          </Link>
        </section>
      </div>

      {/* Wave launch-97: waiting 단계 — 3분 카운트다운 + status polling. */}
      {stage === "waiting" ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="입금 확인 중"
        >
          <div className="mx-4 flex w-full max-w-[360px] flex-col items-center rounded-[28px] bg-white px-6 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.35)] dark:bg-zinc-950">
            <div className="success-check relative flex h-24 w-24 items-center justify-center rounded-full bg-[#ebf2ff] dark:bg-blue-950/40">
              <span className="text-[28px] font-black tabular-nums text-[#3182f6] dark:text-blue-300">
                {formatCountdown(secondsLeft)}
              </span>
            </div>
            <h2 className="mt-5 text-[22px] font-black text-zinc-950 dark:text-zinc-50">입금 확인 중</h2>
            <div className="mt-2 text-[16px] font-bold text-[#3182f6] dark:text-blue-300">
              {plan.monthlyCredits.toLocaleString("ko-KR")} 크레딧
            </div>
            <p className="mt-4 text-center text-[12.5px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
              운영자가 통장을 확인 중이에요.<br/>
              잠시만 기다려주세요.
            </p>
            <div className="mt-3 flex items-center gap-1">
              <span className="h-1.5 w-1.5 animate-bounce-high rounded-full bg-[#3182f6] [animation-delay:-0.32s]" />
              <span className="h-1.5 w-1.5 animate-bounce-high rounded-full bg-[#3182f6] [animation-delay:-0.16s]" />
              <span className="h-1.5 w-1.5 animate-bounce-high rounded-full bg-[#3182f6]" />
            </div>
          </div>
        </div>
      ) : null}

      {/* Wave launch-97: approved 단계 — 큰 ✓ + 2.4s 후 redirect. */}
      {stage === "approved" ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="충전 완료"
        >
          <div className="mx-4 flex w-full max-w-[340px] flex-col items-center rounded-[28px] bg-white px-6 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.35)] dark:bg-zinc-950">
            <div className="success-check flex h-20 w-20 items-center justify-center rounded-full bg-[#3182f6] shadow-[0_10px_24px_rgba(49,130,246,0.42)]">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2 className="mt-5 text-[22px] font-black text-zinc-950 dark:text-zinc-50">
              {approvedBy === "admin" ? "승인 완료!" : "지급 완료!"}
            </h2>
            <div className="mt-2 text-[16px] font-bold text-[#3182f6] dark:text-blue-300">
              +{plan.monthlyCredits.toLocaleString("ko-KR")} 크레딧
            </div>
            <p className="mt-4 text-center text-[12.5px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
              잠시 후 내 피드로 이동해요.
            </p>
          </div>
          <style jsx>{`
            @keyframes minyoiSuccessPop {
              0% { transform: scale(0.5); opacity: 0; }
              60% { transform: scale(1.08); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            .success-check {
              animation: minyoiSuccessPop 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
            }
            @media (prefers-reduced-motion: reduce) {
              .success-check { animation: none; }
            }
          `}</style>
        </div>
      ) : null}
    </main>
  );
}
