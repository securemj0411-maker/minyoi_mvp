# 2026-05-22 — Launch HIGH 잔존: /api/packs/pool raw err 누출 fix

## 발견
`/api/packs/pool/route.ts:693` catch 에서 `error: err.message` 그대로 client 반환.
이 endpoint = 모든 사용자가 호출 (메인 feed). DB schema / PostgREST 에러 누출 risk.

기존 launch-15 #1 (`/api/stats/pool`) 와 같은 패턴이지만 빠뜨림.

## fix
`console.error` 로 server log + client 응답 `error: "pool_load_failed"`.

## 검증
- cron endpoint 들 (다 checkCronAuth 가드) — raw err 응답 가능 but 외부 노출 X. skip.
- admin endpoint 들 — raw err 누출 0건 확인.
- packs/open — message 는 incident log context. client 응답은 일반 ("pack_open_failed"). 안전.
- 결론: `/api/packs/pool` 만 남은 누출 → fix 완료.

## 메모리 룰
- decision log: 이 파일
