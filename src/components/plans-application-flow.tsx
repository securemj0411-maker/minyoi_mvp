"use client";

import { useEffect, useMemo, useState } from "react";
import MembershipApplicationClient from "@/components/membership-application-client";
import type { MembershipPlan, MembershipPlanKey } from "@/lib/membership-plans";

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

type DistrictSeat = {
  name: string;
  seats: number;
  pressure: number;
};

type RegionSeat = {
  key: string;
  shortLabel: string;
  label: string;
  seats: number;
  pressure: number;
  x: number;
  y: number;
  districts: DistrictSeat[];
};

const REGIONS: RegionSeat[] = [
  { key: "seoul", shortLabel: "서울", label: "서울특별시", seats: 38, pressure: 0.82, x: 125, y: 76, districts: [{ name: "강남구", seats: 2, pressure: 0.88 }, { name: "송파구", seats: 3, pressure: 0.8 }, { name: "관악구", seats: 3, pressure: 0.74 }, { name: "마포구", seats: 2, pressure: 0.86 }] },
  { key: "incheon", shortLabel: "인천", label: "인천광역시", seats: 18, pressure: 0.67, x: 94, y: 91, districts: [{ name: "연수구", seats: 2, pressure: 0.78 }, { name: "부평구", seats: 2, pressure: 0.74 }, { name: "서구", seats: 3, pressure: 0.62 }, { name: "남동구", seats: 2, pressure: 0.69 }] },
  { key: "gyeonggi", shortLabel: "경기", label: "경기도", seats: 46, pressure: 0.76, x: 144, y: 104, districts: [{ name: "성남시", seats: 3, pressure: 0.8 }, { name: "수원시", seats: 4, pressure: 0.73 }, { name: "용인시", seats: 4, pressure: 0.69 }, { name: "고양시", seats: 3, pressure: 0.78 }] },
  { key: "gangwon", shortLabel: "강원", label: "강원특별자치도", seats: 20, pressure: 0.45, x: 203, y: 82, districts: [{ name: "춘천시", seats: 4, pressure: 0.48 }, { name: "원주시", seats: 4, pressure: 0.52 }, { name: "강릉시", seats: 3, pressure: 0.42 }, { name: "속초시", seats: 2, pressure: 0.38 }] },
  { key: "chungbuk", shortLabel: "충북", label: "충청북도", seats: 19, pressure: 0.51, x: 161, y: 158, districts: [{ name: "청주시", seats: 4, pressure: 0.51 }, { name: "충주시", seats: 3, pressure: 0.44 }, { name: "제천시", seats: 2, pressure: 0.39 }, { name: "음성군", seats: 2, pressure: 0.43 }] },
  { key: "chungnam", shortLabel: "충남", label: "충청남도", seats: 22, pressure: 0.56, x: 107, y: 171, districts: [{ name: "천안시", seats: 4, pressure: 0.55 }, { name: "아산시", seats: 3, pressure: 0.57 }, { name: "공주시", seats: 2, pressure: 0.46 }, { name: "당진시", seats: 2, pressure: 0.5 }] },
  { key: "sejong", shortLabel: "세종", label: "세종특별자치시", seats: 9, pressure: 0.58, x: 134, y: 185, districts: [{ name: "새롬동", seats: 1, pressure: 0.62 }, { name: "도담동", seats: 1, pressure: 0.57 }, { name: "어진동", seats: 1, pressure: 0.52 }] },
  { key: "daejeon", shortLabel: "대전", label: "대전광역시", seats: 13, pressure: 0.62, x: 139, y: 206, districts: [{ name: "서구", seats: 3, pressure: 0.62 }, { name: "유성구", seats: 2, pressure: 0.66 }, { name: "중구", seats: 2, pressure: 0.51 }] },
  { key: "jeonbuk", shortLabel: "전북", label: "전북특별자치도", seats: 19, pressure: 0.49, x: 121, y: 250, districts: [{ name: "전주시", seats: 4, pressure: 0.49 }, { name: "군산시", seats: 3, pressure: 0.44 }, { name: "익산시", seats: 3, pressure: 0.46 }] },
  { key: "gwangju", shortLabel: "광주", label: "광주광역시", seats: 12, pressure: 0.56, x: 106, y: 300, districts: [{ name: "북구", seats: 3, pressure: 0.56 }, { name: "광산구", seats: 2, pressure: 0.54 }, { name: "서구", seats: 2, pressure: 0.5 }] },
  { key: "jeonnam", shortLabel: "전남", label: "전라남도", seats: 18, pressure: 0.42, x: 119, y: 329, districts: [{ name: "목포시", seats: 3, pressure: 0.41 }, { name: "여수시", seats: 3, pressure: 0.44 }, { name: "순천시", seats: 3, pressure: 0.43 }] },
  { key: "gyeongbuk", shortLabel: "경북", label: "경상북도", seats: 23, pressure: 0.53, x: 202, y: 181, districts: [{ name: "포항시", seats: 3, pressure: 0.52 }, { name: "구미시", seats: 3, pressure: 0.57 }, { name: "경산시", seats: 2, pressure: 0.55 }] },
  { key: "daegu", shortLabel: "대구", label: "대구광역시", seats: 14, pressure: 0.7, x: 198, y: 229, districts: [{ name: "수성구", seats: 3, pressure: 0.7 }, { name: "달서구", seats: 2, pressure: 0.64 }, { name: "동구", seats: 2, pressure: 0.58 }] },
  { key: "ulsan", shortLabel: "울산", label: "울산광역시", seats: 11, pressure: 0.66, x: 240, y: 257, districts: [{ name: "남구", seats: 3, pressure: 0.66 }, { name: "중구", seats: 2, pressure: 0.58 }, { name: "울주군", seats: 2, pressure: 0.5 }] },
  { key: "gyeongnam", shortLabel: "경남", label: "경상남도", seats: 24, pressure: 0.59, x: 184, y: 279, districts: [{ name: "창원시", seats: 4, pressure: 0.58 }, { name: "김해시", seats: 3, pressure: 0.62 }, { name: "진주시", seats: 3, pressure: 0.49 }] },
  { key: "busan", shortLabel: "부산", label: "부산광역시", seats: 22, pressure: 0.82, x: 224, y: 294, districts: [{ name: "해운대구", seats: 2, pressure: 0.88 }, { name: "수영구", seats: 2, pressure: 0.82 }, { name: "부산진구", seats: 3, pressure: 0.74 }] },
  { key: "jeju", shortLabel: "제주", label: "제주특별자치도", seats: 8, pressure: 0.36, x: 113, y: 377, districts: [{ name: "제주시", seats: 4, pressure: 0.37 }, { name: "서귀포시", seats: 3, pressure: 0.32 }] },
];

