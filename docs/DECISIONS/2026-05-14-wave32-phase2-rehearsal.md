# Wave 32 — Phase 2 rehearsal on Supabase branch

> Status: **branch rehearsal complete, no production change.** Supabase development branch `wave32-phase2-rehearsal` (project_ref `vftufdsjlholjhifdmmp`, parent `suwsvvjsycgcegepcktp`)에서 FK swap forward/rollback 전 경로 실측 후 branch 즉시 삭제. production DB 변경 0, runtime 변경 0.

본 doc은 사용자 지시에 따라 production 내 `BEGIN/ROLLBACK` rehearsal 경로를 폐기하고, branch 한정 rehearsal로 재작성한 버전이다. 이전 버전 (production-transaction 기반) 의 결론은 본 doc으로 흡수된다.

## 1. Rehearsal 환경
- Branch: `wave32-phase2-rehearsal` (hourly cost $0.01344, 약 10분 사용 후 삭제)
- Branch project_ref: `vftufdsjlholjhifdmmp`
- 사용한 MCP: `supabase` org-scoped (`create_branch`, `apply_migration`, `execute_sql`, `delete_branch`)
- 기반: branch는 `migrations/` 만 자동 적용하고 `schema.sql`은 적용하지 않아 `public` schema가 비어 있었음. FK 동작 격리 검증용 minimal bootstrap 적용.

## 2. Minimal bootstrap (branch-only)
`mvp_raw_listings`(pid PK), `mvp_listings`(pid PK, FK→raw cascade), `mvp_listing_ai_classifications`(pid PK, **FK→`mvp_listings` cascade**, 즉 pre-swap state).

Seed:
- pid=1: raw + listings 양쪽 (needs_review=false 류)
- pid=2: raw only (needs_review=true 류 — Phase 2 escrow 대상)
- 초기 cache: pid=1만

## 3. 핵심 정정 — Wave 29 가정 vs 실제
Wave 29 doc은 "production FK가 `mvp_listings(pid)`이다"라고 가정했다. 실제는 다음 migration이 이미 commit돼 있어 production은 raw 상태였다:

```
supabase/migrations/20260514000100_ai_l2_cache_fk_raw_listings.sql
```

→ Wave 29의 "Phase 2 prereq migration 필요" 항목은 **이미 완료**. 본 wave는 그 migration의 forward/rollback 동작을 격리 환경에서 사후 검증.

## 4. Probes & 결과

| Probe | Action | Expectation | Result |
|---|---|---|---|
| A | pre-swap FK 상태에서 raw-only pid=2 cache insert | 23503 fail | ✅ 23503 fail (Phase 2 문제 재현) |
| Forward | DROP→ADD FK to `mvp_raw_listings` | success | ✅ success |
| B | post-swap에서 raw-only pid=2 cache insert | success | ✅ success, cache={1,2} |
| C-1 | documented rollback (prerequisite 없이) — DROP raw FK + ADD listings FK | pid=2 raw-only 때문에 23503 fail, multi-statement atomically auto-abort, FK 변동 0 | ✅ 23503 fail, FK 그대로 raw |
| C-3 | rollback **with** `DELETE-orphans` prerequisite | success, FK 다시 listings, orphan 제거 | ✅ success, cache={1}, FK→listings |

## 5. Documented rollback patch (Wave 29 §5 반영)
원본은 단순 DROP+ADD 2문이었고 raw-only cache row 있을 때 hard fail. 정정 SQL:
```sql
DELETE FROM public.mvp_listing_ai_classifications a
  WHERE NOT EXISTS (SELECT 1 FROM public.mvp_listings l WHERE l.pid = a.pid);
ALTER TABLE public.mvp_listing_ai_classifications
  DROP CONSTRAINT mvp_listing_ai_classifications_pid_fkey;
ALTER TABLE public.mvp_listing_ai_classifications
  ADD CONSTRAINT mvp_listing_ai_classifications_pid_fkey
  FOREIGN KEY (pid) REFERENCES public.mvp_listings(pid) ON DELETE CASCADE;
```

production 현황 (Wave 31 baseline + Wave 32 측정): cache 529 rows 중 raw-only 2 rows. 위 DELETE가 그 2건만 제거. content_hash 재생성 가능.

## 6. scoreStage escrow path (code-side rehearsal, 미적용)
파일: `src/lib/tick-pipeline.ts:3339-3342`. 현재 `parsed?.needs_review === true`면 무조건 skip. Phase 2 entry 시 narrow comparable_key + parse_confidence>=0.55 + 일일 cap whitelist만 통과시키고, 통과 row에 `ai_escrow_pending` flag 부여 (pool 차단 유지). 코드 merge는 Wave 33로 이연.

원칙 ack:
- broad smartphone widening 금지 → narrow comparable_key whitelist만.
- silent carrier 추정 금지 → parse_confidence 명시 게이트.
- production runtime on 금지 → feature gate OFF 유지.

## 7. pool-policy `ai_escrow_pending` flag (code-side rehearsal, 미적용)
파일: `src/lib/pool-policy.mjs:3-21` POOL_BLOCK_FLAGS 끝에 `"ai_escrow_pending"` 추가 예정. AI verdict pass 시 detail-worker가 flag 제거 + `score_dirty=true` 마킹. 코드 merge는 Wave 33.

## 8. Branch cleanup 및 production 영향
- Branch `wave32-phase2-rehearsal` `delete_branch` 호출 성공.
- production DB 쿼리 0건 (이 wave에서 production execute_sql 사용 없음. Wave 31 baseline은 별도).
- runtime/config 변경 0.

## 9. Phase 2 production apply 직전 남은 blocker

| # | blocker | 상태 |
|---|---|---|
| 1 | FK migration (`pid → mvp_raw_listings`) | **이미 완료** (committed migration + Wave 32 forward probe PASS) |
| 2 | scoreStage escrow path code merge | 미merge, 설계 §6 확정 |
| 3 | `ai_escrow_pending` pool block flag code merge | 미merge, 설계 §7 확정 |
| 4 | retention prune script (`housekeeper-ai-cache-prune.ts`) dry-run | 미실시 |
| 5 | owner 사인오프 | 미수령 |
| 6 | Wave 29 §5 rollback prerequisite doc patch | ✅ 본 wave에서 완료 |

→ **남은 blocker 4건** (1, 6 폐기/완료).

## 10. 변경/검증/위험
- 변경: branch 한정 DDL (branch 삭제로 소멸), production 변경 0
- 검증: 5 probe 전건 통과
- 위험: 없음
- 다음: Wave 33 — scoreStage escrow + `ai_escrow_pending` flag code merge (feature gate OFF) + `housekeeper-ai-cache-prune.ts` dry-run
