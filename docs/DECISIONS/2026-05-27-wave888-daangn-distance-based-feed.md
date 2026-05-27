# 2026-05-27 — Wave 888 Daangn distance-based feed

## Decision

- 당근 매물 필터를 `같은 시/도` 수준에서 `지역 centroid 거리` 기반으로 바꾼다.
- Kakao Local API로 당근 seed/동네 region id 379개의 좌표를 생성해 `src/lib/generated/daangn-region-geo.json` 에 저장한다.
- 런타임 `/me` 피드는 Kakao API를 매번 호출하지 않고 정적 좌표 JSON으로 사용자 동네와 매물 동네 거리 km를 계산한다.
- 거리 bucket:
  - `near`: 8km 이하
  - `reachable`: 16km 이하
  - `far`: 28km 이하, 노출은 하되 후순위/확인 필요
  - `too_far`: 28km 초과, 당근 피드에서 제외
- 상도1동처럼 exact dong 좌표가 없으면 동작구 centroid로 fallback 한다. 이 fallback은 다른 동으로 표시하지 않고 거리 계산용으로만 쓴다.
- 같은 배포에서 `/me` 클라이언트의 `freeLimit=0` 처리도 보정한다. 현재 운영 정책은 무료 rate-limit 대신 가입 크레딧 grant를 쓰므로, 서버가 `freeLimit=0`을 내려도 클라이언트가 과거 localStorage/default 무료 횟수로 되살리면 안 된다.

## Why

상도1동 사용자는 서초/금천처럼 생활권 당근 매물은 거래 가능할 수 있지만, 기존 시/도 필터는 서울 전체를 같은 실행성으로 취급했다. 당근 채팅 가능 여부는 공식 API로 받을 수 없으므로, 서비스 관점에서는 실제 구매 시도 가능성이 높은 거리 기반 랭킹과 먼 매물 제외가 필요하다.

## Deferred

- 당근 공식 앱의 개인별 동네 인증 반경을 1:1로 복제하지 않는다. 사용자 설정/인증 상태에 따라 달라질 수 있기 때문이다.
- 실거래 피드백이 쌓이면 `far` 기준 28km와 랭킹 가중치를 조정한다.
- 지역 centroid가 부족한 신규 Daangn region id가 들어오면 `scripts/generate-daangn-region-geo.ts` 를 다시 실행해 JSON을 갱신한다.
- 무료 1회 vs 가입 크레딧 grant 방식 자체의 가격 정책은 별도 충전 페이지 wave에서 다시 정리한다. 이번 변경은 stale 무료라벨이 살아나는 버그만 막는다.
