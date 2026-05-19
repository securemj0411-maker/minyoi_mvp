// Wave 329 (사용자 피드백 — 차익 불일치 fix):
// 기존 버그: buyPriceGuidance가 medianPrice + price만 받아서 배송비 무시 → 헤드라인(+21k)과 가이드(+25k) 불일치.
// fix: currentProfit을 외부에서 받음 (헤드라인이 보여주는 정확한 차익).
// 그러면 손익분기/위험/협상 다 일관된 숫자.
//
// 새 프레임:
//   - 현재 매입가 = price (상품가, 사용자가 협상하는 숫자)
//   - 현재 차익 = currentProfit (헤드라인 그대로)
//   - 손익분기(상품가 기준) = price + currentProfit
//   - 위험 임계 = 손익분기 - DANGER_THRESHOLD (1만원)
//   - 협상 목표 = price - 협상 여유 (차익의 30% 또는 최대 2만원)

export type BuyPriceGuidanceInput = {
  price: number;          // 현재 매입가 (상품가, 사용자가 협상하는 숫자)
  currentProfit: number;  // 외부에서 정확히 계산된 차익 (헤드라인 expected_profit_average)
};

export type BuyPriceVerdict = "great" | "good" | "fair" | "tight";

export type BuyPriceGuidance = {
  breakEven: number;      // 손익분기 (상품가 기준) = price + currentProfit (이 이상에 사면 차익 0 이하)
  dangerStart: number;    // 위험 시작 = breakEven - 1만원 (차익 1만 미만)
  currentProfit: number;
  negotiationTarget: number;
  negotiationRoom: number;
  negotiationProfit: number;
  verdict: BuyPriceVerdict;
  verdictLabel: string;
  verdictSub: string;
};

export const DANGER_PROFIT_THRESHOLD = 10000;

export function buyPriceGuidance(input: BuyPriceGuidanceInput): BuyPriceGuidance | null {
  const { price, currentProfit } = input;
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  if (currentProfit == null || !Number.isFinite(currentProfit) || currentProfit <= 0) return null;

  const breakEven = price + currentProfit;
  const dangerStart = breakEven - DANGER_PROFIT_THRESHOLD;

  const negotiationRoom = Math.min(Math.round(currentProfit * 0.3), 20000);
  const negotiationTarget = Math.max(0, price - negotiationRoom);
  const negotiationProfit = currentProfit + negotiationRoom;

  let verdict: BuyPriceVerdict;
  let verdictLabel: string;
  let verdictSub: string;

  if (currentProfit >= 50000) {
    verdict = "great";
    // Wave 394.1 (외부 review #22): 단정형 → 데이터 기준 조건부.
    // Wave 394.7.f (외부 review 2라운드): 차익 큰 매물 = "선점 우선, 네고는 선택".
    // "2만원 깎으려다 놓치는 게 더 손해" — 사용자 짚음.
    verdictLabel = "차익 충분 · 선점 우선";
    verdictSub = "차익 큰 매물 — 네고 시도하다 놓치지 말기. 매입 전 사진/증빙 재확인";
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
