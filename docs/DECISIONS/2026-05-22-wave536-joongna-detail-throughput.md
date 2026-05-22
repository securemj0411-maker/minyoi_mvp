# 2026-05-22 Wave 536 — 중고나라 detail 처리량 개선

## 배경
- 운영자 ready pool 기준 중고나라가 번개장터보다 낮게 유지되고 있었다.
- 최근 로그상 중고나라 worker는 healthy였고 검색 URL은 run당 111~127개를 찾았지만, 실제 detail 처리/parsed는 run당 7~27개 수준이었다.
- 병목은 중고나라 시장 자체보다 `detailTargets`를 순차 처리하면서 매 항목마다 delay를 거는 구조에 있었다.

## 결정
- 검색 요청량을 늘리는 대신, 이미 claim/discovery 된 detail 대상만 작은 wave 동시성으로 처리한다.
- 기본 동시성은 2로 제한한다.
- `JOONGNA_INGEST_DETAIL_CONCURRENCY` 또는 `detailConcurrency` param으로 조정 가능하되, 명시 param이 없으면 최대 2로 clamp한다.

## 기대 효과
- 외부 검색 cadence는 유지하면서 function wall time을 줄인다.
- 같은 worker budget 안에서 더 많은 중고나라 상세/parsed row를 처리할 수 있다.
- block/rate-limit 신호는 기존대로 감지하고 source health에 반영한다.

## 보류
- cron 주기 단축, search query/page 확대, category 가중 배분은 요청량/coverage trade-off가 있어 별도 판단으로 보류한다.
