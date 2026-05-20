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
