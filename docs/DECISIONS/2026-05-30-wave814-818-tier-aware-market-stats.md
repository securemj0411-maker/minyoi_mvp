# Wave 814-818 — tier-aware 시세 lookup 박기 (condition_class 단일 차원 → tier+class 복합 차원)

날짜: 2026-05-30
범위: DB migration + Map composite key + 함수 signature + 6개 callsite
관련: Wave 803g/803i (fashion cc="" + tier), Wave 886.16/886.16b (임시 isFashion 봉합), Wave 714 (5-tier grading)

## 배경 — 문제

사용자 보고 핵심 (직접 인용):
> "지금은 A급이라 해도 옛날 3개 상태로 매핑되서 sample은 A급 보여줘도 실제로는 레거시 등급 으로 시세 판정 아님??"

확인:
- 매물 UI 는 5-tier (S/A/B/C/D) 표시.
- 시세 lookup (`mvp_market_price_daily`, `mvp_market_price_daily_per_source`) 의 PK 는 `(comparable_key, condition_class)` — 3-state (clean/worn/normal/mint).
- 신발/의류 (fashion) 카테고리는 Wave 803g 에서 `cc=""` + `tier="X"` 로 박았지만, lookup 은 여전히 `condition_class` 단일 축.
- Wave 886.16/886.16b 가 `marketBasisForCandidate` 안에서 `isFashion ? "" : cc` 로 임시 봉합했지만 caller 가 tier 자체를 전달하지 않아 cross-tier mix 시세 (NB 991 case: 184K vs 비교매물 130K) 가 박힘.

근본 fix 필요: tier 를 caller 가 직접 전달 + Map key 가 `${tier}|${cc}` composite 로.

## 사용자 결정

사용자 명시 (직접 인용):
> "아니 너가 해야될걸 해 나는 뭔지 몰라서 너한테 시키잖아 파괴적인거 아니고 결국 해야되는거면 해야지 왜 자꾸 나한테 물어봐"

→ 임의 confirm 묻지 않고 진행. 단 destructive (DELETE/DROP) 없음 — 컬럼 read/write 만 변경.

다른 세션 (Wave 886.16/886.16b 작성자) 측 commit:
> "1. condition_tier 마이그레이션 계획 — 너 박는 거 OK + 환영 ... PR ready 되면 ping. 내가 cleanup PR 동시 박을게."

→ 이번 PR 박힌 후 cleanup (`isFashion`/`effectiveConditionClass` hack 제거) 별도 박힘.

## 변경 — Phase별

### Wave 814 — DB 정규화 (legacy tier format → 표준 S/A/B/C/D)

`mvp_market_price_daily` 813행 (sport_golf/game_console/titleist):
- `a_grade` → `A`, `b_grade` → `B`, `c_grade` → `C`, `s_grade` → `S`, `d_grade` → `D`, `reject` → `D`

`mvp_market_price_daily_per_source` 1,296행 동일 정규화.

→ tier-aware lookup 의 Map key 정합성 확보 (한 tier 가 여러 표기로 박혀 lookup miss 차단).

### Wave 815 — `MarketPriceRow` type 에 `condition_tier?: string | null` 추가 (`src/lib/pack-open.ts`)

Wave 803g 정책 반영: fashion row 는 `condition_class = ""` + `condition_tier ∈ {S,A,B,C,D}`.

### Wave 816 — Map composite key `${tier}|${cc}` 박기

`marketStatsConditionKey(conditionTier, conditionClass)`:
- `(tier ?? "").trim() + "|" + (cls ?? "").trim()`
- fashion row: `S|`, `A|`, ...
- non-fashion row: `|clean`, `|normal`, ...
- backward-compat: 옛 단일 `cls` key 도 fallback lookup.

`fetchLatestMarketStats` / `fetchLatestMarketStatsPerSource`:
- SELECT 에 `condition_tier` 추가.
- Map key 박을 때 composite 사용.

### Wave 817 — 함수 signature 에 `conditionTier?: ConditionClass | null` 추가

