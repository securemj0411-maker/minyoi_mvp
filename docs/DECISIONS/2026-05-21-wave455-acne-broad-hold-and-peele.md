# 2026-05-21 Wave455 — Acne broad hold and Peele knit

## 배경
- Wave454 이후 Acne broad 잔여 10건 중 일부가 `needs_review=false` 로 남아 있었다.
- `아크네 반바지 두개` 같은 다중 수량 매물이 단품 shorts 시세 sample 로 들어갈 수 있었다.
- `아크네 스튜디오 형광 peele` 은 broad 에 남아 있었고, 현 parser 가 knit product type 으로 분류하고 있었다.

## 결정
- `clothing-acne-apparel` 은 hold-only fallback 으로 취급한다.
  - product type 이 crewneck/long_sleeve/shorts 로 파싱돼도 vetted narrow lane 이 claim 하기 전까지 `needsReview=true`.
- 의류 제목의 `두개/두 개/2개/일괄/묶음` 은 단품 비교군에서 제외한다.
- `peele` token 은 `clothing-acne-knit` 으로 승격한다.

## 코드 변경
- `src/lib/parsers/wave92-fashion-mobility.ts`
  - clothing parser version 을 `wave216-clothing-v17` 로 올렸다.
  - `clothing-acne-apparel` broad fallback 에 `clothing_broad_fallback` critical unknown 을 추가했다.
  - title-only multi-item bundle 에 `clothing_multi_item_bundle` critical unknown 을 추가했다.
- `src/lib/tick-pipeline.ts`
  - clothing latest parser version 을 `wave216-clothing-v17` 로 맞췄다.
- `src/lib/catalog.ts`, `src/lib/generated/catalog-wave266-clothing.ts`
  - `peele` 이 broad 와 충돌하지 않고 knit lane 으로 가도록 조정했다.

## DB 적용
- `pid=409011364` `아크네 스튜디오 형광 peele` → `clothing-acne-knit`.
- 남은 active `clothing-acne-apparel` 9건을 v17 로 재파싱했다.
- 재파싱 결과:
  - 9/9 `needs_review=true`.
  - `아크네 반바지 두개` 는 `clothing_multi_item_bundle`.
  - `크루넥 긴팔 티셔츠`, `반집업 긴팔` 등은 `clothing_broad_fallback`.

## 검증
- 잔여 샘플:
  - active `clothing-acne-apparel`: 9건.
  - needsReview: 9건.
  - 추가 auto-migration candidate: 0건.
- 테스트:
  - `npx tsx --test tests/wave254-5-fashion-condition.test.ts tests/wave254-6-product-type-priority.test.ts`
  - 결과: 194 pass / 0 fail.

## 보류
- `찰스`, `T52`, `A00309863`, `셋업` 은 품번/모델명 검수가 필요하다.
- 의류 전반의 broad fallback 을 모두 hold-only 로 바꾸는 것은 기존 broad cleanup 테스트와 충돌해 별도 wave 로 검토한다.
