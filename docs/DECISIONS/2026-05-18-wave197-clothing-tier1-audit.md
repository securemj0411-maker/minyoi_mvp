# Wave 197 — 의류 카테고리 Tier 1 사전 sweep audit (2026-05-18)

## 배경

사용자: "스투시 아니더라도 옷 어때? 인기 매물? 여성이던 남성이던?"

→ Tier 1 brand 3개 (폴로 / 노스페이스 / 스투시) catalog 박기 **전에** sweep 조사 박음.
사용자 정책: project_wave90_source_diversification "친화도 ⭐⭐⭐인데 차익 fail" 함정 사전 차단.

## sweep 결과 — Tier 1 brand 검증

### 폴로 랄프로렌 (7일 raw 419건)

| 카테고리 | 건수 | 평균가 | p25 | median | p75 | faved |
|----------|------|--------|-----|--------|-----|-------|
| 기타 | 146 | 209K | 37K | 69K | 180K | 5 |
| **반팔 티셔츠** | **130** | 43K | 20K | **35K** | 59K | 1 |
| 셔츠 (드레스) | 56 | 63K | 40K | 53K | 70K | 3 |
| 가방 | 24 | 258K | 46K | 88K | 221K | 10 |
| 긴팔 티셔츠 | 23 | 49K | 17K | 39K | 73K | 1 |
| **피케 폴로셔츠** | **18** | 92K | 59K | 88K | 109K | 2 |

**핵심**: 반팔 티셔츠 130건 / 피케 18건이 시그니처. 가격대 35~88K = **일반인 친화 ⭐⭐⭐**.

### 노스페이스 (7일 raw 153건)

| 카테고리 | 건수 | median | faved |
|----------|------|--------|-------|
| 기타 | 80 | 50K | 3 |
| **가방** | **49** | **55K** | **5** |
| 고어텍스 | 16 | 47K | 1 |
| 패딩 | 9 | 49K | 3 |
| 플리스/눕시 | 4 | 72K | 10 |

**top 매물 sample (faved 8+)**:
- 퍼플라벨 토트백 60K (faved 48)
- 미니샷 백팩 70K (faved 45)
- 퍼플라벨 숄더백 75K (faved 38)
- 핫샷 백팩 70K (faved 23)
- 눕시 뮬 89K (faved 21)
- 보레알리스 부츠 85K (faved 16)

**경고 signal**:
- 슈프림 collab 백팩 400K — **한정판 inflation 함정** (가품 risk + 가격 5배)
- 퍼플라벨 (일본 라인) vs 화이트라벨 (한국) — 가격대 다름. 별도 SKU 분리 필요.
- 고어텍스 등산화 20K — 사용감 매우 큰 매물 다수, 시세 끌어내림 위험

### 스투시 (7일 raw 195건)

| 카테고리 | 건수 | median | faved |
|----------|------|--------|-------|
| **기타 (한정판 다수)** | **178** | **150K** | 7 |
| 가방 | 13 | 50K | **19** |
| **반팔 티셔츠** | **3** | 37K | **125** ⚠️ |

**위험 signal**:
- 스투시 기타 178건 median 150K — **한정판 / collab / 컬렉션** 다수. 정상 retail 5~10만 vs 한정판 30~50만 가격차 큼.
- 반팔 3건 avg_faved **125** = 폭발적 인기. 단 sample 작아 매물량 부족.
- 가품 risk 매우 큼 (스투시 가품 시장 큰 편)

## 종합 판단

### ✅ 강점
- Tier 1 3개 brand 모두 매물량 충분 (총 7일 767건)
- 폴로/노스페이스 가격대 일반인 친화 (5~10만대)
- 시그니처 모델 명확 (반팔 / 피케 / 백팩 / 가방)

### ⚠️ 사전 함정 발견

