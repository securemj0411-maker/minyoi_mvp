# 2026-05-20 Wave413 — BAPE split and title-dominant clothing type

## 배경

운영자풀 코멘트와 DB sweep에서 의류 비교군 오염이 계속 보였다.
특히 BAPE 계열은 `tee` 하나로 후드/후드집업/맨투맨/샤크 라인이 섞였고, clothing parser는 제목에는 티셔츠가 명확한데 description 검색어의 `팬츠/쇼츠/바지`가 product type을 덮어쓰는 문제가 있었다.

사용자 방향은 확장보다 보수적 안정화다.
즉, 의류는 인기 SKU라도 sample과 정규화가 확실한 lane만 풀에 남기고, product type이 섞일 가능성이 있으면 먼저 blocked/invalidated 상태로 둔다.

## 결정

- clothing parser를 `wave216-clothing-v12`로 bump했다.
- clothing product type은 제목을 우선 신뢰하도록 바꿨다.
  - 순서: title product type → title이 unknown이면 title+description combined → catalog default fallback.
  - description에는 검색 노출용 이종 키워드가 섞이는 경우가 많아, title에서 타입이 잡히면 description이 덮어쓰지 못하게 했다.
  - `parsedJson.clothing_product_type_source`를 추가해 `title`/`combined`/`catalog` 출처를 남긴다.
- shirt/polo 우선순위를 보강했다.
  - `반팔셔츠`, `긴팔셔츠`, `옥스포드 셔츠`, `짚업셔츠`, `카라티`, `피케티셔츠`, `pk티/셔츠`가 tee/hoodie로 흐르지 않게 했다.
- BAPE basic apparel을 product type별로 분리했다.
  - `bape_tee`
  - `bape_hoodie`
  - `bape_hoodie_zip`
  - `bape_crewneck`
  - `bape_shark_hoodie`
- BAPE non-shark basic lanes는 계속 blocked 상태로 둔다.
  - 매물량은 많지만 가격 폭과 콜라보/시즌 차이가 크므로 public pool release는 별도 샘플 검수 후 진행한다.
  - 기존 ready는 `bape_shark_hoodie`만 유지한다.
- BAPE Shark lane도 더 좁혔다.
  - 기존: `BAPE + Shark`면 Shark Hoodie에 들어갈 수 있었다.
  - 변경: `BAPE + Shark + 후드/집업/반집업류`가 같이 있어야 한다.
  - Shark tee/pants/shorts/crewneck은 Shark Hoodie lane에서 차단한다.

## 실행 결과

- pool cleanup 적용 1차:
  - candidateRows: 5
  - 이유: BAPE/Stussy blocked lane 또는 pool key drift
  - invalidated: 5
- pool cleanup 적용 2차:
  - candidateRows: 1
  - 이유: Arc'teryx Atom outdoor Hoody가 현재 parser에서 `jacket`으로 정규화되며 기존 `hoodie` pool key drift 발생
  - invalidated: 1
- BAPE raw sample 200건 재스캔:
  - `bape_shark_hoodie`의 non-hoodie 잔여: 0
  - `bape_tee`의 non-tee 잔여는 제목 자체가 롱슬리브/셔츠인 케이스만 남음
  - description 검색어 오염 케이스는 title-first로 차단됨
- score dirty drain은 AI 비용을 쓰지 않도록 `PIPELINE_AI_REVIEW_TOP_N=0`, `AI_REVIEW_TOP_N=0`, `AI_L2_SHADOW_AUDIT_ENABLED=0`로 진행했다.

## 최종 상태

- `reports/fashion-pool-purity-latest.json`
  - active fashion pool rows: 47
  - clothing: 29
  - shoe: 10
  - bag: 8
  - gate-blocked rows: 0
  - flagged rows: 0
  - actionable rows: 0
- `reports/fashion-pool-gate-cleanup-dry-run-latest.json`
  - candidateRows: 0
- `reports/fashion-dirty-queue-latest.json`
  - loaded dirty fashion rows: 0
  - scorable rows: 0
  - parser key drift rows: 0
- `npx tsx --test tests/core-rules.test.ts tests/wave254-5-fashion-condition.test.ts tests/fashion-catalog-regression.test.ts tests/wave254-6-product-type-priority.test.ts`
  - pass: 194
  - fail: 0

## 보류

- BAPE tee/hoodie/hoodie_zip/crewneck은 아직 public pool release하지 않는다.
- `bape_tee` 안의 long sleeve / shirt 분리는 다음 의류 wave에서 별도 lane 또는 mustNot 정책으로 더 좁힐 수 있다.
- 의류는 계속 인기 SKU 중심으로만 열고, broad/fallback lane은 샘플 purity 검수 전까지 category ready를 상속하지 않는다.
