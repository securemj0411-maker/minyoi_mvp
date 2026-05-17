"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { subscribeClientPlan } from "@/lib/client-billing";
import { formatKrw, planForKey, type PlanKey } from "@/lib/plan-config";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const VALID: PlanKey[] = ["starter", "plus", "pro"];

type Stage = "ready" | "processing" | "success" | "error";

export default function CheckoutClient() {
  const params = useSearchParams();
  const router = useRouter();
  const planKeyParam = (params.get("plan") ?? "plus").toLowerCase();
  const planKey = (VALID.includes(planKeyParam as PlanKey) ? planKeyParam : "plus") as Exclude<PlanKey, "free">;
  const plan = planForKey(planKey);

  const [stage, setStage] = useState<Stage>("ready");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderId] = useState(
    () => `MNYO_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
  );
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserEmail(data.user.email ?? null);
      } else {
        setNeedsLogin(true);
      }
    }).catch(() => undefined);
  }, []);

  async function handlePay() {
    setStage("processing");
    setErrorMessage(null);
    // mock Toss approve 단계 — 짧은 지연으로 결제 흐름 흉내
    await new Promise((resolve) => setTimeout(resolve, 900));
    const paymentKey = `tossmock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    try {
      await subscribeClientPlan(planKey, paymentKey, orderId);
      setStage("success");
      // 크레딧 nav refresh
      window.dispatchEvent(new Event("minyoi:credits-changed"));
      setTimeout(() => router.push("/me?tab=account"), 1400);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "결제 중 오류가 발생했습니다");
      setStage("error");
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f1e8] px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-[520px]">
        <div className="mb-4 flex items-center justify-between text-xs font-black text-[#6b7269]">
          <Link href="/plans" className="inline-flex items-center gap-1 hover:text-[#223127]">
            <span>←</span>
            <span>요금제로 돌아가기</span>
          </Link>
          <span>주문 {orderId.slice(0, 14)}…</span>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-[#ddd4c7] bg-white shadow-[0_30px_60px_rgba(34,49,39,0.10)] dark:border-zinc-800 dark:bg-zinc-900">
          {/* Toss 브랜드 헤더 (mock) */}
          <div className="flex items-center justify-between border-b border-[#eee5d8] bg-[#0064FF] px-5 py-4 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-sm font-black text-[#0064FF]">
                t
              </div>
              <span className="text-base font-black tracking-tight text-white">toss payments</span>
            </div>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white">
              Mock
            </span>
          </div>

          <div className="px-5 pb-2 pt-5 sm:px-7">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7269]">결제 요청</div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[#1a1f1c] dark:text-zinc-50">차익잡이 {plan.name} 플랜</h1>
            <p className="mt-1 text-sm text-[#5d6358] dark:text-zinc-400">{plan.tagline}</p>
          </div>

          <div className="mx-5 mt-5 grid gap-3 rounded-2xl border border-[#eee5d8] bg-[#fafaf7] p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950/40 sm:mx-7">
            <Row label="구독 상품" value={`차익잡이 ${plan.name}`} />
            <Row label="포함 크레딧" value={`${plan.monthlyCredits}개 / 월`} />
            <Row label="일일 열람 한도" value={`${plan.dailyOpenLimit}회 / 일`} />
            <Row label="결제 주기" value="30일 (자동 갱신 없음, 베타)" />
            <Row label="결제 수단" value="토스페이먼츠 (Mock)" />
            {userEmail ? <Row label="결제자" value={userEmail} /> : null}
            <div className="mt-1 flex items-end justify-between border-t border-[#eee5d8] pt-3 dark:border-zinc-800">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-[#6b7269]">최종 결제</span>
              <span className="text-3xl font-black tabular-nums text-[#1a1f1c] dark:text-zinc-50">{formatKrw(plan.priceKrw)}</span>
            </div>
          </div>

          <div className="px-5 py-5 sm:px-7">
            {needsLogin ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                결제하려면 먼저 로그인이 필요합니다.{" "}
                <Link href="/login" className="underline">
                  로그인하기
                </Link>
              </div>
            ) : null}

            {stage === "error" && errorMessage ? (
              <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
                {errorMessage}
              </div>
            ) : null}

            {stage === "success" ? (
              <div className="rounded-2xl border border-[#9fb49c] bg-[#edf3eb] px-4 py-4 text-sm font-bold text-[#2c3f31]">
                결제가 완료됐습니다. 잠시 후 내 대시보드로 이동합니다…
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePay}
                disabled={needsLogin || stage === "processing"}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-[#0064FF] text-base font-black text-white shadow-[0_12px_24px_rgba(0,100,255,0.25)] transition hover:bg-[#0050cc] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {stage === "processing" ? "결제 진행 중…" : `${formatKrw(plan.priceKrw)} 결제하기`}
              </button>
            )}

            <p className="mt-3 text-center text-[11px] leading-5 text-[#8a8a7c]">
              베타 기간 동안 실제 결제는 발생하지 않습니다. 버튼을 누르면 모의 결제 흐름이 진행되고,
              크레딧과 일일 한도가 즉시 반영됩니다.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[#ddd4c7] bg-[#fffbf4] px-4 py-3 text-xs leading-5 text-[#6b7269] dark:border-zinc-800 dark:bg-zinc-900">
          결제 후 언제든 <strong>내 대시보드 → 계정</strong>에서 구독을 취소할 수 있습니다. 취소해도 결제한 기간이 끝날 때까지는 그대로 사용할 수 있어요.
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-[#8a8a7c]">{label}</span>
      <span className="text-sm font-bold text-[#1a1f1c] dark:text-zinc-100">{value}</span>
    </div>
  );
}
