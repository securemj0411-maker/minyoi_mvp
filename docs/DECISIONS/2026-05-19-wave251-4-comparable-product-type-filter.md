# Wave 251.4 — 비교 매물 list clothing_product_type 필터

- date: 2026-05-19
- type: API + UI 보강 (additive — comparable_key 구조 변경 X)
- scope:
  - `src/app/api/listings/[pid]/market-source/route.ts` — 비교군 filter 에 clothing_product_type 추가
  - `src/components/market-source-debug.tsx` — 필터 적용 표시 (사용자 신뢰)
- branch: `fix/market-chart-honesty-2026-05-19`
- 관련 사용자 코멘트: `mvp_reveal_feedback` id 201, 202, 203 (BAPE tee/hoodie / Stussy crewneck)

## 배경

Wave 248 미해결 + Wave 251 사용자 코멘트 (id 201/202/203) 재발견.

### 사용자 frustration

> "BAPE tee 50+건 비교 매물에 product_type 다양 / Stussy crewneck 에 맨투맨 섞임"

같은 sku_id 안 product_type 별 가격 분포가 매우 다른데 비교군 list 가 다 섞임:
- BAPE tee (₩70k) vs hoodie (₩300k) → 4배 차
- Stussy crewneck (199~300k) vs 맨투맨 (45k) → 7배 차

### 근본 원인 분석

1. `option-parser.ts` `comparableParts()` clothing 카테고리는 `[family, model]` 만 반환 (line 1532).
   → comparable_key 에 product_type axis 없음.
2. `mvp_listing_parsed.parsed_json.clothing_product_type` 박힘 (Wave 236d) 이지만 활용 X.
3. `/api/listings/[pid]/market-source` 의 comparables list 가 comparable_key 단독으로 fetch → product_type 다른 매물 다 포함.

### production 측정 (clothing-bape-tee)

| clothing_product_type | cnt |
|---|---|
| tee | 161 |
| null | 55 |
| hoodie | 40 |
| type_unknown | 10 |
| crewneck | 6 |
| jacket | 5 |
| shirt | 1 |

→ 사용자가 tee 매물 보는데 hoodie/crewneck/jacket 가 섞여 가격 분포 왜곡.

## 옵션 검토

| 옵션 | 영향 범위 | 비파괴성 | 사용자 frustration 해결 |
|---|---|---|---|
| A: comparable_key 에 product_type 추가 | parser + mvp_market_price_daily backfill + candidates/pool 전체 | 파괴적 (24h~수일 backfill) | 완전 |
| **B: market-source API 단에서 list filter** | API 1곳 + debug UI 1곳 | additive | 비교군 list 정확 (sku_median 은 그대로) |
| C: catalog mustNotContain 으로 variant 차단 | catalog SKU 별 | additive (Wave 248 패턴) | 부분 — narrow split 없는 broad SKU 만 |

**Option B 채택** — 비파괴 + 사용자 직접 frustration 해결 (비교군 UI).
sku_median 자체는 Wave 247 band-aware fallback 으로 대응. 향후 Option A 는 별도 wave (구조 변경 신중).

## 구현 (Option B)

### 1. `market-source/route.ts` 본 매물 product_type 추출

```typescript
// 기존 parsed select 에 parsed_json 추가
`...?select=pid,comparable_key,parse_confidence,needs_review,condition_class,parsed_json&pid=eq.${pid}`

// 본 매물 product_type
const targetParsedJson = (parsed?.parsed_json as Record<string, unknown> | null) ?? null;
const targetProductType = (targetParsedJson?.clothing_product_type as string | null) ?? null;
```

### 2. 비교군 filter loop 에 product_type 매칭 추가

condition_class filter 직후, 같은 정책:
- 본 매물 type 박힘 + 비교 매물 type 박힘 + 둘 다 != "type_unknown" + 다르면 exclude.
- null/type_unknown 한쪽 → 필터 안 함 (옛 데이터 보수 호환).

```typescript
const compareProductType = (p.parsed_json?.clothing_product_type as string | null) ?? null;
if (
  targetProductType != null && targetProductType !== "type_unknown"
  && compareProductType != null && compareProductType !== "type_unknown"
  && targetProductType !== compareProductType
) {
  excludeByPid.set(Number(p.pid), true);
  continue;
}
```

### 3. response 에 `productType` 노출

`ourListing.productType` — 사용자 신뢰 표시용.

### 4. `market-source-debug.tsx` 필터 표시

비교 매물 list 위에 emerald badge:
```
🧵 product_type 필터 적용 — 본 매물 「tee」 와 같은 type 만 표시 (다른 type 매물 제외)
```

## 영향 (additive only)

### 적용 화면 (3 화면 정책 — memory ui_changes_apply_to_all_card_screens)

- **admin-pool-browser** — `MarketSourceDebug` 임포트 → 직접 영향 ✓
- **pack-reveal-modal** — `MarketHistoryChart` (chart 만, 비교 매물 list 없음) → 시각적 변화 X
- **user-reveal-dashboard** — `pack-reveal-modal` 통과 → 시각적 변화 X

⚠️ pack-reveal-modal/user-reveal-dashboard 는 자체 비교 매물 list UI 가 없음 — 사용자 frustration 의 비교 매물 list 는 admin/debug 경로에 보임. 일반 사용자 모달은 marketBasis aggregated stats 만 노출. 이 부분 별도 wave 검토 가능 (사용자가 일반 사용자 view 에서 본 게 아니면).

### sku_median 영향

- `mvp_market_price_daily` 의 sku_median 자체엔 영향 X (집계 그대로).
- `/api/listings/[pid]/market-source` 의 **liveStats** (실시간 active 매물 기준) 은 filter 적용 후 계산 → product_type 별 정확.
- 사용자가 보는 비교군 list 의 가격 spread 가 product_type 같은 것만으로 줄어듦.

### 옛 데이터 호환

- type_unknown / null product_type 매물은 filter 안 함 (보수).
- Wave 236d 이전 매물은 type 없음 → filter 적용 X (사실상 기존 동작 유지).

## 검증

- `npx tsc --noEmit -p .` → `market-source/route.ts` + `market-source-debug.tsx` 0 error (테스트 파일 pre-existing TS 에러는 무관).
- `npm run test:core` → 581 pass / 9 fail (failing 9건은 me-page-contract UI layout pre-existing, catalog/API 무관).

## 후속 작업 (별도 wave)

1. **사용자 비교 매물 list UI 추가** (pack-reveal-modal/user-reveal-dashboard) — 일반 사용자도 비교군 보기 메뉴 노출 검토.
2. **Option A — comparable_key 에 product_type 추가** — 매우 비파괴적 변경 / mvp_market_price_daily backfill 필요 → 사업 결정 후 별도 wave.
3. **shoe/bag 카테고리도 동일 패턴 적용** — clothing 만 박혔지만 shoe/bag 도 product_type axis 존재 시 확장.

## 사용자 정책 준수

- additive only (필터 조건 추가만, 기존 동작 유지) ✓
- 비파괴 (comparable_key/market_price_daily 손 X) ✓
- decision log 필수 ✓
- 3 화면 정책 — 비교 매물 list UI 가 admin/debug 만 → 사용자 view 영향 X (별도 wave 검토 명시) ✓
- 사용자 친화 (memory project_core_principle_consumer_friendly) — 비교 매물 정확도 ↑ ✓
- narrow=fallback / broad=차단 (Wave 236d Goldilocks) — broad SKU 안 product_type 분리로 정확도 ↑ ✓
- test:core 회귀 검증 ✓
