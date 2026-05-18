# Wave 196 — 신발/가방 시세 정확도 강화 α + γ (2026-05-18)

## 배경

Wave 195 audit 결과 신발 pool 진입 90%+ profit_below_pack_band 차단의 진짜 원인은 threshold가 아니라 **시세 sample에 가품/특가 매물 다수 끼어들어 median 비현실적 낮음**.

사용자: "그렇게 너 추천하는 걸로 다 하자"

→ Option α (가품 floor 강화) + Option γ (confidence + spread 차단) 박음.

## 변경

### α — 시세 sample 가품 floor 강화 (msrp×15% → 25%)

`tick-pipeline.ts:2861 upsertMarketPriceDaily()`:
```ts
const FAKE_FLOOR_RATIO_MARKET = 0.25;  // 이전 0.15
```

신발/가방 카테고리만 적용. msrp×25% 미만 매물은 시세 sample에서 제외.

**영향**:
- dunk_low msrp 129K → floor 32K (이전 19K). 30K 가품 매물 차단.
- gazelle_og msrp 130K → floor 33K (이전 20K). 저가 매물 차단.
- chuck70 msrp 89K → floor 22K (이전 13K). 25K 사용감 큰 매물도 일부 차단.

**trade-off**: precision ↑ recall ↓ (사용감 큰 매물 일부 시세 sample에서 제외). §12b 정확성 우선 정책 일관.

### γ — trustedMarketMedian spread + confidence 차단

`tick-pipeline.ts:2192`:
```ts
const FAKE_RISK_CATEGORIES = new Set<string>(["shoe", "bag"]);
if (category && FAKE_RISK_CATEGORIES.has(category) && stat.confidence === "low") {
  const p25 = Number(stat.p25_price ?? 0);
  const p75 = Number(stat.p75_price ?? 0);
  if (p25 > 0 && p75 > 0 && p75 / p25 > 2) {
    return null;
  }
}
```

신발/가방 + confidence=low + p75/p25 > 2x 시 시세 null 반환 → skuMedian=0 → 풀 진입 차단.

**판단 근거**:
- spread > 2x = 가품/정상 혼재 신호 (정상 매물만이면 spread 작음)
- confidence=low 결합으로 false positive 보호 (medium/high는 통과)
- 가품 risk 큰 카테고리만 적용

### type 보강

`MarketPriceRow` 에 `p25_price` / `p75_price` 추가. DB schema 이미 있었지만 타입 정의 누락.

## verify

- typecheck clean (tick-pipeline 직접 영향 0)
- test:core 451/451 pass (이전 wave159h 1건 무관 — 이번 wave에 같이 통과)
- commit `b19d073`

## 예상 효과

다음 시세 daily 계산 (~111분 후, event-driven invalidation queue 통해 자동 갱신):
1. 신발 시세 median 정상화 (가품 sample 차단으로 ↑)
2. 신발 매물 차익 정상 계산
3. 풀 진입 가능 매물 증가 (정상가 매물 그동안 막혔던 것)
4. spread 큰 저신뢰 시세는 차단 → false positive 보호

24h 후 측정:
- 신발 candidate_pool ready 매물 증가
- pool skipReasons: profit_below_pack_band 카운트 감소
- 신발 시세 daily p25/p75 spread 정상화

## 알려진 위험

1. **recall 손해**: 사용감 큰 매물 (cheap normal listings) 일부 시세 sample 제외 → 시세 약간 inflated 가능. 측정 후 ratio 0.20~0.25 fine-tune 가능.
2. **spread 2x 임계값**: 일부 정상 시세도 차단 가능. 측정 후 2.5x 또는 3x 완화 가능.
3. **신발 외 카테고리 영향 X** — 가전/스마트폰 등은 변경 없음.

## 다음 액션

24h 후 production sweep:
1. 신발 시세 median + p25/p75 분포 비교 (변경 전후)
2. 신발 candidate_pool ready 추이
3. spread 차단으로 인한 false positive 측정 (정상 시세 차단 빈도)
