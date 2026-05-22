# 2026-05-22 — Launch HIGH batch: schema.sql sync + debug err 누출

## #1 subscribe_mvp_plan 멱등성 가드 schema.sql sync
**audit 짚음**: `supabase/migrations/20260515000300_subscribe_mvp_plan_idempotent.sql` 가
멱등성 가드 박은 버전인데, `supabase/schema.sql` L2199~ 의 함수 정의는 옛 버전 (가드 없음).
fresh deploy 시 schema.sql 마지막 적용되면 멱등성 사라짐 risk.

**fix**:
- schema.sql 의 `subscribe_mvp_plan` 함수에 H3 멱등성 가드 block 추가
  (동일 payment_key 재호출 시 기존 결과 반환)
- `mvp_payment_events.payment_key UNIQUE index` 도 schema.sql 에 추가
  (race condition 안전망)
- 결과: schema.sql ↔ migration sync. fresh deploy 안전.

## #2 /api/debug/agent-bridge raw err 누출 차단
**audit 짚음**: admin gate 통과 후라도 catch 에서 `error: message` 그대로 client 반환.
schema / 파일 경로 / internal 정보 노출 risk.

**fix**:
- GET / POST 둘 다 `console.error` 로 server log + client 응답 `error: "internal_error"`
- 일관성 (다른 endpoint 도 같은 패턴 — launch-15 #1 의 stats/pool 과 동일)

## 영향
- DB: schema.sql 만 변경. 실제 운영 DB 는 이미 migration 의 idempotent 버전 작동 중.
- 코드: agent-bridge 1 파일.
- 사용자 영향: X.

## 검증
- TypeScript compile clean
- migration 20260515000300 와 schema.sql 의 subscribe_mvp_plan 함수 정의 동등
