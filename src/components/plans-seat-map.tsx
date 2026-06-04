"use client";

import { useMemo, useState } from "react";

type DistrictSeat = {
  name: string;
  seats: number;
  pressure: number;
};

type RegionSeat = {
  key: string;
  label: string;
  fullLabel: string;
  seats: number;
  reserved: number;
  pressure: number;
  x: number;
  y: number;
  r: number;
  districts: DistrictSeat[];
};

const REGIONS: RegionSeat[] = [
  {
    key: "seoul",
    label: "서울",
    fullLabel: "서울특별시",
    seats: 38,
    reserved: 31,
    pressure: 0.82,
    x: 122,
    y: 72,
    r: 17,
    districts: [
      { name: "강남구", seats: 2, pressure: 0.88 },
      { name: "송파구", seats: 3, pressure: 0.8 },
      { name: "관악구", seats: 3, pressure: 0.74 },
      { name: "마포구", seats: 2, pressure: 0.86 },
      { name: "성동구", seats: 2, pressure: 0.78 },
      { name: "노원구", seats: 4, pressure: 0.66 },
    ],
  },
  {
    key: "gyeonggi",
    label: "경기",
    fullLabel: "경기도",
    seats: 46,
    reserved: 35,
    pressure: 0.76,
    x: 146,
    y: 94,
    r: 25,
    districts: [
      { name: "성남시", seats: 3, pressure: 0.8 },
      { name: "수원시", seats: 4, pressure: 0.73 },
      { name: "용인시", seats: 4, pressure: 0.69 },
      { name: "고양시", seats: 3, pressure: 0.78 },
      { name: "부천시", seats: 2, pressure: 0.84 },
      { name: "남양주시", seats: 5, pressure: 0.61 },
    ],
  },
  {
    key: "incheon",
    label: "인천",
    fullLabel: "인천광역시",
    seats: 18,
    reserved: 12,
    pressure: 0.67,
    x: 92,
    y: 88,
    r: 14,
    districts: [
      { name: "연수구", seats: 2, pressure: 0.78 },
      { name: "부평구", seats: 2, pressure: 0.74 },
      { name: "서구", seats: 3, pressure: 0.62 },
      { name: "남동구", seats: 2, pressure: 0.69 },
    ],
  },
  {
    key: "gangwon",
    label: "강원",
    fullLabel: "강원권",
    seats: 20,
    reserved: 9,
    pressure: 0.45,
    x: 204,
    y: 82,
    r: 20,
    districts: [
      { name: "춘천시", seats: 4, pressure: 0.48 },
      { name: "원주시", seats: 4, pressure: 0.52 },
      { name: "강릉시", seats: 3, pressure: 0.42 },
      { name: "속초시", seats: 2, pressure: 0.38 },
    ],
  },
  {
    key: "chungcheong",
    label: "충청",
    fullLabel: "충청권",
    seats: 28,
    reserved: 16,
    pressure: 0.57,
    x: 142,
    y: 166,
    r: 24,
    districts: [
      { name: "대전 서구", seats: 3, pressure: 0.62 },
      { name: "세종시", seats: 3, pressure: 0.58 },
      { name: "천안시", seats: 4, pressure: 0.55 },
      { name: "청주시", seats: 4, pressure: 0.51 },
    ],
  },
  {
    key: "jeolla",
    label: "전라",
    fullLabel: "전라권",
    seats: 25,
    reserved: 12,
    pressure: 0.48,
    x: 116,
    y: 262,
    r: 23,
    districts: [
      { name: "광주 북구", seats: 3, pressure: 0.56 },
      { name: "전주시", seats: 4, pressure: 0.49 },
      { name: "군산시", seats: 3, pressure: 0.44 },
      { name: "목포시", seats: 3, pressure: 0.41 },
    ],
  },
  {
    key: "gyeongsang",
    label: "경상",
    fullLabel: "경상권",
    seats: 34,
    reserved: 22,
    pressure: 0.65,
    x: 198,
    y: 246,
    r: 28,
    districts: [
      { name: "대구 수성구", seats: 3, pressure: 0.7 },
      { name: "창원시", seats: 4, pressure: 0.58 },
      { name: "포항시", seats: 3, pressure: 0.52 },
      { name: "울산 남구", seats: 3, pressure: 0.66 },
    ],
  },
  {
    key: "busan",
    label: "부산",
    fullLabel: "부산광역시",
    seats: 22,
    reserved: 18,
    pressure: 0.82,
    x: 218,
    y: 306,
    r: 18,
    districts: [
      { name: "해운대구", seats: 2, pressure: 0.88 },
      { name: "수영구", seats: 2, pressure: 0.82 },
      { name: "부산진구", seats: 3, pressure: 0.74 },
      { name: "동래구", seats: 2, pressure: 0.78 },
    ],
  },
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

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function PlansSeatMap({
  filled,
  capacity,
}: {
  filled: number;
  capacity: number;
}) {
  const [selectedKey, setSelectedKey] = useState("seoul");
  const selected = useMemo(
    () => REGIONS.find((region) => region.key === selectedKey) ?? REGIONS[0],
    [selectedKey],
  );
  const filledPct = Math.round((filled / capacity) * 100);

  return (
    <section className="mt-6 overflow-hidden rounded-[24px] border border-zinc-200 bg-[#fbfcff] shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:bg-zinc-950/55">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800 sm:p-5 xl:border-b-0 xl:border-r">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#3182f6] dark:text-blue-300">
                seat map
              </div>
              <h2 className="mt-1 break-keep text-[22px] font-black leading-tight tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-[28px]">
                지역 티오를 먼저 봅니다.
              </h2>
            </div>
            <div className="shrink-0 rounded-2xl bg-zinc-950 px-3.5 py-2.5 text-right text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] dark:bg-white dark:text-zinc-950">
              <div className="text-[9px] font-black uppercase tracking-[0.14em] opacity-60">
                reserved
              </div>
              <div className="mt-0.5 text-[20px] font-black tabular-nums">
                {filled}/{capacity}
              </div>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-r-full bg-[linear-gradient(90deg,#10b981,#3182f6,#1d4ed8)]"
              style={{ width: `${Math.min(96, Math.max(18, filledPct))}%` }}
            />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_132px] lg:items-center">
            <div className="relative mx-auto aspect-[0.78] w-full max-w-[260px]">
              <svg
                viewBox="0 0 300 385"
                role="img"
                aria-label="대한민국 남한 지역별 멤버십 티오 지도"
                className="h-full w-full overflow-visible"
              >
                <defs>
                  <filter id="seat-map-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#0f172a" floodOpacity="0.16" />
                  </filter>
                </defs>
                <path
                  d="M139 18C173 24 206 52 221 89C238 131 218 157 230 190C242 225 266 245 257 286C249 326 219 352 181 363C143 374 108 361 88 332C68 303 74 274 59 248C43 219 25 193 37 154C49 116 76 112 88 82C101 49 112 24 139 18Z"
                  fill="currentColor"
                  className="text-zinc-100 dark:text-zinc-900"
                  filter="url(#seat-map-shadow)"
                />
                <path
                  d="M139 18C173 24 206 52 221 89C238 131 218 157 230 190C242 225 266 245 257 286C249 326 219 352 181 363C143 374 108 361 88 332C68 303 74 274 59 248C43 219 25 193 37 154C49 116 76 112 88 82C101 49 112 24 139 18Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-zinc-300 dark:text-zinc-700"
                />
                <g
                  className="origin-center transition-transform duration-500 ease-out"
                  style={{
                    transform:
                      selected.key === "seoul"
                        ? "translate(10px, 12px) scale(1.09)"
                        : selected.key === "busan"
                          ? "translate(-10px, -18px) scale(1.07)"
                          : "scale(1)",
                  }}
                >
                  {REGIONS.map((region) => {
                    const active = region.key === selected.key;
                    return (
                      <g
                        key={region.key}
                        role="button"
                        tabIndex={0}
                        aria-label={`${region.fullLabel} 티오 ${region.seats}석`}
                        className="cursor-pointer outline-none"
                        onClick={() => setSelectedKey(region.key)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedKey(region.key);
                          }
                        }}
                      >
                        <circle
                          cx={region.x}
                          cy={region.y}
                          r={active ? region.r + 6 : region.r}
                          fill={pressureFill(region.pressure)}
                          opacity={active ? 0.96 : 0.72}
                          stroke={active ? "#ffffff" : "rgba(255,255,255,0.76)"}
                          strokeWidth={active ? 4 : 2}
                        />
                        <text
                          x={region.x}
                          y={region.y - 2}
                          textAnchor="middle"
                          className="pointer-events-none select-none fill-white text-[12px] font-black"
                        >
                          {region.label}
                        </text>
                        <text
                          x={region.x}
                          y={region.y + 13}
                          textAnchor="middle"
                          className="pointer-events-none select-none fill-white/90 text-[10px] font-black"
                        >
                          {region.seats}석
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {REGIONS.slice(0, 6).map((region) => (
                <button
                  type="button"
                  key={region.key}
                  onClick={() => setSelectedKey(region.key)}
                  className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-left transition ${
                    region.key === selected.key
                      ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/35 dark:text-blue-100"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-blue-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  <span className="text-[11px] font-black">{region.fullLabel}</span>
                  <span className="text-[11px] font-black tabular-nums">
                    {region.seats}석
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="rounded-[20px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                  zoomed area
                </div>
                <h3 className="mt-1 text-[24px] font-black tracking-tight text-zinc-950 dark:text-zinc-50">
                  {selected.fullLabel}
                </h3>
              </div>
              <div
                className="rounded-full px-3 py-1.5 text-[11px] font-black text-white"
                style={{ backgroundColor: pressureFill(selected.pressure) }}
              >
                {pressureLabel(selected.pressure)}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-[#f5f7fb] px-3 py-3 dark:bg-zinc-950">
                <div className="text-[10px] font-black text-zinc-400">
                  남은 티오
                </div>
                <div className="mt-1 text-[24px] font-black text-zinc-950 dark:text-zinc-50">
                  {selected.seats}석
                </div>
              </div>
              <div className="rounded-2xl bg-[#f5f7fb] px-3 py-3 dark:bg-zinc-950">
                <div className="text-[10px] font-black text-zinc-400">
                  예약률
                </div>
                <div className="mt-1 text-[24px] font-black text-zinc-950 dark:text-zinc-50">
                  {percent(selected.pressure)}
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {selected.districts.map((district) => (
                <div
                  key={district.name}
                  className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-[#fbfcff] px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/60"
                >
                  <div>
                    <div className="text-[13px] font-black text-zinc-950 dark:text-zinc-50">
                      {district.name}
                    </div>
                    <div className="mt-0.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
                      {pressureLabel(district.pressure)}
                    </div>
                  </div>
                  <div className="rounded-full bg-zinc-950 px-2.5 py-1 text-[11px] font-black text-white dark:bg-white dark:text-zinc-950">
                    {district.seats}석
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 break-keep text-[12px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
              지역을 누르면 확대해서 구/시 단위 티오를 먼저 보여줍니다. 티오가 열려 있으면 기간 선택으로 바로 이어집니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
