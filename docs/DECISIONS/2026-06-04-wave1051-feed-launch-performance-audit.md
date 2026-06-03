# 2026-06-04 Wave 1051 — Feed Launch Performance Audit

## 결정

- `/api/packs/pool`에서는 당근 원문 URL을 request-time에 직접 검증하지 않는다.
- 당근 생존 상태는 lifecycle worker가 DB에 반영한다.
- lifecycle worker freshness를 확인할 수 없거나 최근 성공이 없으면, 당근 live 후보는 피드에서 보수적으로 제외한다.
- `/intro`에서 쓰는 `mvp_landing_showcases` 캐시는 Vercel cron에 등록해 매시간 다시 굽는다.
- 당근 근처 매물 prefetch 쿼리용 partial index를 추가한다.
  - `source='daangn'`
  - `listing_state='active'`
  - `detail_status='done'`
  - `daangn_region_id + last_seen_at desc`

## 배경

- 광고 유입 전 점검에서 `/api/packs/pool`이 매 피드 요청마다 당근 상위 후보 최대 4개를 외부 원문으로 확인하는 것을 확인했다.
- request path에서 외부 원문 fetch를 남겨두면 광고 트래픽 때 latency/timeout이 사용자 요청에 직접 전염된다.
- 따라서 피드 API는 DB에 반영된 lifecycle 결과만 읽고, lifecycle freshness가 깨진 경우에는 외부 fetch로 땜질하지 않고 당근 live 후보를 차단한다.
- `/intro`의 landing showcase cache는 테이블 row가 3개 이상이면 stale 여부와 무관하게 그대로 서빙한다.
- live DB 점검 기준 `mvp_landing_showcases` 최신 row가 약 36시간 전이라, public intro가 낡은 샘플을 보여줄 수 있었다.
- 당근 nearby prefetch는 region + last_seen 필터가 핵심인데, active/done/feed 전용 index가 부족했다.

## 보류

- 피드 전체를 별도 materialized feed table로 완전 denormalize하는 작업은 보류한다.
  - 현재는 request-time external verification 제거, cache cron, hot-path index가 먼저 효과가 크다.
  - 다음 단계는 `mvp_candidate_pool` 또는 별도 feed cache에 `source/price/market/velocity/region`을 더 구워 넣어 `/api/packs/pool`의 다중 REST join을 줄이는 방향이다.
- `mvp_landing_showcases` read path의 stale TTL 강제는 보류한다.
  - cron이 등록되면 stale 상태가 정상적으로 해소된다.
  - 추후 cron 장애까지 고려하려면 `getLandingShowcases()`에서 max age를 검사하고 fallback으로 내려가게 바꾼다.
