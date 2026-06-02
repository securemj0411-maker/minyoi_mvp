# Wave 1019 — Market score_dirty marking DB-side RPC

## 배경

Wave 1018 배포 후 첫 production run:

- 19:42 KST `/api/cron/market-worker`
- `duration_ms=158316`
- `market_stats=156557ms`
- `market_score_dirty_candidate_rows=5000`
- `market_score_dirty_marked_rows=210`
- `market_mark_score_dirty_ms=91026`

Wave 1018로 marked row는 크게 줄었다.

- 이전 느린 run: 1857 rows marked, 270s
- Wave 1018 run: 210 rows marked, 158s

하지만 `market_mark_score_dirty_ms`가 여전히 91s였다. 원인은 REST fallback 구조가 comparable_key → parsed pid 최대 5000건을 네트워크로 끌고 온 뒤, 300개 chunk × listing_type split PATCH를 반복하는 구조였기 때문이다.

추가 read-only 진단:

- 19:42 근처 recomputed keys 81개 기준 DB-side target query EXPLAIN:
  - execution 약 27.8s
  - parsed 11,758 rows 조회
  - raw pkey lookup 다수 발생
- active/scorable raw row count:
  - total raw: 약 1,099,732
  - active/scorable total: 약 279,962
  - active/scorable clean (`score_dirty=false`): 약 110,729

## 결정

1. active/scorable/clean raw row 전용 partial index 추가.

조건:

- `score_dirty is false`
- `detail_status='done'`
- `sku_id is not null`
- `listing_state='active'`
- `listing_type='normal' or listing_type_override='normal'`

2. `mark_scorable_score_dirty_by_comparable_keys(text[], integer)` RPC 추가.

역할:

- comparable_key 목록을 받아 DB 내부에서 parsed/raw join 수행.
- score worker가 실제 처리 가능한 active/scorable/clean row만 target.
- `score_dirty=true` update 후 candidate/marked count 반환.

3. runtime은 RPC 우선, 실패 시 Wave 1018 REST scoped path로 fallback.

## 안전성

- partial index는 `create index concurrently if not exists`로 적용했다.
- 함수 추가는 additive이며 기존 테이블/row 삭제 없음.
- 시세 산정 sample 범위 변경 없음.
- RPC 실패 시 기존 REST fallback 유지.
- fake key probe 결과: `200`, `candidate_count=0`, `marked_count=0`.

## 적용

Supabase migration history mismatch가 있으므로 `supabase db push`는 사용하지 않았다.

직접 적용:

- `mvp_raw_scorable_clean_pid_last_seen_idx`
  - build time: 약 102s
- `mark_scorable_score_dirty_by_comparable_keys`
  - apply time: 약 64ms

## 보류

- 다음 production market-worker run에서 `market_mark_score_dirty_ms`가 실제로 얼마나 줄었는지 확인한다.
- RPC target query 자체가 27s까지 걸릴 수 있으므로, index 적용 후에도 30s+가 유지되면 query shape 또는 추가 index를 다시 검토한다.
- lifecycle A worker는 55s 안팎으로 성공 중이라 이번 wave 범위에서는 건드리지 않는다.
