import type { DetailData } from "@/lib/bunjang";

export type SoldOutSignal =
  | "fetch_failed"
  | "sale_status_inactive"
  | "description_traded"
  | "price_zero"
  | "missing_data";

export type SourceHealthStatus = "healthy" | "degraded" | "unhealthy";

const TRADED_KEYWORDS = [
  "거래완료",
  "판매완료",
  "거래완",
  "판매완",
  "예약중",
  "예약완료",
  "구매완료",
  "거래종료",
  "판매종료",
  "솔드",
  "sold out",
  "sold-out",
  "soldout",
];

const ACTIVE_SALE_STATUSES = new Set(["SELLING", "AVAILABLE", "ON_SALE", "ACTIVE", ""]);

export function detectSoldOut(
  detail: DetailData | null,
  currentPrice?: number | null,
): SoldOutSignal[] {
  const signals: SoldOutSignal[] = [];
  if (!detail) {
    signals.push("fetch_failed");
    return signals;
  }
  const status = (detail.saleStatus ?? "").toString().trim().toUpperCase();
  if (status && !ACTIVE_SALE_STATUSES.has(status)) {
    signals.push("sale_status_inactive");
  }
  const desc = (detail.description ?? "").toLowerCase();
  if (TRADED_KEYWORDS.some((kw) => desc.includes(kw.toLowerCase()))) {
    signals.push("description_traded");
  }
  if (currentPrice != null && currentPrice <= 0) {
    signals.push("price_zero");
  }
  if (!detail.imageUrlTemplate && !detail.thumbnailUrl) {
    signals.push("missing_data");
  }
  return signals;
}

export function isSoldOut(signals: SoldOutSignal[]): boolean {
  return signals.length > 0;
}

export function hasStrongSoldOutSignal(signals: SoldOutSignal[]): boolean {
  return signals.some((signal) => (
    signal === "sale_status_inactive" ||
    signal === "description_traded" ||
    signal === "price_zero"
  ));
}

export function canPermanentlyInvalidateSoldOut(
  signals: SoldOutSignal[],
  sourceHealth: SourceHealthStatus,
): boolean {
  if (signals.length === 0) return false;
  if (sourceHealth === "healthy") return true;
  if (sourceHealth === "degraded") return hasStrongSoldOutSignal(signals);
  return false;
}

export function describeSignals(signals: SoldOutSignal[]): string {
  if (signals.length === 0) return "active";
  return signals.join(",");
}
