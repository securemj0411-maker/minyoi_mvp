# Wave 1192h — 로딩 스켈레톤 반응형 (모바일3 / 태블릿6 / 데스크탑9)

날짜: 2026-06-06
관련: Wave 1192 (무한스크롤), 1192d (empty 가드)
commit: b8dfafe0

## 문제
owner: 데스크탑에서 로딩 스켈레톤이 3개만 떠서 "근처 당근 매물부터 확인 중" 배너 아래가 휑함.
원인: `Array.from({ length: 3 })` 하드코딩 (Wave 370 "6→3" 옛 모바일 viewport 기준).
데스크탑 3열 grid에선 3개 = 1줄만 → 빈 공간.

## fix
`length: 9` + 반응형 className:
- `i >= 6` → `hidden lg:grid` (데스크탑만)
- `i >= 3` → `hidden sm:grid` (태블릿+)
- 나머지 → `grid` (항상)
→ 모바일(1열) 3개 / 태블릿(2열) 6개 / 데스크탑(3열) 9개 — 각 3줄로 꽉 참.

## TS check
clean.
