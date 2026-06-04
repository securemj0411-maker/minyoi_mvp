# Wave 1061 — Detail analysis state merge

## Decision

- 상세/쉬운모드에서 비교 매물·판매 주기가 `표본 부족` 또는 `불러오는 중`으로 남는 문제를 데이터 결손이 아니라 UI state 병합 문제로 판단했다.
- 확인한 예시 `맥북 프로 14인치 M1 Pro 16GB 512gb 실버` (`pid=9001496404236`)는 DB에 `ready` 상태, 같은 `comparable_key`, `worn` velocity 샘플이 존재했다.
- `/api/packs/reveals/detail`의 `analysis` 응답을 `recommendation-workspace`가 버리던 흐름을 고쳐, `result.reveals` 카드에 `marketBasis`, `velocityBasis`, `skuListingFlow`, `optionBaseAssumed`를 병합하도록 했다.
- `/explore`의 lazy analysis 호출과 비교매물 fetch에 Supabase bearer token을 붙여, 상세권한 API가 인증 강화 후 401/403으로 실패하는 경우를 줄였다.
- 분석 전 fallback 카드의 0건 표본을 영구 로딩처럼 보이게 하던 쉬운모드 문구를 정리했다.

## Deferred

- 브라우저 자동화 도구가 이번 턴에 노출되지 않아 실제 로그인 세션 UI 클릭 검증은 빌드 검증으로 대체했다.
- 비교매물 API가 실패했을 때 사용자에게 원인별 메시지(인증 만료, 상세권한 없음, rate limit)를 나누는 UX는 후속으로 남긴다.
