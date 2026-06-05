# 2026-06-05 Admin Pool Filter Race

## 결정
- cau 관리자 pool 브라우저에서 필터 요청 sequence guard를 추가했다.
- 필터 변경 중 여러 fetch가 겹치면 최신 요청만 화면 상태를 갱신한다.

## 이유
- 출처/지역/가격 필터는 React state가 순차 변경되며 여러 `/api/admin/pool-listings` 요청을 만들 수 있다.
- 이전 요청이 더 늦게 도착하면 필터 UI는 `동작구`로 보이는데 리스트는 이전 `관악구` 응답으로 덮일 수 있다.
- 서버 region pidScope는 적용되어 있으므로, 화면 불일치의 핵심은 stale response overwrite 방지다.

## 보류
- 관리자 통계 카드의 가격대별/지역별 ready count는 현재 전역 ready 기준이다.
- “현재 선택 필터 안의 breakdown”으로 바꾸는 작업은 별도 UX 개선으로 보류한다.
