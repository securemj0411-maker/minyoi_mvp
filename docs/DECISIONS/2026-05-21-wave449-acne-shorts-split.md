# 2026-05-21 Wave449 — Acne shorts split

## 배경
- Wave448 이후 Acne broad 에 shorts product type 8건이 남아 있었다.
- 이 중 `아크네 반바지 두개` 는 묶음 판매라 단일 상품 시세 샘플에 넣기 애매했다.

## 결정
- `clothing-acne-shorts` generic shorts lane 을 추가하고 ready lane 으로 등록했다.
- broad `clothing-acne-apparel` 에 shorts 계열 토큰을 must-not 으로 추가했다.
- `두개/2개/세개/묶음/일괄` 류 multi-item 표현은 shorts lane 에서 제외했다.
  - 가격 샘플 왜곡을 줄이기 위함.

## DB 적용
- source: active `sku_id=clothing-acne-apparel` 37건.
- dry-run:
  - shorts candidates: 7건
  - excluded bundle: `아크네 반바지 두개`
  - parser preview: `shorts` 7건
- 적용:
  - `mvp_raw_listings`: 7건을 `clothing-acne-shorts` 로 이동, `score_dirty=true`.
  - `mvp_listing_parsed`: 7건 최신 parser 결과로 upsert.
  - `mvp_candidate_pool`: 7건 stale row delete 시도.

## 검증
- 재 dry-run:
  - active `clothing-acne-apparel` 잔여: 30건.
  - shorts candidates: 0건.
- 테스트:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 결과: 192 pass / 0 fail

## 보류
- bundle/multi-item row 는 별도 bundle/needs-review 정책이 필요하다.
- 남은 broad 30건은 dress/knit/pants/polo/cap/type_unknown 등이 섞여 있다.
- 사이즈별 회전률 bucket 보정은 별도 wave 로 진행한다.
