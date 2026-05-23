# 2026-05-21 Wave444 — Acne tee title-only migration

## 배경
- Wave442 에서 `clothing-acne-apparel` broad catch-all 이 `티셔츠/롱슬리브` 토큰을 더 이상 받지 않도록 막았지만, 기존 DB row 는 아직 broad 에 남아 있었다.
- 단순히 title+description 전체로 `ruleMatch` 를 돌리면 description 의 검색어/브랜드 나열 때문에 오염 가능성이 있었다.
  - 예: `모스키노 아크네 바나나 스팽글 자수 티셔츠`
  - 예: `시스템 티셔츠 한섬 헬무트랭 아크네스튜디오...`
  - 예: `아크네 티셔츠 원피스 xs`
  - 예: `아크네 포바 ... 스웻 티셔츠`

## 결정
- DB migration 은 title-only rule 로만 적용했다.
  - `ruleMatch(title, "") === clothing-acne-tee` 인 row 만 이동.
  - description promotion 은 이번 wave 에서 금지했다.
- `clothing-acne-tee` 는 실제 tee/long-sleeve 만 받도록 더 보수화했다.
  - 차단: `원피스/dress`, `모스키노`, `한섬/시스템/헬무트랭/타임/이자벨마랑/마쥬`, `아미/`, `비비안`.
  - 차단: `스웻/스웨트/sweat`, `포바/forba/flogho`, `맨투맨/후드`.
  - 차단: `폴로/polo`, `카라`, `럭비/rugby`.
- `clothing-acne-sweat` 는 `스웻/스웨트/sweat`, `포바/forba/flogho` 를 받을 수 있게 했다.
  - 기존 `셔츠` must-not 은 너무 넓어 `스웻 티셔츠` 를 막고 있었으므로 `버튼다운/남방` 으로 축소했다.

## DB 적용
- source: active `sku_id=clothing-acne-apparel` 129건.
- dry-run after guards:
  - tee title-only candidates: 61건
  - sweat candidates left for next wave: 16건
  - risky tee candidates: 0건
- 적용:
  - `mvp_raw_listings`: 61건을 `clothing-acne-tee` 로 이동, `score_dirty=true`.
  - `mvp_listing_parsed`: 61건 최신 parser 결과로 upsert.
  - `mvp_candidate_pool`: 61건 stale row delete 시도.

## 검증
- 재 dry-run:
  - broad apparel 잔여 68건.
  - title-only tee candidates: 0건.
  - target `clothing-acne-tee` active rows: 79건.
  - target risky rows: 0건.
- spot check:
  - `아크네 포바 페이스 ... 스웻 티셔츠` 는 tee 로 이동하지 않고 `clothing-acne-apparel` 에 남음.
  - `아크네 스튜디오 블러링 로고 티셔츠 s`, `아크네 스튜디오 로고 티셔츠 페이드 블랙`, `아크네 스튜디오 민트 티셔츠` 는 `clothing-acne-tee` 로 이동.
- 테스트:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 결과: 192 pass / 0 fail

## 보류
- Acne sweat/hoodie/crewneck 16건은 별도 wave 에서 `clothing-acne-sweat` 로 title-only migration 한다.
- Acne polo/카라/럭비티는 tee 비교군에 섞지 않고, 반복량 확인 후 별도 lane 또는 broad+product_type 유지로 판단한다.
- description 기반 tee 복구는 브랜드 나열형 오염 위험이 있어 보류한다.
- 사이즈별 회전률 bucket 보정은 별도 wave 로 진행한다.
