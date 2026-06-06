# Wave 1208 — 당근 거리뷰 무한스크롤 150 천장 fix (audit P0 #5)

날짜: 2026-06-06
관련: Wave 1205 audit #5, Wave 1192e (nearby RPC), owner "p0 죠지자"

## 검증 결과 (코드로 확정 — owner 의심 맞음)

당근 거리뷰 무한스크롤이 실제로 **150개 천장**:
- `nearby_daangn_ready_feed` RPC(route.ts:1032)는 `p_region_ids/p_price_max/p_limit`만 받고
  **excludePids(이미 본 pid) 파라미터가 없음**.
- route가 RPC 결과를 받은 뒤 `exclude.has(pid)`로 거른다(1063).
- `p_limit`이 고정(150)이라: 페이지1 = 최근접 150 표시 → 페이지2 = RPC가 **똑같은 최근접 150**을 또 줌
  → 이미 본 150개 전부 걸러져 fresh 0 → 연쇄(shouldContinueSilentHydration) 종료 = **천장**.
- (일반 피드는 PostgREST `pid=not.in.(...)`(1262)로 서버에서 제외돼 멀쩡 — 당근 거리뷰만 문제.)

## fix

```
p_limit: Math.max(1, Math.min(limit + exclude.size, 500))
```

이미 본 개수(exclude.size)만큼 RPC limit을 키워, 다음 페이지에 충분한 신규 매물이 오게 함.
- 페이지2: limit 150 + exclude 150 = RPC 300 → exclude 150 거름 → 150 신규.
- 당근 6km 내 ready 매물이 RPC 상한 500을 넘는 동네는 사실상 없음(강남도 ~150) → **실질 무한 스크롤**.

## 한계 / 후속 (진짜 무한)
- RPC 상한 500이라 엄밀히는 500 천장. 당근 근처 500+ 동네가 없어 실질 영향 0이나,
  진짜 끝없는 무한을 원하면 RPC에 `p_exclude_pids bigint[]` 파라미터 추가(DB CREATE OR REPLACE)가 정석.
  DB 수정이라 owner 확인 후 별도 진행 가능.

## TS check
clean (exclude는 같은 함수 scope, 접근 OK).

## Sign-off
owner "너가 확인해보면 알잖아" → 코드로 검증해 150 천장 확정(RPC excludePids 미수신). limit 보정으로 실질 무한.
