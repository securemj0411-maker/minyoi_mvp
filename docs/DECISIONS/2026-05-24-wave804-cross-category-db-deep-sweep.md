# Wave 804 — 의류/신발/골프/게임기 DB Deep Sweep 및 노출 풀 정리

**날짜**: 2026-05-24
**Wave**: 804
**Owner**: Codex

## 사용자 피드백

사용자는 기존 다른 세션에서 만든 의류/신발/골프/게임기 새 등급 체계가 안전하게 유지되는지, 직전 작업이 카탈로그만 만진 안전한 변경인지, DB deep sweep을 실제로 했는지 물었다. 또한 에센셜/일부 의류만 보지 말고 다른 브랜드 반바지/후드/신발/골프/게임기까지 체계적으로 보라고 지적했다.

## 범위

이번 wave는 번개장터 API를 새로 호출하지 않고, 현재 DB 기준으로 read-only deep sweep을 먼저 수행한 뒤 실제 ready/reserved 노출 풀만 작게 정리했다.

- 대상 카테고리: `clothing`, `shoe`, `sport_golf`, `game_console`
- 대상 DB: `mvp_listing_parsed`, `mvp_raw_listings`, `mvp_candidate_pool`
- sweep report: `reports/cross-category-db-deep-sweep-latest.{json,md}`
- cleanup report: `reports/cross-category-current-reparse-cleanup-apply-latest.{json,md}`

## 핵심 확인

### 1. 새 등급 체계 자체는 건드리지 않았다

이전 변경과 이번 변경은 새 5-tier 등급 체계의 원칙 자체를 바꾸지 않았다.

- 의류/신발: `condition_tier`와 comparable key의 등급 토큰 일치 여부를 점검했다.
- 골프/게임기: `ConditionClass -> s/a/b/c/reject` post-process 체계를 유지했다.
- 이번 코드 변경은 catalog 충돌, 진단 리포터 오탐, stale DB row 정리 쪽이다.

### 2. DB는 실제로 넓게 봤다

최종 sweep 결과:

- auditedRows: 43,999
- categories
  - clothing: 17,745
  - shoe: 22,979
  - sport_golf: 1,469
  - game_console: 1,806
- poolRowsReadyOrReserved: 112
- poolActionableRows: 0

즉 전체 DB에는 과거 parser/key/tier 부채가 크지만, 현재 노출 ready/reserved 풀에서는 key/gate/tier actionable row를 0으로 닫았다.

## 발견

### Active pool에서 실제 조치한 문제

적용 전 ready/reserved 127건 중 15건이 조치 대상이었다.

- sport_golf 10건
  - Titleist TSR2 driver 2건: blocked lane인데 ready 노출 + key가 세대/loft/tier를 반영하지 못함
  - Titleist TSR2/TSR3 head-only 8건: current catalog 기준 본품 드라이버가 아니라 head-only라 reject 대상인데 pool에 남아 있었음
- shoe 2건
  - Hoka Hopara 1건: DB key는 `b_grade`, 현재 condition tier/key는 `a_grade`
  - Nike x Travis Scott Air Max 1 1건: category internal-only shoe가 ready에 남음
- game_console 3건
  - PS5 Disc / Switch OLED ready row에 `condition_tier` 누락
  - `초기형 ps5 디스크 중고 팝니다`는 current catalog가 게임 디스크 broad와 충돌해 null을 내던 문제 확인

### 전체 DB의 남은 구조적 부채

전체 DB 기준 actionableRows가 큰 이유는 대부분 과거 parser/key/tier backfill debt다.

- `fashion_missing_condition_tier`: 14,693
- `fashion_key_tier_differs_from_condition_tier`: 9,454
- `game_golf_missing_condition_tier`: 1,271
- `db_key_differs_from_raw_reparse`: 25,817

이 숫자는 active pool 오염이 아니라, 과거 parsed row를 새 parser로 재산출하면 key/tier가 달라질 수 있다는 backlog다. 한 번에 전체 mutate하면 median/market/pool 집계가 크게 흔들릴 수 있으므로 staged backfill 대상으로 남긴다.

## 결정

### 1. 전체 DB backfill보다 active pool 정리를 먼저 한다

사용자에게 바로 보이는 것은 ready/reserved pool이므로, 전체 2.5만건 이상의 stale row를 한 번에 mutate하지 않고 active pool 15건만 우선 정리했다.

