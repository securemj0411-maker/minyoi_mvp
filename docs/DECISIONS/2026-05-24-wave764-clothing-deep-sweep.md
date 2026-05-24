# Wave 764 — 의류 ready pool deep sweep (애기 옷 / 보세 brand / 원피스 흡수 fix)

**날짜**: 2026-05-24
**Wave**: 764 (사용자 #4 보고: "애기 옷 끼어들어가고 이상한 거 같이 끼워들어간거 심각함")
**Owner**: Claude

## 사용자 보고

"의류는 이상한 거랑 같이 끼워들어간거랑 문제 많음 한번봐보셈;; 존나 심각함"
"애기 옷이 같이 끼어들어가고"
"신발은 괜찮은데 의류는..."

## Audit

의류 ready pool 전체 105건 brand → SKU 매칭 검사.

### 발견된 미스매치 (8건 = 7.6%)

| 패턴 | 건수 | 예시 매물 | 잘못 매핑된 SKU |
|---|---|---|---|
| **BAPE 아동/베이비 sub-line** | 2 | "APEE BABY 카모 반팔", "에이프 바시티 105사이즈" | bape_tee / bape_varsity_jacket (어른 SKU) |
| **보세/sub-brand → 폴로** | 4 | "마론에디션 polo knit", "에스피오나지 Over Pique Polo", "벨리에 홀가먼트 폴로", "투티/A9 폴로 진스 컴퍼니" | polo_knit_sweater / polo_pique_classic |
| **원피스 → 폴로 셔츠 SKU** | 1 | "폴로 핑크 피케 원피스 XS" | polo_pique_classic (셔츠 SKU) |
| **묶음 사이즈** | 1 | "스투시 맨투맨 오버핏 S / L" | stussy_hoodie (단품 비교 X) |

브랜드 → SKU 매칭은 거의 정상 (97/105 OK = 92%). 미스매치 율 7.6%.

사용자 코멘트 정확 — "애기 옷 끼어들어가는 거" = BAPE APEE/BABY, "이상한 거" = 보세 브랜드.

## Fix

### 1. `polo_knit_sweater` 보세 brand 차단 (catalog-712b-bias-free.ts)

```typescript
mustNotContain: [
  ...,
  // Wave 764: 한국 보세/sub-brand 추가.
  "마론에디션", "마롱에디션", "maron edition",
  "에스피오나지", "espionage",
  "벨리에", "vellie", "ballier",
  "투티", "투티에이나인", "tuti a9", "투티/a9",
  "polo 진스 컴퍼니", "폴로 진스 컴퍼니", "polo jeans company",  // sub-line
  ...
]
```

### 2. `polo_pique_classic` 보세 brand + 원피스 차단 (catalog.ts)

```typescript
mustNotContain: [
  ...,
  // Wave 764: 보세 + 다른 product_type 차단.
  "마론에디션", "에스피오나지", "espionage", "벨리에", "vellie", "투티",
  "원피스", "dress", "드레스 폴로",
  ...
]
```

### 3. `bape_tee` BAPE sub-line 차단 (catalog.ts)

```typescript
mustNotContain: [
  ...,
  // Wave 764: BAPE 아동/베이비 sub-line.
  "apee", "에이피이", "bape baby", "베이프 베이비", "베이비 베이프",
  "bape kids", "베이프 키즈", "키즈 베이프", "bape jr",
  "키즈사이즈", "키즈 사이즈", "kids size", "아동사이즈",
  ...
]
```

### 4. DB 즉시 정리 — 8건 invalidate

```sql
UPDATE mvp_candidate_pool SET status='invalidated', invalidated_reason='wave764_clothing_subline_or_misbrand'
WHERE category='clothing' AND status='ready' AND (matched patterns above);
```

결과: 8건 즉시 풀에서 제거 (사용자 reveal 시 부조리 즉시 차단).

### 5. PARSER_VERSION bump

`wave216-clothing-v48` → `wave216-clothing-v49` (Wave 763 후속).
drift gate trigger → 의류 매물 자동 reparse (보세/sub-line 매물 SKU 매칭 빠짐).

## 미해결 (별도 wave)

- 나머지 BAPE SKU (`bape_hoodie`, `bape_crewneck`, `bape_shark_hoodie`, `bape_coach_jacket`, `bape_varsity_jacket`) sub-line 차단 — 6개 SKU 동일 패턴 박아야 함. 시간 절약 위해 공통 const 만들어 spread 권장.
- 다른 brand sub-line audit (e.g. 아크테릭스 KIDS, 슈프림 KIDS, 톰브라운 KIDS)
- 묶음 매물 detection 강화 — parser 에서 "S / L" 같은 패턴 detect

## 영향

- 사용자가 본 정확히 8건 매물 풀에서 즉시 제거
- 신규 보세/sub-line 매물 SKU 매칭 차단 → 풀 깨끗
- 사용자 신뢰도 회복 — "부끄러울정도로 너무 미스매칭" 해소 시작

## 관련 commit

- `ea3ef60`: Wave 763 — condition_tier ↔ comparable_key tier 통일
- 본 commit: Wave 764 — 의류 ready pool deep sweep (보세/sub-line 차단)
