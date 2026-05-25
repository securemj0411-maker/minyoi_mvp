# Wave 803 — 의류/신발 잔여 문제 추가 진단

**날짜**: 2026-05-24
**Wave**: 803
**Owner**: Codex

## 사용자 피드백

FOG Essentials나 Polo 일부만 보는 접근이 좁다는 지적. 질문은 "그거 말고도 다른 문제 없어? 의류랑 신발중에?"였고, 따라서 ready/reserved 의류/신발 전체를 다시 patrol/purity/systemic audit으로 봤다.

## 발견

Wave 802 이후에도 표본 patrol에서 의류/신발 R1 잔여 혼입이 있었다.

- `clothing|thombrowne_knit|knit|a_grade`
  - `clothing-thombrowne-apparel-broad` stale raw SKU가 세부 knit key에 남음
- `clothing|polo_pique_classic|polo_shirt|b_grade`
  - Malbon/Mark&Lona/Nike 같은 타 브랜드가 `polo`를 의류명으로 쓰면서 Polo Ralph Lauren sample에 남음
  - 일부는 raw SKU는 이미 맞았지만 `mvp_listing_parsed.comparable_key`만 오래된 상태
- `clothing|bape_varsity_jacket|jacket|b_grade`
  - BAPE jacket broad가 varsity jacket key에 남음
- `shoe|stussy_nike_collab|sneaker|b_grade`
  - Stussy x Nike broad footwear는 브랜드는 맞지만 모델이 너무 넓음
  - Benassi/Huarache/Air Penny/LD-1000/Air Max/Spiridon 등이 한 lane에 섞이며 5만~110만 가격대가 공존

## 결정

### 1. raw SKU drift뿐 아니라 parsed comparable_key drift도 apply 대상이다

기존 reclassify 스크립트는 raw `sku_id`가 달라질 때만 처리했다. 실제로는 raw SKU가 이미 맞아도 parsed comparable key가 과거 key로 남아 비교매물 샘플을 오염시키는 케이스가 있었다. 따라서 `refresh_parsed_key` action을 추가했다.

### 2. Polo 계열은 "polo" 단어를 브랜드로 보지 않는 방어가 더 필요하다

Malbon/Mark&Lona뿐 아니라 Nike도 `폴로티/피케 폴로티`를 일반 의류명으로 쓴다. Polo Ralph Lauren classic/vintage/knit/pony 계열에 Nike 차단을 추가했다.

### 3. Stussy x Nike footwear broad는 ready가 아니다

이 lane은 브랜드 단위로는 맞지만 실사용 비교군으로는 너무 넓다. 이미 존재하는 narrow lane(`shoe-stussy-nike-spiridon`, `shoe-stussy-nike-af1-mid`)만 ready로 두고, broad footwear는 blocked로 바꿨다.

## 코드 변경

- `scripts/apply-fashion-current-catalog-reclassify.ts`
  - raw SKU 변경 없이 parsed comparable_key만 drift된 row를 `refresh_parsed_key`로 upsert
- `src/lib/catalog.ts`
  - `clothing-polo-pique-classic` / `clothing-polo-pony-tee`에 Nike 차단 추가
- `src/lib/generated/catalog-712b-bias-free.ts`
  - `clothing-polo-knit-sweater`에 Nike 차단 추가
- `src/lib/generated/catalog-715-clothing-narrow.ts`
  - `clothing-polo-pique-vintage`에 Nike 차단 추가
- `src/lib/category-readiness.ts`
  - `stussy_nike_shoe_collab` ready -> blocked
- `tests/fashion-catalog-regression.test.ts`
  - Nike/Malbon/Mark&Lona generic polo wording 회귀 테스트
  - Stussy x Nike footwear broad blocked / Spiridon narrow ready gate 테스트

## DB 작업

### current catalog reclassify / parsed refresh

적용 대상:

- Thom Browne knit
- Polo pique classic
- BAPE varsity jacket
- Stussy x Nike broad footwear sample

대표 적용 결과:

- Thom Browne apparel broad -> Thom Browne knit
- BAPE jacket broad -> BAPE varsity jacket
- Polo piqué stale condition key refresh
- Malbon/Mark&Lona/Nike polo wording -> Polo sample에서 제거
- Stussy x Nike broad shoe pool row 2건 invalidated

### cleanup

```bash
npx tsx --env-file=.env.local scripts/cleanup-fashion-pool-gate-blocked.ts \
  --categories=shoe,clothing --statuses=ready,reserved --include-key-drift \
  --reason=wave803_stussy_nike_shoe_broad_hold --apply
```

최종 적용:

- candidateRows: 4
- `wave410_lane_blocked_stussy_nike_shoe_collab`: 2
- `wave410_category_internal_only_shoe`: 1
- `wave410_pool_key_drift`: 1

## 최종 검증

### Fashion pool purity

- activeFashionPoolRows: 112
- clothing: 81
- shoe: 31
- gateBlockedRows: 0
- flaggedRows: 0
- actionableRows: 0

### Clothing pool purity

- activeClothingPoolRows: 81
- blockedAfterCurrentGate: 0
- flaggedAllowedRows: 0
- actionableAllowedRows: 0

### Targeted systemic audit

대상:

- `clothing|thombrowne_knit|knit|a_grade`
- `clothing|polo_pique_classic|polo_shirt|b_grade`
- `clothing|bape_varsity_jacket|jacket|b_grade`
- `shoe|stussy_nike_collab|sneaker|b_grade`

최종:

- activePoolRows: 112
- rowFlaggedRows: 0
- rowActionableRows: 0
- comparableGroups: 4
- groupFlaggedGroups: 2
- groupActionableGroups: 0
- 남은 group flag는 price spread뿐

### Patrol 500

전체:

- 178/479 issue
- R5 fallback mismatch: 132
- R2 generation missing: 45
- R1 SKU mismatch: 8
- R4 outlier distortion: 4

의류/신발 subset:

- fashionIssueCount: 27
- R1 SKU mismatch: 0
- R4 outlier distortion: 0
- R5 fallback mismatch: 27

즉, 이번 질문 기준으로 의류/신발의 브랜드/model/sample 혼입은 현재 ready 표본에서 0으로 닫혔다. 남은 문제는 가격 기준축(`sku_median` vs `market_daily`) 불일치다.

### Regression

```bash
npx tsx --test tests/fashion-catalog-regression.test.ts
```

결과:

- tests: 7
- pass: 7
- fail: 0

## 보류 / 다음 작업

- R5 가격 기준축 mismatch는 다음 wave에서 별도 처리한다.
  - 예: TNF Supreme Baltoro, Acne knit/denim/pants, Stussy hoodie, BAPE crewneck, BAPE x Vans, Salomon RX Mary Jane, Dr. Martens Jadon, Vans Style 36
  - 이 문제는 "다른 브랜드가 섞임"보다 `sku_median`과 `market_daily` 산출 source/시점/샘플 정책이 어긋나는 문제다.
- Stussy x Nike footwear는 broad를 막았지만, LD-1000/Air Penny/Air Max 2013/Benassi/Kukini/Huarache 등 narrow SKU 추가는 보류한다.
- broad 1만건 deep sweep을 한 번 더 도는 것보다, patrol R5 상위 lane의 median 재계산/market sample refresh/저표본 hold 정책을 먼저 적용한다.
