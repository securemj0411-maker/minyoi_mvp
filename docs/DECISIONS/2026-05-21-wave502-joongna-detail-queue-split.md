# Wave 502 — Joongna Detail Queue Split

## Context
- 중고나라 worker는 검색, 상세 조회, 판매자 보강, DB write가 한 route budget 안에 묶여 있었다.
- 이전 deadline-aware 패치로 partial work 손실은 줄였지만, 검색에서 발견한 URL이 detail 단계 timeout 전에 영속화되지 않는 구조적 병목은 남아 있었다.
- 운영 목표는 번개장터 throughput을 깎지 않고 중고나라를 별도 파이프로 지속 편입하는 것이다.

## Decision
- 중고나라 검색 발견 URL을 `mvp_joongna_detail_queue`에 먼저 저장한다.
- worker는 큐에서 `claim_mvp_joongna_detail_queue`로 detail 대상만 lease/claim한다.
- 큐 테이블/RPC가 아직 배포되지 않은 환경은 기존 direct ingest로 자동 fallback한다.
- 큐 테이블은 public schema에 두되 RLS를 켜고 anon/authenticated 접근을 회수하며, 서버 REST 경로용 `service_role` 권한만 명시한다.

## Implemented
- `supabase/migrations/20260521183000_wave502_joongna_detail_queue.sql`
  - detail queue 테이블, unique `product_url`, claim index, lease 기반 claim RPC 추가.
- `src/lib/joongna-ingest.ts`
  - 검색 discovery와 detail fetch 대상을 분리.
  - queue mode counters 추가: enqueued/claimed/done/failed.
  - queue unavailable/disabled이면 direct mode fallback.
  - shoe/clothing/fashion 관련 query는 queue priority를 높게 부여.
- `src/app/api/cron/joongna-worker/route.ts`
  - collect run stage stats에 queue counters 기록.
- `tests/joongna-detail-queue-contract.test.ts`
  - migration/RLS/grant/RPC/fallback/counter contract 추가.

## Production Verification
- `supabase db push --dry-run`은 원격 migration history와 로컬 migration 폴더 불일치로 중단했다. 여러 migration을 함께 밀 위험이 있어 사용하지 않았다.
- 같은 SQL 파일만 별도 트랜잭션으로 원격 DB에 적용했다.
- 원격 확인:
  - `mvp_joongna_detail_queue` 존재.
  - RLS enabled.
  - `service_role` table rw 권한 존재.
  - `claim_mvp_joongna_detail_queue(integer,integer)` 실행 권한 존재.
- 소형 live run:
  - query `호카 본디`, maxDetails 2.
  - queueMode true.
  - searchUrls 2, detailQueueEnqueued 2, detailQueueClaimed 2, detailQueueDone 2, detailQueueFailed 0.
  - health `healthy`, reason `active_ingest_ok`.
- 같은 query 재실행 시 이미 처리한 URL만 발견되어 detailQueueClaimed 0이 됐고, health는 `healthy`, reason `queue_no_pending_details`로 기록됨을 확인했다.

## Deferred
- 별도 detail-only endpoint로 route를 완전히 분리하는 작업은 다음 단계로 보류.
- seller enrichment를 별도 async queue로 빼는 작업도 보류. 지금은 detail claim 후 writable detail에 한해 기존 캐시/라이브 보강을 유지한다.
- done URL의 장기 refresh TTL 정책은 운영 데이터가 쌓인 뒤 결정한다. 현재는 새 discovery 손실 방지가 우선이다.
