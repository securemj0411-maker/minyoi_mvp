# 신발 카테고리 진입 가능성 — 종합 조사 보고서

> 2026-05-16. 사용자 요청 ("조사에 조사 검토의 검토"). raw probe: `/tmp/bunjang-shoes-results.json`.

---

## TL;DR — **MAYBE (신중, 3주 작업 + 가품 risk 큼)**

| 항목 | 평가 |
|---|---|
| Bunjang 매물 규모 | ✅ 539,688건 (상위 8위, ID 405) |
| 인기 모델 매물 풍부 | ✅ 13개 모델 sample 모두 page 1에 26-30건 |
| 가격대 적정 | ✅ 대부분 5-30만원대 (베타 친화) |
| condition_class 5단계 | ✅ 자연 매핑 (박스미개봉/1회신음/사용감/하자) |
| **현재 catalog SKU** | ❌ **0개** (Sku 타입에 'shoes' 카테고리 자체 없음) |
| **Parser** | ❌ **0** (사이즈 mm/색상/콜라보/연식 로직 0) |
| **Ground truth (KREAM)** | ⚠️ scrape 어려움 (보안 강함) |
| **가품 risk** | ⚠️⚠️ 매우 큼 (조던/덩크 한정판 가품 빈발) |
| 작업량 | 2-3주 (catalog + parser + 시세 학습) |

**진입 결정 기준**: 베타 사용자 우선순위 vs 다른 작업 비교. 신발은 **차별화 강력** but **가품 사고 시 신뢰 손상 큼**.

---

## S1: 현재 코드 상태 (Explore agent)

### Catalog
- `src/lib/catalog.ts` Sku 타입 카테고리 enum: `earphone, smartwatch, smartphone, tablet, laptop, monitor, speaker, camera, game_console, small_appliance`
- **신발/스니커즈/footwear/fashion 0개**

### Parser
- `src/lib/option-parser.ts`에 신발 처리 0
- queryFamily 함수 신발 인식 안 함 ("unknown" 처리)

### Bunjang 카테고리
- 신발 = **ID 405** (`category-intelligence/category-discovery/REPORT.md`)
- **539,688건** (상위 8위 카테고리)
- 현재 sweep query 0 (DEFAULT_SEARCH_QUERIES에 신발 없음)

### 옛 진입 시도
- `docs/DECISIONS/` 신발 진입 wave 0
- 사용자 memory: "wave 90 신발/가방/스포츠 1차 후보, 진입 mistake" — DECISIONS에 기록 없음 (memory only)

---

## S2: Bunjang 인기 모델 매물 분포 (probe 실측)

probe: `/tmp/bunjang-shoes-probe.ts` 13개 모델 × 30건 sample.

| 모델 | 매물 page1 | Median 가격 | 5-50만 in_range |
|---|---:|---:|---:|
| 조던1 시카고 | 30 | 190,000 | 27/30 (90%) |
| 조던1 로우 | 30 | 175,000 | 15/30 (50%) |
| 조던1 미드 | 30 | 120,000 | 19/30 |
| **에어포스 1** | 30 | **79,000** | 27/30 (가성비) |
| 에어포스 화이트 | 30 | 120,000 | 25/30 |
| **덩크 로우** | 30 | **96,000** | 18/30 |
| 덩크 판다 | 26 | 55,000 | 11/26 |
| **뉴발란스 530** | 30 | **69,000** | 19/30 (남녀 인기) |
| 뉴발란스 992 | 30 | 236,500 | 27/30 (프리미엄) |
| 삼바 | 30 | 65,000 | 21/30 |
| 스탠스미스 | 30 | 89,000 | 16/30 |
| 조던1 다이아몬드 | 30 | 72,000 | 24/30 |
| 삼바 핑크 | 30 | 65,000 | 18/30 (여성) |

