"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getMembershipPlan,
  krw,
  type MembershipPlan,
  type MembershipPlanKey,
} from "@/lib/membership-plans";
import {
  PAYMENT_ACCOUNT_HOLDER,
  PAYMENT_ACCOUNT_NUMBER,
  PAYMENT_BANK_NAME,
} from "@/lib/payment-account";
import {
  KbankPaymentLogo,
  TossPaymentLogo,
} from "@/components/payment-brand-logo";
import PaymentTrustCard from "@/components/payment-trust-card";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { openTossSend } from "@/lib/toss-deeplink";

type ApplyState = "idle" | "submitting" | "cancelling" | "sent" | "error";
type DepositNotifyState = "idle" | "sending" | "sent" | "error";
type PaymentMethod = "toss" | "bank";
type PendingApplication = {
  id: number;
  applicationKind: "new" | "renewal";
  planKey: MembershipPlanKey;
  planLabel: string;
  priceKrw: number;
  depositConfirmedAt: string | null;
  scheduledAutoApproveAt: string | null;
  createdAt: string;
};

type MembershipStatusResponse = {
  ok?: boolean;
  isMember?: boolean;
  planEndAt?: string | null;
  application?: {
    applicationKind?: "new" | "renewal" | string | null;
    scheduledAutoApproveAt?: string | null;
    depositConfirmedAt?: string | null;
    status?: string | null;
  } | null;
};

const PLAN_SELECTION_PROOF_NAMES = [
  "김**님",
  "박**님",
  "최**님",
  "정**님",
  "강**님",
  "윤**님",
  "서**님",
  "송**님",
];

const PLAN_SELECTION_PROOF_MINUTES = [6, 14];

