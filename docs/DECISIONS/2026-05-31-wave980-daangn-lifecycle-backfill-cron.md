# Wave 980 — daangn lifecycle backfill cron route

- 시간: 2026-05-31 15:25 KST
- 트리거: wave 978/979 fix 후 신규 매물은 자동 시드 정상. 단 기존 daangn active 363k 중 7k만 시드 → 나머지 ~356k 영구 누락 위험 (daangn-ingest 는 search 페이지에 노출된 매물만 시드).

## 변경

### DB migration
- partial index: `mvp_raw_listings_daangn_active_pid_idx` ON (pid) WHERE source='daangn' AND listing_state='active' — NOT EXISTS subquery 효율 개선 (Merge Anti Join LIMIT 일찍 종료 가능).
- RPC `wave978_backfill_daangn_lifecycle_chunk(p_chunk_size)`: 단일 INSERT statement, LIMIT chunk_size, ON CONFLICT DO NOTHING. tier 는 parsed metadata 기반. spread: `next_check_at = NOW() + RANDOM() * 7d`.
- `supabase/migrations/20260531062000_wave980_daangn_lifecycle_backfill_chunk.sql` + index migration

### Route
- `src/app/api/cron/daangn-lifecycle-backfill/route.ts`: 매 5분 cron, RPC 호출. env `DAANGN_LIFECYCLE_BACKFILL_CHUNK` (default 5000, max 20000). 응답에 `inserted` 카운트.

### Cron schedule
- `vercel.json`: 매 5분 (`*/5 * * * *`)

## 초기 backfill 측정

MCP 에서 RPC 직접 호출 (2k → 20k → 20k... 큰 chunk 는 PG 안 끝나지만 MCP timeout). 현재 약 31k 시드 (자연 시드 4.5k + manual backfill 22k + phase1 1k + 기존 etc).

## 효과

- Vercel cron 매 5분 5k INSERT → 332k 잔여 67 cycle = **5.5h 안 전체 시드**
- spread 7d 균등 분산 → lifecycle worker capacity 28,800/h 안에 fit (daangn 만 추가 ~52k/day sweep)
- 신규 ingest 시드 + backfill 동시 진행
- 다 시드 후엔 cron 매번 0 row 박힘 (NOT EXISTS 로 다 걸러짐) — 무해. 필요 시 cron 제거 가능.

## 위험

- 매 5분 5k INSERT 와 partial index 쓰임 — `mvp_lifecycle_checks` index 다수, INSERT 시 다 갱신. 측정으로 timeout 발생하면 chunk_size env 로 줄임 (500~5000).
- daangn HTML fetch 부하: 7d spread 라 lifecycle worker capacity 안. probe 측정 (wave 904) 마진 있음.

## 다음

- Vercel deploy 후 cron 자동 실행 모니터: `SELECT inserted FROM mvp_collect_runs WHERE request_path LIKE '%daangn-lifecycle-backfill%' ORDER BY started_at DESC`
- 5.5h 후 daangn lifecycle row ~363k 도달 확인
- 다 시드되면 vercel.json cron 제거 (다음 wave) — 단 시드 후엔 0 row 박혀 무해라 그대로 둬도 OK
