# Wave 34 — Phase 2 AI verdict consumer + R3 retention view + owner sign-off package

> Status: **code merged, gate OFF, no DDL apply.** scoreStage → applyAiReview 사이의 escrow flag 전이 + score_dirty 재마킹 + R3 retention view migration 파일 추가. AI_L2_ESCROW_PHASE2_ENABLED=1 명시 전까지 runtime 동작 변화 0.

## 1. 변경된 파일

| 파일 | 변경 |
|---|---|
| `src/lib/ai-l2-escrow.ts` | `applyEscrowTransition(scoreFlags, "pass"\|"hold"\|"unavailable"\|"reject"\|"noop")` 추가. `ai_escrow_pending` 제거 + transition별 marker flag 부여 (`ai_escrow_held`, `ai_escrow_unavailable`). |
| `src/lib/pipeline.ts` | `applyAiReview`가 escrow row의 verdict별 transition 처리. AI pass → pending 제거 (pool 허용). hold → held 전이 (pool 차단 유지). unavailable → unavailable 전이 + caller에 pid 리스트 반환. 신규 stats `escrowResolvedPass/Held/UnavailableRetry`. |
| `src/lib/tick-pipeline.ts` | scoreStage가 `escrowUnavailablePids`를 받아 `mvp_raw_listings.score_dirty=true`로 재마킹 → 다음 tick에서 retry. 신규 stats `score_phase2_escrow_resolved_pass/held/unavailable_retry`. |
| `supabase/migrations/20260514000300_ai_cache_retention_view.sql` | **새 migration 파일. 미적용**. `mvp_listing_ai_cache_retention_v1` view 정의 (R1/R2/R3 booleans). owner sign-off 후 Wave 35에서 apply. |
| `scripts/housekeeper-ai-cache-prune-dryrun.ts` | view 존재 시 R2/R3를 view에서 읽음, 부재 시 sentinel 0. |

## 2. AI verdict 흐름 (gate ON 가정)

```
scoreStage
 ├─ needs_review=true row → evaluatePhase2Escrow()
 │    └─ gate OFF → skip (default)
 │       gate ON + narrow + conf≥0.55 + cap → scoreFlags += "ai_escrow_pending"
 ├─ applyAiReview
 │    ├─ result=pass(high, normal, !hardRisk)  → pending 제거          → pool 허용
 │    ├─ result=reject(non-low)               → row=null              → pool 미진입
 │    ├─ result=hold/low                      → pending→held          → pool 차단
 │    └─ result=null (unavailable)            → pending→unavailable  → pool 차단, pid 반환
 └─ scoreStage post: unavailable pids → mvp_raw_listings.score_dirty=true 재마킹 (다음 tick에서 재시도)
```

원칙 ack:
- broad smartphone widening 금지: ✓ (escrow eligibility의 `SMARTPHONE_NARROW_PREFIXES` 5개 SKU만)
- silent carrier 추정 금지: ✓ (parse_confidence>=0.55 명시 token)
- feature gate 보수적 유지: ✓ (`AI_L2_ESCROW_PHASE2_ENABLED` default OFF, env 파일 미설정, applyEscrowTransition은 pending 없는 row에 no-op)

## 3. R3 retention view (미적용)

`supabase/migrations/20260514000300_ai_cache_retention_view.sql`:

```sql
create or replace view public.mvp_listing_ai_cache_retention_v1 as
  -- cache + raw left join, R1/R2/R3 booleans
  -- R1: classified_at < now() - 30d
  -- R2: raw row 부재 (FK CASCADE로 정상 0)
  -- R3 proxy: raw.source_updated_at > cache.classified_at + 14d
```

**중요**: R3는 *proxy*다. `mvp_raw_listings`에 content_hash 컬럼이 없어 정확한 hash drift는 DB 측에서 계산 불가. live housekeeper는 view에서 후보 받아 code-level `pipeline.ts:contentHash`로 false-positive 1차 거른 뒤 DELETE.

view 미배포 상태에서 dry-run 결과 (baseline 2026-05-14):

| Metric | Value |
|---|---:|
| total_rows | 529 |
| r1_stale_by_age (30d) | 0 |
| r2_raw_row_gone | 0 (sentinel — view 부재) |
| r3_raw_updated_after_classify | 0 (sentinel) |
| union_would_prune | 0 |
| view_available | false |

## 4. Verification matrix

- `npx tsc --noEmit` → clean
- `npm run test:core` → **120/120 pass**
- `scripts/wave33-escrow-gate-verify.ts` → allPass=true (5/5)
- `scripts/housekeeper-ai-cache-prune-dryrun.ts` → 0 rows would prune (view 부재 → sentinel 0)
- `.env.local`/`.env` grep `AI_L2_ESCROW_PHASE2_ENABLED` → 0 hits (gate OFF 유지)
- `applyAiReview` 기존 caller (`pipeline.ts:1035`)는 `aiReview.rows`만 사용 → backward compatible

## 5. Phase 2 production apply 직전 남은 blocker

| # | blocker | 상태 |
|---|---|---|
| 1 | FK migration | 완료 (Wave 32) |
| 2 | scoreStage escrow path | 완료 (Wave 33) |
| 3 | pool-policy ai_escrow_pending/held/unavailable | 완료 (Wave 33) |
| 4 | retention prune dry-run | 완료 (Wave 33) |
| 5 | AI verdict consumer path + flag clear | ✅ 본 wave |
| 6 | score_dirty 재마킹 (unavailable retry) | ✅ 본 wave |
| 7 | R3 retention view 정의 | ✅ 본 wave (migration 작성, 미적용) |
| 8 | R3 view apply + live housekeeper 구현 | 미apply, Wave 35 |
| 9 | owner 사인오프 | ✅ 본 wave 패키지 작성 — 대기 중 |

→ **남은 blocker 2건** (8, 9).

## 6. 변경/검증/위험
- 변경: 5 files (1 신규 모듈 확장, 1 신규 SQL migration 파일, 3 기존 파일 patch)
- 검증: tsc clean, 120/120 tests, gate matrix 5/5, dry-run 0-row, env grep 0-hit
- 위험: 없음 (gate OFF로 모든 신규 path dead code)
- 다음: Wave 35 — owner sign-off 수령 후 (a) AI_L2_ESCROW_PHASE2_ENABLED=1 ramp, (b) R3 view apply, (c) live housekeeper-ai-cache-prune merge + cron 등록.
