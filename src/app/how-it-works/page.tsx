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

// Wave 106: DB 실측 기반 (2026-05-15 ready pool 245건). Apple 편향 77% 정직 공시.
const supportRows = [
  { category: "이어폰", status: "지금 지원", note: "AirPods · Sony WH · Beats · Bose 중심 (97건)" },
  { category: "태블릿", status: "지금 지원", note: "iPad Pro/Air/mini · Galaxy Tab (51건)" },
  { category: "스마트워치", status: "지금 지원", note: "Apple Watch · Galaxy Watch (47건)" },
  { category: "노트북", status: "지금 지원", note: "MacBook Air/Pro · LG Gram (32건)" },
  { category: "게임 콘솔", status: "지금 지원", note: "PS5 · Switch (소량)" },
  { category: "데스크탑 / 스피커", status: "지금 지원", note: "표본 작아 추천 빈도 낮음" },
  { category: "스마트폰", status: "비공개 검증", note: "자급제 vs 통신사 구분 정확도 보강 중" },
  { category: "신발 · 가방 · 의류", status: "지원 예정 (X)", note: "현재 미지원 — 추후 wave에서 source 다양화 예정" },
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

// 직접 검색 시나리오 vs 미뇨이 (도발적 비교). 가상 데이터 아님 — 실제 검색 패턴 기반.
const directSearchBreakdown = [
  { kind: "부품용 / 액정만 / 메인보드", count: 5, tone: "warn" as const },
  { kind: "케이스만 / 충전기만", count: 8, tone: "warn" as const },
  { kind: "매입 / 삽니다 / 구매합니다 광고", count: 6, tone: "warn" as const },
  { kind: "사기 의심 (거래 0건 + 시세 60%↓)", count: 3, tone: "danger" as const },
  { kind: "통신사 약정 / 자급제 미명시", count: 7, tone: "warn" as const },
  { kind: "고장 / 파손 / 침수", count: 0, tone: "warn" as const },
  { kind: "남는 본품 매물", count: 21, tone: "ok" as const },
];

const compareSteps = [
  { task: "검색 결과 첫 페이지 열기", direct: "1분", minyoi: "1분" },
  { task: "관련 없는 매물 거르기", direct: "10분", minyoi: "자동" },
  { task: "시세 비교 (네이버 / 다른 매물)", direct: "10분", minyoi: "자동" },
  { task: "판매자 거래 / 평점 일일이 확인", direct: "5분", minyoi: "자동" },
  { task: "남은 매물 중 결정", direct: "5분", minyoi: "5분" },
  { task: "그 사이 진짜 좋은 매물 거래 완료", direct: "2~3개", minyoi: "0개" },
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

        {/* Why Minyoi — 직접 검색 vs 미뇨이 시간 비교 (공식적 톤, 사실 기반). */}
        <section className="rounded-[34px] border border-[#ddd4c7] bg-[#fffbf4] px-6 py-8 shadow-[0_18px_42px_rgba(34,49,39,0.08)] sm:px-8 sm:py-10">
          <div className="text-xs font-black uppercase tracking-[0.22em] text-[#5d735f]">
            직접 검색과 비교
          </div>
          <h2 className="mt-3 break-keep text-2xl font-black tracking-tight text-[#223127] [text-wrap:balance] sm:text-4xl">
            번개장터에서도 같은 매물을 찾을 수 있습니다.
            <br />
            <span className="text-[#4f6f58]">차이는 매물을 거르는 데 드는 시간입니다.</span>
          </h2>
          <p className="mt-4 max-w-3xl break-keep text-sm leading-7 text-[#5a6658] sm:text-[15px]">
            미뇨이는 번개장터·중고나라·당근의 공개 매물을 기반으로 추천합니다.
            같은 데이터를 직접 검색할 수도 있고, 미뇨이가 미리 분류·검증한 결과를 받을 수도 있습니다.
            아래는 같은 검색으로 결정까지 가는 데 드는 시간 차이입니다.
          </p>

          {/* 직접 검색 30분 시나리오 */}
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <article className="rounded-[24px] border border-[#e5dccf] bg-[#fffaf1] px-5 py-5">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-[#f4eee3] px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#7a6b60]">
                  직접 검색 — 30분
                </span>
              </div>
              <h3 className="mt-3 text-lg font-black text-[#223127] sm:text-xl">
                &ldquo;에어팟 프로 2 자급제&rdquo; 검색 첫 페이지 50건
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#5a6658]">
                일일이 클릭해서 본품인지 확인하면:
              </p>
              <div className="mt-4 divide-y divide-[#ece3d6] rounded-[18px] border border-[#e5dccf] bg-[#fffbf4]">
                {directSearchBreakdown.map((row) => (
                  <div key={row.kind} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-sm font-semibold text-[#586356]">{row.kind}</span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-black ${
                        row.tone === "danger"
                          ? "bg-[#f6e3df] text-[#a04a3c]"
                          : row.tone === "warn"
                            ? "bg-[#f4eee3] text-[#7a6b60]"
                            : "bg-[var(--brand-accent-soft)] text-[var(--brand-accent-strong)]"
                      }`}
                    >
                      {row.count}건
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-[#586356]">
                결국 본품 21건. 시세 비교 + 판매자 등급을 일일이 확인하면 약 20분이 추가됩니다.
                인기 매물은 등록 후 30분 ~ 몇 시간 안에 거래가 완료되는 경우가 많아,
                그 사이 시세 우위 매물 일부는 거래가 마감됩니다.
              </p>
            </article>

            <article className="rounded-[24px] border border-[#c8d8c4] bg-[var(--brand-accent-soft)] px-5 py-5">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-[var(--brand-accent-strong)] px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--brand-cream)]">
                  미뇨이 — 5분
                </span>
              </div>
              <h3 className="mt-3 text-lg font-black text-[#223127] sm:text-xl">
                같은 검색, 자동 분류된 추천 화면
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#334235]">
                들어오자마자 보이는 것:
              </p>
              <ul className="mt-4 space-y-2 rounded-[18px] border border-[#c8d8c4] bg-[#fffbf4] px-4 py-3">
                {[
                  "부품 / 케이스만 / 매입 광고 / 사기 의심 — 자동 제거 완료",
                  "본품 매물만 시세순 정렬",
                  "판매자 등급 + 거래 횟수 + 평점 한 줄로",
                  "호가 분포에서 이 매물이 어디인지 한눈에",
                  "&ldquo;왜 이 매물이 좋은가&rdquo; 이유 표시",
                ].map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm font-semibold leading-6 text-[#334235]">
                    <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-accent-strong)]" />
                    <span dangerouslySetInnerHTML={{ __html: item }} />
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm leading-6 text-[#334235]">
                남은 5분으로 결정에 집중. 같은 검색 결과를 두고 결정까지 약 25분 차이가 납니다.
              </p>
            </article>
          </div>

          {/* 시간 비교 표 */}
          <div className="mt-6 overflow-x-auto rounded-[22px] border border-[#e5dccf]">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-[#f3eee5] text-[10px] uppercase tracking-wider text-[#5d735f]">
                <tr>
                  <th className="px-4 py-2.5 font-black">단계</th>
                  <th className="px-4 py-2.5 font-black">직접 검색</th>
                  <th className="px-4 py-2.5 font-black">미뇨이</th>
                </tr>
              </thead>
              <tbody>
                {compareSteps.map((row, i) => (
                  <tr key={i} className="border-t border-[#ece3d6] bg-[#fffaf1]">
                    <td className="px-4 py-2.5 font-semibold text-[#344136]">{row.task}</td>
                    <td className="px-4 py-2.5 font-black text-[#7a6b60]">{row.direct}</td>
                    <td className="px-4 py-2.5 font-black text-[var(--brand-accent-strong)]">{row.minyoi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 알람 메시지 — 사실 기반, 톤 차분. */}
          <div className="mt-6 rounded-[22px] border-l-4 border-[var(--brand-accent-strong)] bg-[var(--brand-accent-soft)] px-5 py-4">
            <p className="text-sm font-black leading-7 text-[#223127] sm:text-base">
              등록 후 30분 안에 거래 완료되는 매물은 알람 없이는 잡기 어렵습니다.
            </p>
            <p className="mt-2 text-sm leading-6 text-[#344136]">
              시세보다 낮은 매물은 다른 사용자도 동시에 발견하기 때문에, 등장한 시점부터 거래 완료까지의 간격이 매우 짧은 경우가 많습니다.
              미뇨이의 실시간 알람은 등록 즉시 알려주어 결정 시간을 확보합니다.
            </p>
          </div>

          {/* 택배비 명시 — 사용자 결제 결정 직결 */}
          <div className="mt-3 rounded-[22px] border-l-4 border-[#caab78] bg-[#fff8ea] px-5 py-4 dark:border-amber-900/60 dark:bg-amber-950/20">
            <p className="text-sm font-black leading-7 text-[#7b5724] dark:text-amber-200 sm:text-base">
              예상 수익은 택배비를 포함해서 계산합니다.
            </p>
            <p className="mt-2 text-sm leading-6 text-[#9a7f4f] dark:text-amber-200/80">
              사용자가 별도로 배송비를 빼서 계산할 필요가 없습니다. 카드에 표시된 수익이 곧 손에 남는 실 수익입니다.
            </p>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/me"
              className="inline-flex items-center justify-center rounded-2xl bg-[var(--brand-accent-strong)] px-6 py-3.5 text-base font-black text-[var(--brand-cream)] shadow-[0_14px_28px_rgba(49,66,56,0.16)] transition hover:bg-[#29382f]"
            >
              추천 보러 가기
            </Link>
            <Link
              href="/plans"
              className="inline-flex items-center justify-center rounded-2xl border border-[#ddd4c7] bg-[#fffbf4] px-5 py-3.5 text-sm font-black text-[#344136] transition hover:bg-[var(--brand-accent-soft)]"
            >
              알람 플랜 보기
            </Link>
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
                          : row.status.startsWith("지원 예정")
                            ? "bg-red-50 text-red-700"
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
