const plans = [
  {
    name: "Starter",
    eyebrow: "처음 써보기",
    price: "0원",
    cadence: "베타 기간 무료",
    description: "가볍게 추천 흐름을 확인하는 개인용 요금제",
    badge: "현재 이용 가능",
    highlight: false,
    cta: "무료로 시작",
    metric: "기본 추천",
    features: [
      "일 1회 추천 열람",
      "추천 상품 2건 보기",
      "내 대시보드 저장",
      "기본 추천 기록 관리",
    ],
  },
  {
    name: "Pro",
    eyebrow: "추천",
    price: "29,000원",
    cadence: "월 결제",
    description: "더 자주 찾고, 더 빠르게 판단하고 싶은 사용자용",
    badge: "Most popular",
    highlight: true,
    cta: "Pro 대기 등록",
    metric: "무제한 탐색",
    features: [
      "추천 상품 무제한 탐색",
      "상위 차익 상품 우선 열람",
      "재검증 빈도 증가",
      "가격 추적 요약",
      "판매 타이밍 메모",
    ],
  },
  {
    name: "Team",
    eyebrow: "팀 운영",
    price: "79,000원",
    cadence: "월 결제",
    description: "여러 명이 추천 상품을 같이 보고 운영하는 팀용",
    badge: "Coming soon",
    highlight: false,
    cta: "출시 알림 받기",
    metric: "3 seats",
    features: [
      "팀원 3명 좌석",
      "공유 추천 보드",
      "운영 로그 공유",
      "역할별 피드백 관리",
    ],
  },
];

