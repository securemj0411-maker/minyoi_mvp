# Wave 43 — Cron OFF에서 가능한 3종 검증

> Status: **measure-only.** apply 0, cron 0, cap/conf/parser 변경 0. cron OFF 무관하게 확인 가능한 3종 실행.

## 1. (1) Pending 2건 transition 추적 — **starvation으로 실패**

행동:
- pending 2 pid score_dirty=true 재마킹
- tick 2회 fire (1회 transient Supabase fetch 실패 후 재시도 성공)

결과:
- `escrow_selected: 2` (gate는 정상 통과)
- `escrow_pass: 0`, `escrow_held: 0`, `escrow_unavailable_retry: 0`
- DB analysis_pending **여전히 2** (transition 발생 안 함)

이유: §3 starvation. 자연 tick으로는 transition 안 일어남.

## 2. (2) `ai_escrow_unavailable` retry 시뮬 — **PASS**

방법: starvation을 우회하려 `scripts/wave43-unavailable-sim.ts` 작성 — synthetic single-row를 `applyAiReview`에 직접 주입 + `OPENAI_API_KEY` 일시 unset.

결과:
```json
{
  "OPENAI_API_KEY_present": false,
  "stats": {
    "escrowUnavailableRetry": 1,
    "unavailable": 1
  },
  "escrowUnavailablePids": ["9999900001"],
  "has_pending_after": false,
  "has_unavailable_after": true
}
```

검증:
- `ai_escrow_pending` → `ai_escrow_unavailable` 전이 ✓
- `escrowUnavailablePids` return으로 caller(scoreStage)가 raw.score_dirty=true 재마킹할 path 확인 ✓
- 기존 flag (`option_needs_review`) 보존 ✓
- tsc + test:core 동일하게 통과 (Wave 33/34 이래 변동 없음)

end-to-end raw.score_dirty 재마킹은 scoreStage가 escrowUnavailablePids를 받아 처리하는 tick-pipeline.ts 코드 경로상 자동. 본 시뮬은 module-level positive confirmation.

## 3. (3) topN starvation 정량화 — **starvation = REAL blocker**

DB 측정:
| Metric | Value |
|---|---:|
| pending 2 rows score range | 4.29 ~ 23.98 |
| topN(=10) cutoff score | **89.59** |
| topN(=30 env 시도) cutoff score (실효 max=10 clamp) | 73.99 |
| Pending row rank (전체 analysis 중) | **약 5826위** |

해석:
- 점수 공식: `(priceGap*0.5 + velocity*0.4 + safety*0.1) * 100 * precisionPenalty`.
- needs_review=true row는 parse_confidence<0.65 → precisionPenalty 0.4875 base. trusted market 없는 `unknown_storage` 변형이라 priceGap도 0 근처. → 최하위 score.
- 매 tick `applyAiReview`는 score 정렬 후 topN slice. escrow row가 top 10에 들어갈 자연적 시나리오 없음 (점수 5800등이 10등 진입 ≈ 0).
- env에 `AI_REVIEW_TOP_N=30`이 있어도 `PIPELINE_MAX_AI_REVIEW_TOP_N`(default 10)에 clamp되어 실효 10. 단 30으로 풀어도 73.99 cutoff > 23.98로 여전히 starve.

**판정: topN starvation은 진짜 blocker.** 자연 누적 24h+로도 transition 분포 측정 불가. Owner 설계 결정 필요.

## 4. 해결 옵션 (Wave 44 후보)

| 옵션 | 설명 | 정확성 risk | 효과 |
|---|---|---|---|
| **Y1. score boost for escrow** | `ai_escrow_pending` flag 보유 row에 score 가중치 (예: +200) → 자연 topN 진입 | precision 영향 없음 (escrow는 어차피 pool block, AI verdict까지만 유도) | 즉시 transition 발생 |
| Y2. separate escrow review channel | applyAiReview 외 별도 escrow-only AI 호출 path | 복잡도 ↑, 일관성 ↓ | 효과적이나 코드 분리 비용 |
| Y3. topN cap 상향 | `PIPELINE_MAX_AI_REVIEW_TOP_N=200`으로 풀고 `AI_REVIEW_TOP_N=200` 유지 | 일 AI 비용 상한 ↑ (legacy review도 같이 늘어남) | starvation은 부분 해소이나 일 5826개 매물의 5828 등 row까지는 안 닿음 |
| Z. status quo + dormant 수용 | escrow는 사실상 dormant. 결정론이 정확성 우위. | 0 | sign-off 자료 미달 그대로 |

추천: **Y1 (score boost)** — escrow 의도(AI verdict로 needs_review row를 escrow)가 실제 작동하게 만드는 최소 변경. precision 영향 없음 (AI verdict 통과만 score boost 무관해짐). owner 사인오프 필요.

비추천: Y3 — 일 AI 비용 5800/일 × $0.0002 = 약 $1.2/day 증가 (5826 등까지 자동 호출 시) — 무관한 비-escrow row도 같이 review.

## 5. 원칙 ack
- cron live 등록 금지: ✓
- broad smartphone widening 금지: ✓
- silent carrier 추정 금지: ✓
- apply 추가 금지: ✓ (코드 변경 0, 시뮬 스크립트 1개만)
- cron 없이 확인 가능한 것만: ✓

## 6. 변경/검증/위험
- 변경: `scripts/wave43-unavailable-sim.ts` 1개 추가 (시뮬용, runtime 비참여)
- 검증: (2) unavailable 시뮬 PASS, (3) starvation 정량 데이터 확보, (1) starvation으로 실패 확인
- 위험: 없음
- 다음: Wave 44 — score boost 사인오프 (옵션 Y1) 또는 dormant 수용 (옵션 Z)

## 7. 남은 blocker
1. **escrow topN starvation 해결 (Y1/Y2/Y3/Z 결정)** — 본 wave에서 정량 확정.
2. **transition 분포 자연 누적 측정** — #1 해결되면 가능.
3. **housekeeper cron + live merge** — #2 자료 의존.

→ **남은 blocker 3건**. #1이 critical path 첫 노드.
