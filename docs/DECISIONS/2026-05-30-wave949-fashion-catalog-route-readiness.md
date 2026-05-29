# Wave 949 — Fashion Catalog Route Readiness

Date: 2026-05-30

## Decision

Wave 948 verification에서 남았던 fashion catalog regression 2건을 별도 catalog wave로 처리했다.

상태 파서 문제가 아니라 SKU route/readiness 정합성 문제였으므로, 테스트 기대값만 바꾸지 않고 catalog route와 lane readiness를 함께 맞췄다.

## Implemented

- New Balance x Auralee:
  - `뉴발란스 오라리 1906R 275 새상품` 같은 신발 모델 명시 매물은 `shoe-newbalance-auralee-collab`으로 direct route.
  - `뉴발란스 오라리 러닝캡 모자` 같은 accessory/cap 매물은 계속 차단.
- Arc'teryx Alpha:
  - Wave 765에서 이미 쪼갠 `Alpha SV/AR/LT` exact lanes를 readiness에도 등록.
  - `clothing-arcteryx-alpha`는 sub-line 미명시 generic Alpha로 의미를 좁힘.
  - `아크테릭스 알파 SV 자켓`은 `clothing-arcteryx-alpha-sv`로 route되고 pool gate도 통과.

## Verification

- `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - 81 pass, 0 fail
- `npx tsx --test tests/fashion-catalog-regression.test.ts tests/wave254-5-fashion-condition.test.ts tests/fashion-parser-version-sync.test.ts tests/core-rules.test.ts`
  - 251 pass, 0 fail
- `npm run build`
  - passed

## Deferred

- Alpha SV/AR/LT lane별 production sample count와 market sample sufficiency는 cron 재파싱 이후 운영자 pool에서 별도 확인한다.