const VALUE_STEPS = [
  { label: "희소성", value: "전체 중고 매물 중 시세 차익이 보이는 상품은 극소수입니다." },
  { label: "지역성", value: "당근은 내 근처에 떠야 실전성이 생겨서 같은 지역 접근 수를 관리합니다." },
  { label: "공개 제한", value: "같은 매물을 너무 많이 보면 기회가 깨져서 300명 안에서만 엽니다." },
];

const ACCESS_ITEMS = [
  { label: "원본 링크", value: "승인 후 바로 열림" },
  { label: "매입가·시세", value: "한 화면에서 비교" },
  { label: "판매 속도", value: "평균 며칠 내 판매" },
  { label: "셀러 신뢰", value: "온도·후기 신호" },
];

function pressureFill(pressure: number) {
  if (pressure >= 0.78) return "#2563eb";
  if (pressure >= 0.64) return "#0ea5e9";
  if (pressure >= 0.52) return "#14b8a6";
  return "#94a3b8";
}

function pressureLabel(pressure: number) {
  if (pressure >= 0.78) return "과밀";
  if (pressure >= 0.64) return "마감 임박";
  if (pressure >= 0.52) return "보통";
  return "여유";
}

function KoreaSeatMap({
  selected,
  onSelect,
}: {
  selected: RegionSeat;
  onSelect: (key: string) => void;
}) {
  return (
    <svg
      viewBox="25 0 255 398"
      role="img"
      aria-label="대한민국 남한 지역별 멤버십 티오 지도"
      className="h-full w-full overflow-visible"
    >
      <defs>
        <filter id="plans-korea-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#020617" floodOpacity="0.2" />
        </filter>
      </defs>
      <path
        d="M147 16C173 19 197 38 211 63C226 91 223 118 211 140C203 156 208 173 225 194C246 221 258 251 250 282C242 316 211 344 174 362C137 381 99 369 78 338C58 308 66 281 51 253C35 224 25 190 37 154C48 121 76 111 83 82C92 43 112 12 147 16Z"
        fill="currentColor"
        className="text-zinc-100 dark:text-zinc-900"
        filter="url(#plans-korea-shadow)"
      />
      <path
        d="M147 16C173 19 197 38 211 63C226 91 223 118 211 140C203 156 208 173 225 194C246 221 258 251 250 282C242 316 211 344 174 362C137 381 99 369 78 338C58 308 66 281 51 253C35 224 25 190 37 154C48 121 76 111 83 82C92 43 112 12 147 16Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        className="text-zinc-300 dark:text-zinc-700"
      />
      <ellipse cx="113" cy="377" rx="35" ry="12" fill="currentColor" className="text-zinc-100 dark:text-zinc-900" />
      <ellipse cx="113" cy="377" rx="35" ry="12" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-300 dark:text-zinc-700" />
      {REGIONS.map((region) => {
        const active = region.key === selected.key;
        return (
          <g
            key={region.key}
            role="button"
            tabIndex={0}
            aria-label={`${region.label} 티오 ${region.seats}석`}
            className="cursor-pointer outline-none"
            onClick={() => onSelect(region.key)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(region.key);
              }
            }}
          >
            <circle
              cx={region.x}
              cy={region.y}
              r={active ? 16 : 11}
              fill={pressureFill(region.pressure)}
              opacity={active ? 1 : 0.78}
              stroke={active ? "#fff" : "rgba(255,255,255,0.76)"}
              strokeWidth={active ? 4 : 2}
            />
            <text
              x={region.x}
              y={region.y - 1}
              textAnchor="middle"
              className="pointer-events-none select-none fill-white text-[8px] font-black"
            >
              {region.shortLabel}
            </text>
            <text
              x={region.x}
              y={region.y + 8}
              textAnchor="middle"
              className="pointer-events-none select-none fill-white/90 text-[7px] font-black"
            >
              {region.seats}석
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2, 3].map((idx) => (
        <span
          key={idx}
          className={`h-1.5 rounded-full transition-all ${idx === step ? "w-7 bg-[#3182f6]" : "w-1.5 bg-zinc-300 dark:bg-zinc-700"}`}
        />
      ))}
    </div>
  );
}

