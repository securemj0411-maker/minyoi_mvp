"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getMembershipPlan,
  krw,
  type MembershipPlan,
  type MembershipPlanKey,
} from "@/lib/membership-plans";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const BANK_NAME = "케이뱅크";
const ACCOUNT_NUMBER = "100300138855";
const ACCOUNT_HOLDER = "더빙나우";

type ApplyState = "idle" | "submitting" | "sent" | "error";
type DepositNotifyState = "idle" | "sending" | "sent" | "error";
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
  const [reservationCancelled, setReservationCancelled] = useState(false);
  const [reservationExpiresAt, setReservationExpiresAt] = useState<
    string | null
  >(
    pendingApplication && !pendingApplication.depositConfirmedAt
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
    !reservationCancelled;

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
    if (state === "submitting") return;
    setMessage(null);
    setSelectorOpen(true);
  }

  async function beginApplication(plan: MembershipPlan) {
    if (state === "submitting") return;
    setSelectorOpen(false);
    void submitApplication(plan);
  }

  async function copyAccountNumber() {
    try {
      await navigator.clipboard.writeText(ACCOUNT_NUMBER.replaceAll("-", ""));
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 1800);
    } catch {
      setCopyOk(false);
    }
  }

  async function submitApplication(plan: MembershipPlan) {
    if (state === "submitting") return;
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
    setReservationCancelled(false);
    setReservationExpiresAt(new Date(Date.now() + 7 * 60_000).toISOString());
    setState("sent");
    setMessage(
      renewalMode
        ? `${plan.label} 연장 예약 완료. 아래 계좌로 송금한 뒤 입금했어요 버튼을 눌러주세요.`
        : null,
    );
  }

  async function notifyDepositDone() {
    if (state === "submitting" || depositNotifyState === "sending") return;
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
      setDepositNotifyState("error");
      setDepositNotifyMessage(
        "입금 확인 요청을 보내지 못했어요. 잠시 후 다시 눌러주세요.",
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
    if (state === "submitting") return;
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
    setDepositNotifyState("idle");
    setDepositNotifyMessage(null);
    setAutoApproveAt(null);
    setReservationExpiresAt(null);
    setApprovalDetected(false);
    setApprovalMessage(null);
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
  const defaultReservationMessage =
    "연장 예약이 잡혔습니다. 아래 계좌로 송금한 뒤 입금했어요 버튼을 눌러주세요.";
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

  function goToFeed() {
    router.replace("/me");
  }

  return (
    <div>
      {state === "submitting" ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/38 px-4 backdrop-blur-sm">
          <div className="flex w-full max-w-[300px] flex-col items-center rounded-[24px] border border-blue-100 bg-white px-5 py-6 text-center shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <span className="h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-[#3182f6] dark:border-zinc-800 dark:border-t-blue-300" />
            <div className="mt-4 break-keep text-[18px] font-black text-zinc-950 dark:text-zinc-50">
              {renewalMode ? "연장 예약 중" : "자리 확보 중"}
            </div>
            <p className="mt-1 break-keep text-[12px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
              선택한 기간으로 예약을 만들고 있어요.
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
              상품 피드로 이동
            </button>
          </div>
        </div>
      ) : null}
      {hasReservation ? (
        <div className="overflow-hidden rounded-[24px] border border-blue-100 bg-white text-zinc-950 shadow-[0_18px_54px_rgba(49,130,246,0.13)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
          <div className="relative border-b border-blue-100 bg-[#f5f8ff] px-4 py-4 dark:border-zinc-800 dark:bg-white/6 sm:px-7 sm:py-6">
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black tracking-[0.04em] text-[#3182f6] ring-1 ring-blue-100 dark:bg-zinc-950 dark:ring-zinc-800">
                  {renewalMode
                    ? "연장 예약 완료"
                    : showDepositCountdown
                      ? "입금 확인 진행 중"
                      : "자리 확보 완료"}
                </div>
                <h2 className="mt-3 break-keep text-[25px] font-black leading-tight tracking-tight sm:text-[40px]">
                  {renewalMode
                    ? `${planLabel} 연장 예약을 잡았어요.`
                    : showDepositCountdown
                      ? "입금 확인 요청됐어요."
                      : `${reservationRegion} 자리 예약됐어요.`}
                </h2>
                {showReservationCountdown ? (
                  <p className="mt-2 break-keep text-[12px] font-bold leading-5 text-zinc-600 dark:text-zinc-300">
                    7분 안에 입금하지 않으면 예약이 취소돼요.
                  </p>
                ) : null}
              </div>
              {showReservationCountdown ? (
                <div className="shrink-0 rounded-[18px] bg-white px-3 py-2.5 text-center text-zinc-950 shadow-[0_12px_30px_rgba(49,130,246,0.16)] ring-1 ring-blue-100 dark:bg-zinc-950 dark:text-white dark:ring-zinc-800">
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                    남은 시간
                  </div>
                  <div className="mt-1 font-mono text-[26px] font-black leading-none tabular-nums">
                    {countdownLabel(reservationMsLeft)}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="px-3 py-3 sm:px-5 sm:py-4">
            <div className="flex items-center justify-between gap-3 rounded-[16px] bg-[#f5f8ff] px-3 py-2.5 ring-1 ring-blue-100 dark:bg-white/8 dark:ring-white/10">
              <div>
                <div className="text-[11px] font-black text-zinc-400">
                  선택 기간
                </div>
                <div className="mt-1 text-[16px] font-black">{planLabel}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-black text-zinc-400">
                  입금 금액
                </div>
                <div className="mt-1 text-[20px] font-black tabular-nums text-[#3182f6] dark:text-blue-300">
                  {krw(priceKrw)}
                </div>
              </div>
            </div>
            {renewalMode || state === "error" ? (
              <p
                className={`mt-2 break-keep text-[12px] font-semibold leading-5 ${state === "error" ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}
              >
                {message ?? defaultReservationMessage}
              </p>
            ) : null}
            <div className="mt-2 rounded-[16px] bg-[#f5f7fb] p-3 dark:bg-zinc-900/70">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                    {BANK_NAME}
                  </div>
                  <div className="mt-1 font-black tabular-nums text-[18px] tracking-tight text-zinc-950 dark:text-zinc-50">
                    {ACCOUNT_NUMBER}
                  </div>
                  <div className="mt-1 text-[12px] font-bold text-zinc-700 dark:text-zinc-300">
                    예금주 {ACCOUNT_HOLDER}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void copyAccountNumber()}
                  className="flex h-10 shrink-0 items-center justify-center rounded-xl bg-white px-3 text-[11px] font-black text-[#3182f6] ring-1 ring-zinc-200 transition hover:bg-[#ebf2ff] dark:bg-zinc-950 dark:text-blue-300 dark:ring-zinc-700 dark:hover:bg-blue-950/40"
                >
                  {copyOk ? "복사됨" : "계좌 복사"}
                </button>
              </div>
            </div>
            {showDepositCountdown ? (
              <div className="mt-3 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-3 dark:border-emerald-900/70 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">
                      멤버십 승인 중
                    </div>
                    <div className="mt-1 break-keep text-[12px] font-bold leading-5 text-zinc-600 dark:text-zinc-300">
                      5분 내로 멤버십이 자동 승인됩니다.
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
            {depositNotifyState !== "sent" ? (
              <button
                type="button"
                onClick={() => void notifyDepositDone()}
                disabled={
                  state === "submitting" || depositNotifyState === "sending"
                }
                className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--brand-accent-strong)] px-4 text-[14px] font-black text-[var(--brand-cream)] shadow-[0_10px_22px_rgba(49,130,246,0.22)] transition hover:opacity-90 disabled:cursor-default disabled:opacity-70"
              >
                {depositNotifyState === "sending" ? "확인 중" : "입금했어요"}
              </button>
            ) : null}
            {depositNotifyState === "idle" ? (
              <p className="mt-2 break-keep text-[11px] font-bold leading-4 text-zinc-500 dark:text-zinc-400">
                입금 후 입금했어요 버튼을 누르면 5분 내로 멤버십이 자동
                완료됩니다.
              </p>
            ) : null}
            {depositNotifyMessage ? (
              <p
                className={`mt-2 break-keep text-[11px] font-bold leading-4 ${depositNotifyState === "error" ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}
              >
                {depositNotifyMessage}
              </p>
            ) : null}
            {depositNotifyState !== "sent" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={openSelector}
                  disabled={state === "submitting"}
                  className="h-10 rounded-xl border border-blue-100 bg-blue-50 text-[12px] font-black text-[#3182f6] transition hover:bg-[#ebf2ff] disabled:cursor-default disabled:opacity-60 dark:border-blue-950/70 dark:bg-blue-950/30 dark:text-blue-200"
                >
                  {renewalMode ? "연장 기간 변경" : "기간/금액 변경"}
                </button>
                <button
                  type="button"
                  onClick={() => void cancelReservation()}
                  disabled={state === "submitting"}
                  className="h-10 rounded-xl border border-zinc-200 bg-white text-[12px] font-black text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-default disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                >
                  {renewalMode ? "연장 취소" : "예약 취소"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : renewalMode ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_1.15fr]">
          <Link
            href="/me"
            className="flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-[12px] font-black text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          >
            상품 피드 보기
          </Link>
          <button
            type="button"
            onClick={openSelector}
            disabled={state === "submitting"}
            className="flex h-11 items-center justify-center rounded-xl bg-[var(--brand-accent-strong)] px-4 text-[13px] font-black text-[var(--brand-cream)] shadow-[0_10px_22px_rgba(49,130,246,0.22)] transition hover:opacity-90 disabled:cursor-default disabled:opacity-70"
          >
            {state === "submitting" ? "연장 예약 중" : "멤버십 연장하기"}
          </button>
        </div>
      ) : showInlineSelector ? (
        <div className="overflow-hidden rounded-[26px] border border-blue-100 bg-white text-zinc-950 shadow-[0_24px_70px_rgba(49,130,246,0.16)] ring-1 ring-blue-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:ring-white/10">
          <div className="relative border-b border-blue-100 bg-[linear-gradient(135deg,#f8fbff_0%,#eaf3ff_100%)] px-4 py-4 dark:border-zinc-800 dark:bg-none dark:bg-white/6 sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#3182f6] dark:text-blue-300">
                  Membership
                </div>
                <h2 className="mt-1 break-keep text-[26px] font-black leading-tight tracking-tight sm:text-[36px]">
                  멤버십 기간 선택
                </h2>
                <p className="mt-1 break-keep text-[12px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
                  기간을 고르면 지역 티오를 먼저 잡아둡니다.
                </p>
              </div>
              <div className="shrink-0 rounded-2xl bg-white px-2.5 py-2 text-right ring-1 ring-blue-100 dark:bg-zinc-950 dark:ring-zinc-800">
                <div className="text-[9px] font-black text-zinc-400">지역</div>
                <div className="mt-0.5 max-w-[106px] truncate text-[12px] font-black text-[#3182f6] dark:text-blue-300 sm:max-w-[150px] sm:text-[13px]">
                  {reservationRegion}
                </div>
              </div>
            </div>
          </div>
          <div className="px-3 pb-20 pt-3 sm:px-5 sm:py-5">
            <PlanGrid
              plans={plans}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              disabled={state === "submitting"}
            />
            <button
              type="button"
              onClick={() => void beginApplication(selectedPlan)}
              disabled={state === "submitting"}
              className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-[130] mx-auto flex h-12 max-w-[760px] items-center justify-center rounded-2xl bg-[var(--brand-accent-strong)] px-4 text-[15px] font-black text-[var(--brand-cream)] shadow-[0_18px_45px_rgba(49,130,246,0.30)] transition hover:opacity-90 disabled:cursor-default disabled:opacity-70 sm:static sm:mt-3 sm:max-w-none"
            >
              {state === "submitting" ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  자리 확보 중
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
            onClick={openSelector}
            disabled={state === "submitting"}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand-accent-strong)] px-4 text-[13px] font-black text-[var(--brand-cream)] shadow-[0_10px_22px_rgba(49,130,246,0.22)] transition hover:opacity-90 disabled:cursor-default disabled:opacity-70"
          >
            {state === "submitting"
              ? "자리 예약 중"
              : "지금 바로 자리 차지하기"}
          </button>
          {!suppressFixedCta && !selectorOpen ? (
            <button
              type="button"
              onClick={openSelector}
              disabled={state === "submitting"}
              className="fixed inset-x-3 bottom-3 z-40 flex h-12 items-center justify-center rounded-2xl bg-[var(--brand-accent-strong)] px-4 text-[14px] font-black text-[var(--brand-cream)] shadow-[0_18px_45px_rgba(49,130,246,0.34)] ring-1 ring-white/30 transition hover:opacity-90 disabled:cursor-default disabled:opacity-70 sm:hidden"
            >
              {state === "submitting"
                ? "자리 예약 중"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-3 py-4 backdrop-blur-sm">
          <div className="flex max-h-[calc(100dvh-32px)] w-full max-w-[760px] flex-col overflow-y-auto rounded-[28px] border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3182f6] dark:text-blue-200">
                  Membership
                </div>
                <h2 className="mt-1 break-keep text-[26px] font-black leading-tight text-zinc-950 dark:text-zinc-50 sm:text-[34px]">
                  {renewalMode ? "멤버십 연장 기간 선택" : "멤버십 기간 선택"}
                </h2>
                <p className="mt-1.5 break-keep text-[12px] font-semibold leading-5 text-zinc-500 dark:text-zinc-400">
                  {renewalMode
                    ? "승인되면 기존 만료일 뒤에 선택한 기간이 붙습니다. 월 단가는 기간이 길수록 낮아집니다."
                    : "기간이 길수록 월 단가가 낮아집니다."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectorOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-[17px] font-black text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="mt-4">
              <PlanGrid
                plans={plans}
                selectedKey={selectedKey}
                onSelect={setSelectedKey}
                disabled={state === "submitting"}
              />
            </div>
            <div className="mt-4 grid grid-cols-[0.8fr_1.2fr] gap-2">
              <button
                type="button"
                onClick={() => setSelectorOpen(false)}
                className="h-11 rounded-xl border border-zinc-200 bg-white text-[12px] font-black text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => void beginApplication(selectedPlan)}
                disabled={state === "submitting"}
                className="h-11 rounded-xl bg-[var(--brand-accent-strong)] text-[12px] font-black text-[var(--brand-cream)] transition hover:opacity-90 disabled:cursor-default disabled:opacity-70"
              >
                {state === "submitting" ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                    처리 중
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
    <div className="grid grid-cols-2 gap-2">
      {plans.map((plan) => {
        const active = plan.key === selectedKey;
        return (
          <button
            key={plan.key}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(plan.key)}
            className={`relative overflow-hidden rounded-[18px] border px-3 py-3 text-left transition disabled:cursor-default sm:px-3.5 sm:py-3 ${
              active
                ? "border-[#3182f6] bg-zinc-950 text-white shadow-[0_16px_34px_rgba(49,130,246,0.22)] ring-1 ring-[#3182f6]/30 dark:border-blue-400 dark:bg-white dark:text-zinc-950"
                : "border-zinc-200 bg-white text-zinc-950 shadow-[0_10px_26px_rgba(15,23,42,0.05)] hover:border-blue-200 hover:bg-[#fbfcff] dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-50 dark:hover:border-blue-900"
            }`}
          >
            {active ? (
              <div className="absolute right-2 top-2 rounded-full bg-[#3182f6] px-2 py-0.5 text-[9px] font-black text-white">
                선택됨
              </div>
            ) : null}
            <div className="flex min-h-[82px] flex-col justify-between gap-2 sm:min-h-0">
              <div>
                <div className="flex flex-wrap items-center gap-1 pr-9">
                  <span className="text-[20px] font-black leading-none sm:text-[15px]">
                    {plan.label}
                  </span>
                  {plan.badge ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ring-1 sm:px-2 sm:text-[10px] ${
                        active
                          ? "bg-white/10 text-blue-100 ring-white/20 dark:bg-zinc-950/8 dark:text-[#3182f6] dark:ring-zinc-950/10"
                          : "bg-white text-[#3182f6] ring-blue-100 dark:bg-zinc-900 dark:ring-blue-900"
                      }`}
                    >
                      {plan.badge}
                    </span>
                  ) : null}
                </div>
                <div
                  className={`mt-1 hidden text-[11px] font-bold sm:block ${
                    active
                      ? "text-white/58 dark:text-zinc-500"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {plan.valueNote}
                </div>
              </div>
              <div>
                <div className="text-[19px] font-black leading-none sm:text-[14px]">
                  {krw(plan.priceKrw)}
                </div>
                <div
                  className={`mt-1 whitespace-nowrap text-[10px] font-black ${
                    active
                      ? "text-white/58 dark:text-zinc-500"
                      : "text-zinc-400"
                  }`}
                >
                  {plan.monthlyLabel}
                </div>
              </div>
            </div>
            <div className="mt-1.5 hidden text-[11px] font-bold text-emerald-700 dark:text-emerald-300 sm:block">
              {plan.paybackNote}
            </div>
          </button>
        );
      })}
    </div>
  );
}
