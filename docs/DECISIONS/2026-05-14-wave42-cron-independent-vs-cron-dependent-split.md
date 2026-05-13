# Wave 42 — Cron-OFF 무관 결론 / Cron 필요 측정 분리 + Wave 42 실행계획

> 사용자 지시 반영. apply 0, 측정/계획 정리만.

## 1. Wave 40/41 결론 재분류

### 1.A cron OFF와 무관하게 유효한 결론 (이미 확보)
수동 tick + 내부 DB 측정만으로 충분히 검증됨.

| 항목 | 측정값 | 의미 |
|---|---|---|
| `score_phase2_escrow_gate_enabled` | 1 | env 로딩 OK |
| `score_phase2_escrow_selected` | 2 (Wave 40 tick) | cap=2 binding 도달 ✓ |
| `analysis_pending` (DB persistent) | 2 | escrow flag DB 실제 부여 ✓ |
| pool_leak (analysis ∩ candidate_pool) | 0 | pool-policy hard block 동작 ✓ |
| AI cache write 재개 | 3 (수동 tick 결과) | classifyWithCache 정상 ✓ |
| catalog 정합성 (pro_max SKU 존재) | OK | narrow 확장 안전 ✓ |
| `applyEscrowTransition` 코드 path | tsc/test 통과 | 코드 정합성 ✓ |

→ **Phase 2 활성 path는 cron 상태와 무관하게 정상.**

### 1.B cron OFF 때문에 불충분한 측정 (대기 필요)
자연 시간 + 반복 실행 없이는 가짜 데이터가 됨.

| 항목 | 필요 자료 | 현재 |
|---|---|---|
| transition 분포 (pass/held/unavailable) | 24h+ 누적 비율 | 21분, 전부 0 |
| escrow row가 topN window에 도달하는 빈도 | 다회 tick 자연 데이터 | 단발 tick만 |
| escrow가 일 AI 비용에 미치는 영향 | 일 누적 호출량 | 0 (escrow 경로 도달 0) |
| `ai_escrow_unavailable` retry 동작 (score_dirty 재마킹) | 실제 unavailable 발생 시 동작 | 미발생, 미검증 |
| cron sign-off resubmit 자료 | 위 4종 | 모두 미충족 |

## 2. Wave 42 실행 분류

### 2.A cron OFF에서도 추가 확인 가능 (수동 tick만으로)
이번 wave에서 즉시 확인 가능.

1. **현재 pending 2건의 자연 transition** — score_dirty 재마킹 + manual tick 다회 fire로 pending 2건이 결국 pass/held/reject 중 어디로 가는지 확인. 1회 실험으로 transition 로직 정합성 검증.
2. **`ai_escrow_unavailable` retry 시뮬레이션** — OPENAI_API_KEY 일시 unset → tick → `escrow_unavailable_retry` 카운트 + `score_dirty=true` 재마킹 발생 확인 → key 복원. 짧은 (`<1min`) 시뮬레이션.
3. **escrow row가 topN window에 들어가지 못하는 score-rank 측정** — 현재 pending 2건의 score를 topN(=config) 경계와 비교. 구조적 starvation을 정량화.

각 항목은 단발 tick 1~2회면 충분. cron 없이 가능.

### 2.B cron ON 또는 동등한 반복 실행이 있어야만 측정 가능
다음 wave 이후.

1. **24h+ 자연 누적 escrow_selected 일 비율** — tick 1분 × 1440 = 1440 tick 데이터 필요.
2. **transition 분포 안정 비율** — large-N statistical baseline.
3. **외부 매물 inflow가 dense한 시간대 (e.g. 평일 20시-22시)의 topN 경쟁 패턴** — 일중 패턴.
4. **AI 비용 일 합산** — 일 단위 합계.
5. **content_hash drift R3 발화** — 14일 이상 elapsed 후 첫 관찰.

→ 이 항목들은 **외부 cron이 들어와야** 또는 owner가 manual loop를 24h+ 돌려야 측정 가능.

## 3. Wave 42 권고 범위

이번 wave에서 **2.A 3종만 실행**:
- pending 2건 transition 추적
- unavailable retry 시뮬레이션
- topN starvation 정량화

산출물: decision log + report. apply 0, cron 0.

2.B는 별도 wave (Wave 43+) 또는 자연 시간 경과 후 재측정.

## 4. 원칙 ack
- broad smartphone widening 금지: ✓
- silent carrier 추정 금지: ✓
- cap/conf/parser 변경 금지: ✓
- cron OFF 인정 + 측정 한계 정직 표기: ✓

## 5. 남은 blocker
1. cron OFF 자체 (외부 cron 활성화 또는 24h+ 수동 loop)
2. housekeeper cron + live merge (#1 의존)
3. escrow topN starvation 구조 (Wave 42에서 정량화 후 owner 결정)

→ **남은 blocker 3건** (Wave 41과 동일, #3는 Wave 42에서 데이터 보강).
