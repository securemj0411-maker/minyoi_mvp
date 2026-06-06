# 2026-06-06 Wave 1187 — 당근 15만원 이하 empty 오판 보정

## 결정
- 당근 피드 quick page에서 nearby raw scan이 timeout/interrupted 되면 0개 응답도 `empty`가 아니라 `partial`로 내려보낸다.
- 프론트가 empty card를 띄우기 전에 백그라운드 continuation을 시도하도록 API 상태 계약을 보정한다.
- lifecycle freshness 기본 허용창을 5분에서 15분으로 넓히고, worker가 5분 조금 전에 시작해 최근에 끝난 케이스를 놓치지 않도록 조회 lookback buffer를 추가한다.

## 이유
- 프로덕션 로그에서 `/api/packs/pool`이 `nearby_daangn_raw_fetch_timeout` 후 `returnedItems: 0`, `status: empty`로 내려갔다.
- DB에는 동작구 사당동 기준 15만원 이하 당근 후보가 있었으므로, 실제 후보 부족이 아니라 scan timeout + lifecycle freshness 경계값 오판이었다.
- `mvp_collect_runs`에는 최근 lifecycle 성공 기록이 있었지만 기존 쿼리는 `started_at >= 최근 5분`만 보아, 시작은 5분보다 전이고 완료는 최근인 정상 실행을 놓칠 수 있었다.

## 확인
- `npm run lint -- src/app/api/packs/pool/route.ts` 통과.
- `npm run build` 통과.
- DB에서 최근 25분 내 lifecycle 성공 기록 확인.

## 보류
- 최근 lifecycle worker 실패가 연속으로 보였다. 피드를 빈 상태로 만들지는 않게 했지만, worker 실패 원인은 별도 로그 추적이 필요하다.
