# 2026-05-21 Wave448 — Acne denim residue recovery

## 배경
- Wave447 이후 Acne broad 에 jeans product type 2건이 남아 있었다.
  - `아크네 블랙 스키니진`
  - `아크네 스튜디오 플로라가탄 스톡홀름 리버스테이블랙진 30`
- parser 는 jeans 로 잡고 있었지만 catalog denim lane 이 `스키니진/블랙진/리버스테이` 표현을 받지 못해 broad 에 남았다.

## 결정
- 기존 `clothing-acne-denim` lane 에 black/skinny/reverse-stay denim 표현을 추가했다.
  - 추가: `스키니진`, `블랙진`, `화이트진`, `리버스테이`.
- broad `clothing-acne-apparel` 에도 같은 denim 표현을 must-not 으로 추가했다.
  - broad 와 denim lane 의 중복 매칭을 피하기 위함.

## DB 적용
- source: active `sku_id=clothing-acne-apparel` 39건.
- dry-run:
  - denim candidates: 2건
  - parser preview: `jeans` 2건
- 적용:
  - `mvp_raw_listings`: 2건을 `clothing-acne-denim` 으로 이동, `score_dirty=true`.
  - `mvp_listing_parsed`: 2건 최신 parser 결과로 upsert.
  - `mvp_candidate_pool`: 2건 stale row delete 시도.

## 검증
- 재 dry-run:
  - active `clothing-acne-apparel` 잔여: 37건.
  - denim candidates: 0건.
- 테스트:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 결과: 192 pass / 0 fail

## 보류
- 남은 broad 37건은 shorts/dress/knit/pants/polo/cap/type_unknown 등이 섞여 있다.
- generic shorts/dress/knit/pants lane 추가 여부는 다음 wave 에서 title-only dry-run 후 판단한다.
- 사이즈별 회전률 bucket 보정은 별도 wave 로 진행한다.
