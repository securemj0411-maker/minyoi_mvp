# 2026-05-17 preview-pool: 가격 tier 분리 (10만 2개 + 30만 3개)

## 사용자 요청

> "10만원 이하 상품 2개 그다음 3개는 30만원이하로 하자
> 일단 싼게 진짜 있어야됌 어떰?"

진입장벽 더 강화 — "와 진짜 싼 매물 있네" hook 명확히.

## 박은 변경 (commit `82acc2f`)

### Tier 정의
```ts
const TIER_A_MAX_KRW = 100_000;  // 10만 이하
const TIER_A_COUNT = 2;          // 2개
const TIER_B_MAX_KRW = 300_000;  // 30만 이하 (A 제외하면 10-30만)
const TIER_B_COUNT = 3;          // 3개
```

### pickFromTier 함수 (carry-over dedup)
- tier 별 순차 선택
- `usedSkus` + `usedCategories` cumulative (tier A 와 B 가 SKU/카테고리 공유 안 함)
- tier 못 채우면 카테고리 중복 허용 (SKU dedup 만 유지)

### 선택 흐름
1. tier A: 10만 이하 매물 중 SKU/카테고리 다양 2개
2. tier B: 10-30만 매물 중 SKU/카테고리 다양 3개 (tier A 매물/SKU 제외)

## DB 사전 확인

- 10만 이하 ready: 35건 / 4 카테고리 / 14 SKU ✅
- 10-30만 ready: 104건 ✅
- 다양화 인프라 충분

## Trade-off

- 첫 2개 = 10만 이하 매물 (저렴 hook 강함, 차익 액수는 작을 수 있음)
- 나머지 3개 = 10-30만 (실제 매물 분위기, 차익 더 큼)
- 가격 다양 = 사용자 인식 "고가 매물 만 X, 저렴/중급 다 있음"

## Test

288/288 pass.
