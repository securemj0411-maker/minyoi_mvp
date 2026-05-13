# Wave 45 — Escrow soak 측정 + housekeeper cron sign-off 판단

> Status: **measure-only.** apply 0, design 변경 0. Wave 44의 boost가 적용된 상태에서 추가 escrow row를 score_dirty 재마킹 후 manual tick 7회 (1회 transient 500 fail). transition 분포 누적 + pool leak + cache 측정.

## 1. Soak 방식 (cron OFF 한계 인정)

- 추가 eligible 6개 + 5개 (총 11개)를 score_dirty=true로 재마킹.
- manual tick 7회 fire (cap=2/tick, scoreStage processedPids에 dirty 해제로 1회 selected가 1~2건 한계).
- 외부 cron이 firing되면 자연스럽게 일 1440 tick × cap2 = 최대 2880, 현실 inventory-bound. 본 wave는 그 mini 버전.

## 2. Transition 분포 (Wave 35 gate ON 누적)

| Metric | 누적 |
|---|---:|
| selected (tick stats 합산, 본 wave 7 ticks) | 3 (tick1 1 + tick7 1 + Wave 44 잔류) |
| **resolved_pass** | **0** |
| **held** | **4** (Wave 44에서 2, 본 wave에서 2 추가) |
| **unavailable** | **0** |
| total escrow transitions | 4 |
| hold rate | 4/4 = **100%** |

DB 단면:
```sql
analysis_pending: 0
analysis_held: 4
analysis_unavailable: 0
pool_leak: 0
```

## 3. AI cache 증가량

- cache_total: 529 (Wave 31) → **546** (현재). +17 since gate ON.
- cache_since_wave44 (boost 적용 후): 18 rows. 이 중 escrow 경로 = 2 (held 2건 cache write).
- legacy AI review path: ~16 rows (smartwatch/earphone 위주 — Wave 41과 동일 패턴).

## 4. Pool leak

**0건 유지.** 7 tick + transition 4건 누적에도 candidate_pool에 `ai_escrow_pending/held/unavailable` flag row 단 1건도 없음. pool-policy hard block 정상 동작.

## 5. Housekeeper cron sign-off 판단

### 5.A 자료 정리

| 자료 | 값 | 충족? |
|---|---:|---|
| transition distribution N | 4 | 작음 (소표본) |
| pass rate | 0/4 = 0% | 결정론 + AI 모두 부정 — 결과 자체는 정확 |
| held rate | 4/4 = 100% | escrow는 hold 위주로 흐름 |
| unavailable rate | 0/4 = 0% | unit-style sim PASS (Wave 43 §2) |
| pool leak | 0 | ✓ |
| retention R1/R2/R3 (view) | 0/0/0 | view 정상, cache age <30d |
| 예상 cron 동작 | hourly idle until R1/R3 발화 시점 | 안전 |

### 5.B housekeeper cron 자체는 **enable 가능**

근거:
- 동작은 **retention** — escrow transition 분포와 독립.
- 현재 R1/R2/R3 모두 0. cron이 켜져도 일정 시간 idle.
- view 기반 후보 추출 + code-level contentHash 재확인 후 DELETE → false-positive safety net 있음.
- Wave 32 rollback prerequisite SQL과 R3 view migration 모두 적용 검증됨.

→ **housekeeper cron sign-off = 가능**. 단 escrow 사업 효과 판단은 별개.

### 5.C escrow 사업 효과 판단 = **불충분 (별도 결정)**

- 4-sample 100% held은 충분히 의미 있는 신호이긴 함 (AI가 unknown_storage row의 storage 추정에 자신 없음).
- 그러나 sample N이 작아 일반화 불가. 자연 24h+ 누적 (외부 cron firing)으로 N>50 확보 후 재평가 필요.
- pass=0이면 escrow 비용($0.03~0.10/day)은 발생하나 pool 진입 lift는 0 — 사업 효과 무. 자연 누적 측정에서 pass rate가 여전히 0%면 **escrow gate를 OFF로 되돌리는 결정 필요**.

## 6. 원칙 ack
- 새 apply 금지: ✓ (코드/DDL 변경 0, score_dirty 재마킹은 runtime trigger)
- broad smartphone widening 금지: ✓
- silent carrier 추정 금지: ✓
- 측정/판단만: ✓

## 7. 변경/검증/위험
- 변경: 없음 (score_dirty 재마킹 11건 = runtime trigger)
- 검증: 7 manual ticks, DB 단면 측정 2회
- 위험: 없음
- 다음: Wave 46 — housekeeper cron live merge + 등록 (옵션 A) 또는 escrow 자연 누적 추가 측정 (옵션 B). 둘 병행 가능.

## 8. 남은 blocker

| # | blocker | 상태 |
|---|---|---|
| 1 | housekeeper cron + live merge | **이제 sign-off 가능** (본 wave 판단) |
| 2 | escrow 사업 효과 판단 (pass rate 일반화) | N>50 자연 누적 필요 |

→ **남은 blocker 2건**. #1은 다음 wave에서 적용 가능, #2는 시간/cron 의존.
