# Wave 768 — Ready pool cleanup: AI reject + sku_median=0 stale invalidate

- 시간: 2026-05-27 KST
- 트리거: 사용자 "지금까지 한 거 로그 박고 다음 할 거 찾아줘 뭐 다른 문제 있는지 제품들" → ready pool 다각도 진단.

## 진단 결과 (758 ready 매물 전수)

| 메트릭 | 결과 | 판단 |
|---|---|---|
| comparable_key | 100% complete | 정상 |
| 가격 outlier (≥1억 또는 ≤1만) | 0건 | 정상 |
| broad-vs-narrow collision suspects | False alarm (정상 narrow) | OK |
| 신발 키워드 없는 shoe-* SKU | False alarm (풋살화/로퍼/샌들 등 검색어 누락) | OK |
| **sku_median NULL/0인데 ready** | **4건** | ⚠️ **위험 — 시세 없는 추천** |
| **ai_audit_status='reject'인데 ready** | **3건** | 🚨 **위험 — AI 거부 매물 추천** |
| ai_audit_status='hold'인데 ready | 218건 (28%) | ⚠️ **shadow mode 의도, 별도 정책 결정** |
| ai_audit_status=NULL ready | 73건 | mostly 신규/AI 미적용 |

## 즉시 fix — 7건 invalidate

### AI reject 3건 (사용자 신뢰 직접 위반):
- pid 9001445496708 — 갤럭시 노트20 (120k): "visible crack on front screen, 배터리/액정 교체 이력" (functional defect)
- pid 407765720 — 갤럭시 Z 플립 6 (308k): "main display has black stain and lines" (functional defect)
- pid 403421836 — 갤럭시 버즈 3 Pro (105k): "실제는 화웨이 프리버즈 프로 3" (**SKU mismatch — 다른 제품!**)

### sku_median=0/NULL 4건 (시세 없는 추천):
- pid 409780317 — 스투시 후드집업 (95k, sku_median=0)
- pid 364632072 — 아크테릭스 베타 LT (450k, sku_median=0)
- pid 405557623 — 아크네 니트 (170k, sku_median=0)
- pid 269035831 — 호카 엔가 (145k, sku_median=0)

### SQL
```sql
update mvp_candidate_pool
set status='invalidated',
    invalidated_reason='Wave 768 (2026-05-27): AI audit rejected but stale ready — defect/SKU mismatch'
where status='ready' and ai_audit_status='reject';

update mvp_candidate_pool
set status='invalidated',
    invalidated_reason='Wave 768 (2026-05-27): sku_median=0/NULL — no market reference for pool recommendation'
where status='ready' and pid in (...);
```

## Root cause 진단 (별도 wave 후속 필요)

### AI L2는 Phase 1 shadow mode (`ai-l2-shadow-audit.ts:11`)
> "Phase 1 = shadow only (status='ready' 유지, ai_audit_status 컬럼만 박음)"

즉 AI 결과로 풀 차단 안 됨. `tick-pipeline.ts:4774`에 residue cleanup logic 있음 (`isAiAuditDefiniteNonPass` 필터) — 일부 작동하지만 7건이 빠져나옴. 원인:
1. cleanup 적용 카테고리 제한 (`clothing/shoe/bag` 만): tick-pipeline.ts:4874 line. galaxy-note20/galaxy-z-flip-6/galaxy-buds-3-pro는 smartphone/earphone → cleanup 범위 밖.
2. sku_median=0 매물은 별도 풀 진입 gate에서 차단 못 함 (pool builder에 정책 누락).

### 218 'hold' ready 정책
shadow mode 의도된 동작 — UI "AI 검토 중" 배지 표시. 하지만 pool에서 빠지진 않음 → 사용자가 hold 매물 추천받을 수 있음. **정책 결정 필요** (자동 invalidate vs UI 라벨로만 표시 vs 현 상태 유지).

## 검증
- DB UPDATE: 3 reject + 4 sku_median=0 = **7건 invalidate** 성공.
- 결과: ready 풀 758 → 751건 (사용자 신뢰 위반 매물 제거).

## 위험
- invalidate는 reversible (status='ready'로 되돌리기 가능, PITR 의존 X).
- 이번 fix는 **현 stale 정리만**. cleanup logic 자체 fix는 별도 wave (Wave 769 후보).

## 다음
- **Wave 769 후보**: AI audit residue cleanup 범위 확장 (smartphone/earphone/tablet 포함) + sku_median=0 풀 진입 gate.
- **정책 결정**: 218 hold ready의 처리 방향.
- production replay: Wave 765/766/767 신규 narrow inflow 측정 (3-4시간 후).
