# Wave 157 — Hotdeal 알림 차익을 net으로 통일 + 원 단위 정확 표시

- 시간: 2026-05-17 KST
- 사용자 코멘트: "지금 텔레그램 알림 시세 차익이 뭔가 엄청 이상한데... 차익이랑 시세랑 매입가가 이상함... 운영자풀에서 보이는 정보랑 다름"

## 발견

운영자풀과 hotdeal 알림이 같은 매물에 대해 다른 숫자를 보여줌:

| 항목 | 운영자풀 표시 | hotdeal 알림 표시 (수정 전) |
|---|---|---|
| 매입가 | `₩849,000` (원 단위 정확) | `₩85만` (만원 round) |
| 시세 | `₩1,149,000` | `₩115만` |
| 차익 | `expected_profit_min` = `skuMedian − (price+shipping) − sellingFee(skuMedian × 3.5%) − 3500 − 5000` (net) | `sku_median − price` (raw) |

849k/1149k 매물 기준: 운영자풀 ₩251,285 vs 알림 ₩300,000 → **약 5만원 부풀려짐**.

원인: `hotdeal.ts:68` 에서 raw 차이만 계산. 안전결제 수수료(3.5%)/RESELL_SHIPPING_FEE/SAFETY_BUFFER 미차감.

사용자 메모리 정책 위반: "번개장터 안전결제 의무 → 수익 계산 시 수수료 차감 명시 필요".

## 변경 (src/lib/hotdeal.ts)

1. `CandidateRow` type: `expected_profit_max` 필드 추가
2. `enqueueHotdealsFromPool` select: `expected_profit_min, expected_profit_max` 추가 (운영자풀이 사용하는 동일 필드)
3. `profit_amount` 계산: `p.expected_profit_min > 0 ? p.expected_profit_min : (sku_median - price)` — pool snapshot 비어있는 옛 매물 raw fallback (boot-strap 안전장치)
4. `profit_margin` 재계산: `profit_amount / sku_median` (net 기준으로 자동 변경)
5. `buildAlertText` 만원 round 제거 → 원 단위 정확 표시:
   - `₩85만` → `₩849,000`
   - `₩115만` → `₩1,149,000`
   - `₩30만 (26%)` → `+₩251,285 (22%)`

## 검증
- `npx tsc --noEmit` production code clean.

## 위험
- **알림 매물 수 일시 감소 가능**: `HOTDEAL_MIN_PROFIT_MARGIN=0.3` 기준이 raw → net으로 의미 변경. 예: raw 30% margin = net 25% margin → 통과 매물 줄어듦. 정직성 우선 결정. 24h 후 측정.
- **enqueue → dispatch 시점 stale**: `mvp_listings.price/sku_median` 은 dispatch 시점 fetch (동적), `profit_amount`은 enqueue 시점 snapshot. 큰 가격 변동 시 차익 % 와 매입가/시세 표시 미세 불일치 가능. 별도 wave에서 dispatch 시점 candidate_pool join 검토.

## 다음
- 24h 후 알림 매물 수 측정. 50% 이상 감소 시 `HOTDEAL_MIN_PROFIT_MARGIN` 0.25로 완화 검토.
- hotdeal 통합 test 추가 (enqueue → queue insert → dispatch → alert text 일관성).
- 사용자 화면에 보인 "댓글 28개" 매물 (애플워치 Ultra2 미개봉) 이 풀에 있는 원인 별도 검토 — Wave 132 buntalkCount fix 이전 매물이거나 풀 진입 후 댓글 증가 케이스.