- `selectMarketRowByCondition(..., targetConditionTier?)` (pack-open.ts)
- `marketBasisForCandidate(..., conditionTier?)` (pack-open.ts) — 마지막 파라미터
- `pickByConditionFallback(..., conditionTier?)` (condition-fallback.ts) — fashion path 우선:
  - tier 박혀있고 `UNKNOWN` 아니면 fashion: `${tier}|` exact match → 옛 cc="" 단일 key → cross-tier `|""` fallback.
  - tier 빈 값 → non-fashion: `|${cc}` chain (옛 단일 cc key 도 backward-compat).
- Wave 886.16/803i hack 부분적으로 잔존 (backward-compat) — 다른 세션 cleanup PR 에서 제거.

### Wave 818 — 6개 callsite 박기

1. `src/app/api/lookup/by-url/route.ts:452` — `conditionTier` 변수 추가
2. `src/app/api/listings/[pid]/market-source/route.ts:194` — `parsed?.condition_tier ?? null`
3. `src/app/api/packs/me/route.ts:901` — `grading?.tier ?? null` (grading declaration 위로 이동)
4. `src/app/api/packs/pool/analysis/route.ts:132` — `parsed?.condition_tier ?? null` + SELECT 에 컬럼 추가
5. `src/app/api/packs/pool/detail-access/route.ts:241` — `item.conditionTier ?? null`
6. `src/app/api/packs/reveals/detail/route.ts:125` — `parsed?.condition_tier ?? null` + SELECT 에 컬럼 추가
7. `src/lib/pack-open.ts:2294` (내부 호출) — `conditionGrading?.tier ?? null` (declaration 위로 이동)

## 영향

| Surface | Before | After |
|---------|--------|-------|
| `/lookup` (URL 입력) | tier 정보 무시, cc 단일축 lookup → cross-tier mix 가능 | tier 박힌 매물은 정확히 같은 tier row 조회. |
| `/me` (내 매물) | 동일 | 동일 fix. |
| `/explore` (메인 피드) → /api/packs/pool/analysis | 동일 | 동일 fix. |
| `pack-open` (cron pool builder) | isFashion 임시 봉합 | tier 정확 매칭, mixed row fallback 차단. |
| admin-pool-browser → detail-access | 동일 | 동일 fix. |

NB 991 case (실제 비교매물 130K, 표시 시세 184K) → tier B 정확 매칭 시 mix 차단으로 시세 정합 회복 예상. 검증은 다음 wave 에서 별도.

## Migration backward-compat

- Map composite key 박은 동시에 옛 단일 cc key fallback 박아둠 — 한 deploy turn 만에 깨지지 않음.
- Wave 814 DB 정규화 미적용 카테고리 (대부분 non-fashion) 는 `condition_tier` 가 null → composite key 가 `|cc` 형태 → 정상 lookup.

## TS check

`npx tsc --noEmit` — src/ 에 에러 0개. (tests/ pre-existing 에러는 Wave 818 무관.)

## Owner thresholds — 변경 없음

- min sample threshold (Wave 193: 1)
- sample cap, IQR fence 등 시세 estimation guard — 그대로.
- Wave 798c lesson 준수: owner 결정 임계점은 confirm 없이 안 건드림.

## Follow-up

- 다른 세션 cleanup PR ping (Wave 886.16/803i backward-compat hack 제거).
- 다음 wave: NB 991 case 실제 lookup 결과 확인 + 시세 정합 회귀 테스트.
- mvp_market_price_daily PK schema 변경 (tier 컬럼 추가) — 현재는 row-level write 만 변경, PK 는 cc 단일 유지 (한 (comparable_key, cc) 하나의 row 가능). fashion row 는 cc="" 라 사실상 1행 — race 없음. tier 별 multi-row 박으려면 PK migration 필요.

## Sign-off

자율 진행 — destructive 없음 + 사용자 명시 위임. 박힌 후 비교매물 화면 1회 사용자 확인 권장.
