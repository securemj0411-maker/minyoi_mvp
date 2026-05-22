# Wave 714 — 신발/의류 condition grading 체계 (5-tier S/A/B/C/D, raw text 기반)

**Date**: 2026-05-23
**Scope**: 신발/의류 reseller 매물 상태 분류 + 인접 tier 가중치 시세. Crocs 별도 + 의류 cluster-relative.
**Source**:
- 미뇨이 신발 raw sweep 10,829건 (agent abc358079888d9a69)
- 신발 5-axis cross-tab 11,087건 (agent ac955968c16adba21)
- 의류 raw sweep 11,167건 (agent acb8fe3ea66f00975)
- 의류 5-axis cross-tab 11,543건 (agent a2d7c17a34f40235e)

## 사용자 결정

- 5단계 (S/A/B/C/D) — 한국 reseller 자체 라벨과 align (의류 sweep n=123 자율등급 발견)
- Crocs (casual_parts) 만 별도 — 박스 axis 무력 (3%), 지비츠가 핵심
- 임의 정의 X — 데이터 자연 cluster 기반 (4 mode + C/D 분리)

## 5-tier 정의 (cross-tab raw matrix 기반)

| Tier | 조건 | ratio | n | 사용자 예시 |
|---|---|---|---|---|
| **S** | strong 2축 이상 + 하자 없음 | 1.85~2.31x | ~150 | 박스+실착 1-2회+kream → 2.02x ✓ |
| **A** | strong 1축 + 하자 없음 | 1.4~1.7x | ~1,100 | 박스 단독 (1.77x) / kream 단독 (1.49x) / 미시착 단독 (1.40x) |
| **B** | default / 약한 매칭 (대다수) | 0.9~1.15x | ~7,300 | 매물 description 부실 포함 |
| **C** | 경미 하자 또는 wear=used | 0.5~0.7x | ~280 | 보풀/먼지/스크래치/사용감 있음 |
| **D** | 빈티지 / heavily_used / 심각 하자 | 0.35~0.5x | ~700 | 굽 닳음 / 이염 있음 / 빈티지 |

**strong axis 정의 (S/A 판정 핵심)**:
- A axis: `wear ∈ {unworn, worn_1to2, worn_3to5}`
- B axis: `box == full` (풀구성/풀박/완전체)
- C axis: `auth ∈ {kream, store}`

→ 위 3개 중 2개 이상 동시 = S, 1개 = A.

## 5-axis 라벨링 (data-driven, 임의 X)

| Axis | 값 후보 | raw 표현 (자세히는 `shoe-axes.ts`) |
|---|---|---|
| A (사용감) | unknown / unworn / worn_1to2 / worn_3to5 / used / heavily_used / vintage | 미시착 / 1회 착용 / 2-3회 / 사용감 있음 / 많이 신음 / 빈티지 |
| B (박스) | unknown / full / box_included / box_only / no_box / box_damaged | 풀박/완전체 / 박스 포함 / 박스만 / 박스 없음 / 박스 손상 |
| C (정품 anchor) | none / kream / store / musinsa | kream/크림 / 매장판/백화점 / 무신사 |
| D (하자) | none / minor / major | 보풀/먼지/스크래치 / 이염 있음/굽 닳음/터짐 |
| E (신발 특화) | none / extra_laces / insole_changed / washed | 여분끈 / 깔창 교체 / 세탁 |

**Negation 차단** — "이염 없음", "안 닳음", "오염 X" 등 정상 처리. `shoe-axes.ts:matchesKeyword`.

## False positive 철학 (사용자 요구)

- description < 50 char + 매칭 0건 → `UNKNOWN` tier (confidence 0.2)
- enum prior (`bunjang_condition_label`) 만 있으면 confidence 0.4 — 보수적 (LIKE_NEW 의 raw 데미지 15.9% 섞임 인지)
- UNKNOWN tier weight = 0.85 — baseline × 0.85. **사용자 비싸게 사도록 유도 X**
- `confidence` field 0~1 — UI 신뢰도 표시 필수

