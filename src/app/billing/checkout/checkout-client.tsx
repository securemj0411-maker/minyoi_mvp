"use client";

import * as PortOne from "@portone/browser-sdk/v2";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { subscribeClientPlan } from "@/lib/client-billing";
import { formatKrw, planForKey, type PlanKey } from "@/lib/plan-config";
import { createPortOnePaymentId, PORTONE_CHANNEL_KEY, PORTONE_STORE_ID } from "@/lib/portone-config";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const VALID: Exclude<PlanKey, "free">[] = ["starter", "plus", "pro"];
const CREDIT_PACKAGE_TO_PLAN: Record<string, Exclude<PlanKey, "free">> = {
  "20": "starter",
  "200": "plus",
  "500": "pro",
};
const EMAIL_STORAGE_KEY = "minyoi-checkout-email-v1";
const NAME_STORAGE_KEY = "minyoi-checkout-name-v1";
const PHONE_STORAGE_KEY = "minyoi-checkout-phone-v1";

type Stage = "ready" | "processing" | "success" | "error";

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function isValidKoreanMobilePhone(value: string) {
  return /^01[016789]\d{7,8}$/.test(value);
}

function normalizeBuyerName(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 40);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase().slice(0, 120);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function CheckoutClient() {
  const params = useSearchParams();
  const router = useRouter();
  const creditPackageParam = params.get("credits");
  const planKeyParam = (params.get("plan") ?? "").toLowerCase();
  const planKey = creditPackageParam && CREDIT_PACKAGE_TO_PLAN[creditPackageParam]
    ? CREDIT_PACKAGE_TO_PLAN[creditPackageParam]
    : VALID.includes(planKeyParam as Exclude<PlanKey, "free">)
      ? planKeyParam as Exclude<PlanKey, "free">
      : "plus";
  const plan = planForKey(planKey);

  const [stage, setStage] = useState<Stage>("ready");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Wave launch-7: paymentId 보존 — subscribeClientPlan 실패 시 사용자에게 "다시 등록 시도" 옵션.
  // PortOne 측 결제는 끝났는데 우리 DB credit 박는 step 만 실패한 경우 = 사용자 돈 냈는데 못 받음.
  // paymentId 보존 → 동일 paymentId 로 retry → idempotency RPC 가 중복 차감 차단.
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [orderId] = useState(
    () => `MNYO_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
  );
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const storedEmail = normalizeEmail(window.localStorage.getItem(EMAIL_STORAGE_KEY) ?? "");
    const storedName = normalizeBuyerName(window.localStorage.getItem(NAME_STORAGE_KEY) ?? "");
    const storedPhone = normalizePhoneNumber(window.localStorage.getItem(PHONE_STORAGE_KEY) ?? "");
    if (storedEmail) setBuyerEmail(storedEmail);
    if (storedName) setBuyerName(storedName);
    if (storedPhone) setBuyerPhone(storedPhone);

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const authEmail = normalizeEmail(data.user.email ?? "");
        setUserEmail(authEmail || null);
        if (!storedEmail && authEmail) setBuyerEmail(authEmail);
        const metadataName =
          typeof data.user.user_metadata?.full_name === "string"
            ? data.user.user_metadata.full_name
            : typeof data.user.user_metadata?.name === "string"
              ? data.user.user_metadata.name
              : typeof data.user.user_metadata?.nickname === "string"
                ? data.user.user_metadata.nickname
                : "";
        const profileName = normalizeBuyerName(metadataName);
        if (!storedName && profileName) setBuyerName(profileName);
        const metadataPhone =
          typeof data.user.user_metadata?.phone_number === "string"
            ? data.user.user_metadata.phone_number
            : typeof data.user.phone === "string"
              ? data.user.phone
              : "";
        const profilePhone = normalizePhoneNumber(metadataPhone);
        if (!storedPhone && profilePhone) setBuyerPhone(profilePhone);
      } else {
        setNeedsLogin(true);
      }
    }).catch(() => undefined);
  }, []);

  async function handlePay() {
    const email = normalizeEmail(buyerEmail || userEmail || "");
    if (!isValidEmail(email)) {
      setErrorMessage("결제자 이메일을 입력해주세요.");
      setStage("error");
      return;
    }

    const fullName = normalizeBuyerName(buyerName);
    if (!fullName) {
      setErrorMessage("결제자 이름을 입력해주세요.");
      setStage("error");
      return;
    }

    const phoneNumber = normalizePhoneNumber(buyerPhone);
    if (!isValidKoreanMobilePhone(phoneNumber)) {
      setErrorMessage("결제자 휴대폰 번호를 01012345678 형식으로 입력해주세요.");
      setStage("error");
      return;
    }

    setStage("processing");
    setErrorMessage(null);
    window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
    window.localStorage.setItem(NAME_STORAGE_KEY, fullName);
    window.localStorage.setItem(PHONE_STORAGE_KEY, phoneNumber);
    const paymentId = createPortOnePaymentId();
    try {
      const response = await PortOne.requestPayment({
        storeId: PORTONE_STORE_ID,
        channelKey: PORTONE_CHANNEL_KEY,
        paymentId,
        orderName: `득템잡이 ${plan.monthlyCredits.toLocaleString("ko-KR")} 크레딧 충전권`,
        totalAmount: plan.priceKrw,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        customer: {
          email,
          fullName,
          phoneNumber,
        },
        customData: {
          orderId,
          planKey: plan.key,
          credits: plan.monthlyCredits,
        },
      });

      if (!response) {
        throw new Error("결제창이 닫혔습니다.");
      }
      if (response.code) {
        throw new Error(response.message ?? "결제가 취소되었거나 실패했습니다.");
      }

      // Wave launch-7: subscribe 실패 시 paymentId 보존해서 재시도 가능하게.
      setPendingPaymentId(response.paymentId);
      await subscribeClientPlan(planKey, response.paymentId, orderId);
      setPendingPaymentId(null);
      setStage("success");
      // 크레딧 nav refresh
      window.dispatchEvent(new Event("minyoi:credits-changed"));
      setTimeout(() => router.push("/me?tab=account"), 1400);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "결제 중 오류가 발생했습니다");
      setStage("error");
    }
  }

  // Wave launch-7: 결제는 됐는데 등록 실패한 경우 — 동일 paymentId 로 재시도.
  // 우리 RPC 가 멱등성 보장 (paymentId UNIQUE) → 중복 차감 X.
  async function handleRetrySubscribe() {
    if (!pendingPaymentId) return;
    setRetrying(true);
    setErrorMessage(null);
    try {
      await subscribeClientPlan(planKey, pendingPaymentId, orderId);
      setPendingPaymentId(null);
      setStage("success");
      window.dispatchEvent(new Event("minyoi:credits-changed"));
      setTimeout(() => router.push("/me?tab=account"), 1400);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "다시 시도 실패");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-[520px]">
        <div className="mb-4 flex items-center justify-between text-xs font-black text-zinc-500">
          <Link href="/plans" className="inline-flex items-center gap-1 hover:text-zinc-950">
            <span>←</span>
            <span>크레딧 충전으로 돌아가기</span>
          </Link>
          <span>주문 {orderId.slice(0, 14)}…</span>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-zinc-200 bg-white shadow-[0_30px_60px_rgba(15,23,42,0.10)] dark:border-zinc-800 dark:bg-zinc-900">
          {/* PG 심사용 결제창 placeholder — 실제 PG 채널 연동 후 교체. */}
          <div className="flex items-center justify-between border-b border-zinc-200 bg-[#3182f6] px-5 py-4 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-sm font-black text-[#3182f6]">
                ₩
              </div>
              <span className="text-base font-black tracking-tight text-white">득템잡이 크레딧 충전</span>
            </div>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white">
              CARD
            </span>
          </div>

          <div className="px-5 pb-2 pt-5 sm:px-7">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">크레딧 충전</div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[#1a1f1c] dark:text-zinc-50">득템잡이 {plan.name} 충전권</h1>
            <p className="mt-1 text-sm text-[#5d6358] dark:text-zinc-400">{plan.tagline}</p>
          </div>

          <div className="mx-5 mt-5 grid gap-3 rounded-2xl border border-zinc-200 bg-[#fafaf7] p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950/40 sm:mx-7">
            <Row label="충전 상품" value={`득템잡이 ${plan.monthlyCredits.toLocaleString("ko-KR")} 크레딧 충전권`} />
            <Row label="충전 크레딧" value={`${plan.monthlyCredits.toLocaleString("ko-KR")}개`} />
            <Row label="사용 기준" value="상세보기 1회 = 1크레딧" />
            <Row label="유효기간" value="충전일로부터 1년" />
            <Row label="이용 제한" value="타인 양도·재판매·현금화 불가" />
            <Row label="결제 방식" value="단건 결제 (자동 갱신 없음)" />
            <Row label="결제 수단" value="신용카드 일반결제" />
            {buyerEmail || userEmail ? <Row label="결제자" value={buyerEmail || userEmail || ""} /> : null}
            <div className="mt-1 flex items-end justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">최종 결제</span>
              <span className="text-3xl font-black tabular-nums text-[#1a1f1c] dark:text-zinc-50">{formatKrw(plan.priceKrw)}</span>
            </div>
          </div>

          <div className="px-5 py-5 sm:px-7">
            {needsLogin ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                결제하려면 먼저 로그인이 필요합니다.{" "}
                <Link href={`/login?next=${encodeURIComponent(`/billing/checkout?credits=${plan.monthlyCredits}`)}`} className="underline">
                  로그인하기
                </Link>
              </div>
            ) : null}

            {stage === "error" && errorMessage ? (
              <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
                <div>{errorMessage}</div>
                {/* Wave launch-7: PortOne 결제 됐는데 등록 실패한 경우 — 같은 paymentId 로 재시도. */}
                {pendingPaymentId ? (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-bold text-red-700">
                      💡 결제는 완료되었어요. 크레딧 등록만 실패했어요. 같은 결제로 다시 등록 시도할 수 있어요 (중복 차감 X).
                    </div>
                    <button
                      type="button"
                      onClick={handleRetrySubscribe}
                      disabled={retrying}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-red-700 px-4 text-sm font-black text-white shadow-sm transition hover:bg-red-800 active:scale-[0.98] disabled:opacity-60"
                    >
                      {retrying ? "다시 시도 중…" : "크레딧 다시 등록"}
                    </button>
                    <div className="text-[10px] font-medium text-red-600">
                      그래도 실패하면 카톡 채널로 결제 ID <code className="font-mono">{pendingPaymentId.slice(0, 20)}…</code> 보내주세요. 운영자가 직접 처리해드릴게요.
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <label className="mb-3 block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-[#8a8a7c]">
                결제자 이메일
              </span>
              <input
                type="email"
                autoComplete="email"
                value={buyerEmail}
                onChange={(event) => setBuyerEmail(event.target.value.slice(0, 120))}
                placeholder="you@example.com"
                disabled={needsLogin || stage === "processing"}
                className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-base font-black text-[#1a1f1c] outline-none transition placeholder:text-[#aaa091] focus:border-[#3182f6] focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-blue-950/60"
              />
            </label>

            <label className="mb-3 block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-[#8a8a7c]">
                결제자 이름
              </span>
              <input
                type="text"
                autoComplete="name"
                value={buyerName}
                onChange={(event) => setBuyerName(event.target.value.slice(0, 40))}
                placeholder="홍길동"
                disabled={needsLogin || stage === "processing"}
                className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-base font-black text-[#1a1f1c] outline-none transition placeholder:text-[#aaa091] focus:border-[#3182f6] focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-blue-950/60"
              />
            </label>

            <label className="mb-3 block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-[#8a8a7c]">
                결제자 휴대폰 번호
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={buyerPhone}
                onChange={(event) => setBuyerPhone(normalizePhoneNumber(event.target.value))}
                placeholder="01012345678"
                disabled={needsLogin || stage === "processing"}
                className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-base font-black tabular-nums text-[#1a1f1c] outline-none transition placeholder:text-[#aaa091] focus:border-[#3182f6] focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-blue-950/60"
              />
              <span className="mt-1.5 block text-[11px] leading-5 text-[#8a8a7c]">
                KG이니시스 결제창 호출에 필요한 정보입니다. 결제 알림과 승인 확인에만 사용됩니다.
              </span>
            </label>

            {stage === "success" ? (
              <div className="rounded-2xl border border-[#9fb49c] bg-[#edf3eb] px-4 py-4 text-sm font-bold text-[#2c3f31]">
                결제가 완료됐습니다. 잠시 후 내 대시보드로 이동합니다…
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePay}
                disabled={needsLogin || stage === "processing"}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-[#3182f6] text-base font-black text-white shadow-[0_12px_24px_rgba(5,150,105,0.25)] transition hover:bg-[#1c64dd] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {stage === "processing" ? "결제 진행 중…" : `${formatKrw(plan.priceKrw)} 결제하기`}
              </button>
            )}

            <p className="mt-3 text-center text-[11px] leading-5 text-[#8a8a7c]">
              결제 완료 후 크레딧이 보유 잔액에 즉시 더해집니다. 충전 크레딧은 1년 동안 사용할 수 있으며 타인 양도·현금화는 불가합니다.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-xs leading-5 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          크레딧 충전은 단건 결제이며 자동 갱신되지 않습니다. 유효기간과 환불 기준은 이용약관 및 환불정책을 확인해주세요.
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
