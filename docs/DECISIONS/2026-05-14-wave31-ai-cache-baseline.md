# Wave 31 — AI L2 cache baseline (measure-only)

> Status: **measure-only**. No DDL/runtime/apply. Phase 2 entry check 1.

## 1. Measurement

- 시간: 2026-05-14 KST
- 대상: `public.mvp_listing_ai_classifications`
- 변경: 없음 (read-only SQL)

| Metric | Value |
|---|---:|
| total rows | 529 |
| rows last 24h | 199 |
| rows last 48h | 330 |
| rows prior 24h (24~48h ago) | 131 |
| first classified_at | 2026-05-09 14:07 UTC |
| last classified_at | 2026-05-13 16:40 UTC |

### Daily distribution
| day | rows |
|---|---:|
| 2026-05-09 | 44 |
| 2026-05-10 | 131 |
| 2026-05-11 | 33 |
| 2026-05-12 | 183 |
| 2026-05-13 | 138 |

### Smartphone subset (parsed join)
- iPhone family (`comparable_key LIKE 'iphone|%'`): **68 rows (12.9%)**
- Galaxy family: 0 rows
- No parsed join (parsed row missing): 31 rows
- iPhone share ≈ overall iPhone traffic share (~13.0% per LAUNCH_PLAN §1.1) → cache mix not skewed.

## 2. Phase 2 entry check 1 — verdict

> **Check 1**: `mvp_listing_ai_classifications` row count is stable (no leak).

**Verdict: PASS**

- 5일 누적 인입 33~183 rows/day. 폭증 패턴 없음.
- 24h delta (199) < 48h delta (330). slope 감속 중.
- iPhone subset 비중(12.9%)이 LAUNCH_PLAN §1.1 production iPhone traffic 비중(13.0%)과 정렬 — 특정 lane이 cache를 점거하는 leak 패턴 미관측.

## 3. 남은 blocker (apply 직전)

1. **Phase 2 escrow code path** — Wave 30 review-only doc 작성됨, 코드 merge/적용 안 됨.
2. **FK migration SQL** — Wave 29 review-only doc 작성됨, DDL apply 안 됨.
3. **`ai_escrow_pending` pool block flag** — pool-policy 추가 미수행.
4. **Retention prune script (`housekeeper-ai-cache-prune.ts`)** — dry-run 미실시.
5. **Owner 사인오프** — FK switch 승인 미수령.

총 **5 blocker**.

## 4. 다음 wave

Wave 32 — Phase 2 atomic apply rehearsal (Supabase branch에서 FK migration + scoreStage escrow + pool block flag 동시 적용 + rollback 검증). Production apply는 여전히 금지, branch 한정.

## 5. 변경/검증/위험
- 변경: 없음
- 검증: 4건 read-only SQL (Supabase MCP execute_sql)
- 위험: 없음 (read-only)
- 다음: Wave 32 branch rehearsal 설계
