# 2026-05-16 — N4: condition_class에 `unopened` 별도 클래스 신설 (mint와 분리)

## 트리거
사용자 코멘트 batch 추가 분석 (id 104/107/109):
- **id 104** (pid 408155892): "새상품 미개봉이면 이건 mint가 문제가 아님. 그냥 새상품 미개봉임"
- **id 107** (pid 407909846): "이거 다나와 시세임?? 왜?? 미개봉 신상품 아닌데?"
- **id 109** (pid 408117001): "민트랑 새상품 미개봉은 다르지 않을까???"

**사용자 의도 명확**: 미개봉 매물은 mint와 다른 별도 등급. 분리 필요.

## 진단

Wave 130까지 condition_class 5단계 (mint/clean/normal/worn/low_batt + flawed).
- `new_or_open_box` 라벨 매물 → mint 합쳐짐
- DB 확인: mvp_listing_parsed.condition_class='mint' 3,715건 중 **3,715건 (100%) 가 new_or_open_box 라벨**
- 즉 현재 "mint" = 사실상 "unopened" (실 사용 S급 mint는 별도 분류 없음)

문제:
- 시세 source 다름:
  - mint (현재 unopened) → 다나와 reference_price 사용
  - 진짜 S급 사용감 없음 → 중고 시세 사용
- 같은 class라 디버깅 화면 비교군에 섞임 → 사용자 헷갈림

## Fix

### 1. `src/lib/option-parser.ts`
- `ConditionClass` 타입에 `"unopened"` 추가
- `extractConditionClass`: `new_or_open_box` → `"unopened"` (이전: `"mint"`)
- mint는 향후 진짜 S급 매물용 (현재 mining/parser 보강 후 사용)

### 2. `src/lib/pack-open.ts`
- `CONDITION_LABEL.unopened = "미개봉/새상품"`
- `CONDITION_LABEL.mint = "S급 (사용감 거의 없음)"` (label 정정)
- `CONDITION_FALLBACK_ORDER.unopened = ["unopened", "mint", "clean", "all"]`
- `CONDITION_FALLBACK_ORDER.mint = ["mint", "unopened", "clean", "normal", "all"]` (unopened fallback 추가)

### 3. `src/app/api/market/history/route.ts`
- `VALID_CCS`에 `"unopened"` 추가
- fallback chain `[ccFilter, "mint", "normal", "all", "clean", "worn"]`

### 4. `src/app/api/listings/[pid]/market-source/route.ts`
- fallback chain 같이 업데이트

### 5. `src/components/pack-reveal-modal.tsx`
- 시세 출처 UI 3 분기:
  - **unopened** (amber): "다나와 새 가격 기준 (이 매물 미개봉)"
  - **mint** (emerald): "번개 S급 매물 N건 median"
  - 그 외 (zinc): "번개 중고 매물 N건 median"

### 6. DB reparse (실시간 즉시 적용)
```sql
UPDATE mvp_listing_parsed
SET condition_class = 'unopened'
WHERE condition_class = 'mint'
  AND (parsed_json->'condition_notes') @> '["new_or_open_box"]';
-- 결과: 3,715건 이동

UPDATE mvp_candidate_pool p
SET condition_class = 'unopened'
WHERE p.condition_class = 'mint'
  AND EXISTS (
    SELECT 1 FROM mvp_listing_parsed lp
    WHERE lp.pid = p.pid
      AND (lp.parsed_json->'condition_notes') @> '["new_or_open_box"]'
  );
-- 결과: 571건 이동
```

### 7. `mvp_market_price_daily` 자연 turnover
- 새 daily aggregate row가 `unopened` condition_class로 박힘 (market-worker 다음 사이클)
- 옛 mint row는 그대로 (PK = date + comparable_key + condition_class). 향후 진짜 S급 매물용 분리.

### 8. Test (`tests/wave130-condition-class.test.ts`)
- `"returns 'unopened' for new_or_open_box"` (이전: 'mint')
- `"unopened beats low_batt"` (이전: "mint beats low_batt")

## 검증
- TypeScript: validator.ts(`/plans` dev cache) 외 무에러.
- Tests: **172/172 pass**.
- DB: mvp_listing_parsed unopened 3,715건 / mint 0건.
- DB: mvp_candidate_pool unopened 571건 / mint 0건.

## 다른 세션 알아볼 키 포인트

1. **`new_or_open_box` 라벨 ≠ `mint` condition_class** (2026-05-16 N4부터).
2. **`unopened`** = parser가 new_or_open_box 라벨 매물에 박는 condition_class.
3. **`mint`** = 향후 진짜 S급 사용감 거의 없음 매물용 (현재 비어있음).
4. 시세 source 다름:
   - `unopened` 매물 → `mvp_reference_prices.effective_price` (다나와 새 가격)
   - 그 외 → `mvp_market_price_daily.blended_median_price`
5. UI 표시:
   - `unopened`: "📍 다나와 새 가격 기준 (이 매물 미개봉)" (amber)
   - `mint`: "📍 번개 S급 매물 N건 median" (emerald)
   - 그 외: "📍 번개 중고 매물 N건 median" (zinc)

## 위험 / 다음

- `mint` class 당분간 빈 상태. 진짜 S급 매물 분류는 parser 보강 wave (예: "S급", "초S급", "사용감 없음" → mint 매핑).
- 옛 `mvp_market_price_daily.condition_class='mint'` row는 자연 turnover로 사라짐 (PK = date 매일 새 row).
- 매물 reveal 시 marketBasis.conditionClass 값 변화 → UI에 즉시 반영 (캐시 무관).
- pack-open에서 `condition_class='unopened'` 처리 fallback chain이 unopened → mint 순서라 sample 부족 시 mint(중고 S급) 으로 fallback. 미개봉 매물 sample 부족 시 약간의 가격 underestimate 가능 — 다나와 reference_price가 sku_median에 박혀 있어서 영향 작음.
