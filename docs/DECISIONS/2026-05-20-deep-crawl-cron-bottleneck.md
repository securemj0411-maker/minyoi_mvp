# 2026-05-20 — deep-crawl cron 병목 완화

## 배경

운영자 점검 중 `deep-crawl`이 최근 반복적으로 `stale running run auto-marked after 3m`로 실패 처리되는 것을 확인했다.

## 관측

- 최근 12시간 기준 `deep-crawl` 20회 중 성공 6회, 실패 14회.
- 실패 14회는 모두 stale running 자동 마킹.
- 성공한 run도 `duration_ms`가 약 88~90초로 route `maxDuration=90` 한계에 붙어 있었다.
- 최근 성공 run의 `search_queries_total/search_queries_due`는 2299였고, deep mode는 cadence gate를 우회해 매번 전체 query list를 대상으로 삼았다.
- deadline check는 fetch loop 앞에만 있어 25초 fetch budget 이후에도 수천 건 후처리가 계속 진행됐다.

## 결정

- `deep-crawl`은 전체 query list를 한 번에 대상으로 삼지 않고, 30분 버킷마다 bounded query window를 회전시킨다.
- 기본 window는 `PIPELINE_DEEP_CRAWL_QUERY_LIMIT=80`이며, env로 10~1000 사이 조정 가능하다.
- `stage_stats.timingsMs`에 `search_queries_deep_window_start`, `search_queries_deep_window_limit`, `search_queries_deep_window_size`를 기록해 후속 모니터링한다.

## 보류

- QStash/Vercel runtime 로그 직접 조회는 로컬 Vercel CLI token invalid 때문에 보류.
- 배포 후 2~3회 deep-crawl run에서 duration과 stale rate가 내려가는지 DB run log로 재확인한다.

## 추가 확인 및 후속 조치

- `2026-05-20T11:07Z` scheduled deep-crawl도 stale 처리됐다.
- production manual call: `/api/cron/deep-crawl?force=1&page=1`
  - 결과: 84.6초 후 500.
  - error: `Supabase REST timed out PATCH /rest/v1/mvp_raw_listings?pid=in.(363269848,397884133)`.
  - 해당 2개 row는 실제로 `updated_at=2026-05-20T11:12:09Z`까지 반영되어, REST timeout이 run finish를 막은 형태로 보인다.
- 추가 결정:
  - 기본 deep window를 80 → 40으로 낮춰 post-processing 대상량을 더 줄인다.
  - deep-crawl의 비핵심 write(`patch_title_triage_skips`, skipped lifecycle seed, raw touch, terminal recheck request)는 timeout 시 전체 run 실패로 전파하지 않고 timings에 soft failure로 남긴다.
  - 일반 tick/fresh mode는 기존처럼 hard failure 유지.
