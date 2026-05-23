# 2026-05-21 Wave447 — Acne jacket/coat lane expansion

## 배경
- Acne broad 잔여 49건 중 jacket product type 이 10건 남아 있었다.
- 기존 `clothing-acne-jacket-coat` lane 은 `자켓/재킷/코트` 중심이라 `무스탕`, `블레이저`, `야상`, `봄버`, `후리스` 표현을 받지 못했다.

## 결정
- 새 SKU 를 만들지 않고 기존 `clothing-acne-jacket-coat` lane 의 표현을 확장했다.
  - 추가: `저켓`, `무스탕`, `블레이저`, `야상`, `점퍼`, `봄버`, `ma-1/ma1`, `후리스/플리스/fleece`.
- broad `clothing-acne-apparel` 에도 같은 jacket 계열 토큰을 must-not 으로 추가했다.
  - broad 와 jacket lane 이 동시에 매칭되어 ambiguous/null 이 되는 것을 피하기 위함.
- `르샵/leshop/le shop` 은 jacket/coat lane 에도 must-not 으로 추가했다.
  - Wave446 bait row 가 jacket 표현 확장으로 되살아나는 것을 방지.

## DB 적용
- source: active `sku_id=clothing-acne-apparel` 49건.
- dry-run:
  - jacket candidates: 10건
  - risky candidates: 0건
  - parser preview: `jacket` 10건
- 적용:
  - `mvp_raw_listings`: 10건을 `clothing-acne-jacket-coat` 로 이동, `score_dirty=true`.
  - `mvp_listing_parsed`: 10건 최신 parser 결과로 upsert.
  - `mvp_candidate_pool`: 10건 stale row delete 시도.

## 검증
- 재 dry-run:
  - active `clothing-acne-apparel` 잔여: 39건.
  - jacket candidates: 0건.
  - risky candidates: 0건.
- 대표 이동:
  - `아크네스튜디오 이안 무스탕` → `clothing|acne_jacket_coat|jacket|unknown_condition`
  - `아크네 스튜디오 마키오 ma-1 봄버 팝니다` → `clothing|acne_jacket_coat|jacket|b_grade`
  - `아크네 오버사이즈 후리스` → `clothing|acne_jacket_coat|jacket|b_grade`
- 테스트:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 결과: 192 pass / 0 fail

## 보류
- 남은 broad 39건은 shorts/dress/knit/pants/polo/type_unknown/cap 등이 섞여 있다.
- repeated product-type generic lane 으로 더 좁힐지는 다음 wave 에서 dry-run 후 판단한다.
- 사이즈별 회전률 bucket 보정은 별도 wave 로 진행한다.
