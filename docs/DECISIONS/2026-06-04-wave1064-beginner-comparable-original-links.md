# Wave 1064 — Beginner comparable original links

## Decision

- 쉬운모드 비교매물이 상세보기와 다르게 카드 전체 클릭으로 원문을 열 수 없던 문제를 수정했다.
- 원인은 상세보기 비교매물 리스트와 쉬운모드 비교매물 preview가 별도 컴포넌트로 구현되어 있었고, 쉬운모드 쪽 row가 `<div>`로만 렌더링되던 구조였다.
- 비교매물 원문 URL 선택 로직을 `comparableSourceUrl` helper로 분리했다.
- 쉬운모드 비교매물 row도 원문 URL이 있으면 상세보기처럼 카드 전체를 `<a>`로 렌더링하게 맞췄다.

## Deferred

- 원문 클릭 이벤트 tracking은 현재 비교매물 preview에는 연결하지 않았다. 비교매물별 click analytics가 필요하면 후속으로 event schema를 정리해서 붙인다.