## 가중치 시세 (인접 tier fallback)

```
final_price(tier_X) = α × median_X + (1 - α) × weighted_neighbor_avg
  α = min(1, n_X / N_THRESHOLD)    // N_THRESHOLD = 6
  w_i = 1 / (tier_distance + 1)    // 인접=1/2, 두칸=1/3
```

- **upward fallback 차단 (default)** — D 매물에 S 시세 fallback 금지. 사용자 코멘트 #178 정책 동일.
- own sample ≥ 6 → α=1, 100% own median.
- own sample 0 → α=0, neighbor 만 weighted average.

## Brand cluster

| Cluster | Brand | baseline | kream lift | 처리 |
|---|---|---|---|---|
| premium_snk | Jordan/Yeezy/NB/Salomon/On | ₩145K | +24% | 통합 등급 |
| run_tech | Asics/Hoka | ₩133K | +20% | 통합 등급 |
| volume_vintage | Nike/Adidas/Converse/Vans | ₩80K | **+56%** | 통합 등급 (lift 가장 명확) |
| **casual_parts** | Crocs | ₩45K | (sample 부족) | **별도 grading** (`shoe-crocs.ts`) — 지비츠 axis |
| generic | 미분류 | — | — | 통합 등급 fallback |

**Crocs 만 따로**: 박스 1% 만 매칭 → S 영원히 안 나옴 문제. Crocs S = 미시착 + 지비츠/스트랩 + (kream 또는 매장) 2축 이상.

## 데이터 한계 (인지)

- A0/B0/C0/D0 default 비율 **70~96%** — 셀러가 raw text 에 표현 안 쓰는 매물 대다수
- 매물 대부분이 `B` (baseline) 로 떨어짐 — UI 에서 "정보 부족" 표시 필요
- 모순 cell: A1_unworn × D3_major n=20 (1.75x) — negation 차단 빈틈. 다음 sweep 보완 예정
- 5-axis 동시 매칭 단 5건 — 4-axis 까지가 통계 한계

## 의류 등급 — 신발과 같은 5-tier + 의류 axis 조정

의류 cross-tab 결과 (agent a2d7c17a34f40235e, n=11,543):

| 항목 | 신발 | 의류 | 함의 |
|---|---|---|---|
| Cluster baseline | 1.8x 차이 | **5x** (premium_archive ₩350K vs casual_mass ₩72K) | cluster-relative ratio 필수 |
| 박스 axis | 풀구성 1.77x | 97.9% B0_unknown | 의류 박스 무력 |
| 시즌 SS/FW | 없음 | **3.27x** (단일 최강) | 의류 strong axis 추가 |
| 수선/줄임 | negative (데미지) | **+1.59x (positive)** | A+ flag (등급 가산) |
| 빈티지 | mild neutral | 0.61x (낡음) | D tier |
| 구제 | 없음 | **0.42x** | D tier |
| 콜라보 | 약함 | 1.67x | 의류 strong axis |
| 자율등급 S/A/B급 | 거의 없음 | 1.78x (n=111) | 의류 strong axis |
| X/10 점수 | 없음 | 0.75x (negative) | C tier |

### 의류 strong axis (S/A 판정 핵심)
- A axis: `wear ∈ {unworn, worn_1to2, worn_3to5}`
- B axis: `box ∈ {full, tag_attached}` (의류는 box 약함 — 가중치 ↓)
- C axis: `auth ∈ {kream, store, season}` (**season 포함 — 의류 only**)
- E axis: `extra ∈ {collab, self_grade}` (의류 only strong)

→ 위 4개 중 2개 이상 동시 = S, 1개 = A.

### A+ flag (등급 추가 X, multiplier)
- `tailored`: `damage = repair_pos` (수선/줄임 사이즈 맞춤) — +10%
- `seasonAnchor`: `auth = season` — UI 표시 (premium_archive marker)
- `collab`: `extra = collab` — UI 표시 (한정 marker)

