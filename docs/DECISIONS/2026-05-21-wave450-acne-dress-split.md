# 2026-05-21 Wave450 — Acne dress split

## 배경
- Wave449 이후 Acne broad 에 dress product type 5건이 남아 있었다.
- `아크네 티셔츠 원피스 xs` 는 Wave444 에서 tee 오염 방지를 위해 tee lane 에서 차단했지만, 실제 비교군은 dress 로 보는 것이 맞다.

## 결정
- `clothing-acne-dress` lane 을 추가하고 ready lane 으로 등록했다.
- broad `clothing-acne-apparel` 에 `원피스/dress` 를 must-not 으로 추가했다.
- `티셔츠 원피스` 는 tee 가 아니라 dress 로 라우팅하도록 테스트를 갱신했다.

## DB 적용
- source: active `sku_id=clothing-acne-apparel` 30건.
- dry-run:
  - dress candidates: 5건
  - parser preview: `dress` 5건
- 적용:
  - `mvp_raw_listings`: 5건을 `clothing-acne-dress` 로 이동, `score_dirty=true`.
  - `mvp_listing_parsed`: 5건 최신 parser 결과로 upsert.
  - `mvp_candidate_pool`: 5건 stale row delete 시도.

## 검증
- 재 dry-run:
  - active `clothing-acne-apparel` 잔여: 25건.
  - dress candidates: 0건.
- 대표 이동:
  - `아크네 티셔츠 원피스 xs` → `clothing|acne_dress|dress|unknown_condition`
  - `34사이즈) 아크네 스튜디오 Acne Studios 델라 체크 원피스` → `clothing|acne_dress|dress|a_grade`
- 테스트:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 결과: 192 pass / 0 fail

## 보류
- 남은 broad 25건은 knit/cardigan/pants/polo/cap/type_unknown 및 bundle shorts 등이 섞여 있다.
- 사이즈별 회전률 bucket 보정은 별도 wave 로 진행한다.
