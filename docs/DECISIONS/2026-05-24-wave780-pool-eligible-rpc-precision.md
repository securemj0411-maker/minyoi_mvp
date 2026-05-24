# Wave 780 — pool_eligible RPC 정밀화 (pack-open 차단 시그널 존중)

**날짜**: 2026-05-24
**Wave**: 780 (Wave 778 RPC 사전 점검 시 발견 edge case)

## 발견

Wave 778 RPC `ensure_pool_eligible_for_ready_categories` review 중:

`src/lib/pack-open.ts:548` + `src/app/api/packs/me/route.ts:432` 가 num_comment >= 8 매물에
- `pool_eligible: false` 명시 박음
- `mvp_candidate_pool` invalidate

Wave 778 RPC 가 이 매물 무차별 `pool_eligible: true` 재설정 → 다음 cron 에서
`candidate-pool-builder` 가 num_comment 재gate → 다시 invalidate. **ping-pong + 매 5분 score 낭비**.

## Fix

RPC WHERE 절에 알려진 차단 시그널 skip 추가:

```sql
AND (r.num_comment IS NULL OR r.num_comment < 8)
AND (r.qty IS NULL OR r.qty <= 1)
```

candidate-pool-builder 의 `MAX_POOL_NUM_COMMENT = 8` + `MAX_POOL_QTY = 1` 와 동일.

## 검증

```sql
SELECT public.ensure_pool_eligible_for_ready_categories() as updated;
→ updated: 152 (Wave 778 첫 20,969 backfill 후 ~30분 사이 신규 stuck)
```

152 = Wave 779 source-fix 가 Vercel 에 deploy 되기 전 들어온 신규 bunjang detail done 매물.
deploy 후 → 0~소수 예상 (source path 가 처음부터 박으므로 RPC 는 잔여 만 처리).

## 안전성

- DDL: CREATE OR REPLACE (idempotent)
- additive 한정 (false → true)
- 차단 시그널 매물 skip (regression 없음)

## 누적 (Wave 778-780, defense in depth)

| Wave | 역할 |
|---|---|
| 778 | systemic safety net RPC + cron hook (5분 마다 backfill) |
| 779 | source-level fix — bunjang detail-worker 직접 pool_eligible 박기 |
| 780 | RPC 정밀화 — pack-open 명시 차단 매물 skip (ping-pong 방지) |

= 3-layer fix. source 박힘 (Wave 779) + safety net 자동 (Wave 778) + 차단 시그널 존중 (Wave 780).
