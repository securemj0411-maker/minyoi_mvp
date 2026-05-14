import type { Sku } from "@/lib/catalog";

export type CategoryReadinessStatus = "ready" | "internal_only" | "blocked";

export type CategoryReadinessDecision = {
  category: Sku["category"] | null;
  status: CategoryReadinessStatus;
  canEnterPool: boolean;
  reason: string;
  label: string;
  note?: string;
  minReadyPool?: number;
  laneKey?: string;
};

export type LaneReadinessStatus = "ready" | "blocked";

export type LaneReadinessConfig = {
  status: LaneReadinessStatus;
  label: string;
  note?: string;
};

export type LaneReadinessMap = Record<string, LaneReadinessConfig>;

// Narrow-lane readiness overrides category readiness. A SKU tagged with a
// laneKey here can enter the public candidate pool even if its broader
// category is `internal_only`. Categories without a ready lane stay gated.
export const LANE_READINESS: LaneReadinessMap = {
  camera_body_only_exact_model: {
    status: "ready",
    label: "Camera (body-only exact model)",
    note: "교환식 카메라 body-only narrow lane. lens/번들/킷/액세서리/하자 행은 catalog mustNotContain으로 차단.",
  },
  monitor_benq_xl2540k: {
    status: "ready",
    label: "BenQ ZOWIE XL2540K",
    note: "단일 모델 모니터 narrow lane.",
  },
  speaker_jbl_flip6: {
    status: "ready",
    label: "JBL Flip 6",
    note: "단일 모델 portable speaker narrow lane. broad speaker/PA는 차단 유지.",
  },
  monitor_lg_27up850n: {
    status: "ready",
    label: "LG 27UP850N-W",
    note: "Wave 24: LG UltraFine 4K USB-C narrow lane. distribution 압축으로 pool 미달, sample 누적 대기 상태. 27UL850/27UK850/27UP550/27UP600/27US550 + UltraGear/32\"/24\"는 catalog mustNotContain으로 차단.",
  },
  monitor_lg_27gp850: {
    status: "ready",
    label: "LG UltraGear 27GP850-B",
    note: "Wave 24 fallback: LG UltraGear QHD 165Hz Nano IPS narrow lane. 27GN850/27GP83/27GP95/27GP700 + UltraFine UP/UL/UK + 32\"/24\"는 catalog mustNotContain으로 차단.",
  },
  speaker_bose_soundlink_flex: {
    status: "ready",
    label: "Bose SoundLink Flex",
    note: "Wave 16: Bose SoundLink Flex portable speaker narrow lane. Mini/Revolve/Color/Micro/사운드바는 catalog mustNotContain으로 차단.",
  },
  speaker_sonos_roam: {
    status: "ready",
    label: "Sonos Roam",
    note: "Wave 20: Sonos Roam (1st gen) portable speaker narrow lane. Bunjang 모집단 0건으로 sample 누적 대기 상태. Roam SL/Roam 2/Move/One/Five/Era 등은 catalog mustNotContain으로 차단.",
  },
  speaker_marshall_emberton_ii: {
    status: "ready",
    label: "Marshall Emberton II",
    note: "Wave 20 pivot 1: Sonos Roam Bunjang 0건 → Marshall Emberton II. 16 row apply 했으나 median 150k 압축으로 pool 미달 (JBL Flip 6 패턴 반복). sample 누적 + 가격 하락 대기.",
  },
  speaker_bose_soundlink_mini_ii: {
    status: "ready",
    label: "Bose SoundLink Mini II",
    note: "Wave 20 pivot 2: Marshall Emberton II도 distribution 좁아 Bose SoundLink Mini II로 전환. msrp 219k (2015), 중고 50~130k wider distribution.",
  },
  home_appliance_dyson_v12_detect_slim: {
    status: "ready",
    label: "Dyson V12 Detect Slim",
    note: "Wave 19: 단일 모델 stick vacuum narrow lane. V6/V7/V8/V10/V11/V15/Gen5/Outsize/Omni-glide 등은 catalog mustNotContain으로 차단.",
  },
  desktop_imac_m3_24: {
    status: "ready",
    label: "iMac M3 24\"",
    note: "Wave 22: Apple iMac M3 24-inch (2023) narrow lane. M1/M2/M4/Intel + 27\"/21\" 이전 세대 + Mac Studio/mini/Pro/MacBook은 catalog mustNotContain으로 차단.",
  },
  home_appliance_roborock_s8_pro_ultra: {
    status: "ready",
    label: "Roborock S8 Pro Ultra",
    note: "Wave 21: 단일 모델 robot vacuum narrow lane. S8 base/S8+/S8 MaxV/Qrevo/S7/Q-series 등은 catalog mustNotContain으로 차단.",
  },
  ps5_disc_digital_standard: {
    status: "ready",
    label: "PlayStation 5 (Standard)",
    note: "PS5 Disc/Digital Standard 단독 narrow lane. Slim/Pro/PSVR/Switch는 catalog mustNotContain으로 차단.",
  },
  // Wave 93 (2026-05-15): pollution audit 통과 narrow lane 3개. shoe/bag/bike 카테고리는
  // internal_only 유지 (broad coverage 부족). 단 아래 SKU는 결정론 충분 + 표본 양호로 ready 승격.
  shoe_salomon_xt6_black: {
    status: "ready",
    label: "Salomon XT-6 Black",
    note: "Wave 93: n=31, pollution 0%, median ₩156k. 본품만 정책 + cross-color reject 정밀. description 짧지만 결정론 충분 (사이즈+컨디션). MM6/Margiela 콜라보 + 키즈 사이즈 차단.",
  },
  bike_trek_emonda_sl5: {
    status: "ready",
    label: "Trek Emonda SL5",
    note: "Wave 93: n=39, pollution 2.6%, median ₩1,710k. 카테고리 토큰 (자전거/sram/시마노 등) + 부품/전기자전거 reject 적용. 프레임 사이즈/사고 여부 UI 가이드 필수.",
  },
  bike_merida_bignine: {
    status: "ready",
    label: "Merida Big Nine MTB",
    note: "Wave 93: n=15, pollution 0%, median ₩750k. MTB hardtail. e-BIG.NINE/team 등급은 mustNotContain 차단. 프레임 사이즈/사고 여부 UI 가이드 필수.",
  },
  ipad_pro_11_m4_256_wifi: {
    status: "ready",
    label: "iPad Pro 11\" M4 256GB Wi-Fi",
    note: "단일 변형 narrow lane. 13인치/셀룰러/M1~M3/타 용량은 catalog mustNotContain으로 차단.",
  },
  iphone_15_pro_128gb_self: {
    status: "ready",
    label: "iPhone 15 Pro 128GB (자급제)",
    note: "자급제 + 128GB + 비-Pro Max만. 통신사 약정/완납폰/리퍼/타 용량은 catalog mustNotContain으로 차단.",
  },
  macbook_air_m3_13_256: {
    status: "ready",
    label: "MacBook Air M3 13\" 256GB",
    note: "laptop_broad의 첫 narrow exit. M3 칩 + 13인치 + 256GB만. M1/M2/M4, 15인치, MacBook Pro, 부품/액정/메인보드 매물은 catalog mustNotContain으로 차단.",
  },
  airpods_max_usbc: {
    status: "ready",
    label: "AirPods Max (USB-C, 2024)",
    note: "AirPods Max USB-C 신형 narrow lane. Lightning 구형은 catalog mustNotContain으로 분리.",
  },
  ipad_pro_13_m4_256_wifi: {
    status: "ready",
    label: "iPad Pro 13\" M4 256GB Wi-Fi",
    note: "11\" sibling lane (ipad_pro_11_m4_256_wifi)와 분리. 셀룰러/타 용량/타 chip 차단.",
  },
  iphone_16_pro_128gb_self: {
    status: "ready",
    label: "iPhone 16 Pro 128GB (자급제)",
    note: "iphone_15_pro_128gb_self의 16세대 sibling. Pro Max/15/17/통신사 차단.",
  },
  ipad_air_m2_11_256_wifi: {
    status: "ready",
    label: "iPad Air M2 11\" 256GB Wi-Fi",
    note: "iPad Pro M4의 보급형 sibling. M1/M3, 13인치, 셀룰러, 타 용량은 catalog mustNotContain으로 차단.",
  },
  galaxy_s25_ultra_256_self: {
    status: "ready",
    label: "Galaxy S25 Ultra 256GB (자급제)",
    note: "S24/S26, 512/1TB, 통신사 약정/완납폰/리퍼는 catalog mustNotContain으로 차단.",
  },
  ipad_air_m3_11_256_wifi: {
    status: "ready",
    label: "iPad Air M3 11\" 256GB Wi-Fi",
    note: "M3 신모델 (2025) narrow lane. M1/M2/M4, 13인치, 셀룰러는 catalog로 차단.",
  },
  galaxy_tab_s10_ultra_256_self: {
    status: "ready",
    label: "Galaxy Tab S10 Ultra 256GB (자급제)",
    note: "S10 Ultra Wi-Fi 256GB 자급제 narrow lane. S9/S11/FE/셀룰러/통신사는 catalog로 차단.",
  },
  macbook_pro_14_m3_18_512: {
    status: "ready",
    label: "MacBook Pro 14\" M3 18GB 512GB",
    note: "MacBook Air sibling. M1/M2/M4, 16인치, Air, 타 RAM/SSD는 catalog로 차단.",
  },
  lg_gram_17_2024: {
    status: "ready",
    label: "LG 그램 17\" 2024 (16GB 512GB)",
    note: "한국 인기 laptop narrow. 14/15/16인치, gram pro, 구세대(2020-2023)는 catalog로 차단.",
  },
  iphone_14_pro_128gb_self: {
    status: "ready",
    label: "iPhone 14 Pro 128GB (자급제)",
    note: "iPhone 15/16 Pro 자급제 sibling. 13/15세대, Pro Max, 통신사는 catalog로 차단.",
  },
  galaxy_s24_ultra_256_self: {
    status: "ready",
    label: "Galaxy S24 Ultra 256GB (자급제)",
    note: "S25 자급제 sibling. S22/S23/S25, 512/1TB, 통신사는 catalog로 차단.",
  },
  ps5_slim: {
    status: "ready",
    label: "PlayStation 5 Slim (Disc/Digital)",
    note: "PS5 Slim 2023-11 narrow lane. Standard sibling은 ps5_disc_digital_standard. Pro/PSVR/Switch/액세서리는 catalog mustNotContain으로 분리.",
  },
  iphone_13_pro_128gb_self: {
    status: "ready",
    label: "iPhone 13 Pro 128GB (자급제)",
    note: "iPhone 14/15/16 Pro 자급제 sibling.",
  },
  iphone_12_pro_128gb_self: {
    status: "ready",
    label: "iPhone 12 Pro 128GB (자급제)",
    note: "구형 자급제 narrow lane. Pro Max/미니/통신사는 catalog로 차단.",
  },
  galaxy_s23_ultra_256_self: {
    status: "ready",
    label: "Galaxy S23 Ultra 256GB (자급제)",
    note: "S22/S24/S25 sibling 차단.",
  },
  ipad_pro_11_m2_256_wifi: {
    status: "ready",
    label: "iPad Pro 11\" M2 256GB Wi-Fi",
    note: "M4 sibling. M1/M3/M4, 13인치, 셀룰러 차단.",
  },
  ipad_mini_7_128_wifi: {
    status: "ready",
    label: "iPad mini 7 (A17 Pro) 128GB Wi-Fi",
    note: "신모델. mini 5/6, M-chip, 256+ 차단.",
  },
  ipad_pro_13_m2_256_wifi: {
    status: "ready",
    label: "iPad Pro 13\" M2 256GB Wi-Fi",
    note: "M4 13\" sibling. 11\"/M1/M3/M4/셀룰러/타 용량은 catalog로 차단.",
  },
  macbook_air_m2_13_256: {
    status: "ready",
    label: "MacBook Air M2 13\" 256GB",
    note: "M3 sibling. M1/M3/M4, 15인치, MacBook Pro, 타 RAM/SSD는 catalog로 차단.",
  },
  iphone_11_pro_128gb_self: {
    status: "ready",
    label: "iPhone 11 Pro 128GB (자급제)",
    note: "구형 자급제 narrow lane. Pro Max/12/통신사/리퍼는 catalog로 차단.",
  },
  galaxy_z_flip_5_256_self: {
    status: "ready",
    label: "Galaxy Z Flip 5 256GB (자급제)",
    note: "Flip 4/6, Fold, 512/1TB, 통신사는 catalog로 차단.",
  },
  switch_oled: {
    status: "ready",
    label: "Nintendo Switch OLED",
    note: "OLED 단독 narrow lane. v1/Lite/Switch 2/PS는 catalog로 차단.",
  },
  // Wave 75: Wave 67 신 SKU 측정 결과 ready 승격 (parseRate ≥ 90% + NRfalse ≥ 5).
  watch_gshock_dw5600: {
    status: "ready",
    label: "Casio G-Shock DW-5600",
    note: "Wave 67/74: 모델 코드 DW-5600 strict. 56 raw, parseRate 91% (NRfalse 51) 측정 후 승격.",
  },
  sport_golf_titleist_tsr2_driver: {
    status: "ready",
    label: "Titleist TSR2 Driver",
    note: "Wave 67/74: TSR2 + 드라이버 strict. 47 raw, parseRate 100% 측정 후 승격.",
  },
  sport_golf_titleist_tsr3_driver: {
    status: "ready",
    label: "Titleist TSR3 Driver",
    note: "Wave 67/74: TSR3 + 드라이버 strict. 18 raw, parseRate 100% 측정 후 승격.",
  },
  // 미진입 (측정 불충분): watch_gshock_ga2100 (NRtrue 28건, 옛 parser version), watch_gshock_gmwb5000 (parseRate 55%),
  // watch_seiko_5_sports_srpd (1건), watch_seiko_5_sports_sbsa (0건), camera_sony_a6400 (production 0건)
};

