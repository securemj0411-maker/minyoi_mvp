# 2026-05-21 Wave451 — Acne pants split

## 배경
- Wave450 이후 Acne broad 에 pants product type 4건이 남아 있었다.
  - 트라우저, 치노팬츠, 슬랙스, casual pants.
- `치노팬츠` 는 explicit pants lane 과 generated Acne broad 가 동시에 걸려 null 이 되는 문제가 있었다.

## 결정
- `clothing-acne-pants` lane 을 추가하고 ready lane 으로 등록했다.
- broad `clothing-acne-apparel` 에 pants 계열 토큰을 must-not 으로 추가했다.
- generated `clothing-acne-broad` 에도 pants 계열 토큰을 must-not 으로 추가했다.
  - explicit pants lane 이 generated broad 와 충돌하지 않게 하기 위함.
- shorts/denim 은 pants lane 에서 제외했다.

## DB 적용
- source: active `sku_id=clothing-acne-apparel` 25건.
- dry-run:
  - pants candidates: 4건
  - parser preview: `pants` 4건
- 적용:
  - `mvp_raw_listings`: 4건을 `clothing-acne-pants` 로 이동, `score_dirty=true`.
  - `mvp_listing_parsed`: 4건 최신 parser 결과로 upsert.
  - `mvp_candidate_pool`: 4건 stale row delete 시도.

## 검증
- 재 dry-run:
  - active `clothing-acne-apparel` 잔여: 21건.
  - pants candidates: 0건.
- 대표 이동:
  - `[EU48] 아크네 스투디오 라이더 트라우저 블랙` → `clothing|acne_pants|pants|a_grade`
  - `아크네 치노팬츠 50사이즈(32-34)` → `clothing|acne_pants|pants|s_grade`
  - `ACNE STUDIOS casual pants` → `clothing|acne_pants|pants|c_grade`
- 테스트:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 결과: 192 pass / 0 fail

## 보류
- 남은 broad 21건은 knit/cardigan/polo/cap/type_unknown 및 bundle shorts 등이 섞여 있다.
- 사이즈별 회전률 bucket 보정은 별도 wave 로 진행한다.
