# 2026-05-19 Wave 368 — pool API sanity check: 시세 < 매입 매물 차단

사용자 캡쳐 4건:
- RRL 벨트: 매입 350,000 · 시세 183,080 · 표시 차익 +154,275 ← 실제 손해
- 아이패드 10세대: 매입 610,000 · 시세 561,200 · 표시 차익 +113,935 ← 실제 손해
- 애플워치9 GPS: 매입 380,000 · 시세 386,400 · 표시 차익 +185,535 ← 시세 거의 동일한데 차익 큼

## 원인

**Data source inconsistency**:
- `expected_profit_min/max` = `mvp_candidate_pool` DB column. pool builder가 **계산 시점**의 시세 기준으로 박음.
- 표시 시세 = **Wave 247.2 (다른 세션)** 이후 `bandAwareMedian` (mvp_market_price_daily band-aware).

→ 시세는 wave 247.2로 새로 계산됐는데 차익은 옛날 값. **시세 < 매입인데 차익 +양수** 노출 → 사용자 신뢰 깎임 (사기처럼 보임).

## 결정

**Pool API에 sanity check**:
```ts
const bandPrice = bandAwareMedian(...);
const skuMedianFinal = bandPrice ?? raw.sku_median;
if (skuMedianFinal && skuMedianFinal > 0 && raw.price > skuMedianFinal) {
  return null;  // 응답에서 제외
}
```

- 표시 시세가 매입가 미만이면 buildItems에서 제외 (.map → null → filter)
- DB는 그대로 — UI에서만 silently 숨김
- 일관성 100% 보장 (사용자에게 모순 안 보임)

## 미해결 (별 세션 담당)

- Pool builder가 expected_profit_min/max 계산 시 wave 247.2 band-aware median 사용하도록 동기화
- 또는 expected_profit을 표시 시점에 재계산 (price + skuMedianFinal + fees 기준)
- 둘 다 시세 로직 담당 세션이 해야

이 wave 368은 **사용자 노출 차단만 우선**.

## 변경 파일

`src/app/api/packs/pool/route.ts` (line ~267):
- `buildItems` map callback 안 sanity check 추가

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 효과

- 손해 매물 (시세 < 매입) 풀에서 제외 → 사용자 신뢰 회복
- 결과: 30개 풀에서 일부 매물 사라질 수 있음. 사용자가 새 30개 받으면 다음 풀에서 다시 채워짐.

## 다음 단계 (사용자 결정 / 별 세션)

- 근본 원인 (expected_profit vs 표시 시세 sync) 해결
- 그 전엔 wave 368 가드가 보호막 역할
