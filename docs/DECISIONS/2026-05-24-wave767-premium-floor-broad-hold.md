# Wave 767 — Premium brand min price floor + broad SKU 명시 hold

**날짜**: 2026-05-24
**Wave**: 767 (Wave 766 미해결 3개 사용자 결정 반영)
**Owner**: Claude

## 사용자 결정 (3가지)

| Q | 결정 |
|---|---|
| Brand별 min price floor | ✅ 적용 (premium brand 가품 의심 reject) |
| Broad SKU narrow split | ✅ hold (사용자 노출 차단, narrow lane 만) |
| 시세 sample 정리 | ✅ 자연 만료 대기 (Wave 756 cron) |

## Fix #1 — Premium brand min price floor

### 신규 `Sku.minPriceKrw` 필드

```typescript
// src/lib/catalog.ts
type Sku = {
  // ...
  minPriceKrw?: number;  // Wave 767: 가품 의심 floor 가격
};
```

### Sanity check (pipeline.ts categoryScopedNoise)

```typescript
if (sku.minPriceKrw && price > 0 && price < sku.minPriceKrw) {
  return "damaged";  // floor 미달 → pool 차단 + 시세 sample 제외
}
```

모든 카테고리 적용 — premium SKU 만 floor 박혀있으면 자동 작동.

### 적용 SKU (11개)

| SKU | minPriceKrw | 의도 |
|---|---|---|
| `thombrowne_4bar` | 100K | 시그니처 라인 floor |
| `thombrowne_cardigan` | 100K | |
| `thombrowne_knit` | **50K** | **사용자 #6 발견 7,900원 가품 차단** |
| `thombrowne_shirt` | 50K | |
| `thombrowne_suit_coat` | 200K | 코트 premium |
| `thombrowne_sweat_hoodie` | 50K | |
| `moncler_maya` | 300K | 시그니처 다운 |
| `moncler_grenoble` | 300K | 스키웨어 premium |
| `moncler_tricot` | 100K | |
| `arcteryx_leaf` | 200K | 군용 premium |
| `arcteryx_veilance` | 150K | 도시 premium |

검증 8/8 SKU minPriceKrw 박힘 확인.

## Fix #2 — Broad SKU 명시 hold

`category-readiness.ts` LANE_READINESS 에 4개 broad 추가:
- `polo_apparel_broad`: **239x spread** (audit 발견)
- `stussy_apparel_broad`: 28x spread
- `thombrowne_apparel_broad`: 22x spread
- `junya_watanabe_apparel_broad`: 23x spread

**기존**: clothing category gate 가 lane 없으면 자동 차단 (Wave 407 정책).
**Wave 767**: 명시 hold 로 안전성 강화 — broad SKU 사용자 노출 0 보장.

### Effect
- broad fallback 매물 → narrow lane (Polo Vintage / Thom Browne 6-split / 등) 자동 매칭만 허용
- spread 큰 broad 매물 사용자에게 안 보임 → "잘못된 가격대 비교" 사라짐

## Fix #3 — 시세 sample 자연 만료

Wave 756 의 daily cron 이 outlier comparable_key row 자동 만료. 수동 정리 안 함 (사용자 결정).

## DB 즉시 정리

```sql
UPDATE mvp_candidate_pool SET status='invalidated', invalidated_reason='wave767_premium_brand_floor_fake'
WHERE category='clothing' AND status='ready' AND (
  /* 11 premium SKU floor 미달 */
  OR /* 4 broad SKU 매칭 */
);
```

결과: **0건 invalidate** — ready pool 에 이미 outlier/broad 없음 (이전 Wave 762-766 fix 효과). catalog/parser fix 로 향후 매물 자동 차단.

## 영향

### 안전성 향상
- 사용자가 본 톰브라운 7,900원 같은 명백 가품 → 자동 reject
- broad SKU 흡수 매물 (239x spread polo_apparel) → 풀 진입 0
- 시세 sample 깨끗 (가품 매물 시세 평균 오염 차단)

### Trade-off
- 진짜 정상 차익 매물 (premium brand 의 매우 싼 매물) 도 소량 차단 가능
- 사용자 정책 "일반인 친화" — 가품 위험 매물 안 보이는 게 더 중요

## 안전성

- minPriceKrw 미박힘 SKU → 기존 동작 (대부분 SKU 그대로)
- broad SKU 차단도 lane-only-gate 정책 강화 (Wave 407 후속)
- TypeScript 통과, premium SKU 8/8 확인 test pass

## 미해결 (별도 wave 권장)

- **polo_rrl_* / acne_* / supreme_* min price floor 확장** — 시간 효율 위해 핵심 11개만. 추가 brand 별 audit 필요.
- **broad SKU narrow split 신설** — narrow lane 만들어 release 시 broad hold 해제 (별도 큰 작업).
- **시세 sample 만료 cron 확인** — Wave 756 cron 정상 작동 검증 (24-48h 후).

## 관련 commit

- `a312871a`: Wave 766 — 의류 deep spread audit (다중 brand 묶음 detection)
- 본 commit: Wave 767 — premium floor (11 SKU) + broad hold (4 lane)
