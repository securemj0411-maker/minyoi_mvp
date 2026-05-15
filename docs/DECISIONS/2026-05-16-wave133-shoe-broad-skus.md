# Wave 133 — 신발 broad SKU 5개 신설 (인기 매물 cadence 학습 진입)

> 2026-05-16. 사용자 요청: "조던/에어포스 리셀러 환장 카테고리. 인기 매물 cadence sweep".

---

## 진단

### 인프라 상태 (Wave 91-92에서 다 깔림)
- ✅ Sku 타입 `"shoe"` enum
- ✅ `SHOE_CATALOG` 39 SKU (catalog-shoe-wave91.ts)
- ✅ Parser `wave92-fashion-mobility.ts` (사이즈/condition/박스/키즈 차단)
- ✅ `category-readiness.shoe = internal_only`
- ✅ Bunjang sweep `category:405` 등록 (DEFAULT_CATEGORY_SWEEPS)
- ✅ raw 매물 **3,993건** 누적 (sweep 작동 중)

### 진짜 문제 — Catalog narrow only
- SKU 39개 모두 **한정판/specific 컬러웨이**:
  - `shoe-nike-jordan-1-high-chicago-lost-and-found`
  - `shoe-nike-jordan-1-high-shadow-2-0`
  - `shoe-nike-jordan-1-high-royal-2017`
  - `shoe-adidas-gazelle-indoor-bold-orange`
- **일반 인기 모델 broad SKU 부재**:
  - 에어포스 1 (모든 컬러)
  - 덩크 로우 (일반)
  - NB 530, NB 992
  - 삼바 OG

- SKU 매칭율: ~50건 / 3,993건 = **1.3%**
- 99% 매물이 catalog 못 매칭 → 시세 학습 X

## Fix

### `src/lib/generated/catalog-shoe-broad-wave133.ts` (신규)

5개 broad SKU:

| SKU | msrp | mustContain | mustNotContain |
|---|---:|---|---|
| `shoe-nike-airforce-1-low-broad` | 139k | "에어포스 1" + [low/화이트/블랙/정품] | 한정판 (Off-White/Travis Scott/Sacai) + 가품 + 키즈 |
| `shoe-nike-dunk-low-broad` | 119k | "덩크 로우" + 나이키/정품 | 한정판 (Ben&Jerry/SB/Supreme/CO.JP) + 가품 + 키즈 |
| `shoe-newbalance-530-broad` | 139k | "뉴발란스 530" | ALD 콜라보 + 가품 + 키즈 |
| `shoe-newbalance-992-broad` | 249k | "뉴발란스 992" | 다른 9xx 시리즈 + 콜라보 + 가품 + 키즈 |
| `shoe-adidas-samba-og-broad` | 129k | "아디다스 삼바" | Wales Bonner/Pharrell + 다른 변형 + 가품 + 키즈 |

공통 mustNotContain:
- 한정판/콜라보 (catalog-shoe-wave91.ts와 충돌 방지)
- 가품 (`짭`, `가품`, `replica`, `미러`, `1:1`, `11급`)
- 키즈 (`td`, `ps`, `키즈`, `유아`, `toddler`)
- 단품 (`한짝`, `한쪽만`, `파손`)
- 매입글 (`삽니다`, `구합니다`)

### `src/lib/catalog.ts` 변경
- import `SHOE_BROAD_CATALOG` 추가
- `...SHOE_BROAD_CATALOG` SHOE_CATALOG 뒤에 spread

## 영향 예측

| 지표 | Before (현재) | After (예상) |
|---|---:|---:|
| Catalog 매칭율 | 1.3% (50/3993) | 30-50% (1,200-2,000/3993) |
| Mining sample 누적 (1주) | ~50/SKU | ~200-500/broad SKU |
| 시세 학습 가능 SKU | 0개 (sample 부족) | 5개 (베타 충분) |

## 위험 / 가품 detection

### 가품 risk
- 에어포스 1 / 덩크 로우 가품 10-30% 추정 (Bunjang 일반 시장)
- 한정판 차단 후에도 일반 모델 가품 존재

### 현재 detection
- catalog mustNotContain: "짭", "가품", "replica", "1:1", "11급" — **명시 가품만**
- 명시 안 한 가품은 못 잡음

### 향후 강화 (별도 wave)
- 시세 floor: 모델별 hard floor (에어포스 1 < 50k → 가품 의심)
- 셀러 신뢰도: review 0 + 신상품 → flag
- AI L2 강제 (정확성 우선 §12b)
- parser 가품 키워드 학습 (mining 1-2주 후)

## 검증

- TypeScript: validator.ts 외 무에러
- Tests: **172/172 pass**
- Bunjang sweep 자동 작동 (category:405 이미 등록)
- 다음 collect cycle (2분) 부터 broad SKU 매물 매칭 시작
- 1-2시간 후 mvp_listing_parsed에 broad SKU 매물 누적 측정 가능

## 다른 세션 알아볼 키 포인트

1. **신발 broad SKU 5개 신설** (Wave 133, 2026-05-16).
2. 파일: `src/lib/generated/catalog-shoe-broad-wave133.ts`.
3. 한정판 SKU (catalog-shoe-wave91.ts)와 mustNotContain으로 충돌 방지.
4. **category-readiness `shoe: internal_only`** — 사용자 노출 X (mining + 시세 학습만).
5. ready 승격 조건: minReadyPool 10 / minParseRate 0.85 / minTrustedKeys 5.
6. Bunjang sweep `category:405` 이미 작동 중.

## 다음 (사용자 결정)

1. 1-2시간 후 measurement (broad SKU 매물 매칭 수)
2. 1주 후 parse_ready 정확도 측정 + 가품 false positive 검증
3. 측정 결과 OK → ready 승격 검토
4. ready 승격 전 가품 detection 강화 wave 필수
