# 2026-05-27 — Wave 887 home region confirm path stability

## Decision

- GPS/주소 검색 미리보기에서 사용자가 확인한 `fullPath` 를 저장 요청에 같이 보낸다.
- 서버는 저장 시점에 받은 `fullPath` 를 우선 사용하고, 없을 때만 좌표 reverse-geocode 를 다시 수행한다.
- Daangn 동 단위 exact mapping 이 없을 때 같은 시군구의 첫 번째 동으로 대체하지 않는다.
- exact mapping 이 없으면 시군구 seed id 는 연결하되, 사용자에게 보여주고 저장하는 `daangn_full_path` 는 Kakao 원문 동네를 유지한다.
- 이미 잘못 저장된 사용자가 `/onboarding/home-region?edit=1` 로 다시 동네를 덮어쓸 수 있게 한다.

## Why

상도1동처럼 `daangn-region-parents.json` 에 없는 행정동은 기존 prefix fallback 에서 동작구의 첫 번째 mapped dong 인 사당동으로 바뀌었다. 사용자가 GPS 미리보기에서 상도1동을 확인했는데 저장 완료 토스트가 사당동으로 뜨면 위치 설정 신뢰가 깨진다.

## Deferred

- Daangn region id 를 동 단위로 더 촘촘히 채우는 작업은 별도 wave 로 둔다.
- 현재 pool 필터는 시도 단위 nearby 판정이므로, exact dong id 가 없어도 `daangn_full_path` 를 Kakao 원문으로 저장하면 사용자 표시와 필터 모두 안전하다.
