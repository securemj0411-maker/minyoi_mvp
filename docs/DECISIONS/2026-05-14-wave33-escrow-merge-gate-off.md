# Wave 33 — Phase 2 escrow + pool-policy flag merge (feature gate OFF)

> Status: **code merged, runtime OFF**. production runtime 동작 변화 0. AI_L2_ESCROW_PHASE2_ENABLED=1을 명시적으로 set하기 전까지 모든 `parsed.needs_review === true` row는 기존대로 scoreStage에서 skip된다.

## 1. 변경된 파일

| 파일 | 변경 |
|---|---|
| `src/lib/ai-l2-escrow.ts` | **새 모듈**. `evaluatePhase2Escrow()`, `isPhase2EscrowEnabled()`, narrow smartphone whitelist, parse_confidence floor, per-run cap, gate env `AI_L2_ESCROW_PHASE2_ENABLED` (default OFF). |
| `src/lib/tick-pipeline.ts` | scoreStage needs_review skip 블록에 escrow 평가 호출 + `phase2EscrowFlagByPid` map + `score_phase2_escrow_*` stats. gate OFF면 기존 skip path 그대로. |
| `src/lib/pool-policy.mjs` | POOL_BLOCK_FLAGS에 `ai_escrow_pending`, `ai_escrow_held`, `ai_escrow_unavailable` 3개 추가. AI verdict 전까지 pool 진입 hard block. |
| `scripts/housekeeper-ai-cache-prune-dryrun.ts` | **새 dry-run 스크립트**. DELETE 없음. retention R1 (age 30d) / R2 (raw_row_gone, FK CASCADE로 0 보장) / R3 (content_hash_stale 14d, RPC 부재로 sentinel 0) 측정. |
| `scripts/wave33-escrow-gate-verify.ts` | gate matrix 5-case 검증 스크립트. allPass=true. |

## 2. Feature gate OFF 검증

- `.env.local` / `.env` grep: `AI_L2_ESCROW_PHASE2_ENABLED` **부재** (0 hits).
- `evaluatePhase2Escrow()` gate OFF 호출: `eligible=false, reason=gate_off` (verify script gate_off_default=true).
- scoreStage 동작: gate OFF면 `escrow.eligible=false` → 기존 `needsReviewSkipped += 1; continue;` 그대로 실행. 새 stat `score_phase2_escrow_gate_enabled=0`, `score_phase2_escrow_selected=0`.
- production runtime ON 금지 원칙 ✓.

## 3. Gate 동작 매트릭스 (verify script 결과)

| Case | env | parsed | expected | actual |
|---|---|---|---|---|
| default OFF | unset | eligible row | `gate_off` | `gate_off` ✓ |
| ON narrow eligible | 1 | iphone_15_pro narrow + conf=0.9 | `ai_escrow_pending` | `ai_escrow_pending` ✓ |
| ON broad blocked | 1 | `smartphone\|generic` | `comparable_key_not_narrow` | `comparable_key_not_narrow` ✓ |
| ON low conf blocked | 1 | conf=0.4 | `parse_confidence_below_floor` | `parse_confidence_below_floor` ✓ |
| ON cap blocked | 1 | selectedSoFar=999 | `per_run_cap_reached` | `per_run_cap_reached` ✓ |

allPass=**true**.

## 4. housekeeper-ai-cache-prune dry-run

`reports/wave33-ai-cache-prune-dryrun-latest.json`:

| Metric | Value |
|---|---:|
| total_rows | 529 |
| r1_stale_by_age (30d) | 0 |
| r2_raw_row_gone | 0 (FK CASCADE 보장, dry-run 미측정) |
| r3_content_hash_stale | 0 (sentinel — full 측정은 live housekeeper에서) |
| union_would_prune | 0 |
| oldest_classified_at | 2026-05-09T14:07:33Z |
| newest_classified_at | 2026-05-13T16:40:36Z |

해석: 현 baseline에서 cache age <5 days → 30d retention floor 적용 시 0건 prune. R3 (content_hash_stale)은 PostgREST join 제약으로 sentinel 0; live housekeeper 구현 단계에서 view/RPC로 분리하여 측정.

## 5. Wave 29 rollback prerequisite 최종 확인

Wave 32 doc §5 / Wave 29 doc §5 (정정본) 모두 prerequisite SQL 포함:
```sql
DELETE FROM public.mvp_listing_ai_classifications a
  WHERE NOT EXISTS (SELECT 1 FROM public.mvp_listings l WHERE l.pid = a.pid);
```
- 코드 설계 정합성: gate ON + AI pass 후 detail-worker가 `ai_escrow_pending` 제거하고 score_dirty=true 재마킹 → 다음 tick에서 정상 score path 통과 → mvp_listings insert 가능. 즉 rollback 필요 시 raw-only cache는 **그 시점의 escrow 상태 row만**이며, content_hash 기반 재생성 가능.
- 문서/코드 정합성 OK.

## 6. 원칙 ack
- production runtime ON 금지: ✓ (.env 미설정 + 코드 default OFF)
- DDL/apply 금지: ✓ (DB write 0)
- broad smartphone widening 금지: ✓ (SMARTPHONE_NARROW_PREFIXES 5개만, 추가는 별도 wave 측정 후)
- silent carrier 추정 금지: ✓ (parse_confidence>=0.55 명시 token 게이트)
- feature gate OFF 유지: ✓ (env 미설정 + verify matrix gate_off_default PASS)

## 7. 변경/검증/위험
- 변경: 5 files (2 신규 모듈, 2 신규 스크립트, 3 기존 파일 patch)
- 검증: `npx tsc --noEmit` clean, `npm run test:core` 120/120 PASS, gate matrix 5/5 PASS, prune dry-run 0 rows.
- 위험: 없음 (gate OFF로 dead code, behavior 변화 0).
- 다음: Wave 34 — owner 사인오프 + retention 정책 확정 + AI L2 호출 path (detail-worker가 escrow row 처리 + flag 제거) merge.

## 8. Phase 2 production apply 직전 남은 blocker

| # | blocker | 상태 |
|---|---|---|
| 1 | FK migration | 완료 (Wave 32) |
| 2 | scoreStage escrow path | ✅ 본 wave merge (gate OFF) |
| 3 | `ai_escrow_pending` pool block flag | ✅ 본 wave merge (+ held/unavailable 동시) |
| 4 | retention prune dry-run | ✅ 본 wave 실행 (0 rows prune in baseline) |
| 5 | owner 사인오프 | 미수령 |
| 6 | AI L2 호출 path (detail-worker escrow consumer) | 미merge |
| 7 | retention prune live 구현 (R3 RPC) | 미merge |

→ **남은 blocker 3건** (5, 6, 7).
