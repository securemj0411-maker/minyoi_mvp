# 2026-05-16 — MarketHistoryChart: placeholder price 무시 + 429 친절 메시지

## 트리거
Iteration 8 UI 일관성 검토. Iteration 4의 placeholder price fix와 Iteration 6의 rate limit fix 후속.

## 발견
1. **placeholder currentPrice가 chart 끌어올림**: 매물 price가 999,999,999면 maxP = 1억 → 다른 시세 점이 차트 하단으로 몰림. 그래프 무의미.
2. **rate limit 429 에러 message가 노출**: `HTTP 429` 같은 raw HTTP status code가 사용자에게 보임. 친절도 낮음.

## Fix

### `src/components/market-history-chart.tsx`

1. allPrices push 시 0 ≤ price < 1억 filter. placeholder 자연 제외.
2. `showCurrentPrice = currentPrice != null && currentPrice > 0 && currentPrice < 100_000_000` 변수로 chart 표시 분기. placeholder 매물에선 빨간 dashed line + 박스 라벨 안 그림.
3. 429 에러 시 "잠시 후 다시 시도해주세요 (요청 너무 빠름)" 친절 메시지. 그 외 generic "시세 history 불러오기 실패".

## 검증
- TypeScript: validator.ts 외 무에러.
- ESLint: 무에러.
- 시각 검증: placeholder 매물의 chart에서 빨간 horizontal line + 박스가 안 보임. 다른 시세 점은 정상 분포.

## 영향
- 14건 placeholder 매물의 chart는 정상 시세 점만 표시 (currentPrice 빠짐).
- 429 발생 시 사용자가 raw error code 안 봄.

## 위험
- 진짜 1억+ 매물 (사치품 카메라 등)이 있어도 chart에 안 표시됨. 베타 단계에선 안전.
