import type { DetailData } from "@/lib/bunjang";

export type SoldOutSignal =
  | "fetch_failed"
  | "sale_status_inactive"
  | "description_traded"
  | "text_traded"
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

export function isActiveSaleStatus(value: unknown): boolean {
  const status = String(value ?? "").trim().toUpperCase();
  return ACTIVE_SALE_STATUSES.has(status);
}

function normalizedText(text: unknown) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(text: unknown) {
  return normalizedText(text).replace(/\s+/g, "");
}

export function soldOutTextHits(...texts: unknown[]): string[] {
  const raw = texts.map((text) => String(text ?? "")).join("\n");
  const normalized = normalizedText(raw);
  const compact = compactText(raw);
  if (!normalized) return [];

  const hits = TRADED_KEYWORDS.filter((keyword) => {
    const normalizedKeyword = normalizedText(keyword);
    const compactKeyword = compactText(keyword);
    if (!normalizedKeyword || !compactKeyword) return false;
    return normalized.includes(normalizedKeyword) || compact.includes(compactKeyword);
  });

  if (hits.length === 0) return [];
  if (/(판매완료|거래완료|판매완|거래완|예약중|예약완료|구매완료)(?:아님|아니|아닙니다|전\s*아님|전\s*아니)/.test(compact)) {
    return [];
  }
  if (/(판매완료|거래완료|판매완|거래완)(?:시|되면|후)(?:삭제|내림|내립니다)/.test(compact)) {
    return [];
  }
  return [...new Set(hits)];
}

export function detectSoldOut(
  detail: DetailData | null,
  currentPrice?: number | null,
  context?: { title?: string | null; description?: string | null },
): SoldOutSignal[] {
  const signals: SoldOutSignal[] = [];
  if (!detail) {
    signals.push("fetch_failed");
    return signals;
  }
  const status = (detail.saleStatus ?? "").toString().trim().toUpperCase();
  if (status && !isActiveSaleStatus(status)) {
    signals.push("sale_status_inactive");
  }
  const desc = (detail.description ?? "").toLowerCase();
  if (soldOutTextHits(desc).length > 0) {
    signals.push("description_traded");
  }
  const contextText = [context?.title, context?.description].filter(Boolean).join("\n");
  if (contextText && soldOutTextHits(contextText).length > 0) {
    signals.push("text_traded");
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
    signal === "text_traded" ||
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
