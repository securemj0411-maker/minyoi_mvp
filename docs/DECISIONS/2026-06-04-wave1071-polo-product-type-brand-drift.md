# 2026-06-04 Wave 1071 - 폴로티 상품종류와 Polo 브랜드 분류 드리프트 차단

## 문제

- `타미힐피거 화이트 레귤러핏 폴로티 M` 매물이 Polo Ralph Lauren 비교군과 섞여 노출됐다.
- 원인은 `폴로티/폴로셔츠`가 상품종류인데, 예전 parser 결과가 `clothing-polo-pony-tee`로 DB에 남아 있었고 당근 scheduled touch 재수집이 기존 fashion `sku_id`를 재사용하면서 최신 matcher를 다시 태우지 않은 것이다.
- 상세 비교 API는 저장된 `mvp_listing_parsed.comparable_key`를 정확히 사용하고 있어서, 프론트 문제가 아니라 stale catalog key 문제였다.

## 결정

- 의류 parser version을 `wave216-clothing-v53`으로 올려 fashion row를 drift 대상으로 만든다.
- 당근 ingest의 기존 classification 재사용은 fashion category(`clothing`, `shoe`, `bag`)에서는 금지한다.
- 명시 브랜드가 있는 의류는 상품종류 단어보다 브랜드 lane을 우선한다. 예: `타미힐피거 ... 폴로티`는 Tommy Hilfiger lane, `폴로 랄프로렌 ... 폴로티`는 Polo Ralph Lauren lane.
- 이미 잘못 섞인 DB row는 현 catalog 기준으로 재분류하거나, 비교군 오염 가능성이 있으면 invalidated 처리한다.

## 구현

- `src/lib/parsers/wave92-fashion-mobility.ts`
  - clothing parser version을 `wave216-clothing-v53`으로 상향했다.

- `src/lib/tick-pipeline.ts`
  - drift gate의 clothing 최신 version을 `wave216-clothing-v53`으로 동기화했다.

- `src/lib/daangn-ingest.ts`
  - `reusableDaangnClassification()`에서 fashion SKU는 기존 raw listing의 `sku_id`를 재사용하지 않고 현재 catalog matcher를 다시 실행하게 했다.

- version sync 파일
  - `src/app/api/debug/reparse-listings/route.ts`
  - `scripts/apply-fashion-parser-drift-requeue.ts`
  - `scripts/report-shoe-inflow-funnel.ts`
  - `scripts/report-fashion-shoe-db-sweep.ts`
  - `tests/wave254-5-fashion-condition.test.ts`

- `tests/wave254-6-product-type-priority.test.ts`
  - `타미힐피거 ... 폴로티`가 `clothing-tommy-hilfiger-broad`로 남고 Polo RL key로 들어가지 않는 회귀 테스트를 추가했다.
  - `폴로 랄프로렌 ... 폴로티`는 기존처럼 Polo RL lane으로 들어가는 확인도 추가했다.

## 데이터 정리

- 사용자 신고 PID `9003534368613`은 stale `clothing-polo-pony-tee`에서 `clothing-tommy-hilfiger-broad` / `clothing|tommy_hilfiger_broad|polo_shirt|b_grade`로 재분류됐다.
- 초기 Tommy/Polo stale 후보 10건을 현 catalog 기준으로 재처리했다.
- ready/reserved 의류 Polo 비교군 중 non-Ralph-Lauren 명시 브랜드 후보 31건을 추가로 재처리했다.
- 재처리 후 focused Polo pool의 non-Ralph-Lauren target은 `31 -> 0`으로 정리됐다.

## 검증

- `npx eslint src/lib/daangn-ingest.ts src/lib/parsers/wave92-fashion-mobility.ts src/lib/tick-pipeline.ts src/app/api/debug/reparse-listings/route.ts scripts/apply-fashion-parser-drift-requeue.ts scripts/report-shoe-inflow-funnel.ts scripts/report-fashion-shoe-db-sweep.ts tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
- `npx tsx --test --test-name-pattern "explicit clothing brand beats polo-shirt product type" tests/wave254-6-product-type-priority.test.ts`
- `npx tsx --test --test-name-pattern "parser_version clothing" tests/wave254-5-fashion-condition.test.ts`
- `npm run build`

## 보류

- `tests/wave254-6-product-type-priority.test.ts` 전체 파일에는 과거 catalog assertion 실패가 남아 있어 이번 신규 회귀 테스트만 targeted로 검증했다.
- 프로덕션 worker가 계속 `wave216-clothing-v52` 코드를 실행하면 같은 stale 재사용 경로가 남을 수 있으므로, 이번 패치는 배포까지 완료해야 root fix가 프로덕션에 반영된다.
