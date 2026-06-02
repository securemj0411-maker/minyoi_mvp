# 2026-06-02 Wave 1010 — Daangn source health writer 복구

## 배경
- Wave 1009에서 lifecycle/pool-warmer gate를 source-aware로 바꿨다.
- 운영 스냅샷에서 fresh한 `mvp_source_health(source='daangn')` row가 없었다.
- `daangn-ingest.ts`는 `sourceHealthStatus/sourceHealthReason`을 계산하고 cron route가 collect run stage_stats에는 남기고 있었지만, `mvp_source_health`에는 쓰지 않았다.
- 따라서 cron-guard와 lifecycle gate가 Daangn 상태를 확인하려 해도 stale/unknown으로 볼 수 있었다.

## 결정/구현
- `runDaangnIngest()` active/probe run 종료 직전에 `mvp_source_health` row를 best-effort insert하도록 추가했다.
- 저장 필드:
  - `source='daangn'`
  - `status`, `reason`, `previous_status`
  - `search_result_count`
  - detail/search/raw upsert/timing 지표를 `baseline_json`에 기록
  - `hysteresis_json.note='daangn_ingest_source_health'`
- insert 실패는 ingest 실패로 만들지 않고 warning만 남긴다.

## 의도
- 호출량/크롤링량은 늘리지 않는다.
- 기존에 이미 계산하던 health 결과를 운영 health table에 반영한다.
- Wave 1009의 source-aware lifecycle gate가 Daangn health를 실제로 사용할 수 있게 한다.

## 보류
- `sourceHealthStage()`를 source별로 완전히 재작성하는 것은 보류했다.
- lifecycle claim/due 조회 timeout을 줄이는 DB index/RPC 개선은 다음 후보로 남긴다.
- 랜딩 preview sold listing query statement timeout도 별도 index/cache 후보로 남긴다.

## 검증
- `npx tsx --test tests/daangn-source-probe.test.ts tests/cron-guard.test.ts tests/lifecycle-state.test.ts` 통과: 24 pass.
- `npm run build` 통과.
- 빌드 중 랜딩 preview sold query는 여전히 statement timeout을 냈지만 fallback으로 성공했다.
