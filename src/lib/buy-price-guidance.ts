import { RESELL_SHIPPING_FEE, SAFETY_BUFFER, SELLING_FEE_RATE } from "@/lib/profit";

// Wave 2026-05-19 (외부인 #7 권장 매입가 프레임 — 공유 헬퍼):
// 모달(pack-reveal-modal)과 카드 리스트(user-reveal-dashboard)에서 모두 사용.
// "최대 매입가" 프레임은 일반인이 협상 천장으로 오해 → 손해 위험. "추천/패스" 프레임으로 통일.
// 목표 마진 18% / 패스 임계 10% — 일반인 보호 정책 (메모리: 일반인 친화).

export type BuyPriceGuidanceInput = {
  price: number;
  medianPrice: number | null | undefined;
};

export type BuyPriceVerdict = "good" | "warn" | "danger";

export type BuyPriceGuidance = {
  breakEven: number;
  targetBuy: number;
  passBuy: number;
  currentMarginPct: number;
  verdict: BuyPriceVerdict;
  verdictLabel: string;
  verdictSub: string;
};

export const TARGET_MARGIN_PCT = 0.18;
export const PASS_MARGIN_PCT = 0.10;

export function buyPriceGuidance(input: BuyPriceGuidanceInput): BuyPriceGuidance | null {
  const { price, medianPrice } = input;
  if (medianPrice == null || !Number.isFinite(medianPrice) || medianPrice <= 0) return null;
  if (price == null || !Number.isFinite(price) || price <= 0) return null;

  const sellingFee = Math.round(medianPrice * SELLING_FEE_RATE);
  const resellCost = sellingFee + RESELL_SHIPPING_FEE + SAFETY_BUFFER;
  const breakEven = medianPrice - resellCost;
  if (breakEven <= 0) return null;

  const targetBuy = Math.max(0, breakEven - Math.round(medianPrice * TARGET_MARGIN_PCT));
  const passBuy = Math.max(0, breakEven - Math.round(medianPrice * PASS_MARGIN_PCT));
  if (targetBuy <= 0 || passBuy <= 0) return null;

  const currentMarginPct = Math.round(((breakEven - price) / medianPrice) * 100);
  let verdict: BuyPriceVerdict;
  let verdictLabel: string;
  let verdictSub: string;
  if (currentMarginPct >= 18) {
    verdict = "good";
    verdictLabel = `${currentMarginPct}% 마진 확보`;
    verdictSub = "협상 없이도 충분";
  } else if (currentMarginPct >= 10) {
    verdict = "warn";
    verdictLabel = `${currentMarginPct}% 마진 낮음`;
    verdictSub = "협상 권장";
  } else if (currentMarginPct >= 0) {
    verdict = "danger";
    verdictLabel = `${currentMarginPct}% 마진 — 패스 권장`;
    verdictSub = "손실 위험";
  } else {
    verdict = "danger";
    verdictLabel = "손익분기 미달";
    verdictSub = "현재 가격 손해";
  }

  return { breakEven, targetBuy, passBuy, currentMarginPct, verdict, verdictLabel, verdictSub };
}