export type CategoryReadinessConfig = {
  status: CategoryReadinessStatus;
  label: string;
  note: string;
  minReadyPool: number;
  minParseRate: number;
  minTrustedKeys: number;
  lastMeasuredAt?: string | null;
  operatorNote?: string;
};

export const CATEGORY_READINESS: Record<Sku["category"], CategoryReadinessConfig> = {
  earphone: {
    status: "ready",
    label: "Audio",
    note: "AirPods 계열은 SKU/노이즈/커넥터 파서가 후보팩 최소 기준을 통과했습니다.",
    minReadyPool: 6,
    minParseRate: 0.85,
    minTrustedKeys: 5,
  },
  smartwatch: {
    status: "ready",
    label: "Watch",
    note: "Apple Watch/Galaxy Watch는 사이즈·셀룰러·모델 파서가 후보팩 최소 기준을 통과했습니다.",
    minReadyPool: 6,
    minParseRate: 0.8,
    minTrustedKeys: 5,
  },
  smartphone: {
    status: "internal_only",
    label: "Mobile Phone",
    note: "용량·배터리효율·자급제/통신사·파손 상태 검증이 더 필요해 시세 학습만 허용합니다.",
    minReadyPool: 8,
    minParseRate: 0.9,
    minTrustedKeys: 10,
  },
  tablet: {
    status: "internal_only",
    label: "Tablet",
    note: "세대·용량·Wi-Fi/Cellular·펜/키보드 포함 여부 검증 전까지 시세 학습만 허용합니다.",
    minReadyPool: 8,
    minParseRate: 0.88,
    minTrustedKeys: 8,
  },
  laptop: {
    status: "internal_only",
    label: "PC/Laptop",
    note: "칩·연식·RAM·SSD·화면 크기·배터리 사이클 파서 검증 전까지 시세 학습만 허용합니다.",
    minReadyPool: 8,
    minParseRate: 0.85,
    minTrustedKeys: 8,
  },
  monitor: {
    status: "internal_only",
    label: "Monitor",
    note: "모델코드·인치·해상도·주사율 파서 골격만 열었고, 카탈로그 승격과 공개 후보팩은 보류합니다.",
    minReadyPool: 8,
    minParseRate: 0.85,
    minTrustedKeys: 8,
  },
  speaker: {
    status: "internal_only",
    label: "Speaker",
    note: "JBL/LG portable exact-model 5개만 내부 파싱 후보로 열고, broad speaker/audio 공개 후보팩은 보류합니다.",
    minReadyPool: 8,
    minParseRate: 0.9,
    minTrustedKeys: 5,
  },
  camera: {
    status: "internal_only",
    label: "Camera",
    note: "교환식 카메라 body-only exact-model만 내부 파싱 후보로 열고, 렌즈/킷/컴팩트/액세서리/하자/구매 행은 보류합니다.",
    minReadyPool: 8,
    minParseRate: 0.9,
    minTrustedKeys: 5,
  },
  small_appliance: {
    status: "blocked",
    label: "Small Appliance",
    note: "카테고리별 SKU/옵션/노이즈 모델이 아직 없어 후보팩과 시세 학습 모두 보류합니다.",
    minReadyPool: 10,
    minParseRate: 0.9,
    minTrustedKeys: 10,
  },
  game_console: {
    status: "internal_only",
    label: "Game Console",
    note: "PS5/Switch broad는 보류. ps5_disc_digital_standard + ps5_slim narrow lane만 LANE_READINESS로 별도 ready 처리.",
    minReadyPool: 6,
    minParseRate: 0.9,
    minTrustedKeys: 4,
  },
  desktop: {
    status: "ready",
    label: "Desktop",
    note: "Wave 17: Mac mini M2 narrow lane unlock 후 readiness DB row에서 ready.",
    minReadyPool: 1,
    minParseRate: 0.85,
    minTrustedKeys: 3,
  },
  home_appliance: {
    status: "ready",
    label: "Home Appliance",
    note: "Wave 19: Dyson V12 Detect Slim narrow lane unlock 후 readiness DB row에서 ready.",
    minReadyPool: 1,
    minParseRate: 0.85,
    minTrustedKeys: 3,
  },
  // Wave 67: 신 사업 카테고리 — 시계 + 골프. internal_only로 진입, 측정 후 ready 결정.
  watch: {
    status: "internal_only",
    label: "Watch",
    note: "Wave 67: Casio G-Shock + Seiko 5 Sports narrow lane 진입. 모델 코드 명시 매물만 매칭, 가품/액세서리 거름.",
    minReadyPool: 5,
    minParseRate: 0.9,
    minTrustedKeys: 5,
  },
  sport_golf: {
    status: "internal_only",
    label: "Golf",
    note: "Wave 67: Titleist TSR2/TSR3 드라이버 narrow lane 진입. 헤드만/풀세트는 거름, 드라이버 본체만.",
    minReadyPool: 5,
    minParseRate: 0.9,
    minTrustedKeys: 4,
  },
  // Wave 91 (2026-05-15): 일반인 친화 + 차익 가능 카테고리 진입. internal_only로 시작.
  // 측정 후 ready 승격 결정.
  shoe: {
    status: "internal_only",
    label: "Shoes",
    note: "Wave 91: 한정판 스니커즈 (Jordan/Yeezy/Dunk/NB). resale ≤200만, 본품만. 가품 위험 ↑↑ (Panda/Travis Scott 등).",
    minReadyPool: 10,
    minParseRate: 0.85,
    minTrustedKeys: 5,
  },
  bag: {
    status: "internal_only",
    label: "Bags",
    note: "Wave 91: 입문 명품 + 빈티지 (LV/구찌/MCM/프라다). resale ≤200만 cap. 가품 위험 매우 높음 — internal_only 유지 권장.",
    minReadyPool: 10,
    minParseRate: 0.85,
    minTrustedKeys: 5,
  },
  bike: {
    status: "internal_only",
    label: "Bicycles",
    note: "Wave 91: 자전거 (Giant/Trek/Cannondale/Specialized/Brompton). resale ≤200만. 도난자전거/사고차 risk → 시리얼/영수증 가이드 필요.",
    minReadyPool: 8,
    minParseRate: 0.8,
    minTrustedKeys: 4,
  },
};