### Cluster-relative pricing
- 의류는 premium_archive 의 default 가 신발 S 등급과 비슷 → universe-relative 시 등급 미끄러짐.
- `applyClusterRelativePricing(baseMedian, grade, tierWeight)` — cluster baseline 기준 ratio 적용.

## Template noise 처리 (sanitize 단계)

발견: A1_unworn × D3_major n=82 모순 cell — 셀러 boilerplate 등급표 ("S: 새상품 / A: 사용감 / B: 스크래치 이염") 가 description 에 박혀 keyword 매칭 됨. 의류만 broad 발생, 신발도 같은 문제.

해결: `sanitizeForGrading()` — keyword 매칭 전 전처리:
1. **Grade rubric line 제거**: 2회 이상 "S:..." / "A:..." 패턴 → 등급표로 간주, 줄 자체 제거
2. **"오래 입을 수 있" 마스킹**: A5_heavily_used false positive 차단 (durable positive copy)
3. (향후) 마케팅 boilerplate 추가

신발/의류 axes 모두 sanitize 후 매칭.

## 코드 구조

```
mvp/src/lib/grading/
├── types.ts                      # 5-tier + AxisLabels (신발) + ClothingAxisLabels (의류) + ConditionFlags
├── text-sanitize.ts              # boilerplate 등급표 / 시제 모호 제거 (공통)
├── shoe-axes.ts                  # 신발 raw → 5-axis (sanitize 적용)
├── shoe-condition.ts             # 신발 → S/A/B/C/D
├── shoe-crocs.ts                 # Crocs 전용 (지비츠 axis)
├── clothing-axes.ts              # 의류 raw → 5-axis (sanitize 적용)
├── clothing-condition.ts         # 의류 → S/A/B/C/D + A+ flag + cluster-relative pricing
├── neighbor-weighted-price.ts    # α-weighted neighbor average
└── index.ts                      # entry point
```

기존 `condition-policy.ts` / `condition-fallback.ts` (전자기기 unopened/mint/clean) 와 **별도 모듈**. mixing 금지.

## Integration 진행 상황 (2026-05-23 기준)

**현재 branch**: `claude/amazing-agnesi-381a16` (worktree). **production deploy 안 됨** — main merge + Vercel deploy 필요.

### ✅ Stage 1 — Parser 통합 (완료)
- [parsers/wave92-fashion-mobility.ts](../../src/lib/parsers/wave92-fashion-mobility.ts) 의 `parseFashionMobility` return 시 `parsedJson.condition_grade` 박음 (line 1318 근처)
- 신발 → `gradeShoeCondition`, 의류 → `gradeClothingCondition`, bag/bike → null (정책: 가방 ready X)
- Backward compatible: `parsedJson` 은 jsonb 라 schema 변경 없이 추가 데이터 수용
- `computeConditionGrade(category, title, description, enumLabel)` helper 추가

### ✅ Stage 2 — DB schema migration (적용 완료)
- [supabase/migrations/20260523120000_wave714_condition_grading.sql](../../supabase/migrations/20260523120000_wave714_condition_grading.sql)
- Supabase 적용: `mcp__supabase__apply_migration` (name=`wave714_condition_grading`) → `{"success":true}`
- 추가 column 4개 (모두 NULL 허용, default null):
  - `condition_tier text` — S/A/B/C/D/UNKNOWN
  - `condition_cluster text` — brand cluster
  - `condition_confidence numeric` — 0~1
  - `condition_flags jsonb` — `{tailored?, seasonAnchor?, collab?}`
- composite index `idx_mvp_listing_parsed_condition_tier (category, condition_tier) WHERE condition_tier IS NOT NULL`
- 검증 (적용 직후):
  - mvp_listing_parsed 전체 row: **86,581** (이전 86,484 + 신규 97건, 정상)
  - condition_class 채워진 row: **86,581** (전체) — 기존 grouping key 100% 보존
  - mvp_market_price_daily 시세 row: **42,791** (그대로)
  - mvp_market_velocity_daily velocity row: **8,194** (그대로)
  - 새 column 4개 모두 NULL (예상대로 — backfill 전)
- **데이터 손실 0 확인**

