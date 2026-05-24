# Wave 778 — systemic pool_eligible backfill RPC + cron hook

**날짜**: 2026-05-24
**Wave**: 778 (Wave 772 manual fix → systemic 승격)

## 문제 root (Wave 772 발견)

게임/골프 카테고리 ready 풀린지 6h 지났는데 0건 진입.
원인: **bunjang ingest 시 pool_eligible flag 누락** (joongna 만 박힘).

→ ready 카테고리 매물 detail=done 인데 pool_eligible=false 로 영원히 stuck.
→ Wave 772 manual SQL 1,347건 (game/golf) fix.
→ Wave 778 sweep: **20,969건** 추가 stuck 발견 (다른 ready 카테고리 누락 분).

## Systemic fix

### Supabase RPC

```sql
CREATE OR REPLACE FUNCTION public.ensure_pool_eligible_for_ready_categories()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE mvp_raw_listings r
  SET pool_eligible = true,
      score_dirty = true,
      updated_at = NOW()
  FROM mvp_listing_parsed p
  JOIN mvp_category_readiness c ON c.category = p.category
  WHERE r.pid = p.pid
    AND c.status = 'ready'
    AND r.detail_status = 'done'
    AND r.listing_state = 'active'
    AND r.listing_type = 'normal'
    AND r.pool_eligible IS DISTINCT FROM true;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ensure_pool_eligible_for_ready_categories() TO authenticated, service_role, anon;
```

### tick-pipeline.ts hook

`runTickPipeline()` 에 `poolEligibleBackfillStage()` 추가:
- detail → parser_drift → **pool_eligible_backfill** → score
- 매 5분 cron 마다 ready 카테고리 누락 매물 자동 flag
- additive only (false → true), 안전

## 첫 실행 결과

```
SELECT public.ensure_pool_eligible_for_ready_categories() as updated;
→ updated: 20,969
```

20,969 매물 즉시 pool_eligible=true + score_dirty=true.
→ 다음 score-worker tick 에서 pool 진입.

## 미해결 (별도 wave)

- **bunjang ingest source-level fix**: 신규 매물 ingest 시 pool_eligible 처음부터 박기 (현재 RPC 는 safety net)
- **ai_audit_status='hold' UI 배지**: Wave 771 deferred
- **schema migration condition_class NULL**: Wave 771 deferred

## 효과

- 미래 모든 신규 ready 카테고리 매물 자동 pool 진입 (manual SQL 불필요)
- "왜 게임/골프 0건?" 류 stuck 영원히 차단
- 새 카테고리 ready 풀 때마다 ingest 코드 수정 불필요

## 누적 정리 (Wave 771-778, 24h)

| Wave | 내용 | 효과 |
|---|---|---|
| 771 | AI hold 정책 명확화 (decision log) | 정책 명료 |
| 772 | pool_eligible manual fix (1,347건) | game/golf 즉시 진입 |
| 773 | LOW_SAMPLE_ALLOWED game/golf 추가 | thin_market n<5 우회 |
| 774 | sport_golf loft (각도) 추출 | TSR2 9도 vs 11도 분리 |
| 775 | sport_golf shaft 추출 | Beres TourAD 8.5배 분리 |
| 776 | sport_golf sex + iron_set | Majesty Men/Women 5.6배 |
| 777 | sport_golf generation (5 brand) | Beres NX/BB / Ping G410-G430 / PXG GEN / TM SIM-Qi10 / Titleist TS-GT / XXIO 9-13 |
| 778 | pool_eligible RPC + cron hook | systemic 누락 차단 (20,969건 backfill) |

sport_golf comparable_key 정밀도 완성 + pool 진입 systemic 안정화.
