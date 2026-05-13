# Wave 41 — Phase 2 escrow transition 분포 측정 (soak 부족, sign-off 자료 불충분)

> Status: **measure-only.** apply 0, cron 0, cap/conf/parser 변경 0. 24h+ soak 의도였으나 **실제 gate ON 이후 elapsed ≈ 21분** (2026-05-13 20:03 → 20:24 UTC). 자연 누적 자료는 다음 wave로 이연.

## 1. Elapsed window
- Gate ON 시점: 2026-05-13 20:03 UTC (Wave 35)
- 측정 db_now: 2026-05-13 20:24 UTC
- **실제 elapsed: 21분** (24h의 1.5%)

## 2. Transition 분포 (현재 누적, 21분 기준)

| Metric | Value | 비고 |
|---|---:|---|
| analysis_pending | **2** | Wave 40 manual tick에서 가입된 2건, 그대로 유지 |
| analysis_held | **0** | transition 없음 |
| analysis_unavailable | **0** | transition 없음 |
| pool_leak | **0** | ✓ pool-policy hard block 정상 |
| ai_cache_added_since_gate | 3 | **전부 non-escrow** (smartwatch/earphone legacy review) |
| ai_api_calls (cumulative since gate, collect_runs) | 3 | escrow 호출 0건 |
| runs_since_gate (mvp_collect_runs) | 6 | 대부분 manual tick |

### 새로 add된 cache 3건 inspection
| pid | classified_at | comparable_key | 분류 |
|---|---|---|---|
| 394918943 | 20:20:08 | applewatch\|applewatch_ultra\|49mm\|cellular | smartwatch legacy |
| 407814279 | 20:20:43 | airpods\|airpods_pro_3\|usbc | earphone legacy |
| 396883825 | 20:20:44 | applewatch\|applewatch_series8\|45mm\|cellular | smartwatch legacy |

→ **escrow 경로로 AI 호출 도달한 row = 0건.** selected=2(Wave 40)는 모두 pending 상태에서 정지.

## 3. 왜 escrow 경로로 AI 도달 안 했나 — 구조적 발견

`applyAiReview` (pipeline.ts:1337):
```ts
const sorted = [...rows].sort((a, b) => b.score - a.score);
const reviewRows = sorted.slice(0, options.topN).filter(shouldAiReview);
```

- 정렬 기준: **score 내림차순**, 그다음 `topN` slice.
- escrow row의 score는 일반 row와 동일 공식. pending flag 부여는 `scoreFlags`만 변화, score 값에 boost 없음.
- 21분 동안 fired된 tick은 항상 topN 안에 더 높은 score를 가진 비-escrow 후보가 채워 escrow row가 밀려남.

**이 구조에서 escrow는 24h+ 가도 lower-score iphone needs_review가 topN에 늦게 들어가야만 fire.** 비-escrow 매물 inflow가 dense한 한국 중고 시장에서 escrow는 의도된 것보다 더 보수적으로 동작.

## 4. AI cache 24h 증가량 — 비교 부적합
- Wave 31 baseline (gate OFF): 199 rows/24h
- Wave 41 (gate ON 21분): 3 rows
- 비율 환산 시 ~205/24h. 큰 차이 없음. **escrow가 cache 증가 driver 아님.**

## 5. Cron sign-off 가능 여부 — **불가**

요구 자료 vs 현재:

| 필요 자료 | 현재 |
|---|---|
| escrow transition 분포 (pass/held/unavailable) | 전부 0 — 측정 불가 |
| escrow가 cache 증가에 미치는 영향 | 0 (driver 아님) |
| pool 차단 positive confirmation (AI verdict 후 동작 검증) | 미발생 |
| cap=2 binding 빈도 | 1회 (Wave 40 단발) |

→ **cron sign-off 재제출 보류 그대로.** 자연 누적 21분 → 24h 사이 더 필요.

## 6. 다음 wave 후보 (Wave 42 옵션)

옵션 X — **자연 누적 대기**: 24h 이상 dev server 가동 + 외부 cron 정상 firing 확인 후 재측정. 가장 정직.

옵션 Y — **escrow row score boost**: `applyAiReview`의 topN 정렬에서 escrow row를 우선 처리. design change (1-line addition). 단 broad/silent 위배 아님. owner 사인오프 필요.

옵션 Z — **manual tick 반복**: 본 wave처럼 score_dirty 재마킹 + tick 다회 fire로 인위적으로 escrow 데이터 누적. 정상 운영 시뮬레이션은 아님.

추천: 옵션 X (자연 누적). 단 외부 cron이 활성인지 확인 우선.

## 7. 원칙 ack
- 추가 apply 금지: ✓ (read-only SQL만)
- broad smartphone widening 금지: ✓
- silent carrier 추정 금지: ✓
- cap/conf/parser 변경 금지: ✓
- 측정 + sign-off 자료 정리만: ✓

## 8. 변경/검증/위험
- 변경: 없음
- 검증: 2 read-only SQL
- 위험: 없음
- 다음: Wave 42 — 24h+ 자연 누적 (외부 cron 확인 prerequisite) 또는 escrow priority boost 사인오프 (option Y).

## 9. 남은 blocker
1. **escrow transition 자연 누적** — 24h soak 필요. 21분으로 부족.
2. **housekeeper cron + live merge** — #1 자료 의존.
3. **(신규 구조적 발견)** escrow row가 applyAiReview topN 정렬에서 dense 비-escrow 매물에 밀리는 구조. 자연 누적만으로 의미 있는 transition 모이는데 시간 큼. design 결정 필요할 수 있음 (option Y).

→ **남은 blocker 3건** (#1, #2, #3).
