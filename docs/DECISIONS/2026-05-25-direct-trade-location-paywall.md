# 2026-05-25 Direct Trade Location Paywall Fix

## Decision

직거래 전용 매물의 열기 전 확인 모달에서 원본 매물 링크를 노출하지 않는다.

이 모달은 상세 분석 열람 전 단계이므로, 원본 링크가 보이면 사용자가 크레딧을 쓰기 전에 상품을 특정할 수 있다. 대신 득템잡이 서버가 보유하거나 조회한 직거래 동네만 화면 안에서 보여준다.

## Implemented

- 중고나라 `tradeLocation`을 ingest raw_json에 저장하도록 변경.
- 중고나라 detail HTML의 `locationName` 여러 개를 `원천동 · 영통1동 · 청담동` 형태로 추출.
- `영통1동`처럼 숫자가 들어간 동네명도 위치로 인식.
- 피드 raw_json에 위치가 없을 때, 열기 전 모달에서 `/api/packs/pool/direct-location`으로 지역만 조회하고 raw_json에 패치.
- 열기 전 모달의 `원본에서 위치 확인` 링크 제거.
- 상세 열람 검증 후에도 `directTradeLocation`이 최신 detail 위치로 유지되도록 보강.

## Deferred

- 기존 중고나라 row 전체에 대한 일괄 location backfill은 보류.
- 위치 조회 API 호출 수/응답시간 모니터링 후 캐시 TTL 또는 batch pre-warm 여부를 결정한다.
- 직거래 지역과 사용자 위치/선호 지역을 비교해 자동 경고하는 기능은 별도 wave로 분리한다.

## Verification

- `npx tsx --test --test-name-pattern "direct-only" tests/free-plus-entitlement-contract.test.ts`
- `npx tsx --test tests/marketplace-safety.test.ts tests/joongna-source-guard.test.ts`
- `npm run build`