export default function PlansApplicationFlow({
  isAuthed,
  isMember,
  loginHref,
  plans,
  pendingApplication,
  filled,
  capacity,
}: {
  isAuthed: boolean;
  isMember: boolean;
  loginHref: string;
  plans: MembershipPlan[];
  pendingApplication: PendingApplication | null;
  filled: number;
  capacity: number;
}) {
  const [step, setStep] = useState(0);
  const [selectedKey, setSelectedKey] = useState("seoul");
  const selected = useMemo(
    () => REGIONS.find((region) => region.key === selectedKey) ?? REGIONS[0],
    [selectedKey],
  );
  const filledPct = Math.round((filled / capacity) * 100);
  const canGoBack = step > 0;
  const isLast = step === 3;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <main className="fixed inset-0 z-[75] overflow-hidden bg-[#f4f7fb] text-zinc-950 dark:bg-zinc-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(49,130,246,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_34%)]" />
      <div className="relative mx-auto flex h-full w-full max-w-[1180px] flex-col px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-[calc(env(safe-area-inset-top)+12px)] sm:px-5 sm:py-5">
        <header className="flex h-11 shrink-0 items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#3182f6] dark:text-blue-300">
              단 300명 회원제
            </div>
            <div className="mt-0.5 text-[16px] font-black tracking-tight">
              선공개 300명 신청
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StepDots step={step} />
            <div className="rounded-full bg-zinc-950 px-3 py-1.5 text-[11px] font-black text-white dark:bg-white dark:text-zinc-950">
              {step + 1}/4
            </div>
          </div>
        </header>

        <section className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[30px] border border-zinc-200 bg-white shadow-[0_24px_90px_rgba(15,23,42,0.14)] dark:border-zinc-800 dark:bg-zinc-900">
          {step === 0 ? (
            <div className="grid h-full min-h-0 gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-h-0 border-b border-zinc-200 p-4 dark:border-zinc-800 sm:p-6 lg:border-b-0 lg:border-r">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h1 className="break-keep text-[28px] font-black leading-[1.02] tracking-tight sm:text-[44px]">
                      지역 티오부터
                      <br />
                      확인합니다.
                    </h1>
                    <p className="mt-3 max-w-[520px] break-keep text-[13px] font-bold leading-5 text-zinc-500 dark:text-zinc-400 sm:text-[15px] sm:leading-6">
                      전국을 무제한으로 열지 않고, 권역별 접근 수를 먼저 봅니다. 지도에서 내 지역을 눌러 티오를 확인하세요.
                    </p>
                  </div>
                  <div className="shrink-0 rounded-[22px] bg-zinc-950 px-4 py-3 text-right text-white dark:bg-white dark:text-zinc-950">
                    <div className="text-[9px] font-black uppercase tracking-[0.14em] opacity-60">현재 예약</div>
                    <div className="mt-0.5 text-[24px] font-black tabular-nums">{filled}/{capacity}</div>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-r-full bg-[linear-gradient(90deg,#10b981,#3182f6,#1d4ed8)]"
                    style={{ width: `${Math.min(96, Math.max(18, filledPct))}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between rounded-2xl border border-zinc-200 bg-[#fbfcff] px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/60 lg:hidden">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">
                      선택 지역
                    </div>
                    <div className="mt-0.5 text-[17px] font-black">{selected.label}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-[11px] font-black text-white dark:bg-white dark:text-zinc-950">
                      {selected.seats}석
                    </span>
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-black text-white"
                      style={{ backgroundColor: pressureFill(selected.pressure) }}
                    >
                      {pressureLabel(selected.pressure)}
                    </span>
                  </div>
                </div>
                <div className="mx-auto mt-2 h-[320px] min-h-0 max-w-[620px] sm:h-[calc(100%-184px)] sm:min-h-[280px] sm:max-h-[560px] lg:mt-2 lg:h-[calc(100%-148px)]">
                  <KoreaSeatMap selected={selected} onSelect={setSelectedKey} />
                </div>
              </div>
              <aside className="hidden min-h-0 flex-col p-4 sm:p-5 lg:flex">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                      선택 지역
                    </div>
                    <h2 className="mt-1 break-keep text-[28px] font-black tracking-tight">
                      {selected.label}
                    </h2>
                  </div>
                  <span
                    className="rounded-full px-3 py-1.5 text-[11px] font-black text-white"
                    style={{ backgroundColor: pressureFill(selected.pressure) }}
                  >
                    {pressureLabel(selected.pressure)}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-[#f5f7fb] px-3 py-3 dark:bg-zinc-950">
                    <div className="text-[10px] font-black text-zinc-400">남은 티오</div>
                    <div className="mt-1 text-[28px] font-black">{selected.seats}석</div>
                  </div>
                  <div className="rounded-2xl bg-[#f5f7fb] px-3 py-3 dark:bg-zinc-950">
                    <div className="text-[10px] font-black text-zinc-400">예약률</div>
                    <div className="mt-1 text-[28px] font-black">{Math.round(selected.pressure * 100)}%</div>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-zinc-200 bg-[#fbfcff] p-3 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.13em] text-zinc-400">
                      전국 지역
                    </div>
                    <div className="text-[10px] font-black text-zinc-500 dark:text-zinc-400">
                      지도에서 바로 선택
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {REGIONS.map((region) => (
                      <button
                        key={region.key}
                        type="button"
                        onClick={() => setSelectedKey(region.key)}
                        className={`h-7 rounded-lg border px-1 text-center text-[10px] font-black transition ${
                          region.key === selected.key
                            ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
                            : "border-zinc-200 bg-white text-zinc-500 hover:border-blue-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                        }`}
                      >
                        {region.shortLabel}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border border-zinc-200 bg-[#fbfcff] px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <div className="text-[10px] font-black uppercase tracking-[0.13em] text-zinc-400">
                    대표 지역
                  </div>
                  <div className="mt-2 break-keep text-[12px] font-black leading-5">
                    {selected.districts.map((district) => district.name).join(" · ")}
                  </div>
                </div>
              </aside>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex h-full flex-col justify-center p-5 sm:p-9">
              <div className="max-w-[720px]">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#3182f6] dark:text-blue-300">
                  공개 제한 이유
                </div>
                <h1 className="mt-3 break-keep text-[32px] font-black leading-[1.02] tracking-tight sm:text-[58px]">
                  좋은 매물은
                  <br />
                  많이 보면 깨집니다.
                </h1>
                <p className="mt-4 break-keep text-[14px] font-bold leading-6 text-zinc-500 dark:text-zinc-400 sm:max-w-[620px] sm:text-[16px] sm:leading-7">
                  득템잡이는 차익 예상 상품을 아무나 열람하게 두지 않고, 선착순 정원과 지역 접근 수를 같이 관리합니다.
                </p>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {VALUE_STEPS.map((item) => (
                  <div key={item.label} className="rounded-[24px] border border-zinc-200 bg-[#fbfcff] p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <div className="text-[13px] font-black text-[#3182f6] dark:text-blue-300">{item.label}</div>
                    <div className="mt-3 break-keep text-[15px] font-black leading-6 sm:text-[17px]">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex h-full flex-col justify-center p-5 sm:p-9">
              <div className="max-w-[760px]">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#3182f6] dark:text-blue-300">
                  멤버 공개 정보
                </div>
                <h1 className="mt-3 break-keep text-[32px] font-black leading-[1.02] tracking-tight sm:text-[58px]">
                  승인된 멤버만
                  <br />
                  핵심 정보를 봅니다.
                </h1>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ACCESS_ITEMS.map((item) => (
                  <div key={item.label} className="rounded-[26px] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-[18px] font-black text-[#3182f6] dark:bg-blue-950/40 dark:text-blue-200">
                      ✓
                    </div>
                    <div className="mt-4 text-[18px] font-black">{item.label}</div>
                    <div className="mt-2 break-keep text-[13px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid h-full min-h-0 gap-0 lg:grid-cols-[minmax(0,1fr)_400px]">
              <div className="flex min-h-0 flex-col justify-center border-b border-zinc-200 p-5 dark:border-zinc-800 sm:p-9 lg:border-b-0 lg:border-r">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#3182f6] dark:text-blue-300">
                  멤버십 신청
                </div>
                <h1 className="mt-3 break-keep text-[34px] font-black leading-[1.02] tracking-tight sm:text-[58px]">
                  이제 지역 티오를
                  <br />
                  예약하세요.
                </h1>
                <p className="mt-4 break-keep text-[14px] font-bold leading-6 text-zinc-500 dark:text-zinc-400 sm:max-w-[620px] sm:text-[16px] sm:leading-7">
                  로그인 후 기간을 고르면 계좌가 열립니다. 입금했어요 버튼을 누르면 5분 내 승인 흐름으로 처리됩니다.
                </p>
              </div>
              <div className="flex min-h-0 flex-col justify-center p-4 sm:p-6">
                <div className="rounded-[24px] border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-950/70 dark:bg-blue-950/20">
                  <MembershipApplicationClient
                    isAuthed={isAuthed}
                    isMember={isMember}
                    loginHref={loginHref}
                    plans={plans}
                    pendingApplication={pendingApplication}
                    suppressFixedCta
                  />
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <footer className="mt-2 flex h-12 shrink-0 items-center justify-between gap-3">
          {canGoBack ? (
            <button
              type="button"
              onClick={() => setStep((prev) => Math.max(0, prev - 1))}
              className="h-11 rounded-2xl border border-zinc-200 bg-white px-5 text-[14px] font-black text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              이전
            </button>
          ) : (
            <div className="h-11 w-16" />
          )}
          {!isLast ? (
            <button
              type="button"
              onClick={() => setStep((prev) => Math.min(3, prev + 1))}
              className="h-11 flex-1 rounded-2xl bg-[#3182f6] px-5 text-[15px] font-black text-white shadow-[0_18px_44px_rgba(49,130,246,0.28)] transition hover:bg-[#1c64dd] sm:flex-none sm:min-w-[240px]"
            >
              다음
            </button>
          ) : (
            <div className="break-keep text-right text-[12px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
              신청 버튼을 누르면 기간 선택으로 이어집니다.
            </div>
          )}
        </footer>
      </div>
    </main>
  );
}
