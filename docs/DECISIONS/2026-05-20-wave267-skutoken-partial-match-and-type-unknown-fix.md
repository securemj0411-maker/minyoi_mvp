# Wave 267 — skuTokens partial match + script bug fix + BAG_NON_BAG_NOISE

**날짜:** 2026-05-20
**Owner:** MJ (사용자 "ㄱㄱㄱ" 자율 진행)
**Trigger:** Wave 266b API sweep 후속 — 학습 정확도 보강.

## 문제 발견 (sweep 디버그)

### 1. Script bug — Type Unknown 100% 잘못 보고
- 1차/2차/3차 sweep 모두 "Type Unknown 25,086 = 100%" 보고
- 원인: 내 script가 `parsed.json` 봤지만 실제 parser 결과는 `parsed.parsedJson`
- fix: `parsedJson` 로 정정 → 4차 sweep 정확 측정 (Type Unknown 1,011 = 4%)

### 2. SkuTokens 정확매치 한계 (catalog.ts)
- 매물 `[265]조던1 트래비스 스캇 로우 og 모카` → unmatched 잘못 보고
- 원인: `shoe-nike-jordan-1-low-travis-scott-mocha`의 mustContain에 "트래비스" 박혀있는데
  GLOBAL_DESIGNER_COLLAB_NOISE의 "트래비스 스캇"이 매물에 hit → `skuTokens.has("트래비스 스캇")` false (정확매치)
  → intended collab SKU 인데 자기 mustContain 만족 매물에서도 차단됨.

### 3. shoe-nike-dunk-low-black-white 가 narrow color SKU 매물 가져감
- shoe-nike-dunk-low-syracuse / -seoul / -kentucky / -michigan 매물이 black-white에 catch
- 원인: black-white mustNotContain에 syracuse/seoul 등 narrow color 부재

## Fix

### `src/lib/catalog.ts` — skuTokens partial match
```ts
const skuTokensArr = [...skuTokens];
for (const token of GLOBAL_DESIGNER_COLLAB_NOISE) {
  const tokenLower = token.toLowerCase();
  if (skuTokens.has(tokenLower)) continue;
  // Wave 267: partial match — sku 토큰이 collab noise 토큰의 substring (3자+) 이면 skip
  if (skuTokensArr.some((skuTok) => skuTok.length >= 3 && tokenLower.includes(skuTok))) continue;
  if (tokenHit(normalizedText, token)) return false;
}
```
- 효과: "트래비스" (sku) → "트래비스 스캇" (collab noise) substring → skip → Jordan Travis Mocha 매물 정상 매칭.
- safety: 3자+ 제한 — "th"/"sa" 같은 짧은 토큰 false skip 차단.

### `src/lib/generated/catalog-shoe-narrow-wave134.ts` — dunk-low-black-white narrow color 차단
- mustNotContain 추가: 시라큐스/syracuse, 서울/seoul, 켄터키/kentucky, 미시간/michigan, 스트레인지러브, 청키 덩키, 리버스 판다, 카시나, 베니자나, 헤마초

### `src/lib/generated/catalog-wave266-bag.ts` — BAG_NON_BAG_NOISE 일관 적용
- 신규 noise array: 의류 (반팔/반팔티/티셔츠/데님자켓/하프집업/스웻/점퍼/오버핏/패딩/머플러/스카프),
  향수 (edt/edp/오드뚜왈렛/100ml/replica/재즈클럽), 신발 (퍼들 등)
- 20개 broad SKU 모두에 `...BAG_NON_BAG_NOISE` 적용 (sed perl one-liner)
- 효과: bag-cdg-broad/bag-balenciaga-broad/bag-margiela-broad의 의류·향수 매물 차단

### `src/lib/parsers/wave92-fashion-mobility.ts` — parseBagProductType 보강
- 추가 keyword: 토드 백/todd bag/재패니즈 백/japanese bag/명품 쇼핑백/쇼핑백 → tote
- 효과: MM6/CDG 가방 매물의 product_type 정확 추출

### `scripts/wave266b-bunjang-api-deep-sweep.ts` — bug fix
1. **pickQuery 보강** — Jordan SKU "Nike Air" 한정 query 문제 fix:
   - 한글 alias 5자+ 우선
   - 영문 modelName 사용 시 brand 중복 제거
   - 괄호 안 keyword 포함 (e.g. "Air Jordan 1 Low (Chicago)" → "Air Jordan 1 Low Chicago")
2. **parsedJson field name fix** — `parsed.json` → `parsed.parsedJson`
3. **defaultProductType pass-through** — sku.defaultProductType를 parser에 전달

## 측정 (5차 sweep)

| 차수 | Script fix | Catalog fix | TP rate | Unmatched | Type Unknown |
|--|--|--|--|--|--|
| 1차 | 단순 pickQuery | Wave 266 | 46% | 14,656 | 25,086 (100% bug) |
| 2차 | 단순 pickQuery | + Wave 266b | 52% | 8,952 | 25,086 (100% bug) |
| 3차 | pickQuery 보강 | + Wave 266b | 53% | 8,865 | 25,086 (100% bug) |
| 4차 | + parsedJson fix | + Wave 266b | 53% | 8,836 | **1,011** (정확) |
| 5차 | (4차 동일) | + BAG_NON_BAG_NOISE + parser | 53% | 8,834 | 1,015 |

### Type Unknown 1,015 매물 (5차) 분류
- 매물 진짜 type 모호: ~500건 (e.g. "꼼데가르송 반팔" — clothing query에서 가져온 가방 매물)
- query/매물 카테고리 mismatch: ~400건 (bag SKU query에서 의류 매물 fetched)
- parser 진짜 누락: ~100건 (보강 후보)

## 한계 — 다음 wave 268 작업

### Script
- pickQuery 가 영문 modelName 매물에 한글 변형 못 만듦 (e.g. "Air Jordan 1 Low Chicago" query → 매물 "조던 1 로우 시카고" 매칭 X)
- 진짜 학습 위해서는 한글 검색어 별도 박을 필요 (catalog SKU 마다 `searchQueries` 박기)

### Catalog
- 매물 "나이키 조던 1 로우 스캇 모카" (공백 있는 "조던 1") → mustContain "조던1" (공백 없음) 매칭 X
- 각 jordan/dunk SKU의 mustContain 에 공백 변형 추가 필요

### Parser
- 휠라 골프 의류 (clothing-fila-apparel 65% type_unknown) — 골프웨어 별도 product_type 검토
- 아크테릭스 의류 (clothing-arcteryx 43% type_unknown) — Vertex/Squamish 등 모델별 product_type

## 사용자 명령 정확 인용

1. (Wave 266b) "db sweep이 아니라 번개장터 api deep sweep하고 우리 있는 sku, lane
   학습용 카탈로그 보강 및 파서 강화 학습 하라했는데"
2. (Wave 267) "ㄱㄱㄱ" — 자율 진행

→ API sweep 5회 반복하면서 script bug 잡고, catalog architectural fix (partial match),
   parser regex 보강, broad SKU contamination 차단 박음.