const compareRows = [
  ["추천 열람", "일 1회", "무제한", "무제한"],
  ["우선 열람", "기본", "상위 차익 우선", "상위 차익 + 팀 공유"],
  ["가격 추적", "없음", "기본", "고급"],
  ["피드백 관리", "개인", "개인", "팀"],
  ["지원", "기본", "우선 응답", "전용 채널"],
];

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
  return (
    <main className="min-h-screen bg-[#f6f1e8] px-4 py-8 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-[1180px] space-y-6">
        <section className="overflow-hidden rounded-[34px] border border-[#ddd4c7] bg-[#fffbf4] shadow-[0_24px_60px_rgba(34,49,39,0.08)] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-6 px-6 py-7 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center lg:px-10">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-[#cfd9c9] bg-[#edf3eb] px-3 py-1.5 text-xs font-black text-[#4f6f58]">
                Pricing
              </div>
              <h1 className="mt-4 max-w-2xl break-keep text-[34px] font-black leading-[1.06] tracking-tight text-[#223127] [text-wrap:balance] sm:text-[46px] dark:text-zinc-50">
                필요한 만큼 추천을 열어보세요
              </h1>
              <p className="mt-4 max-w-2xl break-keep text-sm leading-6 text-[#596558] sm:text-[15px] dark:text-zinc-300">
                시작은 무료로 가볍게. 더 자주 확인하고 싶을 때 Pro로 넓히는 구조입니다.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {["무료로 시작", "검증 실패 시 환불", "업그레이드 준비중"].map((item) => (
                  <div key={item} className="rounded-2xl border border-[#ddd4c7] bg-[#fffaf1] px-3 py-2 text-xs font-black text-[#556252]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden justify-self-end rounded-[28px] border border-[#d8decd] bg-[#fffaf1] p-5 shadow-[0_14px_30px_rgba(34,49,39,0.08)] lg:block">
              <PricingMark />
              <div className="mt-4 text-sm font-black text-[#223127]">추천 크레딧 기반</div>
              <div className="mt-1 text-xs leading-5 text-[#6b7269]">
                필요한 만큼 보고, 쓴 만큼 관리하는 가격 구조로 준비합니다.
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative overflow-hidden rounded-[30px] border p-6 shadow-sm transition ${
                plan.highlight
                  ? "border-[#9fb49c] bg-[#edf3eb] shadow-[0_22px_48px_rgba(92,116,95,0.16)] dark:border-emerald-800 dark:bg-emerald-950/20"
                  : "border-[#ddd4c7] bg-[#fffbf4] dark:border-zinc-800 dark:bg-zinc-900"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-[#5d735f]">{plan.eyebrow}</div>
                  <h2 className="mt-2 text-2xl font-black text-[#223127] dark:text-zinc-50">{plan.name}</h2>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-black ${
                    plan.highlight
                      ? "bg-[var(--brand-accent-strong)] text-[var(--brand-cream)]"
                      : "bg-[#fffaf1] text-[#5d735f] ring-1 ring-[#ddd4c7] dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {plan.badge}
                </span>
              </div>

              <p className="mt-4 min-h-[48px] text-sm leading-6 text-[#5f675e] dark:text-zinc-400">{plan.description}</p>

              <div className="mt-6 rounded-[22px] border border-[#d8decd] bg-[#fffaf1] px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="flex items-end gap-2">
                  <div className="text-3xl font-black tracking-tight text-[#223127] dark:text-zinc-50">{plan.price}</div>
                  <div className="pb-1 text-xs font-bold text-[#6b7269] dark:text-zinc-400">{plan.cadence}</div>
                </div>
                <div className="mt-3 inline-flex rounded-full bg-[#edf3eb] px-3 py-1 text-xs font-black text-[var(--brand-accent-strong)]">
                  {plan.metric}
                </div>
              </div>

              <button
                type="button"
                className={`mt-5 h-11 w-full rounded-2xl px-4 text-sm font-black transition ${
                  plan.highlight
                    ? "bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] hover:bg-[#29382f] dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
                    : "border border-[#ddd4c7] bg-[#fffaf1] text-[#344136] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {plan.cta}
              </button>

              <ul className="mt-6 space-y-3 text-sm text-[#586356] dark:text-zinc-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckIcon />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="rounded-[28px] border border-[#ddd4c7] bg-[#fffbf4] p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-xl font-black text-[#223127] dark:text-zinc-50">요금제 비교</h2>
              <p className="mt-2 text-sm text-[#6b7269] dark:text-zinc-400">추천 빈도와 관리 방식에 맞춰 선택하세요.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b border-[#e4dacb] pb-3 pr-4 font-semibold text-[#6b7269] dark:border-zinc-800 dark:text-zinc-400">항목</th>
                  {plans.map((plan) => (
                    <th key={plan.name} className="border-b border-[#e4dacb] pb-3 pr-4 font-black text-[#223127] dark:border-zinc-800 dark:text-zinc-50">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareRows.map(([label, starter, pro, team]) => (
                  <tr key={label}>
                    <td className="border-b border-[#eee5d8] py-3 pr-4 font-semibold text-[#344136] dark:border-zinc-800 dark:text-zinc-300">{label}</td>
                    {[starter, pro, team].map((value, index) => (
                      <td key={`${label}-${index}`} className="border-b border-[#eee5d8] py-3 pr-4 text-[#5f675e] dark:border-zinc-800 dark:text-zinc-300">
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
                <div className="font-black text-[#223127] dark:text-zinc-100">지금 바로 결제되나요?</div>
                <p className="mt-1">아직 결제는 연결되어 있지 않습니다. 현재는 무료 크레딧으로 먼저 사용해볼 수 있습니다.</p>
              </div>
              <div>
                <div className="font-black text-[#223127] dark:text-zinc-100">Pro에서 달라지는 핵심은 뭔가요?</div>
                <p className="mt-1">추천 상품을 더 자주 보고, 상위 차익 상품을 먼저 확인하고, 가격 추적 요약을 받는 흐름이 핵심입니다.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#d8decd] bg-[var(--brand-accent-soft)] p-6 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <h2 className="text-xl font-black text-[#223127] dark:text-zinc-50">베타 운영 안내</h2>
            <div className="mt-5 space-y-3 text-sm leading-6 text-[#334235] dark:text-emerald-100">
              <p>무료 크레딧은 계정당 1회 지급됩니다.</p>
              <p>요금제와 크레딧 정책은 실제 사용량을 보며 조정될 수 있습니다.</p>
              <p>관리자 계정은 운영 확인을 위해 무제한 크레딧으로 표시됩니다.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