export function categoryFromComparableKey(value: string | null | undefined): Sku["category"] | null {
  const family = value?.split("|")[0] ?? "";
  if (
    family === "earphone" ||
    family === "smartwatch" ||
    family === "smartphone" ||
    family === "tablet" ||
    family === "laptop" ||
    family === "monitor" ||
    family === "speaker" ||
    family === "camera" ||
    family === "game_console" ||
    family === "small_appliance" ||
    family === "home_appliance" ||
    family === "desktop" ||
    family === "watch" ||
    family === "sport_golf"
  ) {
    return family;
  }
  if (family === "airpods") return "earphone";
  if (family === "applewatch" || family === "galaxywatch") return "smartwatch";
  if (family === "iphone" || family === "galaxy_s") return "smartphone";
  if (family === "ipad" || family === "galaxy_tab") return "tablet";
  if (family === "macbook") return "laptop";
  if (family === "display") return "monitor";
  if (family === "ps5" || family === "playstation" || family === "switch") return "game_console";
  return null;
}

export type CategoryReadinessMap = Partial<Record<Sku["category"], CategoryReadinessConfig>>;

type CategoryReadinessDbRow = {
  category: Sku["category"];
  status: CategoryReadinessStatus;
  label: string;
  note: string | null;
  min_ready_pool: number | null;
  min_parse_rate: number | null;
  min_trusted_keys: number | null;
  last_measured_at: string | null;
  operator_note: string | null;
};

