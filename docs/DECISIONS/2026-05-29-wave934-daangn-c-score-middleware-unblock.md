# 2026-05-29 Wave 934 — 당근 C score shard middleware unblock

## 배경

Wave 933에서 `score-worker-c`를 추가하고 C 전용 Vercel 프로젝트에 배포했지만,
직접 호출 결과 `/api/cron/score-worker-c`가 `project_role_disabled`로 차단됐다.

확인 결과 라우트/cron guard 문제가 아니라 `src/middleware.ts`의 C 전용 프로젝트 allowlist에
`/api/cron/score-worker-c`가 빠져 있었다. C 프로젝트는 프론트/API를 404로 막고 cron 일부만
허용하는 구조라, middleware allowlist 누락 시 라우트 함수까지 도달하지 못한다.

## 결정

- `daangn_c` middleware allowlist에 `/api/cron/score-worker-c`를 추가한다.
- B 프로젝트는 이미 `/api/cron/score-worker-b`가 허용되어 있어 수정하지 않는다.
- 프론트/API 차단 정책은 유지한다. C 프로젝트는 여전히 허용된 cron 외에는 `404` 또는
  `project_role_disabled`로 막힌다.

## 보류

- score batch size 증설은 이번 wave에서 건드리지 않는다. 먼저 C shard가 실제로 돌면서
  A/B/C 합산 score 처리량이 raw 유입량을 따라잡는지 관찰한다.
- Daangn detail worker 병목과 rowBuild/rawUpsert 최적화는 다음 wave에서 별도 측정한다.

## 검증 계획

1. `npm run build`
2. C 프로젝트 재배포 후 `/api/cron/score-worker-c` 직접 호출
3. `mvp_collect_runs`에서 `/api/cron/score-worker-c` 성공 로그와
   `score_daangn_shard_count=3`, `score_daangn_shard_index=2` 확인
