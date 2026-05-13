# Wave 29 — AI L2 Cache FK migration (review-only)

> Status: **SUPERSEDED on 2026-05-14 by Wave 32 branch rehearsal.** 본문 §1의 "현재 FK가 `mvp_listings(pid)`를 참조한다"는 가정은 사실과 다름이 확인됐다. production은 이미 `mvp_raw_listings(pid)`로 swap 완료된 상태 (committed migration `supabase/migrations/20260514000100_ai_l2_cache_fk_raw_listings.sql`). 본문 §5 rollback SQL은 **DELETE-orphans prerequisite 추가** 필요. 자세한 정정은 [Wave 32 doc](2026-05-14-wave32-phase2-rehearsal.md) §3, §5 참조.

---

> 아래는 원본(가정 기반) 내용. 정정사항은 위 노트 우선.

## 1. Current state

```sql
-- Existing FK on mvp_listing_ai_classifications
ALTER TABLE public.mvp_listing_ai_classifications
  ADD CONSTRAINT mvp_listing_ai_classifications_pid_fkey
  FOREIGN KEY (pid) REFERENCES public.mvp_listings(pid)
  ON DELETE CASCADE;
```

`mvp_listings` only contains rows where `parsed.needs_review = false` (per `tick-pipeline.ts:3344` scoreStage skip). Therefore the AI cache table cannot hold rows for `needs_review = true` listings — they fail FK on insert.

This blocks Phase 2 (tiny-cap escrow for `needs_review = true` smartphone rows): when we want to call AI on a Phase 2 candidate and store the result, the cache insert errors out.

## 2. Proposed migration

Move the FK to `mvp_raw_listings(pid)`, which contains every observed listing regardless of parse state.

```sql
-- Phase 2 prereq migration (NOT APPLIED IN WAVE 29)
ALTER TABLE public.mvp_listing_ai_classifications
  DROP CONSTRAINT mvp_listing_ai_classifications_pid_fkey;

ALTER TABLE public.mvp_listing_ai_classifications
  ADD CONSTRAINT mvp_listing_ai_classifications_pid_fkey
  FOREIGN KEY (pid) REFERENCES public.mvp_raw_listings(pid)
  ON DELETE CASCADE;
```

## 3. Risk assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Cache row count explosion (raw is much larger than listings) | medium | Phase 2 keeps tiny cap (≤ 50 rows/day per category). Add retention: drop AI cache rows where `content_hash` no longer matches any active raw row after 14 days. |
| Stale AI verdicts on rows where parser later flips `needs_review` true→false | low | `content_hash` is computed from title+description+price. If those change, cache miss is correct behavior. |
| ON DELETE CASCADE deletes AI cache when raw is hard-deleted | low | mvp_raw_listings is rarely hard-deleted; ON DELETE CASCADE preserves the existing semantic. |
| Concurrent writers race on FK swap | low | Apply during low-traffic window. `ALTER TABLE` takes ACCESS EXCLUSIVE briefly. |

## 4. Apply gate (NOT YET TRIPPED)

Before applying:

1. Confirm `mvp_listing_ai_classifications` row count is stable (no leak).
2. Add retention policy script (`scripts/housekeeper-ai-cache-prune.ts`) and dry-run it for 1 day.
3. Add Phase 2 scoreStage exception path code review (separate doc).
4. Confirm pool-policy block flags include explicit escrow markers (`ai_escrow_pending`) so AI pass on `needs_review=true` row never enters pool.

## 5. Rollback (CORRECTED — Wave 32 branch rehearsal 결과)

Wave 32 branch rehearsal (Probe C-1)에서 원본 rollback SQL은 raw-only cache row가 1건이라도 있으면 `ERROR 23503: insert or update ... violates foreign key constraint`로 실패하고, multi-statement이라 전체 ALTER가 atomically auto-abort된다 (FK 변동 0). 따라서 prerequisite 한 줄이 필수:

```sql
-- Prerequisite: raw-only AI cache 행을 먼저 정리한다.
DELETE FROM public.mvp_listing_ai_classifications a
  WHERE NOT EXISTS (SELECT 1 FROM public.mvp_listings l WHERE l.pid = a.pid);

-- 이후 documented rollback (Wave 32 branch에서 Probe C-3 PASS)
ALTER TABLE public.mvp_listing_ai_classifications
  DROP CONSTRAINT mvp_listing_ai_classifications_pid_fkey;
ALTER TABLE public.mvp_listing_ai_classifications
  ADD CONSTRAINT mvp_listing_ai_classifications_pid_fkey
  FOREIGN KEY (pid) REFERENCES public.mvp_listings(pid)
  ON DELETE CASCADE;
```

Production 측정값 (Wave 32 시점): 529 cache rows 중 **2 rows가 raw-only** → 실제 rollback이 필요해질 경우 위 DELETE가 그 2 rows를 제거하고 진행됨. AI cache는 content_hash 기반 재생성 가능하므로 데이터 손실 risk는 낮다.

## 6. Decision

**Not applying in Wave 29.** Submitted as review-only doc per LAUNCH_PLAN section 4.3 / 2.4. Apply requires owner sign-off and Phase 2 escrow code path readiness.
