# Wave 755-756 — Pool ready % 진단 + 사용자 size 정책 fix

**날짜**: 2026-05-24
**Owner**: Claude (사용자 명시 "사이즈 별로 시세 하고있는건 아니지...??")
**Status**: parser bump 진행, cron이 점진 reparse

## 🔥 CRITICAL POLICY VIOLATION 발견

### 배경
Wave 755 (Pool ready % 5.9% / 15.2% 진단) 중 sku_median_unavailable 224건 root cause 추적.
사용자 메모리 확인: **"C 시세에 사이즈 반영은 진짜 아니다;;"** (Wave 750 시점)

### Violation
parser가 사용자 명시 정책 위반:
```typescript
// src/lib/parsers/wave92-fashion-mobility.ts
// shoe (line 953):
if (opt.sizeMm != null) {
  partsForKey.push(String(opt.sizeMm));  // ❌ 사이즈 박힘
}
// bag (line 1074):
if (opt.sizeVariant) {
  partsForKey.push(opt.sizeVariant);  // ❌ 사이즈 박힘
}
```

### Impact (production)
- 같은 모델인데 사이즈마다 별 시세 bucket
- 예: `shoe|dunk_low|sneaker|255|b_grade|with_box` 1건, `...|260|...` 1건
- 결과: sample 1-2건만 → confidence='low' → blended_median 계산 불안정
- Nike Dunk Panda 47건 sku_median_unavailable 1위 (수익 좋은 모델)

## Wave 755 — bandFromProfit consistency
profit.ts (20K) ↔ pool-policy.mjs (10K) inconsistency 발견.
production pool builder는 이미 10K (Wave 90 사용자 결정).
sync: profit.ts → 10K. signature category? 인자 추가 (placeholder).

profit_below_pack_band 257건 의류 — 매물 CURRENT profit 진짜 < 10K. threshold 조정으로 회복 불가.
진짜 root cause는 sku_median_unavailable.

## Wave 756 — Size policy fix

### Fix
- shoe parser: `sizeMm` → `parsedJson.shoe_size_mm` (UI display 용). comparable_key 제외.
- bag parser: `sizeVariant` → `parsedJson.bag_size_variant`. comparable_key 제외.
- `criticalUnknown.push("unknown_size")` 제거 (사이즈 없어도 시세 비교 가능).
- Parser version bump:
  - `wave92-shoe-v38` → `wave92-shoe-v39`
  - `wave92-bag-v23` → `wave92-bag-v24`
- `LATEST_PARSER_VERSION_BY_CATEGORY` 매핑 업데이트
- cron이 stale v38 매물 점진 reparse → size-agnostic comparable_key로 sample 통합

### Affected
- 신발 23,770 매물 + 가방 5,385 매물 (총 29,155)
- 모든 size = 같은 시세 bucket → sample 5-10배 증가 예상
- sku_median_unavailable 신발 162 + 의류 62 = 224 회복 예상
- pool ready %: 신발 15.2% → 30%+ 예상

### 사용자 친화
- "250mm 사도 같은 시세" — 일반인 시세 이해 단순화
- size 분리 안 함 → "이 사이즈는 비싸" 같은 false signal 제거
- 시세 sample 충분 → confidence ↑

## Files Touched
- `src/lib/parsers/wave92-fashion-mobility.ts` — shoe/bag parser, parser version bump
- `src/lib/tick-pipeline.ts` — LATEST_PARSER_VERSION_BY_CATEGORY 매핑
- `src/lib/profit.ts` — Wave 755 threshold sync (20K → 10K)
- `src/lib/pool-policy.mjs` + `pool-policy.d.ts` — category? 인자 추가
- `src/lib/candidate-pool-builder.ts` — bandFromProfit category 전달

## Pending verification (24-48h 후)
- Wave 756 reparse 진행률 (`parser_version=wave92-shoe-v38` 매물 감소)
- 신발/가방 comparable_key 통합 효과 (sample count 증가)
- pool ready %: 의류 5.9% → ? / 신발 15.2% → ?
- sku_median_unavailable 224건 회복
- spread 재측정 (size 통합 후 가격 분포 변화)

## 잡은 Pareto 큰 finding
**catalog 매칭은 완벽한데 시세 시스템이 사용자 정책 위반 중**.
catalog 작업 30+ wave 누적도 size fragmentation 때문에 pool ready % 5.9%로 빠짐.

다음 cycle: 24-48h 후 Wave 756 효과 측정 + 남은 root cause (ai_audit_hold 120건) audit.