function supabaseRest() {
  const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!raw) return null;
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function authHeaders(): Record<string, string> | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function normalizeDbRow(row: CategoryReadinessDbRow): CategoryReadinessConfig {
  const fallback = CATEGORY_READINESS[row.category] ?? {
    status: "blocked" as const,
    label: row.category,
    note: "",
    minReadyPool: 8,
    minParseRate: 0.9,
    minTrustedKeys: 8,
  };
  return {
    status: row.status ?? fallback.status,
    label: row.label ?? fallback.label,
    note: row.note ?? fallback.note,
    minReadyPool: Number(row.min_ready_pool ?? fallback.minReadyPool),
    minParseRate: Number(row.min_parse_rate ?? fallback.minParseRate),
    minTrustedKeys: Number(row.min_trusted_keys ?? fallback.minTrustedKeys),
    lastMeasuredAt: row.last_measured_at,
    operatorNote: row.operator_note ?? "",
  };
}

export async function loadCategoryReadinessMap(): Promise<CategoryReadinessMap> {
  const base = supabaseRest();
  const headers = authHeaders();
  if (!base || !headers) return CATEGORY_READINESS;
  try {
    const res = await fetch(
      `${base}/mvp_category_readiness?select=category,status,label,note,min_ready_pool,min_parse_rate,min_trusted_keys,last_measured_at,operator_note`,
      { headers, cache: "no-store" },
    );
    if (!res.ok) return CATEGORY_READINESS;
    const rows = (await res.json()) as CategoryReadinessDbRow[];
    const fromDb: CategoryReadinessMap = {};
    for (const row of rows) {
      fromDb[row.category] = normalizeDbRow(row);
    }
    return { ...CATEGORY_READINESS, ...fromDb };
  } catch {
    return CATEGORY_READINESS;
  }
}

