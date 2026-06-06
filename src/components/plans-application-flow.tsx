"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { CategoryWatermark } from "@/components/category-watermark";
import { MarketplaceSourceBadge } from "@/components/market-brand-logo";
import MembershipApplicationClient from "@/components/membership-application-client";
import {
  KOREA_ADMIN_MAP_VIEWBOX,
  KOREA_ADMIN_REGION_SVG,
} from "@/components/korea-admin-map-data";
import type { MembershipPlan, MembershipPlanKey } from "@/lib/membership-plans";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

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

type AddressOption = {
  fullPath: string;
  region1: string;
  region2: string;
  region3: string;
  lat: number;
  lng: number;
};

type HomeRegionDraft = {
  lat: number;
  lng: number;
  fullPath: string;
  label: string;
  source: "gps" | "manual";
};

type LocationConfirmDraft = {
  draft: HomeRegionDraft;
  parts: Array<string | null | undefined>;
  districtHint: string | null;
};

type DistrictSeat = {
  name: string;
  seats: number;
  pressure: number;
  x?: number;
  y?: number;
};

type RegionSeat = {
  key: string;
  shortLabel: string;
  label: string;
  seats: number;
  pressure: number;
  x: number;
  y: number;
  labelX?: number;
  labelY?: number;
  districts: DistrictSeat[];
};

type LocalSampleItem = {
  pid: number;
  title: string;
  sourceLabel: string;
  regionName: string | null;
  fullRegionName: string | null;
  districtName: string;
  buyPrice: number;
  marketPrice: number;
  expectedProfit: number;
  profitPct: number | null;
  medianDaysToSold: number | null;
  sold7dCount: number | null;
  sampleCount: number | null;
  category: string;
  comparableKey: string | null;
  genericImageUrl: string | null;
  thumbnailUrl: string | null;
};

const SEAT_PROOF_NAMES = [
  "김**님",
  "박**님",
  "최**님",
  "정**님",
  "강**님",
  "윤**님",
  "서**님",
  "송**님",
  "한**님",
  "권**님",
  "임**님",
  "오**님",
];

const SEAT_PROOF_MINUTES = [8, 17];