### ✅ Stage 3 — Column write 통합 (완료)
- [option-parser.ts:2238](../../src/lib/option-parser.ts) 의 `toParsedListingRow` 가 `parsed.parsedJson.condition_grade` 에서 분리 write
- 신발/의류 새 매물 parse 시 자동 채워짐. 전자기기 매물 → grade=null → 모든 grading column null 유지
- typecheck 통과 (신규 코드 에러 0)

### ✅ Stage 3b — Chip 정규화 (Wave 714b, 완료)

**사용자 요구**: "박스도 잇고 실착 적을수도잇고 다른 chip도 될수도잇고 동시에" + "이식성 강하게 정규화" + "/me 페이지 상세보기에서 chip".

**설계**:
- chip key 형식 `<axis>:<value>` (예: `wear:unworn`, `box:full`, `auth:kream`, `extra:charms`)
- listing 당 multi-chip 동시 (axis 5~6개 매칭 → 최대 5~6 chip)
- DB column `condition_chips text[]` + GIN index — 특정 chip 보유 매물 query 효율
- UI 한국어 라벨 + 색상 mapping: `grading/chips.ts:CHIP_LABELS`
- **이번 wave 는 positive only** (negative chip 은 사용자 결정 — 다음 세션)

**Migration**:
- [supabase/migrations/20260523130000_wave714b_condition_chips.sql](../../supabase/migrations/20260523130000_wave714b_condition_chips.sql)
- Supabase 적용: `mcp__supabase__apply_migration` (name=`wave714_condition_chips`) → `{"success":true}`

**Chip key list (positive only)**:

신발:
- `wear:unworn` / `wear:worn_1to2` / `wear:worn_3to5`
- `box:full` / `box:box_included` / `box:box_only`
- `auth:kream` / `auth:store` / `auth:musinsa`
- `extra:extra_laces` / `extra:insole_changed`
- `extra:charms` (Crocs 한정 — 지비츠/스트랩)

의류:
- `wear:unworn` / `wear:worn_1to2` / `wear:worn_3to5`
- `box:full` / `box:tag_attached` / `box:tag_only_cut`
- `auth:kream` / `auth:store` / `auth:musinsa` / `auth:season` (시즌 SS/FW — 의류 only)
- `damage:repair_pos` (수선 — 의류 only positive)
- `extra:collab` / `extra:self_grade`

**활용처** (이식성):
- UI chip badge (admin-pool-browser / pack-reveal-modal / user-reveal-dashboard 3 화면)
- /me 페이지 상세보기 ("실착 1-2회 · 박스 포함 · KREAM 인증")
- 필터 query (예: kream + 풀구성 매물만 검색)
- 시세 분석 (특정 chip 보유 매물의 가격 분포)
- 향후 ML feature engineering

### 🔜 Stage 4 — Backfill (deploy 후 자연 진행 ETA 2일)

**전제**: production deploy 후부터 시작. 현재 worktree branch 라 deploy 안 됨 → 0건 진행 중.

**Deploy 후 reparse rate 실측 (2026-05-23 측정)**:
| Category | Total | 24h reparse | 1h reparse | ETA |
|---|---|---|---|---|
| 신발 | 18,080 | 9,445 (52%) | 397 | ~1.9일 |
| 의류 | 11,882 | 7,605 (64%) | 709 | ~1.6일 |

Wave 713 의 `title_triage_v2` bump (이미 박힘) cron 이 활발히 progressive reparse 중. deploy 만 하면 자연 채움.

**가속 옵션** (필요 시): `score_dirty` 트리거 — 신발/의류 row 전체 강제 reparse. 수시간 안에 완료 but API/DB load spike.

### 🔜 Stage 5 — 시세 query 통합
- `band-aware-median.ts` / `market-source` 등에서 `weightedNeighborPrice` + `applyClusterRelativePricing` 호출
- sample 부족 tier 는 인접 tier 가중평균 (upward fallback 차단)
- 의류는 cluster-relative ratio 필수 (premium_archive vs casual_mass baseline 5배 차이)

