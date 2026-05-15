# 신발 카테고리 깊은 강화 — Iter 1-10 종합 (Wave 138-145)

> 2026-05-16. 사용자 명령: "10번 반복. 결정론 끌어올리기. 신발 ready로 만들 만큼". **완료 10/10**.

---

## 시작 vs 종료 (Iter 1 시작 → Iter 10 종료)

| 지표 | 시작 (Wave 137) | 종료 (Wave 145, Iter 10) | 변화 |
|---|---|---|---|
| 신발 SKU 총 | 71 | **80** | +9 (broad 3, narrow 6) |
| parsed 신발 (cumulative) | 1,110 | **1,490** | +380 |
| parse_ready (overall) | 78.53% | **79.4%** | +0.87%p (옛 매물 포함) |
| parse_ready (recent 2h) | — | **79.27%** | 신규 매물 |
| parse_ready (Wave 138 이후) | — | **85.39%** | **+7%p** ✅ |
| unknown_size | 20.7% | 12.36% (recent) | **-8%p** ✅ |
| unique 모델 | ~40 | **55** | +15 |
| 시세 daily SKU | 40 | 40 | 같음 (시간 누적 필요) |
| 시세 sample (avg) | 1.0 | 1.0 | 같음 |
| medium confidence | 0 | 0 | ❌ 시세 누적 필요 (~3-7일) |
| pool 진입 | 0 | 0 | ✅ internal_only 정상 |
| 가품 차단 (Tier 1) | 없음 | **~184건** | ✅ |
| 가품 차단 (Tier 2 v2) | 없음 | **신규 배포** | ✅ |
| collab 차단 누적 | 0 | **47+** | ✅ |
| mvp_category_readiness | row missing | **internal_only 명시** | ✅ DB 정합성 |

---

## Iter 1-10 진행 요약

### Iter 1 (Wave 138) — parser size 220-309 + cm + 7 변형 + 3 broad SKU + 36건 reparse
### Iter 2 (Wave 139) — EU/US 사이즈 + 5 collab + 4 변형
### Iter 3 (Wave 140) — 6개 신규 narrow SKU (척70 high, 본디 7, AF1 red, jack purcell, pegasus turbo)
### Iter 4 (Wave 141) — pool 진입 가품 floor tier 1 (msrp * 0.15)
### Iter 5 (Wave 142) — 시세 집계 가품 제외 (악순환 차단)
### Iter 6 (Wave 143) — chuck70 하이 broad 통합 (컬러 strict 완화)
### Iter 7 (Wave 144) — mining 23개 query 확장 (sample 가속)
### Iter 8 — mvp_category_readiness DB row 명시 (internal_only)
### Iter 9 (Wave 145) — 가품 floor v2 tier 2 (셀러 신뢰도 + 25% floor)
### Iter 10 — 최종 종합 + ready 승급 권고

---

## ready 승급 기준 vs 현재 상태

| 기준 | 목표 | 현재 | 상태 |
|---|---|---|---|
| catalog SKU coverage | 충분 | **80 SKU + 60+ query** | ✅ |
| parser 정확도 (recent 매물) | 90%+ | **85.39%** | ⚠️ -5%p (시간 누적 후 도달 가능) |
| 가품 detection | 안전장치 필수 | **tier 1 + tier 2** | ✅ |
| 시세 sample medium+ | 5+ SKU | **0개** | ❌ (가장 큰 병목) |
| min_ready_pool | 6+ | **0** | ⏸️ ready 후 채워짐 |
| readiness DB row | 명시 | **internal_only** | ✅ |

### 가장 큰 병목: 시세 sample 누적

40 SKU × avg 1 sample = 시세 confidence 모두 low.
- medium = sample 8+ 필요
- high = sample 20+ 필요

**예상 시간**: 매물 흐름 시간당 ~500건 신발 신규. mining 60+ query 확장 (Wave 144) 적용 시:
- 24시간 후: 약 5-10 SKU medium 도달
- 72시간 후: 약 15-20 SKU medium 도달
- **1주 후**: ready 승급 가능 (medium SKU 10+ 충족)

---

## 가품 detection 최종 정책 (Wave 141 + 145)

```
Tier 1 — 가품 확실:
  price < max(msrp, skuMedian) * 0.15 (85% 이상 할인)
  → 차단 (review 무관)

Tier 2 — 가품 의심:
  price < max(msrp, skuMedian) * 0.25 (75% 이상 할인)
  AND (review_count < 5 OR rating < 4.5)
  → 차단

적용:
- pool 진입 (candidate-pool-builder.ts)
- 시세 집계 (tick-pipeline.ts marketAggregateStage)
- 카테고리: shoe, bag만
```

False positive 보호:
- 가격 25% 초과: 통과
- 신뢰도 높은 셀러 + 25% 이하: 통과
- review null: 통과 (data 부족)

---

## 다음 결정 (사용자)

1. **3-7일 대기 후 측정**: 시세 medium confidence SKU 10+ 도달 확인
2. **ready 승급 시점 결정**: medium 10+ + 사용자 검수 통과 시
3. **추가 catalog 보강 필요 여부**: 매물 흐름 보면서 새 변형/모델 발굴 시
4. **가품 floor ratio 조정 가능**: tier 1 0.15, tier 2 0.25 — false positive 측정 후 미세 조정

---

## 다른 세션 알아볼 키 포인트

1. **신발 카테고리 Iter 1-10 종료 (2026-05-16)** — 10/10 완료.
2. **80 SKU + parser 사이즈 220-309 + UK/EU/US/cm 전부 인식**.
3. **가품 floor v2 (tier 1 + tier 2)** — 신발/가방 카테고리 안전장치.
4. **시세 sample 누적이 마지막 병목** — 자연 시간 (~1주).
5. **internal_only DB row 명시됨**, ready 승급 = 사용자 결정.
6. 추가 작업 시: `docs/DECISIONS/2026-05-16-iter1-7-shoe-deep-strengthen-summary.md` 참조.

---

## Git Commits (Iter 1-10)

```
424a458 detail-worker batch 800 + c=15 push (Wave 135)
f1d04bc Wave 136 신발 collab block
60880d8 Wave 136 catalog/parser fix
7c5f3cb Wave 137 UK 사이즈 + 변형 차단
9168d96 Wave 138 broad 3 SKU
c3c0cd9 Wave 138 Iter 1 깊은 강화
62ae29d Wave 139 Iter 2 EU/US + 변형
1cb96aa Wave 140 Iter 3 5개 신규 SKU
c59b331 Wave 141 Iter 4 가품 floor pool
0c50430 Wave 142 Iter 5 시세 가품 제외
f56bec9 Wave 143 Iter 6 chuck70 broad
60776c0 Wave 144 Iter 7 mining 확장
3d7838c Iter 8 DB row + 종합 log
6411df2 Wave 145 Iter 9 가품 v2 tier 2
[next]  Iter 10 final summary
```