function SeatProofToast({ active }: { active: boolean }) {
  const [index, setIndex] = useState(-1);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const timers: number[] = [];
    const showAt = (nextIndex: number) => {
      setIndex(nextIndex);
      setVisible(true);
      timers.push(window.setTimeout(() => setVisible(false), 7600));
    };

    timers.push(window.setTimeout(() => showAt(0), 1800));
    timers.push(window.setTimeout(() => showAt(1), 16_800));
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [active]);

  if (!active || index < 0 || index >= SEAT_PROOF_MINUTES.length) return null;

  return (
    <div
      aria-live="polite"
      className={`fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+14px)] z-[120] mx-auto max-w-[460px] transition-all duration-700 ease-out sm:left-auto sm:right-8 sm:top-8 sm:mx-0 ${
        visible
          ? "translate-y-0 scale-100 opacity-100"
          : "-translate-y-4 scale-[0.98] opacity-0 pointer-events-none"
      }`}
    >
      <div className="rounded-2xl border border-rose-200 bg-white/98 px-4 py-3.5 shadow-[0_20px_54px_rgba(244,63,94,0.24)] backdrop-blur dark:border-rose-400/30 dark:bg-zinc-950/96">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500 text-[15px] font-black text-white shadow-[0_12px_28px_rgba(244,63,94,0.34)]">
            ✓
          </div>
          <div className="min-w-0">
            <div className="break-keep text-[13px] font-black leading-5 text-zinc-950 dark:text-white">
              {SEAT_PROOF_NAMES[index]}이 {SEAT_PROOF_MINUTES[index]}분 전에
              멤버십에 가입해 1자리를 확보했어요.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function makeDistrictSeats(
  names: string[],
  baseSeats: number,
  basePressure: number,
): DistrictSeat[] {
  return names.map((name, index) => ({
    name,
    seats: Math.max(1, baseSeats - (index % 3)),
    pressure: Math.max(0.32, Math.min(0.9, basePressure - (index % 5) * 0.035)),
  }));
}

const DISTRICT_OVERRIDES: Record<string, DistrictSeat[]> = {
  seoul: makeDistrictSeats(
    [
      "강남구",
      "송파구",
      "관악구",
      "마포구",
      "성동구",
      "노원구",
      "서초구",
      "용산구",
      "영등포구",
      "동작구",
      "강서구",
      "강동구",
      "중구",
      "종로구",
      "은평구",
      "서대문구",
      "구로구",
      "금천구",
      "광진구",
      "동대문구",
      "중랑구",
      "성북구",
      "강북구",
      "도봉구",
      "양천구",
    ],
    3,
    0.86,
  ),
  gyeonggi: makeDistrictSeats(
    [
      "수원시",
      "성남시",
      "용인시",
      "고양시",
      "화성시",
      "부천시",
      "남양주시",
      "안산시",
      "안양시",
      "평택시",
      "시흥시",
      "파주시",
      "김포시",
      "의정부시",
      "광주시",
      "하남시",
      "광명시",
      "군포시",
      "오산시",
      "이천시",
      "양주시",
      "구리시",
      "안성시",
      "포천시",
      "의왕시",
      "양평군",
      "여주시",
      "동두천시",
      "과천시",
      "가평군",
      "연천군",
    ],
    4,
    0.78,
  ),
  incheon: makeDistrictSeats(
    [
      "연수구",
      "부평구",
      "서구",
      "남동구",
      "미추홀구",
      "계양구",
      "중구",
      "동구",
      "강화군",
      "옹진군",
    ],
    3,
    0.72,
  ),
  busan: makeDistrictSeats(
    [
      "해운대구",
      "수영구",
      "부산진구",
      "동래구",
      "남구",
      "연제구",
      "사하구",
      "북구",
      "금정구",
      "강서구",
      "기장군",
      "중구",
      "서구",
      "동구",
      "영도구",
      "사상구",
    ],
    3,
    0.82,
  ),
  daegu: makeDistrictSeats(
    [
      "수성구",
      "달서구",
      "동구",
      "중구",
      "서구",
      "남구",
      "북구",
      "달성군",
      "군위군",
    ],
    3,
    0.7,
  ),
  daejeon: makeDistrictSeats(
    ["서구", "유성구", "중구", "동구", "대덕구"],
    3,
    0.62,
  ),
  gwangju: makeDistrictSeats(
    ["북구", "광산구", "서구", "동구", "남구"],
    3,
    0.56,
  ),
  ulsan: makeDistrictSeats(["남구", "중구", "울주군", "동구", "북구"], 3, 0.66),
  sejong: makeDistrictSeats(
    ["새롬동", "도담동", "어진동", "나성동", "조치원읍", "반곡동"],
    2,
    0.58,
  ),
  gangwon: makeDistrictSeats(
    [
      "춘천시",
      "원주시",
      "강릉시",
      "속초시",
      "동해시",
      "삼척시",
      "태백시",
      "홍천군",
      "횡성군",
      "평창군",
    ],
    4,
    0.48,
  ),
  chungbuk: makeDistrictSeats(
    [
      "청주시",
      "충주시",
      "제천시",
      "음성군",
      "진천군",
      "증평군",
      "옥천군",
      "영동군",
      "단양군",
      "보은군",
      "괴산군",
    ],
    4,
    0.51,
  ),
  chungnam: makeDistrictSeats(
    [
      "천안시",
      "아산시",
      "공주시",
      "당진시",
      "서산시",
      "논산시",
      "보령시",
      "계룡시",
      "홍성군",
      "예산군",
      "부여군",
      "태안군",
    ],
    4,
    0.56,
  ),
  jeonbuk: makeDistrictSeats(
    [
      "전주시",
      "군산시",
      "익산시",
      "완주군",
      "정읍시",
      "남원시",
      "김제시",
      "무주군",
      "고창군",
      "부안군",
    ],
    4,
    0.49,
  ),
  jeonnam: makeDistrictSeats(
    [
      "목포시",
      "여수시",
      "순천시",
      "나주시",
      "광양시",
      "무안군",
      "해남군",
      "화순군",
      "고흥군",
      "영암군",
    ],
    3,
    0.43,
  ),
  gyeongbuk: makeDistrictSeats(
    [
      "포항시",
      "구미시",
      "경산시",
      "경주시",
      "안동시",
      "김천시",
      "영주시",
      "상주시",
      "문경시",
      "칠곡군",
    ],
    3,
    0.55,
  ),
  gyeongnam: makeDistrictSeats(
    [
      "창원시",
      "김해시",
      "진주시",
      "양산시",
      "거제시",
      "통영시",
      "사천시",
      "밀양시",
      "함안군",
      "창녕군",
    ],
    4,
    0.59,
  ),
  jeju: makeDistrictSeats(["제주시", "서귀포시"], 4, 0.37),
};

const DISTRICT_COORDS: Record<string, Record<string, [number, number]>> = {
  seoul: {
    강남구: [170, 190],
    송파구: [178, 188],
    관악구: [154, 194],
    마포구: [147, 174],
    성동구: [164, 177],
    노원구: [171, 158],
    서초구: [163, 190],
    용산구: [156, 181],
    영등포구: [146, 187],
    동작구: [154, 189],
    강서구: [133, 180],
    강동구: [184, 179],
    중구: [157, 175],
    종로구: [156, 168],
    은평구: [144, 160],
    서대문구: [148, 169],
    구로구: [139, 193],
    금천구: [145, 199],
    광진구: [171, 178],
    동대문구: [165, 170],
    중랑구: [174, 168],
    성북구: [162, 164],
    강북구: [160, 156],
    도봉구: [165, 150],
    양천구: [137, 187],
  },
  gyeonggi: {
    수원시: [181, 244],
    성남시: [185, 214],
    용인시: [200, 242],
    고양시: [134, 164],
    화성시: [164, 263],
    부천시: [128, 203],
    남양주시: [194, 177],
    안산시: [150, 234],
    안양시: [158, 220],
    평택시: [188, 286],
    시흥시: [139, 222],
    파주시: [122, 139],
    김포시: [112, 176],
    의정부시: [169, 154],
    광주시: [205, 218],
    하남시: [191, 204],
    광명시: [145, 211],
    군포시: [162, 231],
    오산시: [178, 256],
    이천시: [231, 254],
    양주시: [158, 143],
    구리시: [180, 177],
    안성시: [214, 290],
    포천시: [190, 131],
    의왕시: [169, 224],
    양평군: [237, 202],
    여주시: [253, 239],
    동두천시: [170, 131],
    과천시: [165, 214],
    가평군: [226, 153],
    연천군: [160, 110],
  },
  incheon: {
    연수구: [96, 210],
    부평구: [111, 195],
    서구: [102, 174],
    남동구: [111, 207],
    미추홀구: [102, 201],
    계양구: [116, 184],
    중구: [88, 199],
    동구: [99, 196],
    강화군: [81, 144],
    옹진군: [69, 226],
  },
  busan: {
    해운대구: [445, 554],
    수영구: [435, 561],
    부산진구: [424, 553],
    동래구: [426, 543],
    남구: [429, 566],
    연제구: [429, 550],
    사하구: [409, 573],
    북구: [414, 540],
    금정구: [424, 532],
    강서구: [398, 553],
    기장군: [449, 531],
    중구: [417, 564],
    서구: [413, 568],
    동구: [421, 560],
    영도구: [421, 575],
    사상구: [410, 555],
  },
  daegu: {
    수성구: [367, 461],
    달서구: [348, 461],
    동구: [371, 444],
    중구: [358, 452],
    서구: [351, 450],
    남구: [358, 461],
    북구: [355, 441],
    달성군: [337, 475],
    군위군: [365, 414],
  },
  daejeon: {
    서구: [195, 395],
    유성구: [190, 384],
    중구: [205, 397],
    동구: [213, 391],
    대덕구: [207, 381],
  },
  gwangju: {
    북구: [132, 523],
    광산구: [115, 535],
    서구: [128, 540],
    동구: [139, 536],
    남구: [133, 548],
  },
  ulsan: {
    남구: [453, 500],
    중구: [449, 492],
    울주군: [440, 510],
    동구: [463, 500],
    북구: [456, 486],
  },
  sejong: {
    새롬동: [187, 336],
    도담동: [192, 332],
    어진동: [191, 339],
    나성동: [186, 341],
    조치원읍: [190, 323],
    반곡동: [196, 344],
  },
  gangwon: {
    춘천시: [247, 155],
    원주시: [253, 226],
    강릉시: [360, 166],
    속초시: [350, 98],
    동해시: [371, 203],
    삼척시: [378, 224],
    태백시: [348, 235],
    홍천군: [284, 176],
    횡성군: [282, 215],
    평창군: [323, 205],
  },
  chungbuk: {
    청주시: [225, 341],
    충주시: [263, 298],
    제천시: [297, 293],
    음성군: [238, 302],
    진천군: [224, 315],
    증평군: [235, 326],
    옥천군: [236, 382],
    영동군: [257, 405],
    단양군: [318, 283],
    보은군: [247, 361],
    괴산군: [256, 326],
  },
  chungnam: {
    천안시: [174, 308],
    아산시: [153, 313],
    공주시: [163, 358],
    당진시: [121, 304],
    서산시: [103, 331],
    논산시: [165, 392],
    보령시: [113, 375],
    계룡시: [183, 389],
    홍성군: [124, 357],
    예산군: [142, 343],
    부여군: [144, 384],
    태안군: [81, 334],
  },
  jeonbuk: {
    전주시: [172, 450],
    군산시: [133, 432],
    익산시: [153, 426],
    완주군: [184, 442],
    정읍시: [144, 472],
    남원시: [204, 497],
    김제시: [153, 454],
    무주군: [224, 443],
    고창군: [120, 492],
    부안군: [121, 460],
  },
  jeonnam: {
    목포시: [102, 596],
    여수시: [218, 590],
    순천시: [196, 570],
    나주시: [138, 548],
    광양시: [210, 564],
    무안군: [104, 564],
    해남군: [112, 630],
    화순군: [162, 552],
    고흥군: [189, 622],
    영암군: [130, 589],
  },
  gyeongbuk: {
    포항시: [408, 412],
    구미시: [326, 405],
    경산시: [367, 453],
    경주시: [397, 448],
    안동시: [342, 338],
    김천시: [292, 408],
    영주시: [321, 312],
    상주시: [293, 363],
    문경시: [293, 333],
    칠곡군: [342, 423],
  },
  gyeongnam: {
    창원시: [352, 552],
    김해시: [394, 548],
    진주시: [296, 548],
    양산시: [411, 524],
    거제시: [370, 600],
    통영시: [334, 596],
    사천시: [302, 576],
    밀양시: [374, 516],
    함안군: [334, 544],
    창녕군: [343, 506],
  },
  jeju: {
    제주시: [429, 676],
    서귀포시: [439, 697],
  },
};

function districtSeatsFor(region: RegionSeat): DistrictSeat[] {
  const districts = DISTRICT_OVERRIDES[region.key] ?? region.districts;
  const coords = DISTRICT_COORDS[region.key] ?? {};
  return districts.map((district, index) => {
    const coord = coords[district.name];
    if (coord) return { ...district, x: coord[0], y: coord[1] };
    const angle = (Math.PI * 2 * index) / Math.max(1, districts.length);
    const radius = region.key === "seoul" ? 14 : 42;
    return {
      ...district,
      x: region.x + Math.cos(angle) * radius,
      y: region.y + Math.sin(angle) * radius,
    };
  });
}

const REGIONS: RegionSeat[] = [
  {
    key: "seoul",
    shortLabel: "서울",
    label: "서울특별시",
    seats: 38,
    pressure: 0.82,
    x: 160,
    y: 178,
    labelX: 148,
    labelY: 136,
    districts: [
      { name: "강남구", seats: 2, pressure: 0.88 },
      { name: "송파구", seats: 3, pressure: 0.8 },
      { name: "관악구", seats: 3, pressure: 0.74 },
      { name: "마포구", seats: 2, pressure: 0.86 },
    ],
  },
  {
    key: "incheon",
    shortLabel: "인천",
    label: "인천광역시",
    seats: 18,
    pressure: 0.67,
    x: 98,
    y: 176,
    labelX: 70,
    labelY: 176,
    districts: [
      { name: "연수구", seats: 2, pressure: 0.78 },
      { name: "부평구", seats: 2, pressure: 0.74 },
      { name: "서구", seats: 3, pressure: 0.62 },
      { name: "남동구", seats: 2, pressure: 0.69 },
    ],
  },
  {
    key: "gyeonggi",
    shortLabel: "경기",
    label: "경기도",
    seats: 46,
    pressure: 0.76,
    x: 184,
    y: 214,
    labelX: 214,
    labelY: 220,
    districts: [
      { name: "성남시", seats: 3, pressure: 0.8 },
      { name: "수원시", seats: 4, pressure: 0.73 },
      { name: "용인시", seats: 4, pressure: 0.69 },
      { name: "고양시", seats: 3, pressure: 0.78 },
    ],
  },
  {
    key: "gangwon",
    shortLabel: "강원",
    label: "강원특별자치도",
    seats: 20,
    pressure: 0.45,
    x: 314,
    y: 136,
    districts: [
      { name: "춘천시", seats: 4, pressure: 0.48 },
      { name: "원주시", seats: 4, pressure: 0.52 },
      { name: "강릉시", seats: 3, pressure: 0.42 },
      { name: "속초시", seats: 2, pressure: 0.38 },
    ],
  },
  {
    key: "chungbuk",
    shortLabel: "충북",
    label: "충청북도",
    seats: 19,
    pressure: 0.51,
    x: 260,
    y: 324,
    labelX: 285,
    labelY: 320,
    districts: [
      { name: "청주시", seats: 4, pressure: 0.51 },
      { name: "충주시", seats: 3, pressure: 0.44 },
      { name: "제천시", seats: 2, pressure: 0.39 },
      { name: "음성군", seats: 2, pressure: 0.43 },
    ],
  },
  {
    key: "chungnam",
    shortLabel: "충남",
    label: "충청남도",
    seats: 22,
    pressure: 0.56,
    x: 145,
    y: 337,
    labelX: 112,
    labelY: 330,
    districts: [
      { name: "천안시", seats: 4, pressure: 0.55 },
      { name: "아산시", seats: 3, pressure: 0.57 },
      { name: "공주시", seats: 2, pressure: 0.46 },
      { name: "당진시", seats: 2, pressure: 0.5 },
    ],
  },
  {
    key: "sejong",
    shortLabel: "세종",
    label: "세종특별자치시",
    seats: 9,
    pressure: 0.58,
    x: 190,
    y: 338,
    labelX: 190,
    labelY: 312,
    districts: [
      { name: "새롬동", seats: 1, pressure: 0.62 },
      { name: "도담동", seats: 1, pressure: 0.57 },
      { name: "어진동", seats: 1, pressure: 0.52 },
    ],
  },
  {
    key: "daejeon",
    shortLabel: "대전",
    label: "대전광역시",
    seats: 13,
    pressure: 0.62,
    x: 200,
    y: 388,
    labelX: 205,
    labelY: 398,
    districts: [
      { name: "서구", seats: 3, pressure: 0.62 },
      { name: "유성구", seats: 2, pressure: 0.66 },
      { name: "중구", seats: 2, pressure: 0.51 },
    ],
  },
  {
    key: "jeonbuk",
    shortLabel: "전북",
    label: "전북특별자치도",
    seats: 19,
    pressure: 0.49,
    x: 174,
    y: 456,
    labelX: 170,
    labelY: 470,
    districts: [
      { name: "전주시", seats: 4, pressure: 0.49 },
      { name: "군산시", seats: 3, pressure: 0.44 },
      { name: "익산시", seats: 3, pressure: 0.46 },
    ],
  },
  {
    key: "gwangju",
    shortLabel: "광주",
    label: "광주광역시",
    seats: 12,
    pressure: 0.56,
    x: 132,
    y: 536,
    labelX: 118,
    labelY: 530,
    districts: [
      { name: "북구", seats: 3, pressure: 0.56 },
      { name: "광산구", seats: 2, pressure: 0.54 },
      { name: "서구", seats: 2, pressure: 0.5 },
    ],
  },
  {
    key: "jeonnam",
    shortLabel: "전남",
    label: "전라남도",
    seats: 18,
    pressure: 0.42,
    x: 145,
    y: 586,
    labelX: 172,
    labelY: 594,
    districts: [
      { name: "목포시", seats: 3, pressure: 0.41 },
      { name: "여수시", seats: 3, pressure: 0.44 },
      { name: "순천시", seats: 3, pressure: 0.43 },
    ],
  },
  {
    key: "gyeongbuk",
    shortLabel: "경북",
    label: "경상북도",
    seats: 23,
    pressure: 0.53,
    x: 340,
    y: 360,
    districts: [
      { name: "포항시", seats: 3, pressure: 0.52 },
      { name: "구미시", seats: 3, pressure: 0.57 },
      { name: "경산시", seats: 2, pressure: 0.55 },
    ],
  },
  {
    key: "daegu",
    shortLabel: "대구",
    label: "대구광역시",
    seats: 14,
    pressure: 0.7,
    x: 356,
    y: 448,
    labelX: 365,
    labelY: 450,
    districts: [
      { name: "수성구", seats: 3, pressure: 0.7 },
      { name: "달서구", seats: 2, pressure: 0.64 },
      { name: "동구", seats: 2, pressure: 0.58 },
    ],
  },
  {
    key: "ulsan",
    shortLabel: "울산",
    label: "울산광역시",
    seats: 11,
    pressure: 0.66,
    x: 454,
    y: 496,
    labelX: 466,
    labelY: 485,
    districts: [
      { name: "남구", seats: 3, pressure: 0.66 },
      { name: "중구", seats: 2, pressure: 0.58 },
      { name: "울주군", seats: 2, pressure: 0.5 },
    ],
  },
  {
    key: "gyeongnam",
    shortLabel: "경남",
    label: "경상남도",
    seats: 24,
    pressure: 0.59,
    x: 318,
    y: 535,
    labelX: 318,
    labelY: 545,
    districts: [
      { name: "창원시", seats: 4, pressure: 0.58 },
      { name: "김해시", seats: 3, pressure: 0.62 },
      { name: "진주시", seats: 3, pressure: 0.49 },
    ],
  },
  {
    key: "busan",
    shortLabel: "부산",
    label: "부산광역시",
    seats: 22,
    pressure: 0.82,
    x: 424,
    y: 548,
    labelX: 425,
    labelY: 568,
    districts: [
      { name: "해운대구", seats: 2, pressure: 0.88 },
      { name: "수영구", seats: 2, pressure: 0.82 },
      { name: "부산진구", seats: 3, pressure: 0.74 },
    ],
  },
  {
    key: "jeju",
    shortLabel: "제주",
    label: "제주특별자치도",
    seats: 8,
    pressure: 0.36,
    x: 432,
    y: 678,
    districts: [
      { name: "제주시", seats: 4, pressure: 0.37 },
      { name: "서귀포시", seats: 3, pressure: 0.32 },
    ],
  },
];

function pressureFill(pressure: number) {
  if (pressure >= 0.82) return "#ef4444";
  if (pressure >= 0.72) return "#f97316";
  if (pressure >= 0.62) return "#f59e0b";
  if (pressure >= 0.5) return "#10b981";
  return "#2563eb";
}

function regionMapFill(key: string) {
  const palette: Record<string, string> = {
    seoul: "#ef4444",
    incheon: "#f97316",
    gyeonggi: "#a16207",
    gangwon: "#2563eb",
    chungbuk: "#16a34a",
    chungnam: "#0f766e",
    sejong: "#7c3aed",
    daejeon: "#9333ea",
    jeonbuk: "#1d4ed8",
    gwangju: "#4f46e5",
    jeonnam: "#0ea5e9",
    gyeongbuk: "#059669",
    daegu: "#dc2626",
    ulsan: "#0891b2",
    gyeongnam: "#15803d",
    busan: "#be123c",
    jeju: "#2563eb",
  };
  return palette[key] ?? "#64748b";
}

function regionKeyFromAddress(parts: Array<string | null | undefined>) {
  const text = parts.filter(Boolean).join(" ");
  if (/서울/.test(text)) return "seoul";
  if (/인천/.test(text)) return "incheon";
  if (/경기/.test(text)) return "gyeonggi";
  if (/강원/.test(text)) return "gangwon";
  if (/충청북|충북/.test(text)) return "chungbuk";
  if (/충청남|충남/.test(text)) return "chungnam";
  if (/세종/.test(text)) return "sejong";
  if (/대전/.test(text)) return "daejeon";
  if (/전라북|전북/.test(text)) return "jeonbuk";
  if (/광주/.test(text)) return "gwangju";
  if (/전라남|전남/.test(text)) return "jeonnam";
  if (/경상북|경북/.test(text)) return "gyeongbuk";
  if (/대구/.test(text)) return "daegu";
  if (/울산/.test(text)) return "ulsan";
  if (/경상남|경남/.test(text)) return "gyeongnam";
  if (/부산/.test(text)) return "busan";
  if (/제주/.test(text)) return "jeju";
  return null;
}

function pressureLabel(pressure: number) {
  if (pressure >= 0.82) return "과밀";
  if (pressure >= 0.72) return "마감 임박";
  if (pressure >= 0.62) return "주의";
  if (pressure >= 0.5) return "보통";
  return "여유";
}

function districtUsage(district: DistrictSeat) {
  const total = district.seats + Math.max(1, Math.round(district.pressure * 3));
  return {
    filled: total - district.seats,
    total,
  };
}

function seatTone(seats: number, total: number) {
  const ratio = total > 0 ? seats / total : 1;
  if (seats <= 2) {
    return {
      text: "text-red-600 dark:text-red-300",
      bar: "bg-red-500",
      badge:
        "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-800",
    };
  }
  if (ratio <= 0.5) {
    return {
      text: "text-amber-600 dark:text-amber-300",
      bar: "bg-amber-500",
      badge:
        "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800",
    };
  }
  return {
    text: "text-blue-600 dark:text-blue-300",
    bar: "bg-blue-600",
    badge:
      "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-800",
  };
}

function formatKrw(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function regionZoomScale(key: string) {
  if (key === "seoul") return 10.4;
  if (key === "busan") return 9.6;
  if (
    ["incheon", "daegu", "daejeon", "gwangju", "ulsan", "sejong"].includes(key)
  )
    return 8.8;
  if (key === "jeju") return 3.5;
  if (key === "gyeonggi") return 2.65;
  return 2.1;
}

function KoreaSeatMap({
  selected,
  selectedDistricts,
  hoveredKey,
  zoomed,
  onSelect,
  onHover,
}: {
  selected: RegionSeat;
  selectedDistricts: DistrictSeat[];
  hoveredKey: string | null;
  zoomed: boolean;
  onSelect: (key: string) => void;
  onHover: (key: string | null) => void;
}) {
  const hoveredRegion = zoomed
    ? null
    : REGIONS.find((region) => region.key === hoveredKey);
  const activeRegion = hoveredRegion ?? (zoomed ? selected : null);
  const zoomScale = zoomed ? regionZoomScale(selected.key) : 1;
  const districtBounds = selectedDistricts.reduce(
    (bounds, district) => {
      if (district.x === undefined || district.y === undefined) return bounds;
      return {
        minX: Math.min(bounds.minX, district.x),
        maxX: Math.max(bounds.maxX, district.x),
        minY: Math.min(bounds.minY, district.y),
        maxY: Math.max(bounds.maxY, district.y),
      };
    },
    { minX: selected.x, maxX: selected.x, minY: selected.y, maxY: selected.y },
  );
  const focusX = zoomed
    ? (districtBounds.minX + districtBounds.maxX) / 2
    : selected.x;
  const focusY = zoomed
    ? (districtBounds.minY + districtBounds.maxY) / 2
    : selected.y;
  const zoomX = zoomed ? 254.5 - focusX * zoomScale : 0;
  const zoomY = zoomed ? 358 - focusY * zoomScale : 0;
  const activeRegionX = activeRegion ? activeRegion.x * zoomScale + zoomX : 0;
  const activeRegionY = activeRegion ? activeRegion.y * zoomScale + zoomY : 0;
  const calloutLabel = activeRegion?.label;
  const calloutSeats = activeRegion?.seats;

  return (
    <svg
      viewBox={KOREA_ADMIN_MAP_VIEWBOX}
      role="img"
      aria-label="대한민국 남한 지역별 멤버십 티오 지도"
      className="h-full w-full overflow-visible"
    >
      <defs>
        <filter
          id="plans-korea-shadow"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="14"
            stdDeviation="12"
            floodColor="#020617"
            floodOpacity="0.2"
          />
        </filter>
        <filter
          id="plans-region-pop"
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
        >
          <feDropShadow
            dx="0"
            dy="10"
            stdDeviation="9"
            floodColor="#2563eb"
            floodOpacity="0.28"
          />
        </filter>
      </defs>
      <style>{`
        .korea-region-piece {
          fill: var(--region-fill);
          stroke: var(--region-fill);
          stroke-width: 0.75;
          vector-effect: non-scaling-stroke;
          transition: opacity 160ms ease, stroke 160ms ease, stroke-width 160ms ease, filter 160ms ease;
        }
        .korea-region-boundary .korea-region-piece {
          fill: none;
          stroke: rgba(255,255,255,0.5);
          stroke-width: 0.72;
          vector-effect: non-scaling-stroke;
        }
        .korea-region-boundary-active .korea-region-piece {
          stroke: rgba(255,255,255,0.96);
          stroke-width: 1.25;
        }
        .korea-region-active .korea-region-piece {
          stroke: rgba(255,255,255,0.58);
          stroke-width: 0.9;
        }
        .korea-region-detailed .korea-region-piece {
          stroke: rgba(255,255,255,0.86);
          stroke-width: 1.2;
        }
      `}</style>
      <g
        style={
          {
            transform: `translate(${zoomX}px, ${zoomY}px) scale(${zoomScale})`,
            transformBox: "view-box",
            transformOrigin: "0 0",
            transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
          } as CSSProperties
        }
      >
        {REGIONS.map((region) => {
          const selectedActive = zoomed && region.key === selected.key;
          const hoveredActive = !zoomed && region.key === hoveredKey;
          const active = selectedActive || hoveredActive;
          const regionSvg = KOREA_ADMIN_REGION_SVG[region.key];
          return (
            <g
              key={region.key}
              role="button"
              tabIndex={0}
              aria-label={`${region.label} 티오 ${region.seats}석`}
              className="cursor-pointer outline-none"
              onClick={() => onSelect(region.key)}
              onMouseEnter={() => onHover(region.key)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(region.key)}
              onBlur={() => onHover(null)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(region.key);
                }
              }}
            >
              <g
                className={
                  selectedActive
                    ? "korea-region-detailed"
                    : active
                      ? "korea-region-active"
                      : undefined
                }
                dangerouslySetInnerHTML={{ __html: regionSvg }}
                style={
                  {
                    "--region-fill": regionMapFill(region.key),
                    filter: active ? "url(#plans-region-pop)" : undefined,
                    opacity: selectedActive
                      ? 1
                      : zoomed
                        ? 0.07
                        : hoveredActive
                          ? 0.96
                          : 0.76,
                    transform:
                      hoveredActive && !zoomed ? "scale(1.03)" : "scale(1)",
                    transformBox: "fill-box",
                    transformOrigin: "center",
                  } as CSSProperties
                }
              />
            </g>
          );
        })}
        <g className="pointer-events-none">
          {zoomed
            ? REGIONS.map((region) => {
                const selectedActive = zoomed && region.key === selected.key;
                const hoveredActive = !zoomed && region.key === hoveredKey;
                const regionSvg = KOREA_ADMIN_REGION_SVG[region.key];
                return (
                  <g
                    key={`${region.key}-boundary`}
                    className={
                      selectedActive || hoveredActive
                        ? "korea-region-boundary korea-region-boundary-active"
                        : "korea-region-boundary"
                    }
                    dangerouslySetInnerHTML={{ __html: regionSvg }}
                    style={
                      {
                        opacity: selectedActive ? 1 : zoomed ? 0.08 : 0.86,
                      } as CSSProperties
                    }
                  />
                );
              })
            : null}
        </g>
        <g>
          {REGIONS.map((region) => {
            const selectedActive = zoomed && region.key === selected.key;
            const hoveredActive = !zoomed && region.key === hoveredKey;
            const labelX = region.labelX ?? region.x;
            const labelY = region.labelY ?? region.y;
            if (zoomed) return null;
            return (
              <g
                key={`${region.key}-label`}
                role="button"
                tabIndex={0}
                aria-label={`${region.label} 티오 ${region.seats}석`}
                className="cursor-pointer outline-none"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(region.key);
                }}
                onMouseEnter={() => onHover(region.key)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(region.key)}
                onBlur={() => onHover(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(region.key);
                  }
                }}
              >
                <circle
                  cx={labelX}
                  cy={labelY}
                  r={selectedActive ? 20 : hoveredActive ? 42 : 38}
                  fill="rgba(15,23,42,0.84)"
                  stroke="rgba(255,255,255,0.94)"
                  strokeWidth={selectedActive ? 4 : 3}
                  className="transition-all duration-200"
                />
                <text
                  x={labelX}
                  y={labelY - 5}
                  textAnchor="middle"
                  className="pointer-events-none select-none fill-white font-black"
                  style={
                    {
                      fontSize: selectedActive ? 7 : 28,
                      paintOrder: "stroke",
                      stroke: "rgba(15,23,42,0.82)",
                      strokeWidth: selectedActive ? 3 : 4,
                    } as CSSProperties
                  }
                >
                  {region.shortLabel}
                </text>
                <text
                  x={labelX}
                  y={labelY + (selectedActive ? 8 : 21)}
                  textAnchor="middle"
                  className="pointer-events-none select-none fill-white font-black"
                  style={
                    {
                      fontSize: selectedActive ? 5.3 : 15,
                      paintOrder: "stroke",
                      stroke: "rgba(15,23,42,0.82)",
                      strokeWidth: selectedActive ? 2 : 3,
                    } as CSSProperties
                  }
                >
                  {region.seats}석
                </text>
              </g>
            );
          })}
        </g>
      </g>
      {!zoomed && activeRegion && calloutLabel && calloutSeats !== undefined ? (
        <g className="pointer-events-none">
          <rect
            x={Math.max(16, Math.min(268, activeRegionX - 120))}
            y={Math.max(16, activeRegionY - 112)}
            width="240"
            height="92"
            rx="24"
            fill="rgba(15,23,42,0.88)"
            stroke="rgba(255,255,255,0.24)"
          />
          <text
            x={Math.max(16, Math.min(268, activeRegionX - 120)) + 120}
            y={Math.max(16, activeRegionY - 112) + 34}
            textAnchor="middle"
            className="fill-white font-black"
            style={{ fontSize: 25 }}
          >
            {calloutLabel}
          </text>
          <text
            x={Math.max(16, Math.min(268, activeRegionX - 120)) + 120}
            y={Math.max(16, activeRegionY - 112) + 74}
            textAnchor="middle"
            className="fill-blue-100 font-black"
            style={{ fontSize: 30 }}
          >
            {calloutSeats}자리 남음
          </text>
        </g>
      ) : null}
    </svg>
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

  // Wave 1201 (2026-06-06, audit P0): 비멤버 탈출구. /plans는 전체화면(z-75)이라 nav·로그아웃이
  //   가려지고, /·/me·/lookup 모두 비멤버를 /plans로 되돌려 "영원히 못 나가는" 갇힘 발생(owner 우려).
  //   로그아웃 후 공개 메인(비로그인 마스킹 피드)으로 보내 탈출 보장 — 비멤버는 로그아웃 안 하면
  //   /로 가도 다시 /plans로 튕기므로 signOut 필수.
  async function handleExit() {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    window.location.href = "/";
  }
  const [selectedKey, setSelectedKey] = useState("seoul");
  const [selectedDistrictName, setSelectedDistrictName] = useState<
    string | null
  >(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [mapZoomed, setMapZoomed] = useState(false);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "requesting" | "resolving" | "saving" | "success" | "error"
  >("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState("");
  const [manualResults, setManualResults] = useState<AddressOption[]>([]);
  const [manualSearching, setManualSearching] = useState(false);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [homeRegionDraft, setHomeRegionDraft] =
    useState<HomeRegionDraft | null>(null);
  const [locationConfirmDraft, setLocationConfirmDraft] =
    useState<LocationConfirmDraft | null>(null);
  const [pinnedDistrictName, setPinnedDistrictName] = useState<string | null>(
    null,
  );
  const [localSample, setLocalSample] = useState<LocalSampleItem | null>(null);
  const [localSampleLoading, setLocalSampleLoading] = useState(false);
  const [localSampleError, setLocalSampleError] = useState<string | null>(null);
  const selected = useMemo(
    () => REGIONS.find((region) => region.key === selectedKey) ?? REGIONS[0],
    [selectedKey],
  );
  const selectedDistricts = useMemo(
    () => districtSeatsFor(selected),
    [selected],
  );
  const selectedDistrict =
    selectedDistricts.find(
      (district) => district.name === selectedDistrictName,
    ) ??
    selectedDistricts[0] ??
    null;
  const selectedRegionLabel = selectedDistrict?.name ?? selected.shortLabel;
  const selectedSeatUsage = districtUsage(
    selectedDistrict ?? selected.districts[0],
  );
  const selectedRemainingSeats = selectedDistrict?.seats ?? selected.seats;
  const visibleDistricts = useMemo(() => {
    if (!pinnedDistrictName) return selectedDistricts;
    const pinnedDistrict = selectedDistricts.find(
      (district) => district.name === pinnedDistrictName,
    );
    if (!pinnedDistrict) return selectedDistricts;
    return [
      pinnedDistrict,
      ...selectedDistricts.filter(
        (district) => district.name !== pinnedDistrict.name,
      ),
    ];
  }, [pinnedDistrictName, selectedDistricts]);
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

  const handleRegionSelect = (key: string) => {
    const nextRegion =
      REGIONS.find((region) => region.key === key) ?? REGIONS[0];
    const nextDistricts = districtSeatsFor(nextRegion);
    setSelectedKey(key);
    setSelectedDistrictName(nextDistricts[0]?.name ?? null);
    setPinnedDistrictName(null);
    setHomeRegionDraft(null);
    setLocationConfirmDraft(null);
    setHoveredKey(null);
    setMapZoomed(true);
  };

  function handleDistrictSelect(districtName: string) {
    setSelectedDistrictName(districtName);
    if (homeRegionDraft && !homeRegionDraft.label.includes(districtName)) {
      setHomeRegionDraft(null);
    }
  }

  async function getAccessToken() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  useEffect(() => {
    if (step !== 1) return;
    let cancelled = false;

    async function loadLocalSample() {
      setLocalSampleLoading(true);
      setLocalSampleError(null);
      try {
        const params = new URLSearchParams({ district: selectedRegionLabel });
        const res = await fetch(
          `/api/membership/local-sample?${params.toString()}`,
          {
            cache: "no-store",
          },
        );
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          item?: LocalSampleItem | null;
          error?: string;
        } | null;
        if (!res.ok || !json?.ok)
          throw new Error(json?.error || "sample_load_failed");
        if (!cancelled) setLocalSample(json.item ?? null);
      } catch {
        if (!cancelled) {
          setLocalSample(null);
          setLocalSampleError(
            "실제 추천 샘플을 불러오지 못했어요. 잠시 후 다시 확인해주세요.",
          );
        }
      } finally {
        if (!cancelled) setLocalSampleLoading(false);
      }
    }

    void loadLocalSample();
    return () => {
      cancelled = true;
    };
  }, [step, selectedRegionLabel]);

  function selectRegionFromAddress(
    parts: Array<string | null | undefined>,
    districtHint?: string | null,
  ) {
    const key = regionKeyFromAddress(parts);
    if (!key) {
      setLocationStatus("error");
      setLocationError("지역을 찾지 못했어요. 아래에서 직접 선택해주세요.");
      setShowManualSearch(true);
      return false;
    }
    const nextRegion =
      REGIONS.find((region) => region.key === key) ?? REGIONS[0];
    const nextDistricts = districtSeatsFor(nextRegion);
    const hint = districtHint ?? parts.filter(Boolean).at(-1) ?? "";
    const matchedDistrict = nextDistricts.find(
      (district) =>
        hint.includes(district.name) || district.name.includes(hint),
    );
    const nextDistrictName =
      matchedDistrict?.name ?? nextDistricts[0]?.name ?? null;
    setSelectedKey(key);
    setSelectedDistrictName(nextDistrictName);
    setPinnedDistrictName(nextDistrictName);
    setHoveredKey(null);
    setMapZoomed(true);
    setLocationStatus("success");
    setLocationError(null);
    setShowManualSearch(false);
    setLocationConfirmDraft(null);
    return true;
  }

  function confirmLocationDraft() {
    if (!locationConfirmDraft) return;
    const selectedOk = selectRegionFromAddress(
      locationConfirmDraft.parts,
      locationConfirmDraft.districtHint,
    );
    if (!selectedOk) return;
    setHomeRegionDraft(locationConfirmDraft.draft);
    setLocationConfirmDraft(null);
  }

  async function saveHomeRegionDraft() {
    // Wave 1201 (2026-06-06, audit P0): 지도에서 시/도만 탭(zoom)하고 세부 동네 미선택 시 draft=null.
    //   기존 `return true`는 미저장인데 다음 step 통과 → 결제·승인 후 /onboarding/home-region이
    //   "동네 미설정"으로 또 떠 중복 온보딩. 안전망으로 false 반환(진행 차단). UI는 진행 버튼 disable+라벨로 유도.
    if (!homeRegionDraft) return false;
    setLocationStatus("saving");
    setLocationError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        window.location.href = loginHref;
        return false;
      }
      const res = await fetch("/api/user/home-region", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-minyoi-user-action": "1",
        },
        body: JSON.stringify({
          lat: homeRegionDraft.lat,
          lng: homeRegionDraft.lng,
          fullPath: homeRegionDraft.fullPath,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "home_region_save_failed");
      }
      setLocationStatus("success");
      return true;
    } catch {
      setLocationStatus("error");
      setLocationError(
        "동네 저장에 실패했어요. 다시 위치를 불러오거나 직접 검색해주세요.",
      );
      return false;
    }
  }

  function handleLocationLoad() {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationError(
        "이 브라우저는 위치 기능을 지원하지 않아요. 동네를 직접 입력해주세요.",
      );
      setShowManualSearch(true);
      return;
    }
    setLocationStatus("requesting");
    setLocationError(null);
    setLocationConfirmDraft(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocationStatus("resolving");
        try {
          const token = await getAccessToken();
          if (!token) {
            window.location.href = loginHref;
            return;
          }
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const res = await fetch(
            `/api/user/home-region/reverse-geocode?lat=${lat}&lng=${lng}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          const json = (await res.json()) as {
            ok: boolean;
            fullPath?: string;
            region1?: string;
            region2?: string;
            region3?: string;
            error?: string;
          };
          if (!json.ok) {
            setLocationStatus("error");
            setLocationError(
              json.error === "KAKAO_REST_API_KEY missing"
                ? "주소 변환 키가 설정되지 않았어요."
                : "위치를 동네로 바꾸지 못했어요. 직접 입력해주세요.",
            );
            setShowManualSearch(true);
            return;
          }
          if (json.fullPath) {
            const parts = [
              json.region1,
              json.region2,
              json.region3,
              json.fullPath,
            ];
            const draft = {
              lat,
              lng,
              fullPath: json.fullPath,
              label:
                [json.region2, json.region3].filter(Boolean).join(" ") ||
                json.fullPath,
              source: "gps",
            } satisfies HomeRegionDraft;
            setLocationConfirmDraft({
              draft,
              parts,
              districtHint: json.region2 ?? json.region3 ?? null,
            });
            setLocationStatus("success");
          }
        } catch {
          setLocationStatus("error");
          setLocationError(
            "위치 확인 중 오류가 났어요. 동네를 직접 입력해주세요.",
          );
          setShowManualSearch(true);
        }
      },
      (err) => {
        setLocationStatus("error");
        setShowManualSearch(true);
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? "위치 권한이 거부됐어요. 동네를 직접 입력해주세요."
            : "위치를 가져오지 못했어요. 동네를 직접 입력해주세요.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    );
  }

  async function handleManualSearch() {
    const q = manualQuery.trim();
    if (q.length < 2) {
      setLocationError("동네 이름을 2글자 이상 입력해주세요.");
      return;
    }
    setManualSearching(true);
    setLocationError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        window.location.href = loginHref;
        return;
      }
      const res = await fetch(
        `/api/user/home-region/search?q=${encodeURIComponent(q)}&limit=8`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const json = (await res.json()) as {
        ok: boolean;
        results?: AddressOption[];
        error?: string;
      };
      if (!json.ok) {
        setLocationError(
          json.error === "KAKAO_REST_API_KEY missing"
            ? "주소 검색 키가 설정되지 않았어요."
            : "주소 검색에 실패했어요.",
        );
        setManualResults([]);
        return;
      }
      setManualResults(json.results ?? []);
      if ((json.results ?? []).length === 0)
        setLocationError("검색 결과가 없어요. 다른 동네명으로 입력해주세요.");
    } catch {
      setLocationError("주소 검색 중 오류가 났어요.");
      setManualResults([]);
    } finally {
      setManualSearching(false);
    }
  }

  return (
    <main className="fixed inset-0 z-[75] overflow-hidden bg-[#f4f7fb] text-zinc-950 dark:bg-zinc-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(49,130,246,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_34%)]" />
      <div className="relative mx-auto flex h-full w-full max-w-[1180px] flex-col px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-[calc(env(safe-area-inset-top)+12px)] sm:px-5 sm:py-5">
        <section
          className={`relative min-h-0 flex-1 overflow-hidden ${
            step === 3
              ? "bg-transparent shadow-none"
              : "rounded-[30px] border border-zinc-200 bg-white shadow-[0_24px_90px_rgba(15,23,42,0.14)] dark:border-zinc-800 dark:bg-zinc-900"
          }`}
        >
          {step === 0 ? (
            <div className="grid h-full min-h-0 gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-h-0 border-b border-zinc-200 p-4 pb-2 dark:border-zinc-800 sm:p-6 lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="break-keep pr-6 text-[30px] font-black leading-[1.01] tracking-tight sm:text-[44px]">
                      우리 동네 매물을
                      <br />
                      먼저 독점하세요.
                    </h1>
                  </div>
                  <div className="shrink-0 rounded-full bg-blue-600 px-3 py-2 text-right text-white shadow-[0_12px_34px_rgba(37,99,235,0.3)] sm:px-4">
                    <div className="text-[9px] font-black opacity-80">
                      현재 예약
                    </div>
                    <div className="text-[18px] font-black tabular-nums sm:text-[24px]">
                      {filled}/{capacity}
                    </div>
                  </div>
                </div>
                <div
                  className={`relative mx-auto mt-1 min-h-0 max-w-[620px] lg:mt-2 ${
                    mapZoomed
                      ? "flex h-[calc(100%-118px)] min-h-[430px] flex-col"
                      : "h-[390px] sm:h-[calc(100%-154px)] sm:min-h-[350px] sm:max-h-[590px] lg:h-[calc(100%-120px)]"
                  }`}
                >
                  <div
                    className={`relative min-h-0 ${mapZoomed ? "h-[48%] min-h-[220px] overflow-hidden rounded-[24px] border border-zinc-200 bg-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-950/50" : "h-full"}`}
                  >
                    {mapZoomed ? (
                      <button
                        type="button"
                        onClick={() => setMapZoomed(false)}
                        className="absolute left-2 top-2 z-10 rounded-full border border-zinc-200 bg-white/86 px-3 py-2 text-[12px] font-black text-zinc-700 shadow-[0_10px_28px_rgba(15,23,42,0.16)] backdrop-blur dark:border-zinc-700 dark:bg-zinc-950/78 dark:text-zinc-100"
                      >
                        전국 보기
                      </button>
                    ) : null}
                    <KoreaSeatMap
                      selected={selected}
                      selectedDistricts={selectedDistricts}
                      hoveredKey={hoveredKey}
                      zoomed={mapZoomed}
                      onSelect={handleRegionSelect}
                      onHover={setHoveredKey}
                    />
                  </div>
                  {mapZoomed ? (
                    <div className="mt-2 flex min-h-0 flex-1 flex-col rounded-[24px] border border-zinc-200 bg-[#fbfcff] shadow-[0_14px_34px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-950/80">
                      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                        {visibleDistricts.map((district) => {
                          const active =
                            district.name === selectedDistrict?.name;
                          const usage = districtUsage(district);
                          const tone = seatTone(district.seats, usage.total);
                          const pinned = district.name === pinnedDistrictName;
                          return (
                            <button
                              key={district.name}
                              type="button"
                              onClick={() =>
                                handleDistrictSelect(district.name)
                              }
                              className={`mb-1.5 grid w-full grid-cols-[minmax(0,1fr)_58px_74px] items-center gap-2 rounded-2xl border px-3 py-2 text-left transition ${
                                active
                                  ? "border-blue-500 bg-blue-50 shadow-[0_8px_18px_rgba(37,99,235,0.16)] ring-2 ring-blue-500/35 dark:border-blue-300 dark:bg-blue-950/50 dark:ring-blue-300/45"
                                  : "border-zinc-200 bg-white hover:border-blue-200 dark:border-zinc-800 dark:bg-zinc-900/78"
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <span className="truncate text-[15px] font-black">
                                    {district.name}
                                  </span>
                                  {pinned ? (
                                    <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800">
                                      내 위치
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                                  <div
                                    className={`h-full rounded-full ${tone.bar}`}
                                    style={{
                                      width: `${Math.min(100, Math.round((usage.filled / usage.total) * 100))}%`,
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="text-center">
                                <div
                                  className={`inline-flex min-w-[46px] justify-center rounded-full px-2 py-1 text-[13px] font-black tabular-nums ring-1 ${tone.badge}`}
                                >
                                  {usage.filled}/{usage.total}
                                </div>
                                <div className="mt-0.5 text-[10px] font-black text-zinc-400">
                                  {pressureLabel(district.pressure)}
                                </div>
                              </div>
                              <div className="text-right">
                                <div
                                  className={`text-[15px] font-black ${tone.text}`}
                                >
                                  {district.seats}석
                                </div>
                                <div className="mt-0.5 text-[10px] font-black text-zinc-400">
                                  남음
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {showManualSearch && !mapZoomed ? (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/48 px-4 py-6 backdrop-blur-sm">
                      <div className="w-full max-w-[360px] rounded-[28px] border border-zinc-200 bg-white p-5 text-left shadow-[0_28px_80px_rgba(15,23,42,0.28)] dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="text-center text-[10px] font-black uppercase tracking-[0.14em] text-[#3182f6] dark:text-blue-300">
                          수동 입력
                        </div>
                        <div className="mt-2 break-keep text-center text-[24px] font-black leading-tight text-zinc-950 dark:text-zinc-50">
                          동네를 직접 입력해주세요.
                        </div>
                        <div className="mt-2 break-keep text-center text-[13px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
                          예: 서초구, 상도동, 포항시
                        </div>
                        <div className="mt-5 flex gap-2">
                          <input
                            value={manualQuery}
                            onChange={(event) =>
                              setManualQuery(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter")
                                void handleManualSearch();
                            }}
                            placeholder="예: 서초구, 상도동, 포항시"
                            className="h-11 min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white px-3 text-[14px] font-bold outline-none transition focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900"
                          />
                          <button
                            type="button"
                            onClick={() => void handleManualSearch()}
                            disabled={manualSearching}
                            className="h-11 shrink-0 rounded-2xl bg-zinc-950 px-4 text-[13px] font-black text-white disabled:opacity-55 dark:bg-white dark:text-zinc-950"
                          >
                            {manualSearching ? "검색 중" : "검색"}
                          </button>
                        </div>
                        {locationError ? (
                          <div className="mt-2 break-keep text-[12px] font-bold text-red-500">
                            {locationError}
                          </div>
                        ) : null}
                        {manualResults.length > 0 ? (
                          <div className="mt-2 max-h-36 overflow-y-auto">
                            {manualResults.map((result) => (
                              <button
                                key={`${result.fullPath}-${result.lat}-${result.lng}`}
                                type="button"
                                onClick={() => {
                                  const selectedOk = selectRegionFromAddress(
                                    [
                                      result.region1,
                                      result.region2,
                                      result.region3,
                                      result.fullPath,
                                    ],
                                    result.region2 || result.region3,
                                  );
                                  if (selectedOk) {
                                    setHomeRegionDraft({
                                      lat: result.lat,
                                      lng: result.lng,
                                      fullPath: result.fullPath,
                                      label:
                                        [result.region2, result.region3]
                                          .filter(Boolean)
                                          .join(" ") || result.fullPath,
                                      source: "manual",
                                    });
                                  }
                                }}
                                className="mb-1.5 w-full rounded-2xl border border-zinc-200 bg-[#fbfcff] px-3 py-2 text-left text-[13px] font-black transition hover:border-blue-300 dark:border-zinc-800 dark:bg-zinc-900"
                              >
                                <span className="block truncate">
                                  {result.fullPath}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {locationConfirmDraft && !mapZoomed ? (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/48 px-4 py-6 backdrop-blur-sm">
                      <div className="w-full max-w-[360px] rounded-[28px] border border-emerald-200 bg-white p-5 text-left shadow-[0_28px_80px_rgba(15,23,42,0.28)] dark:border-emerald-400/25 dark:bg-zinc-950">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-[22px] font-black text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800">
                          ✓
                        </div>
                        <div className="text-center text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                          내 동네 확인
                        </div>
                        <div className="mt-2 break-keep text-center text-[24px] font-black leading-tight text-zinc-950 dark:text-zinc-50">
                          {locationConfirmDraft.draft.label} 맞나요?
                        </div>
                        <div className="mt-2 break-keep text-center text-[13px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
                          이 동네 기준으로 지역 티오를 확인합니다.
                        </div>
                        <div className="mt-5 grid grid-cols-[0.72fr_1.28fr] gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setLocationConfirmDraft(null);
                              setShowManualSearch(true);
                            }}
                            className="h-12 rounded-2xl border border-zinc-200 bg-white text-[13px] font-black text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                          >
                            아니요
                          </button>
                          <button
                            type="button"
                            onClick={confirmLocationDraft}
                            className="h-12 rounded-2xl bg-[#3182f6] text-[14px] font-black text-white shadow-[0_14px_34px_rgba(49,130,246,0.28)] transition hover:bg-[#1c64dd]"
                          >
                            맞아요
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <aside className="hidden min-h-0 flex-col p-4 sm:p-5 lg:flex">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                      {mapZoomed ? "선택 지역" : "지역 티오"}
                    </div>
                    <h2 className="mt-1 break-keep text-[28px] font-black tracking-tight">
                      {mapZoomed ? selected.label : "지도에서 선택"}
                    </h2>
                  </div>
                  {mapZoomed ? (
                    <span
                      className="rounded-full px-3 py-1.5 text-[11px] font-black text-white"
                      style={{
                        backgroundColor: pressureFill(selected.pressure),
                      }}
                    >
                      {pressureLabel(selected.pressure)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-[#f5f7fb] px-3 py-3 dark:bg-zinc-950">
                    <div className="text-[10px] font-black text-zinc-400">
                      {mapZoomed ? "남은 티오" : "전체 남은 자리"}
                    </div>
                    <div className="mt-1 text-[28px] font-black">
                      {mapZoomed ? selected.seats : capacity - filled}석
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[#f5f7fb] px-3 py-3 dark:bg-zinc-950">
                    <div className="text-[10px] font-black text-zinc-400">
                      예약률
                    </div>
                    <div className="mt-1 text-[28px] font-black">
                      {mapZoomed
                        ? Math.round(selected.pressure * 100)
                        : filledPct}
                      %
                    </div>
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
                        onClick={() => handleRegionSelect(region.key)}
                        className={`h-7 rounded-lg border px-1 text-center text-[10px] font-black transition ${
                          mapZoomed && region.key === selected.key
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
                    {mapZoomed ? "세부 티오" : "대표 지역"}
                  </div>
                  <div className="mt-2 break-keep text-[12px] font-black leading-5">
                    {mapZoomed && selectedDistrict
                      ? `${selectedDistrict.name} ${selectedDistrict.seats}자리 남음`
                      : "지도에서 지역을 선택하면 남은 티오를 확인합니다."}
                  </div>
                </div>
              </aside>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex h-full min-h-0 flex-col justify-center p-4 sm:p-8">
              <div className="mx-auto w-full max-w-[880px]">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3182f6] dark:text-blue-300">
                      real feed sample
                    </div>
                    <h1 className="mt-2 break-keep text-[30px] font-black leading-[1.02] tracking-tight sm:text-[54px]">
                      지금 {selectedRegionLabel}에
                      <br />
                      차익 매물이 있어요.
                    </h1>
                  </div>
                  <div
                    className={`rounded-[22px] px-4 py-3 text-right ring-1 ${seatTone(selectedRemainingSeats, selectedSeatUsage.total).badge}`}
                  >
                    <div className="text-[10px] font-black opacity-70">
                      남은 자리
                    </div>
                    <div className="text-[24px] font-black leading-none">
                      {selectedRemainingSeats}석
                    </div>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)] dark:border-zinc-800 dark:bg-zinc-950/80">
                  {localSample ? (
                    <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-3 p-3 text-left sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-5 sm:p-5">
                      <div className="relative aspect-square overflow-hidden rounded-[20px] bg-zinc-100 dark:bg-zinc-900">
                        {localSample.thumbnailUrl ||
                        localSample.genericImageUrl ? (
                          <div
                            className="h-full w-full bg-cover bg-center"
                            style={{
                              backgroundImage: `url(${localSample.thumbnailUrl ?? localSample.genericImageUrl})`,
                            }}
                          />
                        ) : (
                          <CategoryWatermark
                            category={localSample.category}
                            comparableKey={localSample.comparableKey}
                            size={76}
                          />
                        )}
                        <CategoryWatermark
                          category={localSample.category}
                          comparableKey={localSample.comparableKey}
                          size={28}
                          variant="corner"
                        />
                      </div>
                      <div className="min-w-0 py-1 sm:py-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black sm:text-[11px]">
                          <MarketplaceSourceBadge
                            source="daangn"
                            label={localSample.sourceLabel}
                          />
                          {localSample.regionName ? (
                            <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                              {localSample.regionName}
                            </span>
                          ) : null}
                          {localSample.medianDaysToSold ? (
                            <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200">
                              평균 {localSample.medianDaysToSold}일 내로 팔려요
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 line-clamp-2 break-keep text-[16px] font-black leading-tight text-zinc-950 dark:text-zinc-50 sm:text-[22px]">
                          {localSample.title}
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-[24px] font-black tabular-nums text-emerald-600 dark:text-emerald-400 sm:text-[38px]">
                            +{formatKrw(localSample.expectedProfit)}
                          </span>
                          {localSample.profitPct != null ? (
                            <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black tabular-nums text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                              +{localSample.profitPct}%
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold text-zinc-500 dark:text-zinc-400 sm:text-[13px]">
                          <span>
                            매입가{" "}
                            <span className="tabular-nums text-zinc-950 dark:text-zinc-50">
                              {formatKrw(localSample.buyPrice)}
                            </span>
                          </span>
                          <span className="text-zinc-300 dark:text-zinc-700">
                            ·
                          </span>
                          <span>
                            시세{" "}
                            <span className="tabular-nums text-zinc-950 dark:text-zinc-50">
                              {formatKrw(localSample.marketPrice)}
                            </span>
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold sm:text-[11px]">
                          {localSample.sold7dCount ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                              최근 7일 판매 {localSample.sold7dCount}건
                            </span>
                          ) : null}
                          {localSample.sampleCount ? (
                            <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                              표본 {localSample.sampleCount}건
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6">
                      <div className="rounded-[22px] bg-zinc-100 px-4 py-5 text-sm font-black text-zinc-500 dark:bg-zinc-900 dark:text-zinc-300">
                        {localSampleLoading
                          ? "실제 피드 샘플을 불러오는 중"
                          : (localSampleError ??
                            "이 지역 샘플 캐시를 준비 중이에요.")}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex h-full flex-col justify-center p-4 sm:p-8">
              <SeatProofToast active={step === 2} />
              <div className="mx-auto w-full max-w-[760px]">
                <div className="overflow-hidden rounded-[30px] border border-blue-100 bg-white text-zinc-950 shadow-[0_28px_80px_rgba(49,130,246,0.14)] ring-1 ring-blue-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:shadow-[0_28px_80px_rgba(15,23,42,0.34)] dark:ring-white/10">
                  <div className="relative p-5 sm:p-7">
                    <div className="absolute right-0 top-0 h-40 w-40 rounded-bl-full bg-[#3182f6]/14 blur-2xl dark:bg-[#3182f6]/30" />
                    <div className="relative flex items-start justify-between gap-4">
                      <div>
                        <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black tracking-[0.02em] text-[#3182f6] ring-1 ring-blue-100 dark:bg-white/10 dark:text-blue-100 dark:ring-white/10">
                          선착순 지역 티오
                        </div>
                        <h1 className="mt-4 break-keep text-[31px] font-black leading-[1.02] tracking-tight sm:text-[54px]">
                          지금 바로 <br className="hidden sm:block" />
                          {selectedRegionLabel} 자리를 차지하세요.
                        </h1>
                      </div>
                      <div className="shrink-0 rounded-[22px] bg-[#3182f6] px-4 py-3 text-right text-white shadow-[0_14px_36px_rgba(49,130,246,0.24)] dark:bg-white dark:text-zinc-950">
                        <div className="text-[10px] font-black tracking-[0.04em] text-white/70 dark:text-zinc-400">
                          남은 자리
                        </div>
                        <div className="mt-1 text-[28px] font-black leading-none tabular-nums">
                          {selectedRemainingSeats}석
                        </div>
                      </div>
                    </div>

                    <p className="relative mt-5 max-w-[590px] break-keep text-[16px] font-bold leading-7 text-zinc-600 dark:text-zinc-300 sm:text-[18px]">
                      전체 중고 매물 중 시세 차익이 보이는 상품은 극소수예요.
                      같은 지역에서 너무 많이 보면 기회가 바로 사라집니다.
                    </p>

                    <div className="relative mt-6 rounded-[22px] bg-[#f5f8ff] p-4 ring-1 ring-blue-100 dark:bg-white/8 dark:ring-white/10">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-black tracking-[0.04em] text-zinc-400">
                            현재 예약
                          </div>
                          <div className="mt-1 text-[20px] font-black tabular-nums text-zinc-950 dark:text-white">
                            {selectedSeatUsage.filled}/{selectedSeatUsage.total}
                            명
                          </div>
                        </div>
                        <div className="rounded-full bg-rose-500 px-3 py-1.5 text-[12px] font-black text-white shadow-[0_10px_24px_rgba(244,63,94,0.25)]">
                          {selectedRemainingSeats <= 2
                            ? "마감 직전"
                            : "마감 임박"}
                        </div>
                      </div>
                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/12">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#3182f6] via-sky-300 to-rose-400"
                          style={{
                            width: `${Math.min(100, Math.max(0, (selectedSeatUsage.filled / selectedSeatUsage.total) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-[22px] border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="text-[11px] font-black text-[#3182f6] dark:text-blue-300">
                      희소성
                    </div>
                    <div className="mt-1 break-keep text-[14px] font-black leading-5">
                      차익 후보만 추립니다
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="text-[11px] font-black text-rose-500 dark:text-rose-300">
                      지역 제한
                    </div>
                    <div className="mt-1 break-keep text-[14px] font-black leading-5">
                      같은 지역 접근을 줄입니다
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex h-full min-h-0 flex-col justify-start overflow-y-auto px-1 py-1 sm:p-8">
              <div className="mx-auto w-full max-w-[760px] pb-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="mb-2 inline-flex h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white/92 px-4 text-[13px] font-black text-zinc-700 shadow-[0_10px_24px_rgba(15,23,42,0.10)] backdrop-blur transition hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/85 dark:text-zinc-200"
                >
                  ← 뒤로
                </button>
                <MembershipApplicationClient
                  isAuthed={isAuthed}
                  isMember={isMember}
                  loginHref={loginHref}
                  plans={plans}
                  pendingApplication={pendingApplication}
                  suppressFixedCta
                  autoOpenSelector
                  reservedRegionLabel={selectedRegionLabel}
                />
              </div>
            </div>
          ) : null}
        </section>

        {!isLast ? (
          <footer className="mt-2 flex h-12 shrink-0 items-center justify-between gap-3">
            {canGoBack ? (
              <button
                type="button"
                onClick={() => setStep((prev) => Math.max(0, prev - 1))}
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-5 text-[14px] font-black text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                이전
              </button>
            ) : isAuthed ? (
              // Wave 1201 (audit P0): step 0(첫 진입, 이전 없음)에서 비멤버가 갇히지 않도록 "나가기" 노출.
              <button
                type="button"
                onClick={() => void handleExit()}
                className="h-11 rounded-2xl border border-zinc-200 bg-white px-5 text-[14px] font-black text-zinc-500 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
              >
                나가기
              </button>
            ) : null}
            <button
              type="button"
              onClick={async () => {
                if (step === 0 && !mapZoomed) {
                  if (locationConfirmDraft) {
                    confirmLocationDraft();
                    return;
                  }
                  handleLocationLoad();
                  return;
                }
                if (step === 0 && mapZoomed) {
                  const saved = await saveHomeRegionDraft();
                  if (!saved) return;
                }
                setStep((prev) => Math.min(3, prev + 1));
              }}
              disabled={
                step === 0 &&
                (locationStatus === "requesting" ||
                  locationStatus === "resolving" ||
                  locationStatus === "saving" ||
                  // Wave 1201 (audit P0): 지도 확대 후 세부 동네 미선택이면 진행 차단 (중복 온보딩 방지)
                  (mapZoomed && !homeRegionDraft))
              }
              className="h-11 flex-1 rounded-2xl bg-[#3182f6] px-5 text-[15px] font-black text-white shadow-[0_18px_44px_rgba(49,130,246,0.28)] transition hover:bg-[#1c64dd] sm:min-w-[240px]"
            >
              {step === 0
                ? mapZoomed
                  ? homeRegionDraft
                    ? "이 지역으로 계속"
                    : "지도에서 우리 동네를 선택하세요"
                  : locationConfirmDraft
                    ? "맞아요, 세부 지역 보기"
                    : locationStatus === "requesting"
                      ? "위치 권한 확인 중..."
                      : locationStatus === "resolving"
                        ? "동네 확인 중..."
                        : locationStatus === "saving"
                          ? "동네 저장 중..."
                          : "내 위치 불러오기"
                : step === 2
                  ? "지금 바로 자리 차지하기"
                  : "다음"}
            </button>
          </footer>
        ) : null}
      </div>
    </main>
  );
}
