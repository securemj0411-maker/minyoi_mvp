# Wave 802 — 패션 systemic sample contamination cleanup

**날짜**: 2026-05-24
**Wave**: 802
**Owner**: Codex

## 사용자 피드백

Wave 801의 FOG Essentials 중심 처리가 너무 좁다는 지적. 실제 문제는 `에센셜` 한 단어가 아니라 의류/신발 전반에서 generic word, stale raw SKU, stale parsed comparable_key, market sample contamination이 겹친 것.

## 재진단

기존 `report-fashion-pool-purity`는 ready/reserved row 자체만 보기 때문에, 과거 `mvp_listing_parsed`에 남은 sample contamination을 충분히 보여주지 못한다.

추가한 진단:

- `scripts/report-fashion-ready-pool-systemic-audit.ts`
  - ready/reserved row의 현재 catalog/parser drift 검사
  - 지정 comparable_key의 sample group을 현재 catalog로 재평가
  - mixed raw SKU / mixed current SKU / current catalog reject sample 식별

patrol 재실행 전 패션 R1 이슈:

- `clothing-polo-knit-sweater`: `clothing-polo-apparel-broad` 및 generic/non-Ralph Polo wording 혼입
- `shoe-hoka-mafate_xlim_collab`: raw는 `shoe-hoka-mafate-speed`, current는 XLIM collab
- `clothing-bape_coach_jacket`: raw broad가 coach jacket key에 혼입
- `clothing-thombrowne_cardigan`: raw broad가 cardigan key에 혼입

가장 중요한 발견:

- `COS 스트라이프 니트 폴로`
- `솔리드옴므 남성 니트 폴로셔츠105`
- `Z Pattern Knitted Polo Shirts Dust`

위 매물들이 `polo`라는 의류 종류 단어 때문에 `clothing-polo-knit-sweater`/Polo 계열 sample에 들어가 있었다.

## 결정

### 1. FOG만이 아니라 generic garment-word lane을 별도 위험군으로 본다

`essential`, `polo`, `classic`, `basic`, `jacket`, `air`, `max` 같은 단어는 brand/model 양쪽 의미를 가진다. 앞으로 deep sweep은 이런 단어가 있는 lane을 우선한다.

### 2. ready row purity와 market sample purity를 분리해서 본다

ready pool row가 깨끗해도 `mvp_listing_parsed` sample key가 오염되어 있으면 사용자가 보는 비교매물/median은 이상해진다. 따라서 current catalog 기준 reclassify 스크립트를 추가했다.

### 3. description SEO tag는 brand conflict 판단에서 제외한다

Polo 정상 매물 description에 `빈폴 헤지스 라코스테 나이키...` 같은 SEO tag가 들어가는 경우가 있다. systemic audit의 brand conflict는 title 중심으로 본다.

## 코드 변경

- `src/lib/generated/catalog-712b-bias-free.ts`
  - `clothing-polo-knit-sweater` mustNotContain에 `COS/코스`, `솔리드옴므/solid homme` 추가
- `src/lib/catalog.ts`
  - `clothing-polo-pony-tee` mustNotContain에 `Z Pattern`, `COS/코스`, `솔리드옴므/solid homme` 추가
- `scripts/report-fashion-ready-pool-systemic-audit.ts`
  - ready row + comparable sample group을 현재 catalog 기준으로 진단하는 report-only 스크립트 추가
- `scripts/apply-fashion-current-catalog-reclassify.ts`
  - stale parsed sample의 raw SKU/parsed key를 current catalog 기준으로 재분류하거나, current catalog reject면 `needs_review=true`/`comparable_key=null`로 전환하는 apply 스크립트 추가
- `tests/fashion-catalog-regression.test.ts`
  - COS/Solid Homme/Z Pattern이 Polo Ralph Lauren으로 흡수되지 않는 회귀 테스트 추가

## DB 작업

### gate/key drift cleanup

```bash
npx tsx --env-file=.env.local scripts/cleanup-fashion-pool-gate-blocked.ts \
  --categories=shoe,clothing,bag --statuses=ready,reserved --include-key-drift --apply
```

최종 적용:

- candidateRows: 2
- `wave410_category_internal_only_shoe`: 1
- `wave410_pool_key_drift`: 1

