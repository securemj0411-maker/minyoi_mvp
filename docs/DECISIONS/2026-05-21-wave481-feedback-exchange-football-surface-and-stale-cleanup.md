# Wave 481 — Recent Feedback Exchange Posts, Football Surface Split, Stale Fashion Cleanup

- Date: 2026-05-21
- Context: 최근 reveal feedback에서 교환글 2건, Nike Mercurial 풋살화/FG 비교군 혼합, Bottega Cassette variant, Acne Max denim, luxury bag broad stale row가 확인됨.

## Decisions

- `ruleMatch`에서 direct catalog match 전에 교환 요청글을 전역 차단한다.
  - `[교환]`, `교환해요`, `교환하고 싶`, 화살표 교환 문구는 null 처리.
  - `교환/환불 불가`, `교환 환불 x`, `교환 ❌ 환불 ❌`, `물품 교환 안해요` 같은 정상 판매 aftercare 문구는 예외로 유지.
- 축구화/풋살화는 shoe product type을 `football_shoe`, `football_tf`, `football_fg`, `football_ag_mg`로 분리한다.
  - Nike Mercurial 풋살화가 Elite FG sample과 같은 `sneaker` bucket에 섞이지 않도록 comparable key 축을 추가.
- DB stale cleanup은 현재 룰과 명확히 다른 행만 보수 적용했다.
  - 교환글 pids `409132786`, `374291461` clear.
  - LV Alma BB stale broad 2건 narrow 이동.
  - YSL/Gucci shopping bag, Gucci apparel, stale Coach apparel-broad rows clear.
  - Acne Max denim 1건 이동, Acne denim knit/kids contamination 2건 clear.
  - Bottega padded cassette 2건 mini에서 padded로 이동.
  - Mercurial feedback pid `409178887`는 new comparable key 계산을 위해 `score_dirty=true`.

## Held / Follow-up

- Chanel/Gucci/LV real luxury bag broad residual 중 실제 본품인데 narrow lane이 없는 행은 억지로 clear하지 않았다.
- Nike Mercurial은 surface axis만 먼저 적용했다. Vapor/Superfly/Elite/Academy 등 grade-level split은 별도 wave에서 sample 수를 보고 결정.
- Size outlier에 따른 회전률 보정은 별도 wave로 보류.

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts` pass: 176/176.
- `npx tsx --test tests/core-rules.test.ts` pass: 101/101.
