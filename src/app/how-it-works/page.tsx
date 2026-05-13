import Link from "next/link";

const principles = [
  {
    icon: "spread",
    title: "같은 상품을 모두에게 뿌리지 않아요",
    body: "추천 후보는 사용자별로 분산해서 공개합니다. 한 번 본 상품을 또 보여주며 사람들이 같은 매물로 몰리는 구조를 피합니다.",
  },
  {
    icon: "option",
    title: "옵션이 다르면 같은 상품으로 보지 않아요",
    body: "세대, 용량, 사이즈, 커넥터처럼 가격을 바꾸는 조건을 먼저 읽습니다. 비교군이 흔들리면 추천보다 내부 학습으로 돌립니다.",
  },
  {
    icon: "verify",
    title: "보여주기 직전에 한 번 더 확인해요",
    body: "추천 직전에는 판매완료, 가격변경, 위험 신호를 다시 확인합니다. 이상하면 보여주기보다 제외 또는 환불이 먼저입니다.",
  },
];

const supportRows = [
  { category: "이어폰", status: "지금 지원", note: "AirPods 중심으로 공개 가능" },
  { category: "스마트워치", status: "지금 지원", note: "Apple Watch, Galaxy Watch 중심" },
  { category: "스마트폰", status: "비공개 검증", note: "표본과 위험 신호 검수 중" },
  { category: "태블릿", status: "비공개 검증", note: "storage/screen/cellular 보강 중" },
  { category: "노트북", status: "보류", note: "RAM/SSD/chip 오차 위험이 큼" },
];

const engineSteps = [
  {
    step: "1. 데이터 모니터링",
    text: "공개된 매물의 가격·인기도 신호를 지속적으로 모니터링해, 시세 통계와 비교 인덱스로 가공합니다.",
  },
  {
    step: "2. 옵션 파싱",
    text: "모델, 세대, 용량, 사이즈, 커넥터, 상태를 읽어서 같은 비교군끼리만 묶습니다.",
  },
  {
    step: "3. 시세/위험 계산",
    text: "같은 비교군의 시세와 예상 차익을 계산하고, 노이즈·부품·매입글·파손글은 미리 제외합니다.",
  },
  {
    step: "4. 공개 게이트",
    text: "category readiness, confidence, freshness, live verify를 통과한 상품만 추천 가능 상태가 됩니다.",
  },
];

const aiRules = [
  "모든 매물에 비싼 AI를 매번 쓰지 않습니다.",
  "강한 룰과 옵션 파서로 먼저 거르고, 애매한 구간만 보수적으로 AI review를 붙입니다.",
  "AI가 애매하게 답하면 통과가 아니라 보류가 먼저입니다.",
];

