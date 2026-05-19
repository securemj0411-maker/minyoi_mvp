# Wave 251.2 — Patagonia Deep Pile narrow split (90s 빈티지 콜렉터)

- date: 2026-05-19
- type: narrow SKU split (additive — broad fallback 유지)
- scope:
  - `clothing-patagonia-deep-pile` 신설 (narrow)
  - `clothing-patagonia-retro-x` mustNotContain 딥파일/deep pile/mesclun/40주년/legacy 추가 (routing → narrow)
  - `category-readiness.ts` LANE_READINESS 에 `patagonia_deep_pile: ready` 추가
- branch: `fix/market-chart-honesty-2026-05-19`
- 관련 사용자 코멘트: `mvp_reveal_feedback` id 197 (pid 402789240)

## 배경

사용자 코멘트 (id 197 — "Patagonia 파타고니아 신칠라 오트밀 ₩190k"):

> "진짜 다른 상품들인데 사진보면" — Pull 190k / Snap-T 249k / Reversible 400k 비교군 spread 큼.

`clothing-patagonia-retro-x` 안에 Retro X / Synchilla / Snap-T / Classic Retro / Reversible / Deep Pile (90s 빈티지) 등 다양한 sub-model 묶임 → 시세 spread 크다는 사용자 인식.

## production sample 측정 (2026-05-19, 14일 active)

### 1. sub_model 별 가격 분포 (n=164)

| sub_model | cnt | p50 | min | max |
|---|---|---|---|---|
| synchilla (snap 제외) | 57 | ₩180k | ₩49k | ₩450k |
| retro_x | 45 | ₩180k | ₩40k | ₩650k |
| other | 40 | ₩150k | ₩40k | ₩780k |
| snap_t (단독) | 8 | ₩167k | ₩100k | ₩335k |
| classic_retro | 5 | ₩140k | ₩80k | ₩300k |
| vest | 5 | ₩100k | ₩95k | ₩260k |
| pullover | 2 | ₩120k | ₩92k | ₩149k |
| reversible | 1 | ₩400k | ₩400k | ₩400k |

→ 모든 sub_model 시세 ₩100~200k 범위 (median 기준 비슷). spread 는 sub-model 차이가 아니라 **색상/연도/사이즈 희귀도**.

### 2. 특수 spec 분포 (희귀 콜렉터 모델)

| spec | cnt | p50 | min | max | 시세 비율 |
|---|---|---|---|---|---|
| mainstream | 149 | ₩165k | ₩40k | ₩450k | 1x |
| **deep_pile (딥파일)** | **10** | **₩390k** | **₩150k** | **₩780k** | **2.4x** |
| shelled_synchilla | 4 | ₩274k | ₩179k | ₩450k | 1.7x (n<5 narrow 임계 미달) |
| 40th_legacy | 1 | ₩650k | ₩650k | ₩650k | 3.9x (n=1 narrow 미달) |

→ **딥파일 (Deep Pile) 만 narrow 임계 충족** (n≥10, 시세 ≥2x 차이).

## 결정

### 1. narrow `clothing-patagonia-deep-pile` 신설 ✓

- modelName: "Patagonia Deep Pile (90s 빈티지 콜렉터 / Mesclun 40주년)"
- mustContain: `Patagonia × (딥파일 | deep pile | mesclun | 40주년 | legacy)`
- msrpKrw: ₩390k, released: 1990
- defaultProductType: jacket
- LANE_READINESS: ready

### 2. mainstream `clothing-patagonia-retro-x` mustNotContain 보강 ✓

추가 키워드 (deep_pile narrow 로 routing):
```typescript
"딥파일", "deep pile", "mesclun", "40주년", "legacy"
```

### 3. Shelled Synchilla / Reversible / Vest 는 narrow 보류

- n<10 → narrow 임계 미달.
- 색상/연도 spread 의 자연스러운 부분 → Wave 251.4 의 비교 매물 list product_type/sub_model 필터로 흡수.
- mustNotContain 으로 broad fallback 보내면 pool 진입 안 됨 (사용자 친화 위배 — 정상 매물).
- 그대로 retro_x 에 유지.

## 영향 (additive only)

- 잘못 매칭 차단:
  - 딥파일 10건 → patagonia-retro-x 에서 제외 → 새 narrow lane.
  - mainstream retro_x p50 시세 stabilize (deep_pile outlier 제외) → 사용자 시세 정확도 ↑.
- 정상 Retro X / Synchilla / Snap-T 매물 영향 X.
- broad `clothing-patagonia` 영향 X (이미 retro/레트로/synchilla/신칠라/snap-t mustNotContain 박혀 있음).

## 검증

- `npm run test:core` → 581 pass / 9 fail (failing 9건은 me-page-contract UI layout 테스트, catalog 무관 pre-existing — Wave 251.1 와 동일).
- TypeScript compile: catalog.ts + category-readiness.ts 정상 (mustContain/mustNotContain 배열 string only).

## 후속 작업

1. **production rematch trigger** (별도 wave 또는 사용자 결정 후):
   ```sql
   UPDATE mvp_raw_listings
   SET detail_status = 'pending'
   WHERE sku_id = 'clothing-patagonia-retro-x'
     AND (name ILIKE '%딥파일%' OR name ILIKE '%deep pile%' OR name ILIKE '%mesclun%' OR name ILIKE '%40주년%' OR name ILIKE '%legacy%');
   ```
   다음 cron 자동 reparse → `clothing-patagonia-deep-pile` 으로 routing.

2. Wave 251.3 — BAPE rematch trigger.
3. Wave 251.4 — 비교 매물 list product_type/sub_model 필터 (사용자 frustration 직접 해결).

## 사용자 정책 준수

- additive only (narrow 신설 + broad mustNotContain 확장만, mustContain 변경 X) → 비파괴 ✓
- decision log 필수 ✓
- 사용자 친화 — 시세 정확도 ↑ ✓
- narrow=fallback / broad=차단 (Wave 236d Goldilocks) — broad 가 narrow specific keyword 차단 ✓
- 매물 ≥10건 narrow 임계 준수 (Wave 218 정책) ✓
