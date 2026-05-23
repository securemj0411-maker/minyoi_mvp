# 2026-05-21 Wave445 — Acne sweat/hoodie title-only migration

## 배경
- Wave444 이후 `clothing-acne-apparel` broad 에 tee 는 더 이상 남지 않았지만, `후드 티셔츠`, `맨투맨 티셔츠`, `스웻 티셔츠`, `포바` 계열 16건이 broad 에 남아 있었다.
- 이들은 tee 로 이동하면 안 되고, hoodie/crewneck 가격군을 분리해야 한다.

## 결정
- DB migration 은 Wave444 와 동일하게 title-only rule 로만 적용했다.
  - `ruleMatch(title, "") === clothing-acne-sweat` 인 row 만 이동.
  - description promotion 은 적용하지 않았다.
- `clothing-acne-sweat` 는 SKU 자체는 하나로 두고, parser 의 product type 으로 `hoodie` / `crewneck` 을 분리한다.

## DB 적용
- source: active `sku_id=clothing-acne-apparel` 68건.
- dry-run:
  - sweat title-only candidates: 16건
  - risky candidates: 0건
  - parser preview: `hoodie` 8건, `crewneck` 8건
- 적용:
  - `mvp_raw_listings`: 16건을 `clothing-acne-sweat` 로 이동, `score_dirty=true`.
  - `mvp_listing_parsed`: 16건 최신 parser 결과로 upsert.
  - `mvp_candidate_pool`: 16건 stale row delete 시도.

## 검증
- 재 dry-run:
  - broad apparel 잔여 52건.
  - sweat title-only candidates: 0건.
  - risky candidates: 0건.
- 적용 row 의 comparable key 는 title 기반으로 분리됐다.
  - `아크네 화이트 얄라 후드 티셔츠 L` → `clothing|acne_sweat|hoodie|unknown_condition`
  - `아크네 포바 페이스 ... 스웻 티셔츠` → `clothing|acne_sweat|crewneck|unknown_condition`
  - `아크네스튜디오 페어뷰 기모 맨투맨 티셔츠...` → `clothing|acne_sweat|crewneck|unknown_condition`
- 테스트:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 결과: 192 pass / 0 fail

## 보류
- Acne polo/카라/럭비티는 이번 sweat migration 에 포함하지 않았다.
- 남은 broad 52건은 셔츠/니트/팬츠/스커트/셋업/product-code/불명확 제목이 섞여 있어 샘플링 후 다음 wave 에서 처리한다.
- 사이즈별 회전률 bucket 보정은 별도 wave 로 진행한다.
