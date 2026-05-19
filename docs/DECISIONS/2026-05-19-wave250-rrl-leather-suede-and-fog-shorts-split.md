# Wave 250 — RRL leather/suede narrow split + FOG shorts outlier 차단 + RRL knit 신설

- date: 2026-05-19
- type: catalog narrow split (additive — SKU 신설 + broad mustNotContain 보강)
- scope:
  - `clothing-polo-rrl-jacket-leather-suede` (신설)
  - `clothing-polo-rrl-shirt-leather-suede` (신설)
  - `clothing-polo-rrl-knit` (신설)
  - `clothing-polo-rrl-jacket-coat` (mustNotContain 보강 — leather/suede 차단)
  - `clothing-polo-rrl-shirt` (mustContain 보강 — 오버셔츠/웨스턴 추가)
  - `clothing-polo-rrl-shirt-pants` (mustNotContain 보강 — leather/suede/오버셔츠/웨스턴/카디건/스웨터/블레이저 차단)
  - `clothing-fog-essentials-shorts` (mustNotContain 보강 — 주니어/코어컬렉션/1977/그라미치/세트 차단)
- branch: `fix/p1-velocity-condition-confidence-2026-05-19`

## 배경

Wave 245 narrow split 효과 측정 후속. 여전히 CV 높은 narrow lane 3 개 추가 검증.

### Production sample (2026-05-19 측정)

#### a. `polo-rrl-jacket-coat` (CV 0.78, n=41)
가격대 cluster 분석:
- **leather/suede** (러프아웃/시얼링/뉴스보이/G-1/모토/플라이트/MA-1): n=15, avg ₩2,457,200 (₩250k~440만), CV 0.48
- **canvas/work** (트러커/덱자켓/캔버스/워크): n=7, avg ₩841k, CV 0.34
- **coat** (피코트/카코트/필드코트): n=6, avg ₩835k, CV 0.81 (대부분 ~₩500k, leather coat 1건만 ₩2.2M)
- **denim** (그리즐리/엔지니어/필드): n=10, avg ₩708k, CV 0.46
- **other**: n=8, avg ₩798k

→ leather/suede cluster 가 다른 bucket 대비 3x 가격 차이. 별도 narrow lane 분리 필수.

#### b. `fog-essentials-shorts` (CV 0.87, n=20)
outlier 매물 식별:
- "코어 컬렉션 오트밀 쇼츠" ₩399k (한정판)
- "1977/그라미치 X 알파 카고 쇼츠" ₩219k (collab)
- "주니어 10Y 반바지" ₩30k (kids)
- "후드 반바지 세트" ₩240k (set 매물 — single shorts 시세 왜곡)
- 정상 반바지: ₩35k~₩110k

→ split 대신 outlier mustNotContain 차단 (정상 풀은 동일 가격대 cluster).

#### c. `polo-rrl-shirt-pants` (Wave 247.1 후 분포)
```
clothing-polo-rrl-pants       n=12, p50 ₩280k, CV 0.36 ✓
clothing-polo-rrl-shirt       n=31, p50 ₩280k, CV 0.43 ✓
clothing-polo-rrl-shirt-pants n=78, p50 ₩357k, CV 0.85 ✗ (catch-all 너무 큼)
```

broad catch-all (n=78, CV 0.85) 안에 outlier 4건 검출 (러프아웃 스웨이드 셔츠/오버 셔츠/웨스턴, ₩1.2M~2.15M). 일반 셔츠 (p50 ₩280k) 대비 4~8x.

#### d. RRL knit/cardigan/sweater (n=11)
broad RRL 가 카디건/스웨터/니트 키워드 차단 중 → null 매칭 → 사용자 풀 진입 X.
production 11건 (₩63k~₩2.24M) — narrow lane 미신설로 운영자 풀에서도 안 보임.

## 결정

### 1. `clothing-polo-rrl-jacket-leather-suede` (신설)
- mustContain: RRL × (러프아웃/스웨이드/레더/가죽/시얼링/뉴스보이/모토/G-1/플라이트/MA-1/나바호/버팔로)
- mustNotContain: 키즈/스니커즈/액세서리/주얼리
- msrpKrw: 3,000,000 (production median 2.77M 기반)
- `clothing-polo-rrl-jacket-coat` mustNotContain 에 leather/suede 키워드 추가 → 새 narrow 우선 매칭

### 2. `clothing-polo-rrl-shirt-leather-suede` (신설)
- mustContain: RRL × (러프아웃/스웨이드/레더/가죽/염소가죽) × (셔츠/오버셔츠/워크셔츠/웨스턴)
- mustNotContain: 자켓/팬츠 (다른 lane 으로)
- defaultProductType: "shirt"
- msrpKrw: 1,800,000 (production median 기반)
- `clothing-polo-rrl-shirt-pants` mustNotContain 에 러프아웃/스웨이드/오버셔츠/웨스턴 추가

### 3. `clothing-polo-rrl-knit` (신설)
- mustContain: RRL × (카디건/cardigan/스웨터/sweater/니트/knit/터틀넥/와플/헨리니트/풀오버)
- mustNotContain: 스웨터 재킷 (jacket-coat 으로) / 키즈 / 액세서리
- defaultProductType: "knit"
- msrpKrw: 500,000 (production sample 기반)

### 4. `clothing-polo-rrl-shirt` (mustContain 보강)
- "오버셔츠" / "오버 셔츠" / "웨스턴" / "western" 추가 — broad catch-all 의 워크 오버 셔츠 매물 narrow 우선

### 5. `clothing-polo-rrl-shirt-pants` (mustNotContain 보강)
- leather/suede 키워드 차단 (`shirt-leather-suede` lane 으로)
- 오버셔츠/웨스턴 (narrow shirt 로)
- 워크팬츠/필드팬츠/플리츠 코듀로이/퍼티그 (narrow pants 로)
- 블레이저 (jacket-coat 으로)
- 카디건/스웨터 (knit 으로)

### 6. `clothing-fog-essentials-shorts` (mustNotContain 보강)
- 주니어/junior/10Y/12Y/8Y (kids 차단)
- 코어 컬렉션/core collection (한정판)
- 1977/그라미치/gramicci/알파/카고 쇼츠 (collab)
- 후드 반바지 세트/셋업/세트 팝니다 (single shorts 시세 왜곡 차단)

## 영향 (additive only)

- 신설 narrow 3 개 → broad 에서 null 매칭이던 매물이 narrow 로 진입 가능.
- 기존 narrow `jacket-coat` 의 leather/suede 매물은 새 narrow 로 이동 (rematch 후) — CV ↓ 예상.
- `shirt-pants` catch-all 의 outlier 매물도 narrow 로 이동 — CV ↓ 예상.
- FOG shorts outlier 차단 → CV 0.87 → 정상 풀만 남으면 0.4~0.6 예상.

## 검증

- production sample SQL 측정 (DECISIONS/2026-05-19-wave250 와 production SQL 출력 참조).
- rematch 후 narrow lane n / CV 재측정 필요 (별도 wave).

## 참고

- Wave 245 (jacket-coat 신설 / RRL knit 의도 — 실제로 신설 안 됨 → Wave 250 에서 박음)
- Wave 247.1 (shirt/pants 1st split)
- Wave 249 (pool builder Option 3 — sku_median=0 narrow gate)
- 사용자 정책 (memory: project_supply_vs_demand_priority, project_core_principle_consumer_friendly)
