"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getMembershipPlan,
  krw,
  UPSELL_PLANS_FROM_1MO,
  UPSELL_PLANS_FROM_3MO,
  type MembershipPlan,
  type MembershipPlanKey,
} from "@/lib/membership-plans";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const BANK_NAME = "우리은행";
const ACCOUNT_NUMBER = "1002-367-160511";
const ACCOUNT_HOLDER = "이민제";

type ApplyState = "idle" | "submitting" | "sent" | "error";
type DepositNotifyState = "idle" | "sending" | "sent" | "error";
type PendingApplication = {
  id: number;
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
  application?: {
    scheduledAutoApproveAt?: string | null;
    depositConfirmedAt?: string | null;
    status?: string | null;
  } | null;
};

function upsellPlansFor(plan: MembershipPlan): MembershipPlan[] {
  if (plan.key === "limited_300_1mo") return UPSELL_PLANS_FROM_1MO;
  if (plan.key === "limited_300_3mo") return UPSELL_PLANS_FROM_3MO;
  return [];
}

function countdownLabel(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSec = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function MembershipApplicationClient({
  isAuthed,
  isMember,
  loginHref,
  plans,
  pendingApplication,
}: {
  isAuthed: boolean;
  isMember: boolean;
  loginHref: string;
  plans: MembershipPlan[];
  pendingApplication: PendingApplication | null;
}) {
  const router = useRouter();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<MembershipPlanKey>(
    getMembershipPlan(pendingApplication?.planKey ?? plans[1]?.key).key,
  );
  const [selectedUpsellKey, setSelectedUpsellKey] = useState<MembershipPlanKey | null>(null);
  const [submittedPlan, setSubmittedPlan] = useState<MembershipPlan | null>(null);
  const [state, setState] = useState<ApplyState>(pendingApplication ? "sent" : "idle");
  const [message, setMessage] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);
  const [depositNotifyState, setDepositNotifyState] = useState<DepositNotifyState>(pendingApplication?.depositConfirmedAt ? "sent" : "idle");
  const [depositNotifyMessage, setDepositNotifyMessage] = useState<string | null>(
    pendingApplication?.depositConfirmedAt ? "입금 확인 요청이 접수됐어요. 5분 내 승인 보장으로 확인 중입니다." : null,
  );
  const [autoApproveAt, setAutoApproveAt] = useState<string | null>(pendingApplication?.scheduledAutoApproveAt ?? null);
  const [approvalDetected, setApprovalDetected] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const [reservationCancelled, setReservationCancelled] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [upsellStartedAt, setUpsellStartedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const selectedPlan = getMembershipPlan(selectedKey);
  const upsellPlans = upsellPlansFor(selectedPlan);
  const selectedUpsellPlan = selectedUpsellKey ? getMembershipPlan(selectedUpsellKey) : (upsellPlans[0] ?? null);
  const offerMsLeft = upsellStartedAt ? Math.max(0, (10 * 60_000) - (nowMs - upsellStartedAt)) : 10 * 60_000;
  const offerMinutesLeft = Math.max(0, Math.ceil(offerMsLeft / 60_000));
  const offerExpired = upsellStartedAt !== null && offerMsLeft <= 0;

  useEffect(() => {
    if (!upsellOpen && !autoApproveAt) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [autoApproveAt, upsellOpen]);

  useEffect(() => {
    if (!autoApproveAt || approvalDetected || reservationCancelled) return;
    let alive = true;

    async function checkMembershipStatus() {
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase ? await supabase.auth.getSession() : { data: null };
      const token = data?.session?.access_token;
      if (!token || !alive) return;

      const res = await fetch("/api/membership/status", {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (!res?.ok || !alive) return;
      const payload = (await res.json().catch(() => null)) as MembershipStatusResponse | null;
      const nextAutoApproveAt = payload?.application?.scheduledAutoApproveAt ?? null;
      if (nextAutoApproveAt && nextAutoApproveAt !== autoApproveAt) setAutoApproveAt(nextAutoApproveAt);
      if (payload?.isMember) {
        setApprovalDetected(true);
        setApprovalMessage("멤버십 가입 완료. 환영합니다.");
        setDepositNotifyMessage("승인 완료됐어요. 상품 피드로 이동합니다.");
        window.setTimeout(() => router.replace("/me"), 1200);
      }
    }

    void checkMembershipStatus();
    const id = window.setInterval(() => void checkMembershipStatus(), 2000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [autoApproveAt, approvalDetected, reservationCancelled, router]);

  function openSelector() {
    if (state === "submitting") return;
    setMessage(null);
    setSelectorOpen(true);
  }

  function beginApplication(plan: MembershipPlan) {
    if (state === "submitting") return;
    const nextUpsells = upsellPlansFor(plan);
    setSelectorOpen(false);
    if (!plan.isUpsell && nextUpsells.length > 0) {
      const startedAt = Date.now();
      setNowMs(startedAt);
      setSelectedUpsellKey(nextUpsells[0]?.key ?? null);
      setUpsellStartedAt(startedAt);
      setUpsellOpen(true);
      return;
    }
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
      setMessage("입금 확인 요청 후에는 기간/금액 변경이 막혀요. 필요하면 운영자에게 알려주세요.");
      return;
    }
    setState("submitting");
    setMessage(null);
    setSelectorOpen(false);
    setUpsellOpen(false);

    const supabase = getSupabaseBrowserClient();
    const { data } = supabase ? await supabase.auth.getSession() : { data: null };
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
      body: JSON.stringify({ source: "plans", productKey: plan.key }),
    }).catch(() => null);

    if (!res?.ok) {
      setState("error");
      setMessage("자리 예약이 실패했어요. 잠시 후 다시 눌러주세요.");
      return;
    }
    const payload = (await res.json().catch(() => null)) as { telegramSent?: boolean } | null;
    setSubmittedPlan(plan);
    setReservationCancelled(false);
    setState("sent");
    setMessage(payload?.telegramSent === false
      ? "내 지역 티오 확인 후 자리는 예약됐어요. 아래 계좌로 송금한 뒤 입금했어요 버튼을 눌러주세요."
      : `${plan.label} 내 지역 티오 확인 완료. 아래 계좌로 송금한 뒤 입금했어요 버튼을 눌러주세요.`);
  }

  async function notifyDepositDone() {
    if (state === "submitting" || depositNotifyState === "sending") return;
    setDepositNotifyState("sending");
    setDepositNotifyMessage(null);

    const supabase = getSupabaseBrowserClient();
    const { data } = supabase ? await supabase.auth.getSession() : { data: null };
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
      setDepositNotifyMessage("입금 확인 요청을 보내지 못했어요. 잠시 후 다시 눌러주세요.");
      return;
    }

    const payload = (await res.json().catch(() => null)) as { telegramSent?: boolean; scheduledAutoApproveAt?: string | null } | null;
    const fallbackAutoApproveAt = new Date(Date.now() + 5 * 60_000).toISOString();
    setAutoApproveAt(payload?.scheduledAutoApproveAt ?? fallbackAutoApproveAt);
    setDepositNotifyState("sent");
    setDepositNotifyMessage(payload?.telegramSent === false
      ? "입금 확인 요청은 저장됐어요. 알림 상태는 확인 중이라, 늦으면 카톡으로도 알려주세요."
      : "운영자에게 입금 확인 알림을 보냈어요. 5분 내 승인 보장으로 확인합니다.");
  }

  async function cancelReservation() {
    if (state === "submitting") return;
    if (depositNotifyState === "sent") {
      setMessage("입금 확인 요청 후에는 예약 취소가 막혀요. 운영자에게 환불/취소를 요청해주세요.");
      return;
    }
    const confirmed = window.confirm("입금 전 자리 예약을 취소할까요? 취소 후 다시 신청할 수 있어요.");
    if (!confirmed) return;

    setState("submitting");
    setMessage(null);
    setSelectorOpen(false);
    setUpsellOpen(false);

    const supabase = getSupabaseBrowserClient();
    const { data } = supabase ? await supabase.auth.getSession() : { data: null };
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
    setApprovalDetected(false);
    setApprovalMessage(null);
    setReservationCancelled(true);
    setState("idle");
    setMessage("예약이 취소됐어요. 다시 신청할 수 있어요.");
  }

  if (isMember) {
    return (
      <Link
        href="/me"
        className="flex h-11 min-w-[148px] items-center justify-center rounded-xl bg-[var(--brand-accent-strong)] px-4 text-[13px] font-black text-[var(--brand-cream)] shadow-[0_10px_22px_rgba(49,130,246,0.22)] transition hover:opacity-90"
      >
        이미 승인됨
      </Link>
    );
  }

  if (!isAuthed) {
    return (
      <Link
        href={loginHref}
        className="flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand-accent-strong)] px-4 text-[13px] font-black text-[var(--brand-cream)] shadow-[0_10px_22px_rgba(49,130,246,0.22)] transition hover:opacity-90"
      >
        로그인하고 신청하기
      </Link>
    );
  }

  const hasReservation = Boolean((pendingApplication || state === "sent") && !reservationCancelled);
  const planLabel = submittedPlan?.label ?? pendingApplication?.planLabel ?? "멤버십";
  const priceKrw = submittedPlan?.priceKrw ?? pendingApplication?.priceKrw ?? 99_000;
  const autoApproveTargetMs = autoApproveAt ? Date.parse(autoApproveAt) : null;
  const autoApproveMsLeft = autoApproveTargetMs && Number.isFinite(autoApproveTargetMs)
    ? Math.max(0, autoApproveTargetMs - nowMs)
    : 5 * 60_000;
  const showDepositCountdown = hasReservation && depositNotifyState === "sent";

  return (
    <div>
      {approvalMessage ? (
        <div className="fixed left-1/2 top-4 z-[70] w-[calc(100%-24px)] max-w-[420px] -translate-x-1/2 rounded-[14px] border border-emerald-200 bg-white px-4 py-3 text-center text-[13px] font-black text-emerald-700 shadow-2xl dark:border-emerald-900 dark:bg-zinc-950 dark:text-emerald-300">
          {approvalMessage}
        </div>
      ) : null}
      {hasReservation ? (
        <div className="rounded-[12px] border border-blue-100 bg-white px-3.5 py-3 dark:border-blue-950/70 dark:bg-zinc-950/50">
          <div className="text-[11px] font-black text-[#3182f6] dark:text-blue-300">내 지역 티오 확인 완료 · 입금 대기</div>
          <div className="mt-1 text-[15px] font-black text-zinc-950 dark:text-zinc-50">
            {planLabel} · {krw(priceKrw)}
          </div>
          <p className={`mt-1.5 break-keep text-[12px] font-semibold leading-5 ${state === "error" ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}>
            {message ?? "자리가 예약됐습니다. 아래 계좌로 송금한 뒤 입금했어요 버튼을 누르면 운영자에게 바로 알림이 갑니다."}
          </p>
          <div className="mt-3 rounded-[12px] bg-[#f5f7fb] p-3 dark:bg-zinc-900/70">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">{BANK_NAME}</div>
                <div className="mt-1 font-black tabular-nums text-[19px] tracking-tight text-zinc-950 dark:text-zinc-50">
                  {ACCOUNT_NUMBER}
                </div>
                <div className="mt-1 text-[12px] font-bold text-zinc-700 dark:text-zinc-300">예금주 {ACCOUNT_HOLDER}</div>
              </div>
              <button
                type="button"
                onClick={() => void copyAccountNumber()}
                className="flex h-10 shrink-0 items-center justify-center rounded-xl bg-white px-3 text-[11px] font-black text-[#3182f6] ring-1 ring-zinc-200 transition hover:bg-[#ebf2ff] dark:bg-zinc-950 dark:text-blue-300 dark:ring-zinc-700 dark:hover:bg-blue-950/40"
              >
                {copyOk ? "복사됨" : "계좌 복사"}
              </button>
            </div>
            <div className="mt-2 rounded-[10px] border border-blue-100 bg-white px-3 py-2 text-[11px] font-bold leading-4 text-zinc-600 dark:border-blue-950/60 dark:bg-zinc-950 dark:text-zinc-300">
              입금 금액: <b className="text-[#3182f6] dark:text-blue-300">{krw(priceKrw)}</b>
              {" "}· 5분 내 승인 보장
            </div>
          </div>
          {showDepositCountdown ? (
            <div className="mt-3 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-3 dark:border-emerald-900/70 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">입금 확인 진행 중</div>
                  <div className="mt-1 break-keep text-[12px] font-bold leading-5 text-zinc-600 dark:text-zinc-300">
                    5분 내 운영자가 확인합니다. 시간이 지나면 자동으로 승인돼요.
                  </div>
                </div>
                <div className="shrink-0 rounded-[10px] bg-white px-3 py-2 text-[22px] font-black tabular-nums text-emerald-700 ring-1 ring-emerald-100 dark:bg-zinc-950 dark:text-emerald-300 dark:ring-emerald-900">
                  {autoApproveMsLeft > 0 ? countdownLabel(autoApproveMsLeft) : "0:00"}
                </div>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void notifyDepositDone()}
            disabled={state === "submitting" || depositNotifyState === "sending" || depositNotifyState === "sent"}
            className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand-accent-strong)] px-4 text-[13px] font-black text-[var(--brand-cream)] shadow-[0_10px_22px_rgba(49,130,246,0.22)] transition hover:opacity-90 disabled:cursor-default disabled:opacity-70"
          >
            {depositNotifyState === "sending"
              ? "입금 확인 요청 중"
              : depositNotifyState === "sent"
                ? "입금 확인 요청 완료"
                : "입금했어요"}
          </button>
          {depositNotifyMessage ? (
            <p className={`mt-2 break-keep text-[11px] font-bold leading-4 ${depositNotifyState === "error" ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}>
              {depositNotifyMessage}
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={openSelector}
              disabled={state === "submitting" || depositNotifyState === "sent"}
              className="h-10 rounded-xl border border-blue-100 bg-blue-50 text-[12px] font-black text-[#3182f6] transition hover:bg-[#ebf2ff] disabled:cursor-default disabled:opacity-60 dark:border-blue-950/70 dark:bg-blue-950/30 dark:text-blue-200"
            >
              기간/금액 변경
            </button>
            <button
              type="button"
              onClick={() => void cancelReservation()}
              disabled={state === "submitting" || depositNotifyState === "sent"}
              className="h-10 rounded-xl border border-zinc-200 bg-white text-[12px] font-black text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-default disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
            >
              예약 취소
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openSelector}
          disabled={state === "submitting"}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand-accent-strong)] px-4 text-[13px] font-black text-[var(--brand-cream)] shadow-[0_10px_22px_rgba(49,130,246,0.22)] transition hover:opacity-90 disabled:cursor-default disabled:opacity-70"
        >
          {state === "submitting" ? "자리 예약 중" : "멤버십 신청하기"}
        </button>
      )}
      {message && !hasReservation ? (
        <p className={`mt-2 break-keep text-[11px] font-bold leading-4 ${state === "error" ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}>
          {message}
        </p>
      ) : null}
      {selectorOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-3 py-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-[560px] rounded-[18px] border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3182f6] dark:text-blue-200">Membership select</div>
                <h2 className="mt-1 break-keep text-[22px] font-black leading-tight text-zinc-950 dark:text-zinc-50">
                  신청 기간을 고르세요.
                </h2>
                <p className="mt-1.5 break-keep text-[12px] font-semibold leading-5 text-zinc-500 dark:text-zinc-400">
                  신청자 기준 지역 티오를 확인한 뒤 가능하면 자리를 예약합니다. 월 단가는 기간이 길수록 낮아집니다.
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
              <PlanGrid plans={plans} selectedKey={selectedKey} onSelect={setSelectedKey} disabled={state === "submitting"} />
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
                onClick={() => beginApplication(selectedPlan)}
                disabled={state === "submitting"}
                className="h-11 rounded-xl bg-[var(--brand-accent-strong)] text-[12px] font-black text-[var(--brand-cream)] transition hover:opacity-90 disabled:cursor-default disabled:opacity-70"
              >
                {selectedPlan.label} 자리 예약하기
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {upsellOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-3 py-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-[520px] rounded-[18px] border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-[#3182f6] dark:bg-blue-950/40 dark:text-blue-200">
              {offerExpired ? "신청 직후 조건 만료" : `신청 직후 ${offerMinutesLeft}분 조건`}
            </div>
            <h2 className="mt-3 break-keep text-[22px] font-black leading-tight text-zinc-950 dark:text-zinc-50">
              지금 기간을 늘리면 월 단가를 더 낮출 수 있어요.
            </h2>
            <p className="mt-2 break-keep text-[12px] font-semibold leading-5 text-zinc-500 dark:text-zinc-400">
              아래 카드는 선택만 됩니다. 마지막 예약 버튼을 눌러야 입금 안내가 열립니다.
            </p>
            <div className="mt-4 grid gap-2">
              {upsellPlans.map((plan) => {
                const active = plan.key === selectedUpsellKey;
                return (
                  <button
                    key={plan.key}
                    type="button"
                    onClick={() => setSelectedUpsellKey(plan.key)}
                    disabled={state === "submitting" || offerExpired}
                    className={`rounded-[12px] border px-3.5 py-3 text-left transition disabled:cursor-default disabled:opacity-50 ${
                      active
                        ? "border-[#3182f6] bg-blue-50 shadow-[0_10px_24px_rgba(49,130,246,0.12)] dark:border-blue-700 dark:bg-blue-950/30"
                        : "border-blue-100 bg-blue-50/70 hover:border-[#3182f6] hover:bg-blue-50 dark:border-blue-950/70 dark:bg-blue-950/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[14px] font-black text-zinc-950 dark:text-zinc-50">{plan.label}</div>
                        <div className="mt-1 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">{plan.valueNote}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[15px] font-black text-[#3182f6]">{krw(plan.priceKrw)}</div>
                        <div className="mt-0.5 text-[10px] font-black text-zinc-400">{plan.monthlyLabel}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{plan.paybackNote}</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setUpsellOpen(false);
                  setSelectorOpen(true);
                }}
                className="h-10 rounded-xl border border-zinc-200 bg-white text-[12px] font-black text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              >
                다시 고르기
              </button>
              <button
                type="button"
                onClick={() => void submitApplication(selectedPlan)}
                disabled={state === "submitting"}
                className="h-10 rounded-xl border border-zinc-200 bg-white text-[12px] font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-default disabled:opacity-70 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {selectedPlan.label} 그대로
              </button>
              <button
                type="button"
                onClick={() => selectedUpsellPlan ? void submitApplication(selectedUpsellPlan) : undefined}
                disabled={state === "submitting" || offerExpired || !selectedUpsellPlan}
                className="h-10 rounded-xl bg-zinc-900 px-3 text-[12px] font-black text-white transition hover:bg-zinc-700 disabled:cursor-default disabled:opacity-50 dark:bg-white dark:text-zinc-950"
              >
                {offerExpired ? "특별 조건 만료" : `${selectedUpsellPlan?.label ?? "특별가"}로 예약`}
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
    <div className="grid gap-2 sm:grid-cols-2">
      {plans.map((plan) => {
        const active = plan.key === selectedKey;
        return (
          <button
            key={plan.key}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(plan.key)}
            className={`rounded-[12px] border px-3.5 py-3 text-left transition disabled:cursor-default ${
              active
                ? "border-[#3182f6] bg-blue-50 shadow-[0_10px_24px_rgba(49,130,246,0.12)] dark:border-blue-700 dark:bg-blue-950/30"
                : "border-zinc-200 bg-white hover:border-blue-200 hover:bg-[#fbfcff] dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-blue-900"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-black text-zinc-950 dark:text-zinc-50">{plan.label}</span>
                  {plan.badge ? (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-[#3182f6] ring-1 ring-blue-100 dark:bg-zinc-900 dark:ring-blue-900">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">{plan.valueNote}</div>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-black text-zinc-950 dark:text-zinc-50">{krw(plan.priceKrw)}</div>
                <div className="mt-0.5 text-[10px] font-black text-zinc-400">{plan.monthlyLabel}</div>
              </div>
            </div>
            <div className="mt-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{plan.paybackNote}</div>
          </button>
        );
      })}
    </div>
  );
}