export function evaluateCategoryReadiness(
  category: Sku["category"] | null | undefined,
  readinessMap: CategoryReadinessMap = CATEGORY_READINESS,
): CategoryReadinessDecision {
  if (!category) {
    return {
      category: null,
      status: "blocked",
      canEnterPool: false,
      reason: "category_unknown",
      label: "Unknown",
    };
  }

  const config = readinessMap[category] ?? CATEGORY_READINESS[category];
  if (!config) {
    return {
      category,
      status: "blocked",
      canEnterPool: false,
      reason: `category_unconfigured_${category}`,
      label: category,
    };
  }

  return {
    category,
    status: config.status,
    canEnterPool: config.status === "ready",
    reason: config.status === "ready" ? "category_ready" : `category_${config.status}_${category}`,
    label: config.label,
    note: config.note,
    minReadyPool: config.minReadyPool,
  };
}

export function categoryReadinessRows(readinessMap: CategoryReadinessMap = CATEGORY_READINESS) {
  return Object.entries(readinessMap).map(([category, config]) => ({
    category: category as Sku["category"],
    ...config,
  }));
}

export function evaluateLaneReadinessForSku(
  sku: Sku | null | undefined,
  laneMap: LaneReadinessMap = LANE_READINESS,
): CategoryReadinessDecision | null {
  const laneKey = sku?.laneKey;
  if (!laneKey) return null;
  const config = laneMap[laneKey];
  if (!config) return null;
  return {
    category: sku?.category ?? null,
    status: config.status === "ready" ? "ready" : "blocked",
    canEnterPool: config.status === "ready",
    reason: config.status === "ready" ? `lane_ready_${laneKey}` : `lane_blocked_${laneKey}`,
    label: config.label,
    note: config.note,
    laneKey,
  };
}

export async function loadLaneReadinessMap(): Promise<LaneReadinessMap> {
  // DB-backed override hook — table not present yet, so we fall back to the
  // in-code map. Mirrors `loadCategoryReadinessMap()` shape so tick-pipeline
  // can `await` both without a special case once a `mvp_lane_readiness`
  // table exists.
  return LANE_READINESS;
}