function ServiceFlowVisual() {
  return (
    <div className="rounded-[30px] border border-[#e5dccf] bg-[#fffaf1] p-4 shadow-[0_18px_42px_rgba(34,49,39,0.08)]">
      <div className="relative overflow-hidden rounded-[24px] border border-[#d8decd] bg-[linear-gradient(180deg,#f7fbf4_0%,#fffaf1_100%)] px-4 py-5">
        <svg viewBox="0 0 520 230" className="h-auto w-full" role="img" aria-label="미뇨이 추천 엔진 흐름">
          <defs>
            <linearGradient id="flowLine" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#9fb49c" />
              <stop offset="100%" stopColor="#314238" />
            </linearGradient>
            <filter id="flowShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#314238" floodOpacity="0.12" />
            </filter>
          </defs>
          <path d="M92 116 C150 56 218 56 260 116 S370 176 428 116" fill="none" stroke="url(#flowLine)" strokeWidth="10" strokeLinecap="round" opacity="0.28" />
          {[
            { x: 36, y: 70, title: "수집", sub: "raw" },
            { x: 178, y: 38, title: "비교", sub: "option" },
            { x: 318, y: 102, title: "검증", sub: "live" },
          ].map((node) => (
            <g key={node.title} filter="url(#flowShadow)">
              <rect x={node.x} y={node.y} width="112" height="92" rx="24" fill="#fffbf4" stroke="#d8decd" />
              <circle cx={node.x + 56} cy={node.y + 32} r="16" fill="#314238" />
              <path d={`M${node.x + 50} ${node.y + 32}h12M${node.x + 56} ${node.y + 26}v12`} stroke="#f7f1e6" strokeWidth="3" strokeLinecap="round" />
              <text x={node.x + 56} y={node.y + 63} textAnchor="middle" fontSize="18" fontWeight="900" fill="#223127">{node.title}</text>
              <text x={node.x + 56} y={node.y + 80} textAnchor="middle" fontSize="11" fontWeight="700" fill="#6b7269">{node.sub}</text>
            </g>
          ))}
          <g filter="url(#flowShadow)">
            <rect x="206" y="124" width="118" height="84" rx="24" fill="#edf3eb" stroke="#9fb49c" strokeWidth="2" />
            <text x="265" y="161" textAnchor="middle" fontSize="17" fontWeight="900" fill="#314238">AI 보류</text>
            <text x="265" y="181" textAnchor="middle" fontSize="11" fontWeight="700" fill="#5d735f">애매하면 공개 안 함</text>
          </g>
        </svg>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {["같은 옵션만 비교", "공개 전 재확인", "사용자별 분산"].map((label) => (
            <div key={label} className="rounded-2xl border border-[#d8decd] bg-[#fffbf4] px-3 py-2 text-center text-xs font-black text-[#344136]">
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PrincipleIcon({ type }: { type: string }) {
  if (type === "option") {
    return (
      <svg viewBox="0 0 96 96" className="h-16 w-16" aria-hidden="true">
        <rect x="12" y="18" width="72" height="60" rx="20" fill="#edf3eb" stroke="#b9c9b9" strokeWidth="3" />
        <path d="M28 36h40M28 58h40" stroke="#314238" strokeWidth="7" strokeLinecap="round" />
        <circle cx="42" cy="36" r="8" fill="#fffbf4" stroke="#314238" strokeWidth="4" />
        <circle cx="58" cy="58" r="8" fill="#fffbf4" stroke="#314238" strokeWidth="4" />
      </svg>
    );
  }

  if (type === "verify") {
    return (
      <svg viewBox="0 0 96 96" className="h-16 w-16" aria-hidden="true">
        <path d="M48 12 76 24v22c0 20-12 32-28 40-16-8-28-20-28-40V24l28-12Z" fill="#edf3eb" stroke="#9fb49c" strokeWidth="3" />
        <path d="m33 48 10 10 21-24" fill="none" stroke="#314238" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="70" cy="27" r="9" fill="#fffbf4" stroke="#314238" strokeWidth="3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 96 96" className="h-16 w-16" aria-hidden="true">
      <circle cx="48" cy="48" r="13" fill="#314238" />
      <circle cx="20" cy="24" r="9" fill="#edf3eb" stroke="#9fb49c" strokeWidth="3" />
      <circle cx="76" cy="24" r="9" fill="#edf3eb" stroke="#9fb49c" strokeWidth="3" />
      <circle cx="20" cy="72" r="9" fill="#edf3eb" stroke="#9fb49c" strokeWidth="3" />
      <circle cx="76" cy="72" r="9" fill="#edf3eb" stroke="#9fb49c" strokeWidth="3" />
      <path d="M38 42 27 30M58 42l11-12M38 54 27 66M58 54l11 12" stroke="#314238" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function SectionBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--brand-accent-strong)] text-xs font-black text-[var(--brand-cream)] shadow-[0_8px_18px_rgba(49,66,56,0.14)]">
      {label}
    </span>
  );
}

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-[#f6f1e8] dark:bg-zinc-950">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[34px] border border-[#ddd4c7] bg-[#fffbf4] px-6 py-7 shadow-[0_24px_60px_rgba(34,49,39,0.08)] sm:px-8 sm:py-9">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px] xl:items-center">
            <div className="max-w-4xl">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-[#5d735f]">How It Works</div>
              <h1 className="mt-3 break-keep text-3xl font-black tracking-tight text-[#223127] [text-wrap:balance] sm:text-5xl">
                많이 보여주기보다,
                <br />
                <span className="text-[#4f6f58]">걸러서 추천합니다</span>
              </h1>
              <p className="mt-4 max-w-3xl break-keep text-sm leading-7 text-[#5a6658] sm:text-[15px]">
                비교 가능한 상품만 남기고, 공개 가능한 상태인지 다시 확인한 뒤, 사용자별로 분산된 추천 흐름을 만듭니다.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/me"
                  className="inline-flex items-center justify-center rounded-2xl bg-[var(--brand-accent-strong)] px-6 py-3.5 text-base font-black text-[var(--brand-cream)] shadow-[0_14px_28px_rgba(49,66,56,0.16)] transition hover:bg-[#29382f]"
                >
                  추천 받으러 가기
                </Link>
                <Link
                  href="/plans"
                  className="inline-flex items-center justify-center rounded-2xl border border-[#ddd4c7] bg-[#fffaf1] px-5 py-3.5 text-sm font-black text-[#344136] transition hover:bg-[var(--brand-accent-soft)]"
                >
                  요금제 보기
                </Link>
              </div>
            </div>
            <ServiceFlowVisual />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {principles.map((item) => (
            <article key={item.title} className="rounded-[28px] border border-[#ddd4c7] bg-[#fffbf4] px-6 py-5 shadow-sm">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[24px] border border-[#d8decd] bg-[#fffaf1]">
                <PrincipleIcon type={item.icon} />
              </div>
              <h2 className="text-lg font-black text-[#223127]">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#586356]">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[30px] border border-[#ddd4c7] bg-[#fffbf4] px-6 py-6 shadow-sm sm:px-7">
            <div className="flex items-center gap-3">
              <SectionBadge label="01" />
              <div className="text-sm font-black text-[#223127]">기술적으로는 이렇게 작동합니다</div>
            </div>
            <div className="mt-5 space-y-4">
              {engineSteps.map((item) => (
                <div key={item.step} className="rounded-[22px] border border-[#e5dccf] bg-[#fffaf1] px-4 py-4">
                  <div className="text-sm font-black text-[#223127]">{item.step}</div>
                  <p className="mt-2 text-sm leading-6 text-[#586356]">{item.text}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[30px] border border-[#ddd4c7] bg-[#fffbf4] px-6 py-6 shadow-sm sm:px-7">
            <div className="flex items-center gap-3">
              <SectionBadge label="02" />
              <div className="text-sm font-black text-[#223127]">지금 지원하는 범위</div>
            </div>
            <div className="mt-5 divide-y divide-[#ece3d6] rounded-[22px] border border-[#e5dccf] bg-[#fffaf1]">
              {supportRows.map((row) => (
                <div key={row.category} className="flex items-start justify-between gap-4 px-4 py-4">
                  <div>
                    <div className="text-sm font-black text-[#223127]">{row.category}</div>
                    <div className="mt-1 text-sm text-[#586356]">{row.note}</div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                      row.status === "지금 지원"
                        ? "bg-[var(--brand-accent-soft)] text-[var(--brand-accent-strong)]"
                        : row.status === "비공개 검증"
                          ? "bg-[#f4eee3] text-[#6a6f62]"
                          : "bg-[#f1ebe2] text-[#7a6b60]"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-[#586356]">
              공개 기준이 애매한 카테고리는 일부러 내부 학습으로 묶어둡니다. 많이 보여주는 것보다,
              잘못 보여주지 않는 것이 더 중요하다고 보기 때문입니다.
            </p>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[30px] border border-[#d8decd] bg-[var(--brand-accent-soft)] px-6 py-6 shadow-sm sm:px-7">
            <div className="flex items-center gap-3">
              <SectionBadge label="03" />
              <div className="text-sm font-black text-[var(--brand-accent-strong)]">AI는 여기서만 신중하게 씁니다</div>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#334235]">
              {aiRules.map((rule) => (
                <li key={rule} className="rounded-[18px] bg-[#fffbf4] px-4 py-3">
                  {rule}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[30px] border border-[#ddd4c7] bg-[#fffbf4] px-6 py-6 shadow-sm sm:px-7">
            <div className="flex items-center gap-3">
              <SectionBadge label="04" />
              <div className="text-sm font-black text-[#223127]">사용자를 이렇게 생각하고 설계합니다</div>
            </div>
            <div className="mt-4 space-y-4 text-sm leading-6 text-[#586356]">
              <p>
                우리는 전문 리셀러만을 위한 복잡한 분석 화면보다, 일반 사용자도 바로 이해할 수 있는 추천
                경험을 먼저 만듭니다. 대신 내부 엔진은 오히려 더 보수적으로 돌아가게 설계합니다.
              </p>
              <p>
                추천 직전 live verify, category readiness gate, 옵션 파서, AI second opinion hold 같은
                장치는 모두 “틀릴 수 있으면 안 보여준다” 쪽에 가깝습니다.
              </p>
              <p>
                그래서 지금 당장 모든 카테고리를 열지 않습니다. 비교군이 흔들리면 과감히 내부 학습으로
                남겨두고, 충분히 맞는 구간부터 공개합니다.
              </p>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
