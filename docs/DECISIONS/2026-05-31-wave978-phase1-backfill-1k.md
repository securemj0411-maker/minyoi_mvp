# Wave 978 follow-up — Phase 1 backfill 1k 실행

- 시간: 2026-05-31 14:20~14:40 KST
- 트리거: wave 978 코드 fix (lifecycle seed) 적용 후 backfill ramp 시작.

## 변경 (production DB SQL)

### 1. INSERT — daangn active 매물 1,000건 lifecycle seed
```sql
INSERT INTO mvp_lifecycle_checks (pid, source, status, priority_tier, next_check_at, state_reason, updated_at)
SELECT r.pid, 'daangn', 'active',
  COALESCE(CASE
    WHEN p.parse_confidence >= 0.65 AND p.needs_review = false THEN 'market_sample'
    WHEN p.comparable_key IS NOT NULL THEN 'exploration'
    ELSE 'general'
  END, 'general'),
  NOW(), 'wave978_backfill_phase1', NOW()
FROM mvp_raw_listings r LEFT JOIN mvp_listing_parsed p ON p.pid = r.pid
WHERE r.source = 'daangn' AND r.listing_state = 'active'
  AND r.last_seen_at > NOW() - INTERVAL '6 hours'
  AND NOT EXISTS (SELECT 1 FROM mvp_lifecycle_checks lc WHERE lc.pid = r.pid)
LIMIT 1000
ON CONFLICT (pid) DO NOTHING;
```

분포: market_sample 454 / general 495 / exploration 51.

### 2. UPDATE — next_check_at + updated_at 을 1일 전으로 patch
배경: 초기 INSERT 가 `next_check_at = NOW()` 박았는데, claim RPC `ORDER BY priority+next_check_at+updated_at` 에서 bunjang/joongna 옛 매물 12만+ 백로그에 밀려 1000건 중 1건만 처리됨 (15분 측정).

```sql
UPDATE mvp_lifecycle_checks
SET next_check_at = NOW() - INTERVAL '1 day',
    updated_at = NOW() - INTERVAL '1 day'
WHERE source='daangn' AND state_reason='wave978_backfill_phase1';
```

이 단발성 patch 는 wave 979 (lane a/b/c 분산) 적용 전 임시 우선순위 부여. wave 979 deploy 후엔 b/c 가 daangn shard 잡으니 별도 patch 불필요.

## 위험

- 옛 시점 patch → daangn 1k 가 같은 priority 의 bunjang/joongna 매물보다 우선 잡힘. wave 979 deploy 후엔 b/c lane 이 daangn-only 라 우선순위 충돌 없음.
- wave 979 deploy 가 06:01 UTC fail (PG overload, follow-up commit 으로 해결) → 1k 처리 지연. 06:06 부터 정상 재개.

## 다음

- 06:15 UTC 측정: daangn 1k 처리율 + sold detection 작동 확인
- 양호 시 phase 2 (10k), 3 (100k), 4 (잔여 ~252k) 진행. wave 979 deploy 후엔 INSERT 시 `next_check_at = NOW() + (RANDOM() * INTERVAL '7 days')` spread 박아 일거 폭증 없게.
