import type { Sku } from "@/lib/catalog";

export type CategoryReadinessStatus = "ready" | "internal_only" | "blocked";

export type CategoryReadinessDecision = {
  category: Sku["category"] | null;
  status: CategoryReadinessStatus;
  canEnterPool: boolean;
  reason: string;
  label: string;
};

type CategoryReadinessConfig = {
  status: CategoryReadinessStatus;
  label: string;
  note: string;
};

export const CATEGORY_READINESS: Record<Sku["category"], CategoryReadinessConfig> = {
  earphone: {
    status: "ready",
    label: "Audio",
    note: "AirPods 계열은 SKU/노이즈/커넥터 파서가 후보팩 최소 기준을 통과했습니다.",
  },
  smartwatch: {
    status: "ready",
    label: "Watch",
    note: "Apple Watch/Galaxy Watch는 사이즈·셀룰러·모델 파서가 후보팩 최소 기준을 통과했습니다.",
  },
  smartphone: {
    status: "internal_only",
    label: "Mobile Phone",
    note: "용량·배터리효율·자급제/통신사·파손 상태 검증이 더 필요해 시세 학습만 허용합니다.",
  },
  tablet: {
    status: "internal_only",
    label: "Tablet",
    note: "세대·용량·Wi-Fi/Cellular·펜/키보드 포함 여부 검증 전까지 시세 학습만 허용합니다.",
  },
  laptop: {
    status: "internal_only",
    label: "PC/Laptop",
    note: "칩·연식·RAM·SSD·화면 크기·배터리 사이클 파서 검증 전까지 시세 학습만 허용합니다.",
  },
  small_appliance: {
    status: "blocked",
    label: "Small Appliance",
    note: "카테고리별 SKU/옵션/노이즈 모델이 아직 없어 후보팩과 시세 학습 모두 보류합니다.",
  },
};

export function evaluateCategoryReadiness(category: Sku["category"] | null | undefined): CategoryReadinessDecision {
  if (!category) {
    return {
      category: null,
      status: "blocked",
      canEnterPool: false,
      reason: "category_unknown",
      label: "Unknown",
    };
  }

  const config = CATEGORY_READINESS[category];
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
  };
}

export function categoryReadinessRows() {
  return Object.entries(CATEGORY_READINESS).map(([category, config]) => ({
    category: category as Sku["category"],
    ...config,
  }));
}
