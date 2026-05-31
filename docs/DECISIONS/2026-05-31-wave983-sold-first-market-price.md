# Wave 983 — 시세 sold-first 정확도 강화

- 시간: 2026-05-31 17:30 KST
- 트리거: 사용자 정책 "팔린 게 시세, 호가는 fallback". 갤럭시 S25 사례 — sold 2건 650k + active 10건 730k → 기존 blended 706k (active 가중치 75%). 실제 거래가 무시.

## 발견

### 1. blended_median 가중치 active 우세 (Wave 221 정책 잔존)
- sold>=1 + active>=5: sold 0.3 / active 0.7 → 호가 dominant
- sold>=3: sold 0.45 / active 0.55 → 거의 균형
- sold>=8: sold 0.7 / active 0.3 → 그래도 active 30%

Wave 221 (2026-05-18) 의도: "sold 1건 outlier 위험 — active anchor 유지". 단 sold 3+ 부터는 anchor 약화 가능.

### 2. lookup 비교 매물 list active-only
- `lookup/by-url/route.ts:597`: `listing_state=eq.active` 만 fetch (Wave 806).
- daangn 갤럭시 S25 256GB sold 339건 있어도 UI 비교 list 안 보임.

## 변경

### A. blended_median 가중치 (`src/lib/tick-pipeline.ts:4519` + `4612` per-source)
| sold 건수 | 변경 전 (sold) | 변경 후 (sold) | 변화 |
|---|---:|---:|---|
| >=8 + active>=5 | 0.7 | **0.85** | +15%p |
| >=5 | 0.6 | **0.75** | +15%p |
| >=3 | 0.45 | **0.65** | +20%p |
| >=2 (신설) | 0.4 | **0.50** | +10%p |
| >=1 (anchor) | 0.25~0.4 | **0.30** | Wave 221 안전장치 유지 |

원칙: sold 3+ 부터 dominant. sold 1건은 outlier 위험으로 active anchor 0.7 유지.

예상 효과 (갤럭시 S25 sold 2 + active 10):
- 변경 전: 0.25*650 + 0.75*730 = **710k** (active 우세)
- 변경 후: 0.50*650 + 0.50*730 = **690k** (균형)
- 차이 -20k, sold 쪽으로 이동

sold 3+ 케이스 더 큰 변화 (sold 4 + active 10): 535k → 585k 같은 패턴 (sold weight 20%p ↑).

### B. lookup 비교 매물 list (`src/app/api/lookup/by-url/route.ts:597`)
- `listing_state=eq.active` → `or(active+last_seen 3d, sold_confirmed+sold_detected 14d)`
- limit 12 → 20 (sold 추가 수용)
- order: `listing_state.asc, price.desc` (active 먼저, sold 뒤)
- response type 에 `sold_detected_at` 컬럼 추가

UI client 가 listing_state='sold_confirmed' 인 카드는 "판매완료" 라벨 + 거래 시점 (sold_detected_at) 표시 가능. 이건 frontend 별도 작업.

## 검증

- `npx tsc --noEmit` clean (변경 파일 에러 0)
- 직접 RPC 호출 없음 — 다음 market-worker tick (10분 안) 부터 새 blended 가중치 적용. 갱신된 mvp_market_price_daily / per_source row 측정으로 확인 가능.

## 위험

- 모든 SKU 시세 값 변경 (sold 가중 ↑). 매입 후보 score 영향:
  - sold median > active median (드뭄) → 시세 ↑ → priceGap ↓ → 후보 감소
  - sold median < active median (일반) → 시세 ↓ → priceGap ↑ → 후보 증가 (사용자 매입가 vs 실제 거래가 비교 정확)
- 갤럭시 S25 예: 706k → 690k (-2.3%). priceGap (570k → 시세) 변화 정도.
- sold 1건만 있는 SKU: weight 0.25~0.4 → 0.30 통일. 일부 SKU 미세 차이 가능.

## 다음

- 다음 market-worker tick (~10분) 후 mvp_market_price_daily 새 blended 확인 (갤럭시 S25 등 sample SKU).
- frontend client 에서 비교 매물 카드에 sold 라벨 추가 (별도 wave) — 지금은 backend response 만 박음.
- 1~2주 운영 후 사용자 피드백 (매입 후보 정확도) 측정 후 가중치 추가 튜닝.