### current catalog reclassify

```bash
npx tsx --env-file=.env.local scripts/apply-fashion-current-catalog-reclassify.ts \
  '--comparable-keys=clothing|polo_knit_sweater|knit|b_grade;;shoe|hoka_mafate_xlim_collab|sneaker|a_grade;;clothing|bape_coach_jacket|jacket|b_grade;;clothing|thombrowne_cardigan|cardigan|b_grade' \
  --limit-per-key=80 \
  --reason=wave802_current_catalog_reclassify \
  --apply
```

결과:

- scannedParsedRows: 134
- rawRows: 133
- candidateRows: 32
- reclassifyRows: 25
- rejectRows: 7

대표 reject:

- `COS 스트라이프 니트 폴로`
- `솔리드옴므 남성 니트 폴로셔츠105`
- `Z Pattern Knitted Polo Shirts Dust`
- Zara knit polo variants
- Polo Jeans sub-line

대표 reclassify:

- Hoka Mafate Speed raw -> Hoka XLIM collab
- BAPE jacket broad -> BAPE coach jacket
- Thom Browne apparel broad -> Thom Browne cardigan
- Polo apparel broad -> Polo knit sweater

## 검증

### Targeted systemic audit

```bash
npx tsx --env-file=.env.local scripts/report-fashion-ready-pool-systemic-audit.ts \
  --categories=shoe,clothing,bag --statuses=ready,reserved --sample-per-key=30 --group-concurrency=4 \
  '--only-keys=clothing|polo_knit_sweater|knit|b_grade;;shoe|hoka_mafate_xlim_collab|sneaker|a_grade;;clothing|bape_coach_jacket|jacket|b_grade;;clothing|thombrowne_cardigan|cardigan|b_grade'
```

최종:

- activePoolRows: 116
- rowFlaggedRows: 0
- rowActionableRows: 0
- groupFlaggedGroups: 0
- groupActionableGroups: 0

### Fashion pool purity

```bash
npx tsx --env-file=.env.local scripts/report-fashion-pool-purity.ts \
  --statuses=ready,reserved --categories=shoe,clothing,bag
```

최종:

- activeFashionPoolRows: 116
- gateBlockedRows: 0
- flaggedRows: 0
- actionableRows: 0

### Clothing pool purity

```bash
npx tsx --env-file=.env.local scripts/report-clothing-pool-purity.ts
```

최종:

- activeClothingPoolRows: 81
- blockedAfterCurrentGate: 0
- flaggedAllowedRows: 0
- actionableAllowedRows: 0

### Patrol

```bash
node scripts/patrol-pool-quality.mjs --sample=300
```

패션 subset:

- fashionIssueCount: 23
- R1 mixed SKU: 0
- R2 generation missing: 0 (패션 subset)
- R4 outlier distortion: 0 (패션 subset)
- R5 fallback mismatch: 23

즉, brand/model/sample 섞임은 이번 pass에서 0으로 닫혔다. 남은 것은 가격 기준의 `sku_median` vs `market_daily` 불일치다.

### Regression

```bash
npx tsx --test tests/fashion-catalog-regression.test.ts
```

결과: 5/5 pass.

## 보류 / 다음 작업

- R5 가격 불일치는 다음 wave에서 별도 처리한다.
  - 예: `clothing-acne-denim`은 `sku_median 92K` vs `market_daily 303.6K`처럼 방향이 반대로 튄다.
  - 일부는 market sample 부족/오염, 일부는 sku median source stale 가능성.
- premium floor는 parser가 price를 받지 않아 market sample 단계에서 아직 완전히 빠지지 않는다.
  - 예: Thom Browne cardigan 69K sample은 current SKU로는 맞지만 price sanity상 market median에 넣으면 위험하다.
- 다음 deep sweep은 broad 10k 재실행이 아니라:
  1. generic garment-word lane (`polo`, `essential`, `basic`, `classic`, `jacket`)
  2. patrol R5 상위 lane (`acne_denim`, `stussy_hoodie`, `bape_crewneck`, collab shoes)
  3. current catalog reclassify candidate가 반복되는 lane
  위 순서로 targeted sweep한다.
