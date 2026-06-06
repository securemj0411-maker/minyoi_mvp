"use client";

// Wave 1218 (2026-06-07): 멤버십 결제 UI 공유 컴포넌트.
//   배경(owner 지적): 피드 "7만원 더 내면 1년 무제한" 업그레이드 오퍼(explore-client `FeedMembershipUpsellCard`)가
//     가입/연장 모달(membership-application-client)과 완전히 다른 컴포넌트로 만들어져 색/레이아웃/카운트다운/신뢰배지가 제각각이었음.
//   해결: 입금방법 선택 → 송금정보 → 입금했어요 → 신뢰배지 → 자동승인 카운트다운 → 환불/사업자 카드를
//     presentational(상태 없는) 공유 컴포넌트로 추출. 예약/입금확인 API와 상태머신은 각 부모가 소유하고
//     콜백/상태로 주입 → 7분 자리예약(가입) vs 1시간 특가(피드)처럼 다른 흐름도 회귀 없이 같은 룩을 공유.
//   가입 모달이 더 다듬어진 canonical 룩(Wave 1195~1214)이라 그 마크업을 기준으로 추출함.

import {
  KbankPaymentLogo,
  TossPaymentLogo,
} from "@/components/payment-brand-logo";
import PaymentTrustCard from "@/components/payment-trust-card";
import { krw } from "@/lib/membership-plans";
import {
  PAYMENT_ACCOUNT_HOLDER,
  PAYMENT_ACCOUNT_NUMBER,
  PAYMENT_BANK_NAME,
} from "@/lib/payment-account";

export type CheckoutPaymentMethod = "toss" | "bank";
export type CheckoutDepositState = "idle" | "sending" | "sent";
export type CheckoutIntent = "new" | "renewal";

export function countdownLabel(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSec = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// 모달 헤더 우측 "남은 시간" 카운트다운 카드.
//   가입 모달 = 7분 자리 예약 만료(`reservationMsLeft`), 피드 오퍼 = 1시간 특가(`feedUpsellRemainingSec`).
//   value 문자열만 부모가 다르게 주입하고 룩앤필은 동일. mr-9 = 모달 우상단 닫기 버튼 자리 확보.
export function UrgencyCountdownCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="mr-9 shrink-0 rounded-[18px] bg-white px-3 py-2.5 text-center text-zinc-950 shadow-[0_12px_30px_rgba(49,130,246,0.16)] ring-1 ring-blue-100 dark:bg-zinc-950 dark:text-white dark:ring-zinc-800">
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
        {label}
      </div>
      <div className="mt-1 font-mono text-[26px] font-black leading-none tabular-nums">
        {value}
      </div>
      {caption ? (
        <div className="mt-1 max-w-[124px] break-keep text-[10px] font-black leading-4 text-rose-500 dark:text-rose-300">
          {caption}
        </div>
      ) : null}
    </div>
  );
}