### 🔜 Stage 6 — UI 노출
- pack-reveal-modal / user-reveal-dashboard / admin-pool-browser **3 화면 다 박기** (사용자 memory: UI 변경 시 3 화면 모두 적용)
- tier badge (S/A/B/C/D color coding) + confidence indicator (< 0.4 시 "정보 부족") + flags (tailored=수선/season=시즌/collab=콜라보)

## 미해결 / 모니터링

- **Template noise 추가 패스**: 셀러 boilerplate sample 더 보고 sanitize 패턴 확장 (특히 의류).
- **모순 cell 재검증**: A1_unworn × D3_major n=82 (1.75x) 가 sanitize 후 줄어드는지 backfill 후 측정.
- **A0/B0 default 비율 70~96%**: 매물 대다수 UNKNOWN/B 로 떨어짐 — UI 신뢰도 표시 + reseller 가 더 자세한 description 쓰도록 유도 UX 검토.

## 관련 파일

**Grading module (신규)** — `mvp/src/lib/grading/`
- [types.ts](../../src/lib/grading/types.ts) — ConditionTier / AxisLabels (신발) / ClothingAxisLabels (의류) / ConditionFlags / TIER_WEIGHT
- [text-sanitize.ts](../../src/lib/grading/text-sanitize.ts) — boilerplate 등급표 / 시제 모호 제거 (공통)
- [shoe-axes.ts](../../src/lib/grading/shoe-axes.ts) — 신발 raw → 5-axis (sanitize 적용)
- [shoe-condition.ts](../../src/lib/grading/shoe-condition.ts) — 신발 → S/A/B/C/D
- [shoe-crocs.ts](../../src/lib/grading/shoe-crocs.ts) — Crocs 전용 (지비츠 axis 가 박스 자리)
- [clothing-axes.ts](../../src/lib/grading/clothing-axes.ts) — 의류 raw → 5-axis (sanitize 적용)
- [clothing-condition.ts](../../src/lib/grading/clothing-condition.ts) — 의류 → S/A/B/C/D + A+ flag + cluster-relative pricing
- [neighbor-weighted-price.ts](../../src/lib/grading/neighbor-weighted-price.ts) — α-weighted neighbor average
- [index.ts](../../src/lib/grading/index.ts) — entry point

**기존 모듈 수정**:
- [src/lib/parsers/wave92-fashion-mobility.ts](../../src/lib/parsers/wave92-fashion-mobility.ts) — `parseFashionMobility` 가 `parsedJson.condition_grade` 박음 + `computeConditionGrade` helper
- [src/lib/option-parser.ts:2238](../../src/lib/option-parser.ts) — `toParsedListingRow` 가 4 column 분리 write

**DB schema**:
- [supabase/migrations/20260523120000_wave714_condition_grading.sql](../../supabase/migrations/20260523120000_wave714_condition_grading.sql) — applied (2026-05-23)

**Agent ID (sweep raw 결과 — 다른 세션에서 재참조 시)**:
- 신발 sweep (n=10,829): `abc358079888d9a69` — 6-tier 초기 분석
- 신발 5-axis cross-tab (n=11,087): `ac955968c16adba21` — 자연 4 cluster 발견, 사용자 결정 근거
- 의류 sweep (n=11,167): `acb8fe3ea66f00975` — 의류 only axis 9개 발견
- 의류 5-axis cross-tab (n=11,543): `a2d7c17a34f40235e` — cluster baseline 5x 차이 + template noise 발견

## 미해결 / 모순 (raw text 한계)

- "거의 새것" (102k) vs "거의 새상품" (147k) — 1.45x 차이. 표현 자체에서 분리 어려움
- "사용감 없음" (0.6x) — 강조 시점에 이미 사용된 매물 (negative correlation, signal 무시)
- "세탁" (0.66x) — 운동화 세탁 통과인데 가격 ↓ — C tier 분류
- A1_unworn × D3_major n=20 (1.75x) — negation 차단 빈틈 (다음 sweep 보완)
- A0_unknown 70.8% — raw text 부실 매물 대다수
