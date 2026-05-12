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
  ps5_disc_digital_standard: {
    status: "ready",
    label: "PlayStation 5 (Standard)",
    note: "PS5 Disc/Digital Standard 단독 narrow lane. Slim/Pro/PSVR/Switch는 catalog mustNotContain으로 차단.",
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
    note: "PS5/Switch broad는 보류. ps5_disc_digital_standard narrow lane만 LANE_READINESS로 별도 ready 처리.",
    minReadyPool: 6,
    minParseRate: 0.9,
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
    family === "small_appliance"
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
