# Wave 116 — "본체" 단독 매물 parts 오분류 fix (CRITICAL)

> Status: **applied (code + production).** 사용자 자급제 흔적 통찰의 연쇄 audit 결과 → AirPods 매물에서 진짜 pipeline 버그 발견. 109건 catalog 즉시 복구.

CLAUDE.md 6 필드 포맷.

## 1. 진단 — AirPods Pro 2 매물 75% catalog 매칭 실패

- 시간: 2026-05-15
- 발견:
  - 14일 AirPods Pro 2 매물 1,969건 중 **sku_id null 1,480건 (75%)**
  - AirPods 4 매물 1,316건 중 **ANC 명시 1,047 (80%) but narrow lane 매칭 45건 (3%)**
  - sample 분석 결과 catalog는 정상 매칭하는데 pipeline의 partsHits가 끊음.
- Sample debug (debug-airpods-pipeline.ts):
  - "에어팟 4세대 본체 노캔o" → ruleMatch `airpods-4-anc` ✓
  - 하지만 pipeline classifyListing → **listingType=parts** ❌
- 변경: 측정만.
- 다음: pipeline.ts:291 root cause fix.

## 2. 근본 원인 — `compactTitle.includes("본체")` 단독 매칭

- 시간: 2026-05-15
- 발견: **[mvp/src/lib/pipeline.ts:291](mvp/src/lib/pipeline.ts:291)**
  ```typescript
  if (!fullSizeHeadphone && !isGameConsoleFullUnitText(normalizedText)
      && compactTitle.includes("본체")
      && !containsAny(text, ["양쪽", "풀박", ...]).length) {
    hits.push("title_case_only");
  }
  ```
  - 매물에 "본체" 한 글자만 포함되면 무조건 parts 분류
  - "에어팟 4세대 본체 노캔o" (본품 매물) → "본체" 매칭 → parts (잘못)
  - 셀러들이 "본품" 의미로 "본체"를 자주 쓰는데 pipeline이 부품으로 오해
- 변경: regex로 "본체만/단품/판매/팝니다/구매" 같이 명시되어야 parts 분류:
  ```typescript
  /본체\s*(?:만|단품|판매|팝니다|구매|구합니다|삽니다)/.test(compactTitle.replace(/\s+/g, ""))
  ```
- 검증:
  - 139/139 test pass (기존 부품 매물 분류 보존)
  - 본품 매물 normal로 복구:
    - "에어팟 4세대 본체 노캔o" → normal + airpods-4-anc ✓
    - "에어팟 4세대 노이즈캔슬링 노캔 본체" → normal + airpods-4-anc ✓
- 위험: 매우 낮음. 명시 token 강제로 false positive 차단.

## 3. Production reclassify — 109건 즉시 복구 ⭐⭐⭐

- 시간: 2026-05-15
- 실행: scripts/reclassify-airpods-bonche.ts (sku_id null + 에어팟/airpods 패턴 14일 sweep)
- 결과 (단일 Wave 최대 임팩트):
  - **airpods-pro-2-usbc: 37건**
  - **airpods-pro-2-lightning: 22건**
  - **airpods-pro-1: 20건**
  - airpods-2: 9건
  - airpods-3: 8건
  - airpods-4-anc: 5건
  - airpods-pro-3: 5건
  - airpods-4: 2건
  - iphone-air: 1건
  - **총 109건 catalog 복구**

## 4. 사용자 통찰 → 발견 연쇄 (정리)

1. 사용자 자급제 흔적 의문 → "정상해지/확정기변" 발견 (Wave 115)
2. 다른 자급제 표현 측정 → "전 통신사/타통신사/유심 꽂고" 발견 (Wave 115b)
3. 같은 통찰 다른 카테고리 → AirPods broad audit
4. AirPods Pro 2 매물 75% sku_id null 발견
5. catalog는 정상 매칭하는데 pipeline.ts:291 "본체" 오분류 발견
6. 109건 catalog 즉시 복구

## 5. 거론 금지

- "본체" 매물 의미 — "본품" 약어. 셀러가 "본품 (구성품 다 있음)" 의미로 사용. 부품 매물은 "본체만 / 본체 단품 / 본체 판매" 명시.
- AirPods broad SKU `airpods-pro` 없음 — narrow Pro 2 Lightning/USB-C만. 일반 Pro/Pro 1만 명시 매물도 narrow Pro 1로 흡수 (정상).
- iPhone Air 1건 보너스 — "본체" 매물에 "에어팟 본체" 외 "아이폰 에어 본체" 가 catalog 매칭됨.