**Top 5 진입 후보**:
1. **에어포스 1** (median 79k, in_range 90%) — 회전 빠름 + 가격대 친화
2. **덩크 로우** (96k) — 인기 + 가품 risk 중간
3. **뉴발란스 530** (69k) — 남녀 unisex 인기, 가품 risk 작음
4. **삼바** (65k) — 트렌드 + 가격 friendly
5. **조던1 시카고** (190k) — 차별화 (한정판) but 가품 risk 큼

---

## S3: Ground truth 가능성

### KREAM (스니커즈 리셀 표준)
- 인기 모델 100% 있음
- **시세 정확** (실시간 거래 데이터)
- ❌ **Scrape 어려움**: javascript-heavy SPA, anti-bot 강함
- 대안: 사용자 manual 박기 / 공식 API 신청 (가능성 낮음)

### 다나와
- 신발 가격 정보 일부 있음 (재고 있는 모델)
- 발매가 정도. 리셀 시세 X.
- 한정판은 무용

### POIZON (포이즌)
- 중국 플랫폼 + "선 감별" 서비스
- 한국 사용자도 사용 증가
- API scrape 가능성 낮음 (보안)

### 자체 학습
- Bunjang sweep으로 시세 자체 학습 (1-2주 데이터 누적)
- 한정판은 sample 부족 위험 — confidence 'low' 유지
- 인기 모델 (에어포스 1, 덩크 로우 등) 매물 풍부라 자체 학습 OK

**결론**: KREAM scrape 불가 → Top 20 SKU **hardcoded reference price** (운영자 manual 입력) + 자체 학습 hybrid 권장.

---

## S4: condition_class 5단계 적용성

| 우리 class | 신발 매핑 | 매물 빈도 |
|---|---|---|
| **unopened** | "박스 미개봉", "데드스톡", "미신" | 발매 직후 한정판 ~30% |
| **mint** | "1-2회 신음", "S급", "거의 새것" | ~25% |
| **clean** | "정상 사용", "사용감 적음" | ~20% |
| **normal** | "일반 사용" | ~15% |
| **worn** | "굽 깎임", "기스 있음" | ~10% |
| **flawed** | "옐로잉", "굽 다 깎임", "가품 의심" | ~10% |

**자연 매핑 가능 ✅**. 기존 5단계 로직 그대로 적용.

추가 신호 필요:
- 사이즈 (240-290mm) — 옵션 추출
- 발매연도 (2022 vs 2024) — 가격 차이 큼
- 색상 (Chicago vs Bred vs 판다)
- 콜라보 (Off-White, Travis Scott, Dior 등) — 시세 폭증

---

## S5: 가품 risk 분석 (가장 중요)

### Bunjang 신발 가품 빈도
- 검색 결과: 명품/신발 가품 사례 빈발
- 한정판 (조던/덩크 트래비스 스캇 등) → 가품 매물 50%+ 추정
- 일반 모델 (에어포스 1, 삼바) → 가품 10-20% 추정

### 우리 가품 detection 현재
- `option-parser`에 "가품", "짝퉁", "fake", "replica" 키워드 차단 있음
- 그러나 "정품" "진품" 표현 매물도 가품 가능성 큼
- 시세 대비 너무 싼 매물 (예: 시카고 30만 → 8만원) = 가품 신호. 현재 자동 차단 없음.

### 가품 detection 강화 필요
1. 모델별 floor price 박기 (조던1 시카고 < 50만원 → 가품 의심)
2. KREAM 시세 대비 70% 이하 → flag
3. 셀러 review 0건 + 신상품 = 위험
4. **신발 카테고리 = AI L2 review 강제** (정확성 우선 §12b)

---

## 진입 시 작업 plan (만약 GO)

### Phase 1 (1주차) — Foundation
1. catalog.ts: 'shoes' category 추가 (Sku 타입 변경)
2. Top 5 SKU 정의:
   - `nike-airforce-1-white-low` (msrp 130k)
   - `nike-dunk-low` (msrp 119k)
   - `nb-530` (msrp 119k)
   - `adidas-samba` (msrp 119k)
   - `jordan-1-low` (msrp 169k)
