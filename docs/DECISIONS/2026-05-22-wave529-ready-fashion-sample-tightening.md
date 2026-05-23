# 2026-05-22 Wave 529 — Ready Fashion Sample Tightening

## Context
- Pool 복구 후 ready fashion sample 을 재검사했다.
- parser/key drift 는 0에 가깝게 줄었지만, 실제 ready sample 에서 두 개의 의미 오염이 확인됐다.
  - `250974772`: Nike Dunk Low SE 85 Neptune Green/Sail 이 `shoe-nike-dunk-low-black-white` lane 에 들어감.
  - `241337527`: TNF Antora Jacket 이 seller title 의 `마운틴자켓` 단어 때문에 `clothing-tnf-mountain-jacket` lane 에 들어감.

## Decision
- ready pool 은 당분간 인기 lane 중심으로 보수적으로 좁힌다.
- 색상/variant 가 가격축을 바꾸는 sneaker 는 broad black-white lane 에 섞지 않는다.
- seller SEO 단어 때문에 다른 TNF jacket family 가 Mountain Jacket 으로 들어오는 경우는 catalog match 와 stored-SKU reparse 양쪽에서 hold 한다.

## Implementation
- `src/lib/parsers/wave92-fashion-mobility.ts`
  - Dunk Low black-white stored SKU 에 `넵튠/neptune/green and sail` colorway guard 를 추가했다.
  - `clothing-tnf-mountain-jacket` stored SKU 에 `안토라/antora` variant review hold 를 추가했다.
- `src/lib/generated/catalog-shoe-narrow-wave134.ts`
  - Dunk Low black-white catalog `mustNotContain` 에 Neptune Green/Sail tokens 를 추가했다.
- `src/lib/catalog.ts`
  - TNF Mountain Jacket catalog `mustNotContain` 에 Antora tokens 를 추가했다.
- `tests/wave254-6-product-type-priority.test.ts`
  - Dunk Low Neptune Green/Sail 과 TNF Antora regression 을 추가했다.
- Follow-up active sample sweep 에서 `뉴발 ML2002RA 235사이즈` row 가 description 의 `270사이즈도` inventory text 때문에 270 bucket 으로 가는 버그를 확인했다.
  - 명시 mm size regex 들끼리는 패턴 우선순위가 아니라 텍스트상 가장 먼저 등장한 값을 고르도록 수정했다.
  - regression test 를 추가했다.

## Production Apply
- Target pids `250974772`, `241337527` parsed rows 를 새 parser 결과로 upsert 하고 `score_dirty=true` 처리했다.
- `scoreStage` 재실행 결과 두 row 모두 `ready` 에서 제거됐다.
  - `score_needs_review_skipped: 2`
  - `score_pool_stale_parser_residue_invalidated_rows: 2`
- Ready fashion pool count 는 15 → 13 으로 줄었다.
- Target pid `409089039` parsed row 를 새 parser 결과로 upsert 하고 `score_dirty=true` 처리했다.
  - comparable key 가 `shoe|2002r|sneaker|270|a_grade` 류 오염에서 `shoe|2002r|sneaker|235|a_grade` 로 정정됐다.
  - 현 pool status 는 low-volume gate 로 `invalidated` 유지.

## Verification
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 213 pass / 0 fail
- `npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave238-ai-l2-shadow-audit.test.ts`
  - 123 pass / 0 fail

## Deferred
- Size별 회전률 sample 분리는 별도 wave 로 진행한다.
- `stale_parser_version_*_residue` invalidation reason 이 실제 parser-review hold 와 섞여 보이는 부분은 observability 개선 wave 에서 reason 명시화를 검토한다.