function countdownLabel(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSec = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function reservationExpiryFromCreatedAt(createdAt: string | null | undefined) {
  if (!createdAt) return null;
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return null;
  return new Date(createdMs + 7 * 60_000).toISOString();
}

export default function MembershipApplicationClient({
  isAuthed,
  isMember,
  loginHref,
  plans,
  pendingApplication,
  suppressFixedCta = false,
  autoOpenSelector = false,
  reservedRegionLabel,
}: {
  isAuthed: boolean;
  isMember: boolean;
  loginHref: string;
  plans: MembershipPlan[];
  pendingApplication: PendingApplication | null;
  suppressFixedCta?: boolean;
  autoOpenSelector?: boolean;
  reservedRegionLabel?: string | null;
}) {
  const router = useRouter();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<MembershipPlanKey>(
    getMembershipPlan(pendingApplication?.planKey ?? plans[1]?.key).key,
  );
  const [submittedPlan, setSubmittedPlan] = useState<MembershipPlan | null>(
    null,
  );
  const [state, setState] = useState<ApplyState>(
    pendingApplication ? "sent" : "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);
  const [depositNotifyState, setDepositNotifyState] =
    useState<DepositNotifyState>(
      pendingApplication?.depositConfirmedAt ? "sent" : "idle",
    );
  const [depositNotifyMessage, setDepositNotifyMessage] = useState<
    string | null
  >(null);
  const [autoApproveAt, setAutoApproveAt] = useState<string | null>(
    pendingApplication?.scheduledAutoApproveAt ?? null,
  );
  const [approvalDetected, setApprovalDetected] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(
    Boolean(pendingApplication),
  );
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);
  const [reservationCancelled, setReservationCancelled] = useState(false);
  const [reservationExpiresAt, setReservationExpiresAt] = useState<
    string | null
  >(
    pendingApplication &&
      pendingApplication.applicationKind !== "renewal" &&
      !pendingApplication.depositConfirmedAt
      ? reservationExpiryFromCreatedAt(pendingApplication.createdAt)
      : null,
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const selectedPlan = getMembershipPlan(selectedKey);
  const renewalMode = isMember;
  const showInlineSelector =
    autoOpenSelector &&
    !renewalMode &&
    !pendingApplication &&
    !reservationCancelled &&
    state !== "sent";
  const isBusy = state === "submitting" || state === "cancelling";

  useEffect(() => {
    if (!autoApproveAt && !reservationExpiresAt) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [autoApproveAt, reservationExpiresAt]);

  useEffect(() => {
    if (!autoApproveAt || approvalDetected || reservationCancelled) return;
    let alive = true;

    async function checkMembershipStatus() {
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase
        ? await supabase.auth.getSession()
        : { data: null };
      const token = data?.session?.access_token;
      if (!token || !alive) return;

      const res = await fetch("/api/membership/status", {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (!res?.ok || !alive) return;
      const payload = (await res
        .json()
        .catch(() => null)) as MembershipStatusResponse | null;
      const nextAutoApproveAt =
        payload?.application?.scheduledAutoApproveAt ?? null;
      if (nextAutoApproveAt && nextAutoApproveAt !== autoApproveAt)
        setAutoApproveAt(nextAutoApproveAt);
      const applicationStatus = payload?.application?.status ?? null;
      if (payload?.isMember && applicationStatus === "approved") {
        setApprovalDetected(true);
        setPaymentModalOpen(false);
        setApprovalMessage(
          renewalMode
            ? "멤버십 연장 완료. 기간이 추가됐어요."
            : "멤버십 가입 완료. 환영합니다.",
        );
        setDepositNotifyMessage(
          renewalMode ? "연장 승인 완료됐어요." : "승인 완료됐어요.",
        );
      } else if (applicationStatus === "rejected") {
        setDepositNotifyState("error");
        setDepositNotifyMessage(
          "신청이 거절됐어요. 기간/금액을 다시 선택해주세요.",
        );
      }
    }

    void checkMembershipStatus();
    const id = window.setInterval(() => void checkMembershipStatus(), 2000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [
    autoApproveAt,
    approvalDetected,
    renewalMode,
    reservationCancelled,
    router,
  ]);

  function openSelector() {
    if (isBusy) return;
    setMessage(null);
    setSelectorOpen(true);
  }

  async function beginApplication(plan: MembershipPlan) {
    if (isBusy) return;
    setSelectorOpen(false);
    void submitApplication(plan);
  }

  function chooseTossPayment() {
    setSelectedPaymentMethod("toss");
    openTossSend(priceKrw);
  }

  async function copyAccountNumber() {
    try {
      await navigator.clipboard.writeText(
        PAYMENT_ACCOUNT_NUMBER.replaceAll("-", ""),
      );
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 1800);
    } catch {
      setCopyOk(false);
    }
  }

  async function submitApplication(plan: MembershipPlan) {
    if (isBusy) return;
    if (depositNotifyState === "sent") {
      setMessage(
        "입금 확인 중에는 기간/금액 변경이 막혀요. 필요하면 고객센터로 알려주세요.",
      );
      return;
    }
    setState("submitting");
    setMessage(null);
    setSelectorOpen(false);

    const supabase = getSupabaseBrowserClient();
    const { data } = supabase
      ? await supabase.auth.getSession()
      : { data: null };
    const token = data?.session?.access_token;
    if (!token) {
      setState("error");
      setMessage("로그인 세션을 다시 확인해주세요.");
      return;
    }

    const res = await fetch("/api/membership/apply", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "plans",
        productKey: plan.key,
        intent: renewalMode ? "renewal" : "new",
      }),
    }).catch(() => null);

    if (!res?.ok) {
      setState("error");
      setMessage(
        renewalMode
          ? "연장 예약이 실패했어요. 잠시 후 다시 눌러주세요."
          : "자리 예약이 실패했어요. 잠시 후 다시 눌러주세요.",
      );
      return;
    }
    await res.json().catch(() => null);
    setSubmittedPlan(plan);
    setSelectedPaymentMethod(null);
    setReservationCancelled(false);
    setReservationExpiresAt(
      renewalMode ? null : new Date(Date.now() + 7 * 60_000).toISOString(),
    );
    setPaymentModalOpen(true);
    setState("sent");
    setMessage(null);
  }

  async function notifyDepositDone() {
    if (isBusy || depositNotifyState === "sending") return;
    setDepositNotifyState("sending");
    setDepositNotifyMessage(null);

    const supabase = getSupabaseBrowserClient();
    const { data } = supabase
      ? await supabase.auth.getSession()
      : { data: null };
    const token = data?.session?.access_token;
    if (!token) {
      setDepositNotifyState("error");
      setDepositNotifyMessage("로그인 세션을 다시 확인해주세요.");
      return;
    }

    const res = await fetch("/api/membership/deposit-notify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => null);

    if (!res?.ok) {
      // Wave 1200 (2026-06-06): 404(no_pending_application) = 예약 7분 만료/취소됨.
      //   기존엔 모든 실패를 "잠시 후 다시 눌러주세요"로 뭉뚱그려 → row가 영구 rejected라
      //   재시도 무한 실패 (송금 마치고 7분 넘겨 누른 사용자가 돈 나간 채 갇힘).
      //   만료는 별도 안내 + 재예약(기간/금액 변경) + 송금했으면 고객센터 유도.
      if (res?.status === 404) {
        setDepositNotifyState("error");
        setDepositNotifyMessage(
          "예약 시간이 만료됐어요. 아래 ‘기간/금액 변경’으로 다시 예약해주세요. 이미 송금하셨다면 고객센터(🎧)로 알려주시면 바로 확인해 드려요.",
        );
        return;
      }
      setDepositNotifyState("error");
      setDepositNotifyMessage(
        "입금 확인 요청을 보내지 못했어요. 네트워크 확인 후 다시 눌러주세요.",
      );
      return;
    }

    const payload = (await res.json().catch(() => null)) as {
      alreadyMember?: boolean;
      telegramSent?: boolean;
      scheduledAutoApproveAt?: string | null;
    } | null;
    if (payload?.alreadyMember) {
      setApprovalDetected(true);
      setApprovalMessage("멤버십이 이미 활성화되어 있어요.");
      setDepositNotifyState("sent");
      setDepositNotifyMessage("이미 승인된 계정입니다.");
      return;
    }
    const fallbackAutoApproveAt = new Date(
      Date.now() + 5 * 60_000,
    ).toISOString();
    setAutoApproveAt(payload?.scheduledAutoApproveAt ?? fallbackAutoApproveAt);
    setDepositNotifyState("sent");
    setDepositNotifyMessage(
      payload?.telegramSent === false
        ? "입금 확인 요청은 저장됐어요. 알림 상태는 확인 중이라, 늦으면 카톡으로도 알려주세요."
        : null,
    );
  }

  async function cancelReservation() {
    if (isBusy) return;
    if (depositNotifyState === "sent") {
      setMessage(
        "입금 확인 중에는 예약 취소가 막혀요. 필요하면 고객센터로 알려주세요.",
      );
      return;
    }
    const confirmed = window.confirm(
      renewalMode
        ? "입금 전 연장 예약을 취소할까요? 취소 후 다시 연장할 수 있어요."
        : "입금 전 자리 예약을 취소할까요? 취소 후 다시 신청할 수 있어요.",
    );
    if (!confirmed) return;

    setState("cancelling");
    setMessage(null);
    setSelectorOpen(false);

    const supabase = getSupabaseBrowserClient();
    const { data } = supabase
      ? await supabase.auth.getSession()
      : { data: null };
    const token = data?.session?.access_token;
    if (!token) {
      setState("error");
      setMessage("로그인 세션을 다시 확인해주세요.");
      return;
    }

    const res = await fetch("/api/membership/apply", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => null);

    if (!res?.ok) {
      setState("error");
      setMessage("예약 취소가 실패했어요. 잠시 후 다시 눌러주세요.");
      return;
    }

    setSubmittedPlan(null);
    setSelectedPaymentMethod(null);
    setDepositNotifyState("idle");
    setDepositNotifyMessage(null);
    setAutoApproveAt(null);
    setReservationExpiresAt(null);
    setApprovalDetected(false);
    setApprovalMessage(null);
    setPaymentModalOpen(false);
    setReservationCancelled(true);
    setState("idle");
    setMessage(
      renewalMode
        ? "연장 예약이 취소됐어요. 다시 연장할 수 있어요."
        : "예약이 취소됐어요. 다시 신청할 수 있어요.",
    );
  }

  if (!isAuthed) {
    return (
      <>
        <Link
          href={loginHref}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand-accent-strong)] px-4 text-[13px] font-black text-[var(--brand-cream)] shadow-[0_10px_22px_rgba(49,130,246,0.22)] transition hover:opacity-90"
        >
          로그인하고 자리 차지하기
        </Link>
        {!suppressFixedCta ? (
          <Link
            href={loginHref}
            className="fixed inset-x-3 bottom-3 z-40 flex h-12 items-center justify-center rounded-2xl bg-[var(--brand-accent-strong)] px-4 text-[14px] font-black text-[var(--brand-cream)] shadow-[0_18px_45px_rgba(49,130,246,0.34)] ring-1 ring-white/30 transition hover:opacity-90 sm:hidden"
          >
            로그인하고 내 지역 티오 확인
          </Link>
        ) : null}
      </>
    );
  }

  const hasReservation = Boolean(
    (pendingApplication || state === "sent") && !reservationCancelled,
  );
  const planLabel =
    submittedPlan?.label ?? pendingApplication?.planLabel ?? "멤버십";
  const priceKrw =
    submittedPlan?.priceKrw ?? pendingApplication?.priceKrw ?? 99_000;
  const autoApproveTargetMs = autoApproveAt ? Date.parse(autoApproveAt) : null;
  const autoApproveMsLeft =
    autoApproveTargetMs && Number.isFinite(autoApproveTargetMs)
      ? Math.max(0, autoApproveTargetMs - nowMs)
      : 5 * 60_000;
  const reservationTargetMs = reservationExpiresAt
    ? Date.parse(reservationExpiresAt)
    : null;
  const reservationMsLeft =
    reservationTargetMs && Number.isFinite(reservationTargetMs)
      ? Math.max(0, reservationTargetMs - nowMs)
      : 7 * 60_000;
  const reservationRegion = reservedRegionLabel?.trim() || "내 지역";
  const showDepositCountdown = hasReservation && depositNotifyState === "sent";
  const showReservationCountdown =
    hasReservation && !renewalMode && depositNotifyState !== "sent";
  const showPaymentDetails =
    showDepositCountdown || selectedPaymentMethod !== null;
  const showPlanSelectionProof =
    !renewalMode && !hasReservation && (selectorOpen || showInlineSelector);

  function goToFeed() {
    router.replace("/me");
  }

  return (
    <div>
      <PlanSelectionProofToast active={showPlanSelectionProof} />
      {isBusy ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/38 px-4 backdrop-blur-sm">
          <div className="flex w-full max-w-[300px] flex-col items-center rounded-[24px] border border-blue-100 bg-white px-5 py-6 text-center shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <span className="h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-[#3182f6] dark:border-zinc-800 dark:border-t-blue-300" />
            <div className="mt-4 break-keep text-[18px] font-black text-zinc-950 dark:text-zinc-50">
              {state === "cancelling"
                ? renewalMode
                  ? "연장 취소 중"
                  : "예약 취소 중"
                : renewalMode
                  ? "연장 예약 중"
                  : "자리 확보 중"}
            </div>
            <p className="mt-1 break-keep text-[12px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
              {state === "cancelling"
                ? "입금 전 예약을 취소하고 있어요."
                : "선택한 기간으로 예약을 만들고 있어요."}
            </p>
          </div>
        </div>
      ) : null}
      {approvalMessage ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="membership-approval-title"
            className="w-full max-w-[430px] rounded-[18px] border border-emerald-200 bg-white p-5 text-center shadow-2xl dark:border-emerald-900/80 dark:bg-zinc-950"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-[28px] font-black text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
              ✓
            </div>
            <div className="mt-4 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              Membership active
            </div>
            <h2
              id="membership-approval-title"
              className="mt-2 break-keep text-[25px] font-black leading-tight text-zinc-950 dark:text-zinc-50"
            >
              {approvalMessage}
            </h2>
            <p className="mt-2 break-keep text-[13px] font-semibold leading-5 text-zinc-500 dark:text-zinc-400">
              이제 실시간 추천 매물, 원본 링크, 시세 근거를 바로 볼 수 있어요.
            </p>
            <button
              type="button"
              onClick={goToFeed}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[var(--brand-accent-strong)] px-4 text-[14px] font-black text-[var(--brand-cream)] shadow-[0_10px_22px_rgba(49,130,246,0.22)] transition hover:opacity-90"
            >
              지금 바로 매물 보러가기
            </button>
          </div>
        </div>
      ) : null}
      {/* Wave 1198 (2026-06-06): 모바일 items-start → items-center (짧은 단계가 위로 붙어 아래 공백 컸음).
          모달 내부 max-h+자체 overflow라 긴 단계도 위 잘림 없이 가운데 OK. */}
      {hasReservation && paymentModalOpen ? (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center overflow-y-auto bg-black/62 px-3 py-[calc(env(safe-area-inset-top)+16px)] backdrop-blur-sm sm:py-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={renewalMode ? "멤버십 연장 입금" : "멤버십 입금"}
            className="relative w-full max-w-[520px]"
          >
            <button
              type="button"
              onClick={() => setPaymentModalOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[18px] font-black text-zinc-500 shadow-lg ring-1 ring-zinc-200 transition hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-zinc-800"
              aria-label="입금 안내 닫기"
            >
              ×
            </button>
            {/* Wave 1195 (2026-06-06): 모달 자체 "문의" pill 제거. 하단 글로벌 고객센터(SiteHelpFaq)와
                동일 기능(둘 다 minyoi:open-support-chat 이벤트)이라 중복 + 카운트다운 카드("자리 예약 만료까지")를 가렸음.
                결제 중 문의는 하단 floating 🎧(모달 위 z-10020)으로 그대로 가능. */}
            <div className="max-h-[calc(100dvh-32px)] overflow-y-auto rounded-[24px] border border-blue-100 bg-white text-zinc-950 shadow-[0_24px_80px_rgba(15,23,42,0.35)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
          <div className="relative border-b border-blue-100 bg-[#f5f8ff] px-4 py-4 dark:border-zinc-800 dark:bg-white/6 sm:px-7 sm:py-5">
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black tracking-[0.04em] text-[#3182f6] ring-1 ring-blue-100 dark:bg-zinc-950 dark:ring-zinc-800">
                  {renewalMode
                    ? "연장 예약 완료"
                    : showDepositCountdown
                      ? "입금 확인 진행 중"
                      : "자리 확보 완료"}
                </div>
                <h2 className="mt-3 break-keep text-[25px] font-black leading-tight tracking-tight sm:text-[34px]">
                  {showDepositCountdown
                    ? renewalMode
                      ? "연장 승인 중"
                      : "입금 확인 중"
                    : showPaymentDetails
                      ? renewalMode
                        ? "연장 입금 확인"
                        : "입금 확인"
                      : renewalMode
                        ? "연장 입금 방법 선택"
                        : "입금 방법 선택"}
                </h2>
                <p className="mt-2 break-keep text-[12px] font-bold leading-5 text-zinc-600 dark:text-zinc-300">
                  {showDepositCountdown
                      ? renewalMode
                        ? "입금 확인 요청을 받았어요. 승인되면 기존 만료일 뒤에 기간이 붙습니다."
                        : "입금 확인 요청을 받았어요. 승인까지 잠시만 기다려주세요."
                    : showPaymentDetails
                      ? "선택한 방법으로 송금한 뒤 입금 확인을 진행해 주세요."
                      : "토스 또는 계좌송금 중 편한 방법을 먼저 골라주세요."}
                </p>
              </div>
              {showReservationCountdown ? (
                <div className="shrink-0 rounded-[18px] bg-white px-3 py-2.5 text-center text-zinc-950 shadow-[0_12px_30px_rgba(49,130,246,0.16)] ring-1 ring-blue-100 dark:bg-zinc-950 dark:text-white dark:ring-zinc-800">
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                    자리 예약 만료까지
                  </div>
                  <div className="mt-1 font-mono text-[26px] font-black leading-none tabular-nums">
                    {countdownLabel(reservationMsLeft)}
                  </div>
                  <div className="mt-1 max-w-[118px] break-keep text-[10px] font-black leading-4 text-rose-500 dark:text-rose-300">
                    시간 내 입금하지 않으면 취소돼요
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="px-3 py-3 sm:px-5 sm:py-4">
            {state === "error" && message ? (
              <p
                className="break-keep text-[12px] font-semibold leading-5 text-red-500"
              >
                {message}
              </p>
            ) : null}
            {!showPaymentDetails ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={chooseTossPayment}
                  className="group min-h-[154px] rounded-[22px] bg-[#3182f6] p-4 text-left text-white shadow-[0_18px_42px_rgba(49,130,246,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_52px_rgba(49,130,246,0.34)]"
                >
                  <TossPaymentLogo />
                  <span className="mt-5 block break-keep text-[21px] font-black leading-tight">
                    토스로 보내기
                  </span>
                  <span className="mt-2 block break-keep text-[11px] font-bold leading-4 text-blue-50">
                    앱에서 금액 확인 후 송금
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod("bank")}
                  className="group min-h-[154px] rounded-[22px] bg-zinc-950 p-4 text-left text-white shadow-[0_18px_42px_rgba(15,23,42,0.22)] ring-1 ring-zinc-200 transition hover:-translate-y-0.5 hover:shadow-[0_22px_52px_rgba(15,23,42,0.28)] dark:bg-white dark:text-zinc-950 dark:ring-zinc-800"
                >
                  <KbankPaymentLogo />
                  <span className="mt-5 block break-keep text-[21px] font-black leading-tight">
                    계좌송금 하기
                  </span>
                  <span className="mt-2 block break-keep text-[11px] font-bold leading-4 text-zinc-300 dark:text-zinc-500">
                    복사 후 은행앱에서 송금
                  </span>
                </button>
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[#f5f8ff] px-3 py-3 ring-1 ring-blue-100 dark:bg-white/8 dark:ring-white/10">
                  <div>
                    <div className="text-[11px] font-black text-zinc-400">
                      선택 기간
                    </div>
                    <div className="mt-1 text-[16px] font-black">
                      {planLabel}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-black text-zinc-400">
                      입금 금액
                    </div>
                    <div className="mt-1 text-[22px] font-black tabular-nums text-[#3182f6] dark:text-blue-300">
                      {krw(priceKrw)}
                    </div>
                  </div>
                </div>
                {selectedPaymentMethod === "toss" && !showDepositCountdown ? (
                  <div className="rounded-[18px] bg-[#eef5ff] p-3 ring-1 ring-blue-100 dark:bg-blue-950/20 dark:ring-blue-900/60">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <TossPaymentLogo className="h-10 w-[112px] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[13px] font-black text-zinc-950 dark:text-white">
                            토스 송금창을 열었어요
                          </div>
                          <div className="mt-0.5 break-keep text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                            송금 후 아래 입금했어요를 눌러주세요.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openTossSend(priceKrw)}
                        className="h-9 shrink-0 rounded-xl bg-[#3182f6] px-3 text-[11px] font-black text-white"
                      >
                        다시 열기
                      </button>
                    </div>
                  </div>
                ) : null}
                {(selectedPaymentMethod === "bank" ||
                  (showDepositCountdown && !selectedPaymentMethod)) ? (
                  <div className="rounded-[18px] bg-white p-3 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <KbankPaymentLogo className="h-10 w-[112px] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[13px] font-black text-zinc-950 dark:text-zinc-50">
                            계좌송금 정보
                          </div>
                          <div className="mt-0.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                            복사 후 은행앱에서 송금
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void copyAccountNumber()}
                        className="flex h-9 shrink-0 items-center justify-center rounded-xl bg-[#ebf2ff] px-3 text-[11px] font-black text-[#3182f6] transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
                      >
                        {copyOk ? "복사됨" : "계좌 복사"}
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-[76px_1fr] gap-x-3 gap-y-1 text-[12px] font-bold">
                      <div className="text-zinc-400">은행</div>
                      <div className="text-zinc-800 dark:text-zinc-200">
                        {PAYMENT_BANK_NAME}
                      </div>
                      <div className="text-zinc-400">계좌번호</div>
                      <div className="font-black tabular-nums tracking-tight text-zinc-950 dark:text-zinc-50">
                        {PAYMENT_ACCOUNT_NUMBER}
                      </div>
                      <div className="text-zinc-400">예금주</div>
                      <div className="text-zinc-800 dark:text-zinc-200">
                        {PAYMENT_ACCOUNT_HOLDER}
                      </div>
                    </div>
                  </div>
                ) : null}
                {selectedPaymentMethod === "toss" && !showDepositCountdown ? (
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("bank")}
                    className="h-10 rounded-xl border border-zinc-200 bg-white text-[12px] font-black text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                  >
                    토스가 안 열리면 계좌송금으로 변경
                  </button>
                ) : null}
              </div>
            )}
            {showDepositCountdown ? (
              <div className="mt-3 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-3 dark:border-emerald-900/70 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">
                      {renewalMode ? "연장 승인 중" : "멤버십 승인 중"}
                    </div>
                    <div className="mt-1 break-keep text-[12px] font-bold leading-5 text-zinc-600 dark:text-zinc-300">
                      {renewalMode
                        ? "5분 내로 연장 기간이 자동 반영됩니다."
                        : "5분 내로 멤버십이 자동 승인됩니다."}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-[10px] bg-white px-3 py-2 text-[22px] font-black tabular-nums text-emerald-700 ring-1 ring-emerald-100 dark:bg-zinc-950 dark:text-emerald-300 dark:ring-emerald-900">
                    {autoApproveMsLeft > 0
                      ? countdownLabel(autoApproveMsLeft)
                      : "0:00"}
                  </div>
                </div>
              </div>
            ) : null}
            {/* Wave 1196 (2026-06-06): 입금했어요 = primary CTA 강조. owner: 필수 버튼인데
                송금방법 다시선택과 위계가 비슷했음. h-12→h-14 키우고 버튼 안 2줄(제목 + 안내
                서브텍스트)로 통합. 기존 별도 안내 문단은 버튼으로 흡수. */}
            {showPaymentDetails && depositNotifyState !== "sent" ? (
              <button
                type="button"
                onClick={() => void notifyDepositDone()}
                disabled={isBusy || depositNotifyState === "sending"}
                className="mt-3 flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-2xl bg-[var(--brand-accent-strong)] px-4 text-[var(--brand-cream)] shadow-[0_14px_30px_rgba(49,130,246,0.30)] transition hover:opacity-90 disabled:cursor-default disabled:opacity-70"
              >
                {depositNotifyState === "sending" ? (
                  <span className="text-[16px] font-black leading-none">확인 중</span>
                ) : (
                  <>
                    <span className="text-[17px] font-black leading-none">입금했어요</span>
                    <span className="text-[11px] font-bold leading-none opacity-80">
                      입금 완료 후 눌러주세요 · 최대 5분 내 자동 {renewalMode ? "연장" : "승인"}
                    </span>
                  </>
                )}
              </button>
            ) : null}
            {/* Wave 1197 (2026-06-06): 계좌입금 공포 차단 — 신뢰 배지 상시 노출.
                기존엔 사업자/실명/환불이 PaymentTrustCard <details> 안에 접혀 입금 직전(공포 최고조)에 안 보였음.
                "미승인 시 전액 환불"은 환불정책 1조(입금 후 미활성화 시 전액 환불)에 근거 — 과장 아님. */}
            {showPaymentDetails && depositNotifyState !== "sent" ? (
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[10.5px] font-black text-zinc-500 dark:text-zinc-400">
                <span>
                  <span className="text-emerald-500">✓</span> 사업자 등록업체
                </span>
                <span>
                  <span className="text-emerald-500">✓</span> 예금주 실명 일치
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  ✓ 미승인 시 전액 환불
                </span>
              </div>
            ) : null}
            {/* Wave 1198 (2026-06-06): 송금 방법 다시 선택 — 입금했어요(primary) + 배지 아래로 이동.
                보조 액션(거의 안 누름)이라 위계상 필수 CTA보다 밑이 맞음. */}
            {showPaymentDetails && depositNotifyState !== "sent" ? (
              <button
                type="button"
                onClick={() => setSelectedPaymentMethod(null)}
                className="mt-1.5 h-9 w-full text-[12px] font-black text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                송금 방법 다시 선택
              </button>
            ) : null}
            {depositNotifyMessage ? (
              <p
                className={`mt-2 break-keep text-[11px] font-bold leading-4 ${depositNotifyState === "error" ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}
              >
                {depositNotifyMessage}
              </p>
            ) : null}
            {showPaymentDetails ? (
              <div className="mt-3">
                <PaymentTrustCard />
              </div>
            ) : null}
            {depositNotifyState !== "sent" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={openSelector}
                  disabled={isBusy}
                  className="h-10 rounded-xl border border-blue-100 bg-blue-50 text-[12px] font-black text-[#3182f6] transition hover:bg-[#ebf2ff] disabled:cursor-default disabled:opacity-60 dark:border-blue-950/70 dark:bg-blue-950/30 dark:text-blue-200"
                >
                  {renewalMode ? "연장 기간 변경" : "기간/금액 변경"}
                </button>
                <button
                  type="button"
                  onClick={() => void cancelReservation()}
                  disabled={isBusy}
                  className="h-10 rounded-xl border border-zinc-200 bg-white text-[12px] font-black text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-default disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                >
                  {renewalMode ? "연장 취소" : "예약 취소"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
          </div>
        </div>
      ) : null}
      {renewalMode ? (
        <div className="grid gap-2">
          <button
            type="button"
            onClick={
              hasReservation ? () => setPaymentModalOpen(true) : openSelector
            }
            disabled={isBusy}
            className="flex h-14 items-center justify-center rounded-2xl bg-[var(--brand-accent-strong)] px-4 text-[16px] font-black text-[var(--brand-cream)] shadow-[0_18px_42px_rgba(49,130,246,0.28)] transition hover:opacity-90 disabled:cursor-default disabled:opacity-70"
          >
            {isBusy
              ? state === "cancelling"
                ? "연장 취소 중"
                : "연장 예약 중"
              : hasReservation
                ? depositNotifyState === "sent"
                  ? "승인 대기 보기"
                  : "입금 이어하기"
                : "멤버십 연장하기"}
          </button>
          <Link
            href="/me"
            className="flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-[12px] font-black text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          >
            지금 매물 보러가기
          </Link>
        </div>
      ) : showInlineSelector ? (
        <div className="overflow-hidden rounded-[28px] border border-zinc-800 bg-[#16181d] text-zinc-50 shadow-[0_28px_80px_rgba(15,23,42,0.22)] ring-1 ring-white/8">
          <div className="relative border-b border-white/8 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-blue-200">
                  <span className="h-6 w-6 overflow-hidden rounded-lg shadow-[0_8px_18px_rgba(49,130,246,0.35)]">
                    <Image
                      src="/logo.svg"
                      alt=""
                      width={24}
                      height={24}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  MEMBERSHIP
                </div>
                <h2 className="mt-3 break-keep text-[26px] font-black leading-tight tracking-tight sm:text-[34px]">
                  멤버십 기간 선택
                </h2>
                <p className="mt-2 break-keep text-[12px] font-bold leading-5 text-zinc-400">
                  선택 즉시 지역 티오를 먼저 잡아둡니다.
                </p>
              </div>
              <div className="shrink-0 rounded-2xl bg-white/8 px-2.5 py-2 text-right ring-1 ring-white/10">
                <div className="text-[9px] font-black text-zinc-500">지역</div>
                <div className="mt-0.5 max-w-[106px] truncate text-[12px] font-black text-blue-200 sm:max-w-[150px] sm:text-[13px]">
                  {reservationRegion}
                </div>
              </div>
            </div>
          </div>
          <div className="px-3 pb-20 pt-3 sm:px-5 sm:py-5">
            {/* Wave 1213 (2026-06-06): 평균 차익 가치 배너 (신규 가입만). 법꾸라지 — 매물 차익(시세−매물가)은
                정보지 수익 보장이 아님. ready pool 실측 평균 33,816원 → "약 3만원". 1~2건 거래로 멤버십값(49,000) 회수. */}
            {!renewalMode ? (
              <div className="mb-3 rounded-[14px] border border-emerald-400/22 bg-emerald-500/8 px-3 py-2.5 text-center">
                <div className="break-keep text-[12px] font-black text-emerald-200 sm:text-[13px]">
                  💰 한 매물당 평균 차익 <span className="text-emerald-100">약 3만원</span> · 매물 1~2건만 거래해도 멤버십값 회수
                </div>
                <div className="mt-1 break-keep text-[9.5px] font-bold leading-tight text-emerald-400/65 sm:text-[10px]">
                  차익은 시세−매물가 기준 추정값이에요. 실제 거래·수익은 보장되지 않으며 개인차가 있습니다.
                </div>
              </div>
            ) : null}
            <PlanGrid
              plans={plans}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              disabled={isBusy}
            />
            <button
              type="button"
              onClick={() => void beginApplication(selectedPlan)}
              disabled={isBusy}
              className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-[130] mx-auto flex h-12 max-w-[760px] items-center justify-center rounded-2xl bg-[#3b74ff] px-4 text-[15px] font-black text-white shadow-[0_18px_45px_rgba(49,130,246,0.30)] transition hover:opacity-90 disabled:cursor-default disabled:opacity-70 sm:static sm:mt-4 sm:max-w-none"
            >
              {isBusy ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  {state === "cancelling" ? "예약 취소 중" : "자리 확보 중"}
                </span>
              ) : (
                `${selectedPlan.label}로 자리 확보하기`
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={
              hasReservation ? () => setPaymentModalOpen(true) : openSelector
            }
            disabled={isBusy}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand-accent-strong)] px-4 text-[13px] font-black text-[var(--brand-cream)] shadow-[0_10px_22px_rgba(49,130,246,0.22)] transition hover:opacity-90 disabled:cursor-default disabled:opacity-70"
          >
            {isBusy
              ? state === "cancelling"
                ? "예약 취소 중"
                : "자리 예약 중"
              : hasReservation
                ? depositNotifyState === "sent"
                  ? "승인 대기 보기"
                  : "입금 이어하기"
                : "지금 바로 자리 차지하기"}
          </button>
          {!suppressFixedCta && !selectorOpen ? (
            <button
              type="button"
              onClick={
                hasReservation ? () => setPaymentModalOpen(true) : openSelector
              }
              disabled={isBusy}
              className="fixed inset-x-3 bottom-3 z-40 flex h-12 items-center justify-center rounded-2xl bg-[var(--brand-accent-strong)] px-4 text-[14px] font-black text-[var(--brand-cream)] shadow-[0_18px_45px_rgba(49,130,246,0.34)] ring-1 ring-white/30 transition hover:opacity-90 disabled:cursor-default disabled:opacity-70 sm:hidden"
            >
              {isBusy
                ? state === "cancelling"
                  ? "예약 취소 중"
                  : "자리 예약 중"
                : hasReservation
                  ? depositNotifyState === "sent"
                    ? "승인 대기 보기"
                    : "입금 이어하기"
                  : "지금 바로 자리 차지하기"}
            </button>
          ) : null}
        </>
      )}
      {message && !hasReservation ? (
        <p
          className={`mt-2 break-keep text-[11px] font-bold leading-4 ${state === "error" ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}
        >
          {message}
        </p>
      ) : null}
      {selectorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-2 py-2 backdrop-blur-sm sm:px-3 sm:py-3">
          <div className="flex max-h-[calc(100dvh-16px)] w-full max-w-[720px] flex-col overflow-y-auto rounded-[22px] border border-zinc-800 bg-[#16181d] p-3 text-zinc-50 shadow-[0_28px_90px_rgba(0,0,0,0.52)] sm:max-h-[calc(100dvh-24px)] sm:rounded-[24px] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
                  <span className="h-6 w-6 overflow-hidden rounded-lg shadow-[0_8px_18px_rgba(49,130,246,0.35)]">
                    <Image
                      src="/logo.svg"
                      alt=""
                      width={24}
                      height={24}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  MEMBERSHIP
                </div>
                <h2 className="mt-2.5 break-keep text-[22px] font-black leading-tight text-zinc-50 sm:mt-3 sm:text-[30px]">
                  {renewalMode ? "멤버십 연장 기간 선택" : "멤버십 기간 선택"}
                </h2>
                <p className="mt-1.5 hidden break-keep text-[12px] font-semibold leading-5 text-zinc-400 sm:block">
                  {renewalMode
                    ? "승인되면 기존 만료일 뒤에 선택한 기간이 붙습니다. 월 단가는 기간이 길수록 낮아집니다."
                    : "기간이 길수록 월 단가가 낮아집니다."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectorOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[22px] font-light text-zinc-300 transition hover:bg-white/10"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="mt-4 sm:mt-5">
              <PlanGrid
                plans={plans}
                selectedKey={selectedKey}
                onSelect={setSelectedKey}
                disabled={isBusy}
              />
            </div>
            <div className="mt-3 grid grid-cols-[0.34fr_1fr] gap-2 sm:mt-4 sm:gap-2.5">
              <button
                type="button"
                onClick={() => setSelectorOpen(false)}
                className="h-11 rounded-2xl border border-white/10 bg-white/5 text-[13px] font-black text-zinc-200 transition hover:bg-white/10 sm:h-12 sm:text-[14px]"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => void beginApplication(selectedPlan)}
                disabled={isBusy}
                className="h-11 rounded-2xl bg-[#3b74ff] text-[13px] font-black text-white shadow-[0_14px_34px_rgba(49,130,246,0.30)] transition hover:opacity-90 disabled:cursor-default disabled:opacity-70 sm:h-12 sm:text-[14px]"
              >
                {isBusy ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                    {state === "cancelling" ? "취소 중" : "처리 중"}
                  </span>
                ) : (
                  <>
                    {selectedPlan.label}{" "}
                    {renewalMode ? "연장 예약하기" : "자리 예약하기"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlanSelectionProofToast({ active }: { active: boolean }) {
  const [index, setIndex] = useState(-1);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const timers: number[] = [];
    const showAt = (nextIndex: number) => {
      setIndex(nextIndex);
      setVisible(true);
      timers.push(window.setTimeout(() => setVisible(false), 7200));
    };

    timers.push(window.setTimeout(() => showAt(0), 1200));
    timers.push(window.setTimeout(() => showAt(1), 15_800));
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [active]);

  if (!active || index < 0 || index >= PLAN_SELECTION_PROOF_MINUTES.length) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className={`fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+14px)] z-[120] mx-auto max-w-[460px] transition-all duration-700 ease-out sm:left-auto sm:right-8 sm:top-8 sm:mx-0 ${
        visible
          ? "translate-y-0 scale-100 opacity-100"
          : "-translate-y-3 scale-[0.98] opacity-0 pointer-events-none"
      }`}
    >
      <div className="rounded-2xl border border-rose-200 bg-white/98 px-4 py-3.5 shadow-[0_20px_54px_rgba(244,63,94,0.24)] backdrop-blur dark:border-rose-400/30 dark:bg-zinc-950/96">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(244,63,94,0.34)]">
            ✓
          </div>
          <div className="min-w-0">
            <div className="break-keep text-[13px] font-black leading-5 text-zinc-950 dark:text-white">
              {PLAN_SELECTION_PROOF_NAMES[index]}이{" "}
              {PLAN_SELECTION_PROOF_MINUTES[index]}분 전에 멤버십에 가입해
              1자리를 확보했어요.
            </div>
            <div className="mt-1 break-keep text-[11px] font-black text-rose-600 dark:text-rose-200">
              기간 선택 중에도 선착순 지역 티오는 계속 줄어듭니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanGrid({
  plans,
  selectedKey,
  onSelect,
  disabled,
}: {
  plans: MembershipPlan[];
  selectedKey: MembershipPlanKey;
  onSelect: (key: MembershipPlanKey) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
      {plans.map((plan) => {
        const active = plan.key === selectedKey;
        return (
          <button
            key={plan.key}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(plan.key)}
            className={`relative overflow-hidden rounded-[16px] border px-3 py-3 text-left transition disabled:cursor-default sm:min-h-[148px] sm:rounded-[18px] sm:px-4 sm:py-4 ${
              active
                ? "border-[#3b74ff] bg-[#18223d] text-white shadow-[0_22px_58px_rgba(49,130,246,0.26)] ring-1 ring-[#3b74ff]/35"
                : "border-white/10 bg-[#15171d] text-zinc-50 shadow-[0_14px_40px_rgba(0,0,0,0.18)] hover:border-blue-400/45 hover:bg-[#181c25]"
            }`}
          >
            {active ? (
              <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#3b74ff] px-2 py-0.5 text-[9px] font-black text-white shadow-[0_10px_26px_rgba(49,130,246,0.32)] sm:right-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[10px]">
                <span>✓</span>
                <span>선택됨</span>
              </div>
            ) : null}
            <div className="flex min-h-[88px] flex-col justify-between gap-2 sm:min-h-[98px] sm:gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-1 pr-14 sm:gap-1.5 sm:pr-20">
                  <span className="text-[19px] font-black leading-none sm:text-[24px]">
                    {plan.label}
                  </span>
                  {plan.badge ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ring-1 sm:px-2 sm:text-[10px] ${
                        active
                          ? "bg-white/8 text-blue-100 ring-white/18"
                          : "bg-[#17213a] text-blue-300 ring-blue-400/20"
                      }`}
                    >
                      {plan.badge}
                    </span>
                  ) : null}
                </div>
                <div
                  className={`mt-2 hidden text-[12px] font-bold sm:block ${
                    active
                      ? "text-zinc-300"
                      : "text-zinc-400"
                  }`}
                >
                  {plan.valueNote}
                </div>
              </div>
              <div>
                <div className="text-[20px] font-black leading-none sm:text-[24px]">
                  {krw(plan.priceKrw)}
                </div>
                <div
                  className="mt-1 whitespace-nowrap text-[10.5px] font-black text-zinc-500 sm:mt-1.5 sm:text-[12px]"
                >
                  {plan.monthlyLabel}
                </div>
              </div>
            </div>
            <div className="mt-2 hidden border-t border-white/8 pt-3 text-[12px] font-black text-emerald-300 sm:block">
              <span className="mr-2">✓</span>
              {plan.paybackNote}
            </div>
          </button>
        );
      })}
    </div>
  );
}
