# 2026-05-27 — Wave 890 Daangn Direct Radius Tighten

## Problem

- 사용자 home region 이 `서울특별시 동작구 상도1동`인데 `/me` 피드에 `경기도 광명시 일직동` 당근 매물이 노출됐다.
- 원인은 Wave 888 거리 정책이 `16km`까지 actionable 으로 둔 점이다.
- 현재 centroid 기준 상도1동 fallback geo(`서울 동작구`) → 일직동은 약 `10.8km`라서 기존 정책에서는 `reachable`로 통과했다.
- 당근은 직거래 실행성이 핵심이라 10km 초과 매물은 피드 신뢰를 깨는 쪽의 비용이 더 크다.

## Decision

- 당근 피드 actionable radius 를 `10km 이하`로 좁힌다.
- `near <= 6km`, `reachable <= 10km`만 사용자 피드에 노출한다.
- `10km 초과 ~ 16km`는 `far`로 분류하되 `actionable=false`라서 `/api/packs/pool`에서 숨긴다.
- 상도1동 기준 서초4동/가산동/사당동은 계속 노출 가능하고, 광명 일직동은 차단한다.

## Deferred

- `mvp_user_home_regions`에 사용자가 확인한 GPS 좌표를 별도 저장해서 동 centroid fallback보다 더 정밀하게 계산하는 작업은 다음 위치 정확도 wave로 보류한다.
- 당근 실제 채팅 가능 범위는 계정/앱 정책에 따라 달라질 수 있으므로, 현재는 서비스 신뢰를 우선한 보수적 노출 정책으로 간다.

## Verification

- `npx tsx --test tests/daangn-region-distance.test.ts tests/home-region-matcher.test.ts` => pass
- `npm run build` => pass
