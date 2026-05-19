import { RESELL_SHIPPING_FEE, SAFETY_BUFFER, SELLING_FEE_RATE } from "@/lib/profit";

// Wave 325 (사용자 피드백 — 가이드 로직 잘못 박힘):
// 기존 18%/10% 마진 기준은 신발/명품용. 미개봉 IT는 5~10% 마진이 정상.
// → 풀에 있는 거의 모든 매물이 "패스 권장"으로 뜨는 모순.
//
// 우리 풀 정책: 차익 양수 + 안전 마진 통과한 매물만 노출.
// → 사용자는 "이 매물 사도 되나?"가 아니라 "협상 어디까지?" 알고 싶음.
//
// 새 프레임:
//   - 현재 가격 = 매물 매입가 (헤드라인)
//   - 현재 차익 = 남는 돈 (예상 순익)
//   - 협상 목표 = 현재 가격 - 협상 여유 (차익의 30% 또는 최대 2만원)
//   - 손익분기 = 시세 - 비용 (이 이상이면 손해)
//   - verdict = 차익 절대값 기준 (5만+ 충분 / 2만+ 괜찮음 / 1만+ 작음 / 1만 미만 매우 작음)

export type BuyPriceGuidanceInput = {
  price: number;
  medianPrice: number | null | undefined;
};

export type BuyPriceVerdict = "great" | "good" | "fair" | "tight";

export type BuyPriceGuidance = {
  breakEven: number;      // 손익분기 = 시세 - 비용 (이 가격에 사면 수익 0)
  dangerStart: number;    // 차익 1만원 미만 시작 = breakEven - 10000 (사실상 손해 시작 구간)
  currentProfit: number;  // 현재 가격에 사면 남는 돈
  negotiationTarget: number;  // 협상해서 도달 시도할 가격
  negotiationRoom: number;
  negotiationProfit: number;  // 협상 도달 시 남는 돈
  verdict: BuyPriceVerdict;
  verdictLabel: string;
  verdictSub: string;
};

// 위험 임계: 차익 1만원 미만이면 사실상 손해 (잡비/시간 비용 + 시세 변동 흡수 못 함).
export const DANGER_PROFIT_THRESHOLD = 10000;

export function buyPriceGuidance(input: BuyPriceGuidanceInput): BuyPriceGuidance | null {
  const { price, medianPrice } = input;
  if (medianPrice == null || !Number.isFinite(medianPrice) || medianPrice <= 0) return null;
  if (price == null || !Number.isFinite(price) || price <= 0) return null;

  const sellingFee = Math.round(medianPrice * SELLING_FEE_RATE);
  const totalCost = sellingFee + RESELL_SHIPPING_FEE + SAFETY_BUFFER;
  const breakEven = medianPrice - totalCost;
  const currentProfit = breakEven - price;

  // 풀에 있는 매물은 currentProfit > 0 가정. 음수면 (시세 갱신 등) 별도 처리.
  if (currentProfit <= 0) return null;

  // 협상 여유 — 현재 차익의 30% 또는 최대 2만원 (보수적).
  // 일반인이 협상 시 시도해볼만한 폭.
  const negotiationRoom = Math.min(Math.round(currentProfit * 0.3), 20000);
  const negotiationTarget = Math.max(0, price - negotiationRoom);
  const negotiationProfit = breakEven - negotiationTarget;

  // 위험 임계 — 차익 1만원 미만 시작 가격.
  const dangerStart = breakEven - DANGER_PROFIT_THRESHOLD;

  let verdict: BuyPriceVerdict;
  let verdictLabel: string;
  let verdictSub: string;

  if (currentProfit >= 50000) {
    verdict = "great";
    verdictLabel = "충분한 차익 · 협상 없어도 OK";
    verdictSub = "차익이 충분해서 그대로 사도 안전";
  } else if (currentProfit >= 20000) {
    verdict = "good";
    verdictLabel = "괜찮은 차익 · 협상 시 +α";
    verdictSub = `협상되면 더 좋음 (목표 ${formatKrw(negotiationTarget)})`;
  } else if (currentProfit >= 10000) {
    verdict = "fair";
    verdictLabel = "차익 작음 · 협상 권장";
    verdictSub = `${formatKrw(negotiationTarget)} 이하로 협상 시도 권장`;
  } else {
    verdict = "tight";
    verdictLabel = "차익 매우 작음 · 적극 협상 필요";
    verdictSub = `협상 안 되면 패스 고려 — 목표 ${formatKrw(negotiationTarget)}`;
  }

  return {
    breakEven,
    dangerStart,
    currentProfit,
    negotiationTarget,
    negotiationRoom,
    negotiationProfit,
    verdict,
    verdictLabel,
    verdictSub,
  };
}

function formatKrw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}