적용:

```bash
npx tsx --env-file=.env.local scripts/apply-cross-category-current-reparse-cleanup.ts \
  --categories=clothing,shoe,sport_golf,game_console \
  --statuses=ready,reserved \
  --apply
```

결과:

- scannedPoolRows: 127
- candidateRows: 15
- invalidatePoolRows: 15
- rejectRows: 8
- refreshRows: 7
- applied: true

### 2. PS5 Disc 본체와 PS5 게임 디스크 broad 충돌은 catalog rule로 막는다

`ps5-game-broad`가 `팝니다/판매/정품` 같은 일반 판매 단어까지 조건으로 삼아 본체 매물과 충돌했다. `초기형`, `본체`, `풀박`, `디스크 에디션`, `1118A` 등 본체/edition 강신호가 있으면 `ps5-disc-standard`로 고정하는 direct match를 추가했다.

보존한 차단:

- `ps5 디스크 드라이브 가격`은 null 유지
- `ps5 스파이더맨 디스크 팝니다`는 본체로 오분류하지 않음

### 3. deep sweep 리포터의 false positive도 줄인다

진단기가 `푸마 NITRO`의 `니트`, `클라우드`의 `우드` 같은 부분 문자열을 category conflict로 잘못 찍고 있었다. 실제 catalog 문제가 아닌 오탐이 다음 진단을 흐리지 않도록 키워드 경계를 보강했다.

## 코드 변경

- `src/lib/catalog.ts`
  - PS5 Disc 본체 direct match 추가
- `tests/cross-category-deepsweep-regression.test.ts`
  - PS5 Disc 본체 vs PS5 게임 디스크/드라이브 회귀 테스트 추가
- `scripts/report-cross-category-db-deep-sweep.ts`
  - cross-category DB sweep 리포트 추가 및 false-positive 키워드 보정
  - `current-replay=pool`일 때 non-pool row를 current replay로 오해하지 않도록 flag 분리
- `scripts/apply-cross-category-current-reparse-cleanup.ts`
  - ready/reserved pool row를 current catalog/parser로 재파싱
  - gate blocked/key drift/tier missing/current reject row만 parsed refresh + raw dirty + pool invalidated 처리

## 검증

### Regression

```bash
npx tsx --test tests/cross-category-deepsweep-regression.test.ts tests/fashion-catalog-regression.test.ts
```

결과:

- tests: 8
- pass: 8
- fail: 0

### Cleanup dry-run after apply

```bash
npx tsx --env-file=.env.local scripts/apply-cross-category-current-reparse-cleanup.ts \
  --categories=clothing,shoe,sport_golf,game_console \
  --statuses=ready,reserved
```

결과:

- scannedPoolRows: 113
- candidateRows: 0
- invalidatePoolRows: 0

### Final DB deep sweep

```bash
npx tsx --env-file=.env.local scripts/report-cross-category-db-deep-sweep.ts \
  --categories=clothing,shoe,sport_golf,game_console \
  --limit=120000 \
  --include-review=true \
  --current-replay=pool
```

결과:

- auditedRows: 43,999
- poolRowsReadyOrReserved: 112
- poolActionableRows: 0

## 보류 / 다음 작업

1. 전체 DB backfill은 staged로 한다.
   - 1차: game_console/sport_golf `condition_tier` missing 1,271건
   - 2차: fashion `condition_tier` missing / key-tier mismatch 상위 key부터
   - 각 단계는 dry-run group report -> capped apply -> pool 재검증 순서로 진행한다.
2. 번개장터 API deep sweep은 전량 재수집보다 high-risk lane 우선으로 한다.
   - golf full-set broad / driver head-only / shaft-only
   - game console 본체 vs game title/accessory
   - Polo/Stussy/BAPE/Nike/Adidas 등 일반 의류명과 브랜드명이 겹치는 lane
3. `shoe_title_has_golf_terms`, `shoe_title_has_clothing_terms` 같은 진단 flag는 더 줄일 수 있다.
   - 이번 wave에서 obvious false positive는 줄였지만, 리포터는 계속 보조 지표로만 사용한다.
4. 전체 DB의 `db_key_differs_from_raw_reparse`는 즉시 오염이 아니라 parser version drift/backfill debt다.
   - active pool이 0으로 닫힌 뒤, 가격 median/market_daily 영향이 큰 key부터 backfill한다.