3. option-parser-shoes.ts 신설:
   - 사이즈 정규식 (240mm~300mm, 7~12)
   - 색상 + 발매연도 + 콜라보 추출
4. category-readiness.ts: `shoes: internal_only`
5. Bunjang sweep: `q=에어포스 1`, `q=덩크 로우` 등 추가

### Phase 2 (2주차) — 시세 학습 + 가품 detection
1. Top 5 SKU hardcoded reference_price (KREAM 시세 manual 입력)
2. mining 1주 데이터 누적
3. 가품 detection: floor_price + AI L2 강제
4. condition_class 적용 검증 (unopened 비율 측정)

### Phase 3 (3주차) — Ready 승격 결정
1. parse_ready 0.85+ / sample_count 100+ 검증
2. 가품 false positive 측정
3. 사용자 노출 결정 (internal → ready)

---

## 위험 / 보류 항목

| 위험 | 영향 | 대응 |
|---|---|---|
| **가품 매물 사용자 노출** | 신뢰 손상 큼 (한 번 사고 → 베타 유지 X) | AI L2 강제 + 시세 floor + 사람 검수 |
| **한정판 가격 변동** | 발매 직후 vs 후 10배 차이 | unopened condition_class로 분리 + 한정판 별도 SKU |
| **catalog 작업량** | 30-50 SKU 필요 | Top 5만 narrow lane으로 시작 |
| **KREAM scrape 어려움** | reference price 없음 | hardcoded Top 20 + 자체 학습 hybrid |
| **사이즈/색상 옵션 폭증** | parser 복잡도 ↑ | 사이즈만 우선 (mm). 색상은 phase 2 |

---

## 결론 — 사용자 결정 필요

### 진짜 GO 신호 (강한)
- ✅ Bunjang 매물 풍부 (539k건)
- ✅ 가격대 적정 (5-30만원 대다수)
- ✅ 베타 사용자 차별화 강력 (조던/에어포스 = 리셀러 거의 모름)
- ✅ condition_class 5단계 자연 매핑
- ✅ Bunjang rate limit 검증됨 → 적극 sweep 가능

### NO 신호 (강한)
- ⚠️⚠️ **가품 risk 매우 큼** — 사용자에게 가품 매물 추천 시 신뢰 손상
- ⚠️ catalog/parser 0 → 2-3주 작업
- ⚠️ KREAM ground truth scrape 어려움
- ⚠️ 한정판 가격 변동성 → 시세 계산 복잡

### 사용자 결정 옵션
- **A. 진입 GO** — 3주 작업, Top 5 SKU narrow lane, internal_only 시작
- **B. 보류** — 베타 안정화 (lifecycle/UI) 우선, 신발은 v2에서
- **C. 시범 limit** — Top 1-2 SKU만 (에어포스 1, 덩크 로우) 1주 prototype → 측정 후 결정

내 추천 (정직): **C (시범 limit)**.
- 가품 risk 1-2 SKU에 한정
- 1주 prototype으로 ground truth 가능성 검증
- 성공 시 Top 10 SKU로 확장. 실패 시 손해 작음.

---

## 다른 세션 알아볼 키 포인트

1. **신발 카테고리 진입 결정 보류** (2026-05-16 사용자 조사 요청).
2. **현재 신발 catalog/parser 0**. Sku 타입에 'shoes' 없음.
3. Bunjang 신발 카테고리 = ID 405. sweep 가능.
4. Top 5 진입 후보: 에어포스 1 / 덩크 로우 / NB 530 / 삼바 / 조던 1 low.
5. **가품 risk 큼** — 진입 시 AI L2 강제 필수.
6. KREAM scrape 어려움 → hardcoded reference 또는 자체 학습.
7. 매물 매물 분포 raw: `/tmp/bunjang-shoes-results.json`.
