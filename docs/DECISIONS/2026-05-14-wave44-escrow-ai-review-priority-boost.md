# Wave 44 — Y1: Escrow AI review priority boost (pool 무관)

> Status: **code merged, runtime active.** owner option Y1 사인오프 반영. DDL 0, pool-policy 변경 0, score 공식 변경 0, conf floor 변경 0, parser 변경 0. user-facing pool/reveal 동작 변화 없음.

## 1. 변경

| 파일 | 변경 |
|---|---|
| `src/lib/pipeline.ts` | `applyAiReview` 내부 sort 비교자에만 boost 적용. `row.score`는 mutate 안 함 — pool-policy / listings / analysis 출력 / user-facing rank 모두 영향 없음. `ai_escrow_pending` flag 보유 시 sort priority에 `+1e6` 가산. |

```ts
const ESCROW_AI_REVIEW_PRIORITY_BOOST = 1e6;
const reviewPriority = (row) =>
  row.score + (row.scoreFlags.includes("ai_escrow_pending") ? ESCROW_AI_REVIEW_PRIORITY_BOOST : 0);
const sorted = [...rows].sort((a, b) => reviewPriority(b) - reviewPriority(a));
```

비변경:
- `row.score` 필드 자체: pool 진입 score, listing/analysis 출력, 사용자 노출 rank에 그대로 사용됨 → user-facing 동작 무관.
- `shouldAiReview` 필터: 그대로. pending flag는 기존 legacy `scoreFlags.length>0` 조건 충족.
- `pool-policy.mjs`: ai_escrow_pending/held/unavailable 모두 POOL_BLOCK_FLAGS 그대로 → pool block 유지.

## 2. 검증

`npx tsc --noEmit` clean / `npm run test:core` 120/120 PASS.

### 2.A Starvation 해소
Wave 43 측정값:
- pending 2 rows score: 4.29 / 23.98
- topN(=10) cutoff: 89.59
- Rank: 5826위

Wave 44 boost 적용 후 manual tick (재발사):
- `score_phase2_escrow_selected: 2`
- `score_phase2_escrow_resolved_pass: 0`
- **`score_phase2_escrow_held: 2`** ← 첫 자연 transition 실측 ✓
- `score_phase2_escrow_unavailable_retry: 0`
- `ai_api_calls: 5`, `ai_kept_low_confidence: 4` (2 escrow + 2 legacy hold), `ai_filtered: 1`

→ **escrow row가 AI까지 도달**, hold 판정 받아 자연 transition.

### 2.B Pool leak 0 유지

```sql
analysis_pending:   0  (2 → 0, 전이 완료)
analysis_held:      2  (escrow row 2건 held로 전이)
analysis_unavailable: 0
pool_leak:          0  ✓
cache_last_5m:      5  (escrow 2건 포함 AI cache write 증가)
```

`ai_escrow_held`도 `POOL_BLOCK_FLAGS`에 포함되어 있어 hard block 유지. user-facing pool에는 절대 노출 안 됨.

### 2.C user-facing pool/reveal 변화 없음

- `row.score` 변경 없음 → analysis.score / listing.score / pool rank 그대로
- pool-policy block flags 변경 없음 → 노출 차단 규칙 그대로
- boost는 `applyAiReview` 내부 정렬에만 적용 → AI review 우선순위만 영향

## 3. AI 비용 영향

boost 적용으로 매 tick 최대 cap=2 escrow row가 topN에 강제 진입. 일 1440 tick × 2 = 최대 2880 escrow 호출/일. 단 현실치는:
- escrow eligible inventory가 작음 (Wave 38 baseline 1~52건)
- pending 처리되면 (held/pass/reject) 동일 row 재계산 안 됨 (score_dirty=false)

→ 일 escrow 호출 현실치: 50~150건/일 (inventory 52건 + 신규 inflow). gpt-4.1-mini 단가로 일 비용 ≈ $0.03~0.10. 무시 가능.

## 4. 원칙 ack
- broad smartphone widening 금지: ✓ (narrow whitelist 7개 그대로)
- silent carrier 추정 금지: ✓ (conf floor 0.55 그대로)
- pool leak 허용 금지: ✓ (pool leak 0 실측)
- user-facing pool/reveal 동작 변경 금지: ✓ (row.score 불변, pool-policy 불변)

## 5. 변경/검증/위험
- 변경: pipeline.ts 6 lines (boost 함수 + sort 호출 1줄 교체)
- 검증: tsc clean, test:core 120/120, tick selected=2/held=2, pool leak 0, cache write 5건
- 위험: 매우 낮음. rollback은 boost 함수 제거 + 원본 sort 복원 (1-line).
- 다음: Wave 45 — 자연 누적 시간 대기 + cron sign-off 자료 완성 (transition 분포 N-large).

## 6. 남은 blocker (재정렬)

| # | blocker | 상태 |
|---|---|---|
| 1 | FK migration | 완료 (Wave 32) |
| 2 | scoreStage escrow + pool flags | 완료 (Wave 33) |
| 3 | consumer + score_dirty retry | 완료 (Wave 34) |
| 4 | R3 view + gate ON | 완료 (Wave 35) |
| 5 | escrow path positive confirmation | 완료 (Wave 40) |
| 6 | escrow topN starvation | ✅ 본 wave 해소 |
| 7 | transition 자연 누적 분포 (24h+) | 외부 cron 또는 시간 경과 |
| 8 | housekeeper cron + live merge | #7 의존 |

→ **남은 blocker 2건** (#7, #8). #6 폐기.
