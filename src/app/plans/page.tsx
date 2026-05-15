"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadClientPlan, type ClientPlanState } from "@/lib/client-billing";
import { PLANS, formatKrw, type PlanKey } from "@/lib/plan-config";

const ORDER: PlanKey[] = ["starter", "plus", "pro"];

function CheckIcon() {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent-strong)] text-[11px] font-black text-[var(--brand-cream)]">
      ✓
    </span>
  );
}

function PricingMark() {
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24" aria-hidden="true">
      <rect x="18" y="18" width="84" height="84" rx="30" fill="#edf3eb" stroke="#b9c9b9" strokeWidth="4" />
      <path d="M36 72c12-28 36-28 48 0" fill="none" stroke="#314238" strokeWidth="9" strokeLinecap="round" />
      <path d="M60 35v34" stroke="#314238" strokeWidth="9" strokeLinecap="round" />
      <path d="M47 49h26" stroke="#314238" strokeWidth="9" strokeLinecap="round" />
      <circle cx="60" cy="84" r="7" fill="#314238" />
    </svg>
  );
}

export default function PlansPage() {
  const [current, setCurrent] = useState<ClientPlanState | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadClientPlan()
      .then((state) => {
        if (active) {
          setCurrent(state);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#f6f1e8] px-4 py-8 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-[1180px] space-y-6">
        <section className="overflow-hidden rounded-[34px] border border-[#ddd4c7] bg-[#fffbf4] shadow-[0_24px_60px_rgba(34,49,39,0.08)] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-6 px-6 py-7 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center lg:px-10">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-[#cfd9c9] bg-[#edf3eb] px-3 py-1.5 text-xs font-black text-[#4f6f58]">
                요금제
              </div>
              <h1 className="mt-4 max-w-2xl break-keep text-[34px] font-black leading-[1.06] tracking-tight text-[#223127] [text-wrap:balance] sm:text-[46px] dark:text-zinc-50">
                필요한 만큼 추천을 열어보세요
              </h1>
              <p className="mt-4 max-w-2xl break-keep text-sm leading-6 text-[#596558] sm:text-[15px] dark:text-zinc-300">
                월 크레딧 + 일일 열람 한도로 운영합니다. 가입 시 무료 크레딧 5개가 지급되고, 더 자주 돌리고 싶을 때 유료 플랜으로 올리세요.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {[
                  { label: "무료 5크레딧 지급", note: "가입 시" },
                  { label: "언제든 취소", note: "남은 기간 사용" },
                  { label: "Mock 결제", note: "베타 검증" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-[#ddd4c7] bg-[#fffaf1] px-3 py-2 text-xs font-black text-[#556252]">
                    <div>{item.label}</div>
                    <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a8a7c]">{item.note}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden justify-self-end rounded-[28px] border border-[#d8decd] bg-[#fffaf1] p-5 shadow-[0_14px_30px_rgba(34,49,39,0.08)] lg:block">
              <PricingMark />
              <div className="mt-4 text-sm font-black text-[#223127]">월 크레딧 + 일일 한도</div>
              <div className="mt-1 text-xs leading-5 text-[#6b7269]">
                과한 결제 부담 없이, 일정 페이스로 돌릴 수 있는 가격대로 준비합니다.
              </div>
            </div>
          </div>
        </section>

        {loaded && current && current.planKey !== "free" ? (
          <section className="rounded-[24px] border border-[#cfd9c9] bg-[#edf4e8] px-5 py-4 text-sm text-[#2f3d31] dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100">
            현재 이용중인 플랜: <strong className="font-black">{current.planName}</strong>
            {current.cancelAtPeriodEnd ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800">취소 예약됨</span>
            ) : null}
            <Link
              href="/me?tab=account"
              className="ml-3 inline-flex rounded-full border border-[#9fb49c] bg-[#fffaf1] px-3 py-1 text-xs font-black text-[#3a4f40] hover:bg-white"
            >
              사용량 보기
            </Link>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-3">
          {ORDER.map((key) => {
            const plan = PLANS[key];
            const isCurrent = current?.planKey === plan.key && current?.status === "active";
            return (
              <article
                key={plan.key}
                className={`relative overflow-hidden rounded-[30px] border p-6 shadow-sm transition ${
                  plan.highlight
                    ? "border-[#9fb49c] bg-[#edf3eb] shadow-[0_22px_48px_rgba(92,116,95,0.16)] dark:border-emerald-800 dark:bg-emerald-950/20"
                    : "border-[#ddd4c7] bg-[#fffbf4] dark:border-zinc-800 dark:bg-zinc-900"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-[#5d735f]">{plan.tagline}</div>
                    <h2 className="mt-2 text-2xl font-black text-[#223127] dark:text-zinc-50">{plan.name}</h2>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-black ${
                      plan.highlight
                        ? "bg-[var(--brand-accent-strong)] text-[var(--brand-cream)]"
                        : "bg-[#fffaf1] text-[#5d735f] ring-1 ring-[#ddd4c7] dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {plan.badge ?? "—"}
                  </span>
                </div>

                <div className="mt-6 rounded-[22px] border border-[#d8decd] bg-[#fffaf1] px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <div className="flex items-end gap-2">
                    <div className="text-3xl font-black tracking-tight text-[#223127] dark:text-zinc-50">{formatKrw(plan.priceKrw)}</div>
                    <div className="pb-1 text-xs font-bold text-[#6b7269] dark:text-zinc-400">{plan.cadence}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-black">
                    <span className="rounded-full bg-[#edf3eb] px-3 py-1 text-[var(--brand-accent-strong)]">
                      월 {plan.monthlyCredits} 크레딧
                    </span>
                    <span className="rounded-full bg-[#fff3df] px-3 py-1 text-[#8b6914]">
                      하루 {plan.dailyOpenLimit}회
                    </span>
                  </div>
                </div>

                {isCurrent ? (
                  <div className="mt-5 flex h-11 w-full items-center justify-center rounded-2xl border border-[#9fb49c] bg-[#fffaf1] text-sm font-black text-[#3a4f40]">
                    이용중
                  </div>
                ) : (
                  <Link
                    href={`/billing/checkout?plan=${plan.key}`}
                    className={`mt-5 flex h-11 w-full items-center justify-center rounded-2xl px-4 text-sm font-black transition ${
                      plan.highlight
                        ? "bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] hover:bg-[#29382f] dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
                        : "border border-[#ddd4c7] bg-[#fffaf1] text-[#344136] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {current && current.planKey !== "free" ? "이 플랜으로 변경" : "결제하고 시작"}
                  </Link>
                )}

                <ul className="mt-6 space-y-3 text-sm text-[#586356] dark:text-zinc-300">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckIcon />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>

        <section className="rounded-[28px] border border-[#ddd4c7] bg-[#fffbf4] p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-black text-[#223127] dark:text-zinc-50">요금제 비교</h2>
          <p className="mt-2 text-sm text-[#6b7269] dark:text-zinc-400">월 크레딧과 일일 열람 한도가 다릅니다.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b border-[#e4dacb] pb-3 pr-4 font-semibold text-[#6b7269] dark:border-zinc-800 dark:text-zinc-400">항목</th>
                  {ORDER.map((key) => (
                    <th key={key} className="border-b border-[#e4dacb] pb-3 pr-4 font-black text-[#223127] dark:border-zinc-800 dark:text-zinc-50">
                      {PLANS[key].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["월 크레딧", ...ORDER.map((k) => `${PLANS[k].monthlyCredits}개`)],
                  ["하루 열람 한도", ...ORDER.map((k) => `${PLANS[k].dailyOpenLimit}회`)],
                  ["가격", ...ORDER.map((k) => formatKrw(PLANS[k].priceKrw))],
                  ["적합한 사용자", ...ORDER.map((k) => PLANS[k].tagline)],
                ].map(([label, ...values]) => (
                  <tr key={label as string}>
                    <td className="border-b border-[#eee5d8] py-3 pr-4 font-semibold text-[#344136] dark:border-zinc-800 dark:text-zinc-300">
                      {label}
                    </td>
                    {values.map((value, idx) => (
                      <td key={`${label}-${idx}`} className="border-b border-[#eee5d8] py-3 pr-4 text-[#5f675e] dark:border-zinc-800 dark:text-zinc-300">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[28px] border border-[#ddd4c7] bg-[#fffbf4] p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-xl font-black text-[#223127] dark:text-zinc-50">자주 묻는 질문</h2>
            <div className="mt-5 space-y-4 text-sm leading-6 text-[#586356] dark:text-zinc-300">
              <div>
                <div className="font-black text-[#223127] dark:text-zinc-100">크레딧과 일일 한도는 어떻게 다른가요?</div>
                <p className="mt-1">크레딧은 한 달 동안 열 수 있는 추천 카드 총량입니다. 일일 한도는 하루 안에 몰아서 열지 못하게 하는 안전장치예요.</p>
              </div>
              <div>
                <div className="font-black text-[#223127] dark:text-zinc-100">취소하면 바로 끊기나요?</div>
                <p className="mt-1">아니요. 결제한 기간 끝까지는 계속 사용할 수 있고, 그 이후 자동으로 무료 플랜으로 돌아갑니다.</p>
              </div>
              <div>
                <div className="font-black text-[#223127] dark:text-zinc-100">지금 결제가 실제로 빠지나요?</div>
                <p className="mt-1">베타 기간에는 토스 결제 화면을 시뮬레이션만 합니다. 실제 결제는 정식 출시 때 연결돼요.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#d8decd] bg-[var(--brand-accent-soft)] p-6 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <h2 className="text-xl font-black text-[#223127] dark:text-zinc-50">베타 운영 안내</h2>
            <div className="mt-5 space-y-3 text-sm leading-6 text-[#334235] dark:text-emerald-100">
              <p>무료 크레딧은 계정당 1회 지급됩니다.</p>
              <p>유료 플랜 가입 시 월 크레딧이 잔여 크레딧에 더해집니다.</p>
              <p>관리자 계정은 운영 확인을 위해 무제한으로 표시됩니다.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
