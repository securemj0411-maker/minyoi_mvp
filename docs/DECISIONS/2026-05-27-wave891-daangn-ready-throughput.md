# 2026-05-27 — Wave 891 Daangn Ready Throughput

## Problem

- 당근 매물은 별도 `daangn-worker`가 수집하지만, `/me` ready 진입이 체감상 느리다.
- 무작정 당근/Bunjang search cron을 늘리면 외부 요청량과 차단 리스크가 증가한다.
- 코드상 더 안전한 병목은 두 곳이다.
  - `daangn-worker`가 catalog-hint 후보를 최신순 `500개`로 자른 뒤 preflight를 한다. 상위 500개가 이미 저장된 row면, 뒤쪽 신규/변경 후보가 같은 run에서 채워지지 못한다.
  - 공용 `score-worker`가 2분 cadence라서 `score_dirty=true`인 당근 row가 ready로 승격되기까지 기다릴 수 있다.

## Decision

- 외부 당근 fetch 규모는 그대로 두고, DB write 전 preflight window만 넓힌다.
  - write cap `500`은 유지한다.
  - preflight 후보는 `write cap × 3`, 최대 `2,000개`까지 확인한다.
  - 이미 저장돼서 classify를 skip한 row 뒤에 있는 신규/변경 row가 같은 run에서 write cap을 채울 수 있게 한다.
- `score-worker`를 2분마다에서 1분마다로 바꾼다.
- score row 선택에서 Daangn reserve를 `40%` 수준에서 `60%+ / 최소 90건`으로 올린다.
- 번개장터 search cadence는 건드리지 않는다. 당근 ready 지연의 원인이 번장 search 부족이 아니고, 외부 fetch를 늘리는 쪽은 trade-off가 크다.

## Deferred

- 당근 worker 자체를 1분 cadence로 올리는 것은 보류한다. 같은 전체 region firehose를 더 자주 때리면 차단/비용 trade-off가 커질 수 있다.
- `maxUpsertArticles` 자체를 500에서 올리는 것도 보류한다. 이번 변경으로 effective write fill rate를 먼저 확인한다.
- 필요하면 다음 wave에서 source-specific score worker route를 분리한다.

## Verification

- `npx tsx --test tests/daangn-ingest.test.ts` => pass
- `npm run build` => pass

## Production Measurement

- Read-only measurement at `2026-05-28 00:10 KST`; no manual cron trigger and no DB mutation.
- Before new deploy, recent `daangn-worker` runs wrote only `3` raw rows because the 500-row candidate window was mostly existing rows:
  - `upsertCandidateArticles=500`
  - `rawSkippedExisting=495`
  - `articlesDeferredByUpsertCap=1027~1028`
- After deploy, the new preflight window is active on production:
  - `2026-05-28 00:03 KST`: `upsertCandidateArticles=1500`, `rawSkippedExisting=663`, `classifyCandidates=500`, `upserted=500`, duration `45.8s`.
  - `2026-05-28 00:08 KST`: `upsertCandidateArticles=1500`, `rawSkippedExisting=1125`, `classifyCandidates=366`, `upserted=366`, duration `34.8s`.
- Raw Daangn ingestion throughput improved materially without increasing the external fetch cadence.
- Ready pool did not jump at the same rate during the short window:
  - ready source snapshot moved roughly `daangn 298 -> 299`.
  - recent ready 30m moved `daangn 7 -> 13`.
  - dirty Daangn backlog stayed low-ish (`24 -> 32`), so the new bottleneck appears to be score/pool acceptance quality, not raw collection.
- Caution: `score-worker` 1-minute cadence is not clearly trade-off-free. Recent score-worker runs take `51~67s`, so Vercel may skip/overlap minutes. A lifecycle worker also hit one Supabase statement timeout during the same observation window. Do not increase score cadence further without either source-specific worker separation or a lock/claim review.