1. **사이즈 분리 필요** — 의류는 S/M/L/XL/95/100 표기 다양. 신발 사이즈 narrow lane 패턴 적용 필수.
2. **퍼플라벨 (일본) vs 일반 라인** — 가격 1.5~2배 차이. 별도 SKU.
3. **한정판/collab inflation** — 슈프림×노스페이스 / 스투시 시즌 컬렉션. 차단 또는 narrow SKU 분리.
4. **가품 risk** — 의류 가품 시장 매우 큼. Wave 196 신발 0.25 floor 보다 더 strict (0.30~0.35) 적용 필요.
5. **시즌 매물** — 5월 현재 비시즌 패딩 9건만. 겨울 시즌 매물 폭발 예상.
6. **퍼플라벨 신발 (눕시 뮬, 등산화)** — 의류 카테고리 아닌 신발에 catalog? 별도 SKU 필요.

## 정책 결정 필요 (사용자)

### 1. 카테고리 분리 방식
- **A**: 새 카테고리 `clothing` 만들고 시작 (신발/가방과 분리)
- **B**: 기존 `bag` 카테고리에 의류도 포함 (의류+가방 = apparel)

→ 추천: **A** (clothing 분리. 시세 / 가품 floor / readiness 독립 관리)

### 2. 사이즈 분리 정책
- **C**: narrow lane S/M/L/XL 분리 (시세 정확 ↑, sample 작아짐 ↓)
- **D**: broad SKU (사이즈 무관, sample 풍부)

→ 추천: **D** broad 시작 → 측정 후 narrow 승격 (신발 broad → narrow 패턴)

### 3. 한정판 / collab 매물
- **E**: mustNotContain 강력 차단 ("슈프림 collab", "한정판", "FW XX", "20XX SS")
- **F**: 별도 narrow SKU 분리 (한정판 가치 인정)
- **G**: 차단 X — 자연스럽게 시세 inflation

→ 추천: **E** (한정판 차단). 일반인 친화 정책 일치.

### 4. 가품 floor (msrp 대비 ratio)
현재 신발/가방 0.25. 의류는 더 strict?
- **H**: 0.25 동일
- **I**: 0.30 (의류 가품 더 많아서)
- **J**: 0.35 (보수적)

→ 추천: **I** 0.30. 의류는 가품 시장이 신발/가방보다 더 큼.

### 5. 첫 SKU 후보 list (사용자 확인)

**폴로** (5개 — broad):
- shoe-polo-pony-tee (반팔 티셔츠 포니로고)
- shoe-polo-pique-classic (피케 폴로셔츠 클래식)
- shoe-polo-oxford-shirt (옥스포드 셔츠)
- shoe-polo-cap (모자/캡)
- shoe-polo-cardigan (가디건/스웨터)

**노스페이스** (6개 — narrow lane 가능):
- clothing-tnf-nuptse-1996 (눕시 1996 패딩 — 시즌)
- clothing-tnf-mountain-jacket (마운틴 자켓 — 고어텍스)
- clothing-tnf-denali-fleece (데날리 플리스)
- bag-tnf-borealis (보레알리스 백팩)
- bag-tnf-hotshot (핫샷 백팩)
- shoe-tnf-nuptse-mule (눕시 뮬 슬리퍼)

**스투시** (3개 — broad):
- clothing-stussy-basic-tee (basic 반팔, 8ball, world tour)
- clothing-stussy-hoodie (basic 후드)
- bag-stussy-waist-bag (웨이스트 백)

## 다음 액션 (사용자 결정 후)

1. 카테고리 분리 (A 추천) + sku-base-options + category-readiness 박기
2. SKU catalog 추가 (위 후보)
3. queryFamily에 의류 brand 매핑 추가
4. Wave 196 가품 floor 의류 카테고리 0.30 (I 추천)
5. mustNotContain 한정판 / collab 강력 차단 (E 추천)
6. internal_only 시작 → 24h 측정 → ready 승격

## 사용자 결정 필요 항목 정리

| 항목 | 옵션 | 추천 |
|------|------|------|
| 카테고리 분리 | A clothing 신규 / B bag 포함 | **A** |
| 사이즈 정책 | C narrow / D broad | **D** broad 시작 |
| 한정판/collab | E 차단 / F narrow 분리 / G 허용 | **E** 차단 |
| 가품 floor ratio | H 0.25 / I 0.30 / J 0.35 | **I** 0.30 |
| 시작 SKU | 폴로 5 / 노스페이스 6 / 스투시 3 (14개) | 위 list 그대로 |

전체 추천 박을지, 항목별 변경 있는지 확인 받기.
