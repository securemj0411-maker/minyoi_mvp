# Wave 35 — Phase 2 escrow gate ON + R3 view apply (cron 보류)

> Sign-off: owner option **B 승인** (gate + view, cron 보류). 2026-05-14 KST.

## 1. Apply 내역

| 항목 | 상태 | 비고 |
|---|---|---|
| R3 retention view migration | **APPLIED** | `mvp_listing_ai_cache_retention_v1` 배포 (production DB) |
| Escrow gate env (`AI_L2_ESCROW_PHASE2_ENABLED=1`) | **APPLIED** | `.env.local`에 추가 (LAUNCH_PLAN §2.1: 로컬 dev = production runtime) |
| Per-run cap | **2** (보수적 ramp, default 5에서 축소) | `AI_L2_ESCROW_PHASE2_PER_RUN_CAP=2` |
| `housekeeper-ai-cache-prune` cron 등록 | **보류** | option B 결정. manual dry-run 유지. |
| `housekeeper-ai-cache-prune` live merge (DELETE 포함) | **보류** | cron과 함께 별도 wave |

## 2. View apply 검증

```sql
SELECT count(*) AS total,
  count(*) FILTER (WHERE r1_stale_by_age) AS r1,
  count(*) FILTER (WHERE r2_raw_row_gone) AS r2,
  count(*) FILTER (WHERE r3_raw_updated_after_classify) AS r3
FROM public.mvp_listing_ai_cache_retention_v1;
-- total=529, r1=0, r2=0, r3=0
```

Baseline 깨끗. R1은 oldest=2026-05-09라 자연스럽고, R2는 FK CASCADE로 0, R3는 cache가 신규(<5d)라 0. view 동작 정상.

## 3. Gate ON 검증

`scripts/wave35-gate-on-verify.ts` (`.env.local` 로드 후 모듈 평가):

```json
{
  "AI_L2_ESCROW_PHASE2_ENABLED": "1",
  "AI_L2_ESCROW_PHASE2_PER_RUN_CAP": "2",
  "isPhase2EscrowEnabled": true,
  "effective_per_run_cap": 2,
  "decision_for_eligible_row": {
    "eligible": true,
    "flag": "ai_escrow_pending",
    "reason": "narrow_smartphone_escrow"
  }
}
```

scoreStage에서 narrow iphone needs_review row가 escrow path 진입 → `ai_escrow_pending` 부여 → pool-policy hard block → applyAiReview에서 verdict 받고 transition.

## 4. Cron 보류 사유 + 운영 가이드

cron 미등록 = R1/R2/R3 자동 prune 안 됨. 단기 영향 없음:
- baseline R1/R2/R3 = 0/0/0.
- 일 누적 ~199 rows, R1 첫 발화는 2026-06-08 이후 (oldest 2026-05-09 + 30d).
- manual prune이 필요해지면 `npx tsx scripts/housekeeper-ai-cache-prune-dryrun.ts` 실행 → 검토 → 별도 DELETE 스크립트 작성.

다음 wave에서 cron 승인 시 추가할 것:
- live `housekeeper-ai-cache-prune.ts` (view → contentHash 재확인 → DELETE)
- 새 cron route `src/app/api/cron/housekeeper-ai-cache-prune/route.ts` (60분 주기)
- `vercel.json` (또는 QStash registry)에 등록

## 5. Rollback

각 항목 독립 rollback:
- **Gate**: `.env.local`에서 `AI_L2_ESCROW_PHASE2_ENABLED` 줄 제거 또는 `=0` → 다음 tick부터 OFF. AI cache는 그대로.
- **View**: `DROP VIEW public.mvp_listing_ai_cache_retention_v1;`. 데이터 영향 0.
- **Cap**: env 줄 제거 → default 5로 복원.

## 6. 24h 측정 항목 (Wave 36 전 모니터)

다음 항목을 ScoreStage stats / DB 측정:
- `score_phase2_escrow_selected` 일 누적 (목표: cap=2 × tick 횟수 이하)
- `score_phase2_escrow_resolved_pass` / `_held` / `_unavailable_retry` 비율
- `mvp_listing_ai_classifications` 일 증가량 (Wave 31 baseline 199 + 추가분)
- `ai_escrow_pending`/`held`/`unavailable` flag가 candidate_pool에 누출되지 않음 (pool-policy block 확인)

## 7. 원칙 ack
- broad smartphone widening 금지: ✓ (narrow whitelist 5 SKU만)
- silent carrier 추정 금지: ✓ (parse_confidence>=0.55 명시)
- sign-off 결과 없는 apply 금지: ✓ (option B 명시 승인)

## 8. 변경/검증/위험
- 변경: production DB view 1개 apply, `.env.local` 2 라인 추가.
- 검증: tsc clean, test:core 120/120, view R1/R2/R3=0/0/0, gate ON verify PASS, prune dry-run view_available=true.
- 위험: cap=2 보수적이라 비용 미세. 의도치 않은 escrow 흐름 발견 시 env 1줄 unset 즉시 OFF.
- 다음: Wave 36 — 24h baseline 측정 + (a) cap 조정 (2→5 or DB 일 cap) (b) housekeeper cron sign-off 재제출.

## 9. Phase 2 production apply 직전 남은 blocker (재정렬)

| # | blocker | 상태 |
|---|---|---|
| 1 | FK migration | 완료 (Wave 32) |
| 2 | scoreStage escrow + pool flags | 완료 (Wave 33) |
| 3 | AI verdict consumer + score_dirty retry | 완료 (Wave 34) |
| 4 | R3 retention view | ✅ apply (본 wave) |
| 5 | Gate ON | ✅ apply (본 wave) |
| 6 | housekeeper live + cron | 보류 (option B per owner) |

→ Phase 2 활성: **완료** (cron만 보류).
→ 남은 blocker: **1건** (housekeeper cron, owner option B로 의도적 보류).
