import Link from "next/link";
import CreditIcon from "@/components/credit-icon";
import { PLANS, formatKrw, type PlanDefinition, type PlanKey } from "@/lib/plan-config";

const ORDER: PlanKey[] = ["starter", "plus", "pro"];

const PACKAGE_VALUE_COPY: Record<Exclude<PlanKey, "free">, string> = {
  starter: "처음 써보며 관심 매물만 가볍게 확인",
  plus: "여러 모델을 비교하며 살 만한 후보 추리기",
  pro: "대량 탐색과 반복 시세 확인이 많은 날에",
};

const INFO_ROWS = [
  { label: "차감 기준", value: "상세보기 또는 원본 확인 1회마다 1크레딧을 사용합니다." },
  { label: "반영 시점", value: "결제 완료 후 보유 크레딧에 바로 더해집니다." },
  { label: "유효기간", value: "충전된 크레딧은 지급일로부터 1년 동안 사용할 수 있습니다." },
  { label: "이용 제한", value: "크레딧은 타인 양도, 재판매, 현금화가 불가합니다." },
  { label: "결제 방식", value: "자동 갱신 없이 필요한 만큼만 충전합니다." },
];

function formatUnitPrice(plan: PlanDefinition) {
  const unitPrice = plan.priceKrw / Math.max(1, plan.monthlyCredits);
  const rounded = Math.round(unitPrice);
  const prefix = Number.isInteger(unitPrice) ? "" : "약 ";
  return `${prefix}${rounded.toLocaleString("ko-KR")}원/1크레딧`;
}

function ChargeCard({ plan }: { plan: PlanDefinition }) {
  const isFeatured = Boolean(plan.highlight);
  const valueCopy = plan.key === "free" ? "" : PACKAGE_VALUE_COPY[plan.key];

  return (
    <article
      className={`rounded-[16px] border p-3.5 shadow-sm sm:p-4 ${
        isFeatured
          ? "border-[#a5c4f7] bg-[#ebf2ff] ring-2 ring-[#cfddf7] dark:border-blue-800 dark:bg-blue-950/20 dark:ring-blue-900/60"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-1.5 text-[23px] font-black leading-none tracking-tight text-zinc-950 sm:text-[27px] dark:text-zinc-50">
              <CreditIcon size={22} className="shrink-0 sm:h-6 sm:w-6" />
              <span>{plan.monthlyCredits.toLocaleString("ko-KR")}</span>
              <span className="text-[15px] sm:text-[16px]">크레딧</span>
            </h2>
            {isFeatured ? (
              <span className="rounded-full bg-[var(--rd-em)] px-2 py-0.5 text-[10px] font-black text-white">
                추천
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 break-keep text-[12px] font-bold text-zinc-500 dark:text-zinc-400">
            상세보기 {plan.monthlyCredits.toLocaleString("ko-KR")}회분
          </p>
          <p className="mt-1 break-keep text-[11px] leading-4 text-[#7a8177] dark:text-zinc-500">
            {valueCopy}
          </p>
        </div>
        <div className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-black text-[#3182f6] ring-1 ring-[#cfddf7] dark:bg-zinc-950/50 dark:text-blue-200 dark:ring-zinc-800">
          {formatUnitPrice(plan)}
        </div>
      </div>

      <div className="mt-3.5 flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8a8a7c]">
            결제금액
          </div>
          <div className="mt-1 text-[20px] font-bold leading-none tracking-tight text-zinc-950 dark:text-zinc-50">
            {formatKrw(plan.priceKrw)}
          </div>
        </div>
        <Link
          /* Wave launch-95 (사용자 결정 — 토스페이먼츠 가맹심사 중 임시):
             /billing/checkout (PortOne 카드결제) → /billing/manual (계좌이체) 로 우회.
             가맹 승인 후엔 이 link 만 다시 /billing/checkout 으로 돌려놓으면 됨. */
          href={`/billing/manual?credits=${plan.monthlyCredits}`}
          className={`flex h-10 shrink-0 items-center justify-center rounded-xl px-3.5 text-[13px] font-black transition sm:min-w-[112px] ${
            isFeatured
              ? "bg-[var(--rd-em)] text-white shadow-[0_10px_22px_rgba(49,130,246,0.28)] hover:bg-[var(--rd-em-700)]"
              : "border border-[#d9cfbf] bg-white text-zinc-900 hover:bg-[#f3eadc] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          충전하기
        </Link>
      </div>
    </article>
  );
}

export default function PlansPage() {
  return (
    <main className="min-h-screen bg-[#f5f7fb] px-3 py-3 dark:bg-zinc-950 sm:px-5 sm:py-7">
      <div className="mx-auto w-full max-w-[560px]">
        <section className="rounded-[18px] border border-zinc-200 bg-white p-3.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-4">
          <div>
            <h1 className="text-[20px] font-black leading-tight tracking-tight text-zinc-950 sm:text-[22px] dark:text-zinc-50">
              크레딧 충전
            </h1>
            <p className="mt-0.5 text-[12px] font-bold text-zinc-500 dark:text-zinc-400">
              3가지 충전권
            </p>
          </div>

          <p className="mt-3 break-keep text-[13px] leading-5 text-zinc-600 dark:text-zinc-300">
            상세보기 1회 = 1크레딧. 자동 갱신 없이 한 번만 결제하고 바로 충전됩니다.
            충전 크레딧은 1년 동안 사용할 수 있어요.
          </p>
        </section>

        <section className="mt-3 grid gap-2.5">
          {ORDER.map((key) => (
            <ChargeCard key={key} plan={PLANS[key]} />
          ))}
        </section>

        <section className="mt-3 rounded-[14px] border border-zinc-200 bg-white px-3.5 py-2.5 text-[11px] leading-5 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>크레딧은 타인 양도·재판매·현금화가 불가하며, 미사용 환불은 결제일과 사용 여부 기준으로 처리됩니다.</span>
            <Link href="/refund-policy" className="font-black text-[var(--rd-em)] hover:text-[var(--rd-em-700)] dark:text-blue-300">
              환불정책 확인
            </Link>
          </div>
        </section>

        <section className="mt-3 rounded-[16px] border border-zinc-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 rounded-[14px] border border-[#e2d7c8] bg-white/70 px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="text-[13px] font-black text-zinc-950 dark:text-zinc-100">크레딧으로 여는 정보</div>
            <p className="mt-1.5 break-keep text-[12px] leading-5 text-zinc-600 dark:text-zinc-300">
              상세페이지에는 예상 순익, 시세 그래프, 비교 매물, 원본 링크가 함께 표시됩니다.
              실제 거래 결과는 가격·상태·거래 조건에 따라 달라집니다.
            </p>
          </div>
          <h2 className="text-[15px] font-black text-zinc-950 dark:text-zinc-50">충전 전 확인</h2>
          <div className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
            {INFO_ROWS.map((row) => (
              <div key={row.label} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 py-3 first:pt-0 last:pb-0">
                <div className="text-[12px] font-black text-[#3182f6] dark:text-blue-300">{row.label}</div>
                <div className="break-keep text-[12px] leading-5 text-zinc-600 dark:text-zinc-300">{row.value}</div>
              </div>
            ))}
          </div>
          <Link
            href="/me?tab=account"
            className="mt-4 flex h-10 items-center justify-center rounded-xl border border-[#d9cfbf] bg-white text-[13px] font-black text-zinc-900 transition hover:bg-[#f3eadc] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            보유 크레딧 확인하기
          </Link>
        </section>
      </div>
    </main>
  );
}