// 입금방법 선택 → 송금정보 → 입금했어요 CTA → 신뢰배지 → 자동승인 카운트다운 → 환불/사업자 카드.
//   showDepositCountdown / showPaymentDetails 는 depositState·paymentMethod 에서 파생 (양쪽 부모와 동일 정의).
//   부모가 모달 헤더/푸터/예약 흐름은 각자 소유하고, 이 컴포넌트는 결제 본문 룩만 책임진다.
export function MembershipCheckoutBody({
  planLabel,
  priceKrw,
  intent,
  paymentMethod,
  depositState,
  autoApproveMsLeft,
  copyOk,
  busy = false,
  onChooseToss,
  onChooseBank,
  onReopenToss,
  onSwitchToBank,
  onResetMethod,
  onCopyAccount,
  onNotifyDeposit,
  note,
  noteTone = "info",
}: {
  planLabel: string;
  priceKrw: number;
  intent: CheckoutIntent;
  paymentMethod: CheckoutPaymentMethod | null;
  depositState: CheckoutDepositState;
  autoApproveMsLeft: number;
  copyOk: boolean;
  busy?: boolean;
  onChooseToss: () => void;
  onChooseBank: () => void;
  onReopenToss: () => void;
  onSwitchToBank: () => void;
  onResetMethod: () => void;
  onCopyAccount: () => void;
  onNotifyDeposit: () => void;
  note?: string | null;
  noteTone?: "error" | "info";
}) {
  const showDepositCountdown = depositState === "sent";
  const showPaymentDetails = showDepositCountdown || paymentMethod !== null;
  const approveWord = intent === "renewal" ? "연장" : "승인";

  return (
    <>
      {!showPaymentDetails ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onChooseToss}
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
            onClick={onChooseBank}
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
              <div className="mt-1 text-[16px] font-black">{planLabel}</div>
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
          {paymentMethod === "toss" && !showDepositCountdown ? (
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
                  onClick={onReopenToss}
                  className="h-9 shrink-0 rounded-xl bg-[#3182f6] px-3 text-[11px] font-black text-white"
                >
                  다시 열기
                </button>
              </div>
            </div>
          ) : null}
          {paymentMethod === "bank" ||
          (showDepositCountdown && !paymentMethod) ? (
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
                  onClick={onCopyAccount}
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
          {paymentMethod === "toss" && !showDepositCountdown ? (
            <button
              type="button"
              onClick={onSwitchToBank}
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
                {intent === "renewal" ? "연장 승인 중" : "멤버십 승인 중"}
              </div>
              <div className="mt-1 break-keep text-[12px] font-bold leading-5 text-zinc-600 dark:text-zinc-300">
                {intent === "renewal"
                  ? "5분 내로 연장 기간이 자동 반영됩니다."
                  : "5분 내로 멤버십이 자동 승인됩니다."}
              </div>
            </div>
            <div className="shrink-0 rounded-[10px] bg-white px-3 py-2 text-[22px] font-black tabular-nums text-emerald-700 ring-1 ring-emerald-100 dark:bg-zinc-950 dark:text-emerald-300 dark:ring-emerald-900">
              {autoApproveMsLeft > 0 ? countdownLabel(autoApproveMsLeft) : "0:00"}
            </div>
          </div>
        </div>
      ) : null}
      {/* Wave 1196 (2026-06-06): 입금했어요 = primary CTA 강조. h-14 + 2줄(제목 + 안내 서브텍스트). */}
      {showPaymentDetails && depositState !== "sent" ? (
        <button
          type="button"
          onClick={onNotifyDeposit}
          disabled={busy || depositState === "sending"}
          className="mt-3 flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-2xl bg-[var(--brand-accent-strong)] px-4 text-[var(--brand-cream)] shadow-[0_14px_30px_rgba(49,130,246,0.30)] transition hover:opacity-90 disabled:cursor-default disabled:opacity-70"
        >
          {depositState === "sending" ? (
            <span className="text-[16px] font-black leading-none">확인 중</span>
          ) : (
            <>
              <span className="text-[17px] font-black leading-none">
                입금했어요
              </span>
              <span className="text-[11px] font-bold leading-none opacity-80">
                입금 완료 후 눌러주세요 · 최대 5분 내 자동 {approveWord}
              </span>
            </>
          )}
        </button>
      ) : null}
      {/* Wave 1197 (2026-06-06): 계좌입금 공포 차단 — 신뢰 배지 상시 노출.
          "미승인 시 전액 환불"은 환불정책 1조(입금 후 미활성화 시 전액 환불)에 근거. */}
      {showPaymentDetails && depositState !== "sent" ? (
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
      {/* Wave 1198 (2026-06-06): 송금 방법 다시 선택 — 보조 액션이라 입금했어요(primary) + 배지 아래로. */}
      {showPaymentDetails && depositState !== "sent" ? (
        <button
          type="button"
          onClick={onResetMethod}
          className="mt-1.5 h-9 w-full text-[12px] font-black text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          송금 방법 다시 선택
        </button>
      ) : null}
      {note ? (
        <p
          className={`mt-2 break-keep text-[11px] font-bold leading-4 ${noteTone === "error" ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}
        >
          {note}
        </p>
      ) : null}
      {showPaymentDetails ? (
        <div className="mt-3">
          <PaymentTrustCard />
        </div>
      ) : null}
    </>
  );
}
