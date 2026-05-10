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
  small_appliance: {
    status: "blocked",
    label: "Small Appliance",
    note: "카테고리별 SKU/옵션/노이즈 모델이 아직 없어 후보팩과 시세 학습 모두 보류합니다.",
    minReadyPool: 10,
    minParseRate: 0.9,
    minTrustedKeys: 10,
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
    family === "small_appliance"
  ) {
    return family;
  }
  if (family === "airpods") return "earphone";
  if (family === "applewatch" || family === "galaxywatch") return "smartwatch";
  if (family === "iphone" || family === "galaxy_s") return "smartphone";
  if (family === "ipad" || family === "galaxy_tab") return "tablet";
  if (family === "macbook") return "laptop";
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
