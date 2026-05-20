# Wave 268 — normalize 한글-숫자 canonical + parser regex 학습 보강

**날짜:** 2026-05-20
**Owner:** MJ (사용자 "제발 해라")
**Trigger:** Wave 267 한계 — 5차 sweep TP 53% 정체. 매물 공백 변형 (조던1 vs 조던 1) 매칭 X.

## Fix

### 1. `src/lib/catalog.ts` — normalize 한글-숫자 경계 canonical 통합
```ts
// Wave 268: "조던1" / "조던 1" → 같은 canonical " 조던 1 "
t = t.replace(/([가-힣])(\d)/g, "$1 $2");
t = t.replace(/(\d)([가-힣])/g, "$1 $2");
```
- 효과: 모든 SKU/매물 같은 form. catalog 변경 없이 자동 catch.
- 영문 (jordan 1) 영향 X (이미 공백 있음).
- 6차 sweep: TP +175 매물 (1% 상승).

### 2. `parseClothingProductType` — 쇼츠 변형 보강
- 추가: 배기스/baggies (파타고니아 쇼츠), 5인치/7인치 (사이즈 표기)
- 효과: clothing-patagonia 36/96 type_unknown 매물 중 "배기스 5인치 그레이" 등 catch.

### 3. `parseBagProductType` — 보강
- 추가 `tote`: 서류 가방, business bag, 비즈니스 백, 세컨 백, 세컨드 백,
  포트폴리오 백/portfolio bag, 도큐먼트 케이스/document case, 브리프 케이스/briefcase
- 추가 `waist`: waist pack/웨이스트 팩, Mantis 2/만티스 웨이스트 (Arc'teryx 모델)
- 효과: bag-coach-broad/arcteryx 등 type_unknown 매물 catch.

### 4. `clothing-fila-apparel` — 골프웨어 차단
- mustNotContain 추가: 골프, 골프웨어, 골프 의류, 골프 셋업, 골프채, 퍼터, 드라이버, 아이언
- 사유: 골프웨어 시세군 (50~150만) ≠ 일반 휠라 의류 (3~10만). 별도 시세 비교.

## 측정 (6차 sweep)

| 차수 | 변경 | TP | Unmatched | Type Unknown |
|--|--|--|--|--|
| 4차 (script bug fix 후 baseline) | parsedJson | 53% | 8,836 | 1,011 |
| 5차 (BAG_NON_BAG_NOISE + parser) | + Wave 267 | 53% | 8,834 | 1,015 |
| **6차** | **+ Wave 268** | **54%** | **8,671** | **977** |

- TP +175 매물 (~1.2%)
- Unmatched -163
- Type Unknown -38

## 한계 — 다음 wave 269

- 영문 modelName SKU 들이 한글 검색어 부재 → API 검색 효율 낮음 (SKU별 searchQueries 박을 필요)
- bag-cdg-broad 92/96 / bag-balenciaga-broad 79/96 — query 결과 자체가 의류 (mustNotContain reject돼도 typeUnknown count 증가). metric 노이즈로 처리하거나 query 변경 필요.
- bag-coach-broad type_unk 32/96 — "코치 가방 새상품" 같은 단순 매물도 type_unknown. defaultProductType="shoulder" fallback 박을 후보.
- clothing-arcteryx 41/96 — 모델별 product_type 명시 (Vertex Sleeve/Mantis Waistpack 등).

## 사용자 명령 정확 인용

"제발 해라" → systemic normalize 변경 + parser regex 보강 + 골프 noise 차단 박음. TP 54% 도달.
