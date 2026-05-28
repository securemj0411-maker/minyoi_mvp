# Wave 796 — 당근 표본 < 3 매물 ready 차단

- 시간: 2026-05-27 KST
- 트리거: owner — "당근마켓은 시세 표본 비교매물이 3개 이하면 ready 처리 안 하면 안되는거임?"

## 배경

당근마켓 특수성:
- 안전결제 X — 직거래만 (사기 risk 큼)
- 사용자는 매물 사기 전에 정확한 시세 알아야 함
- 같은 sku 의 당근 매물 표본 < 3 이면 시세 비교군 부족 → 신뢰 부족

기존 logic (Wave 225):
- `lowVolumeSkuIds` — 같은 sku 의 **전체 source 합산** 7d <3 OR 2d <1 차단
- 신발/의류/가방 카테고리만 적용
- 당근 source 한정 strict 검사 없음

## 변경

### `src/lib/tick-pipeline.ts`
신규 함수 `loadDaangnVolumeBySku()`:
```ts
async function loadDaangnVolumeBySku(): Promise<Map<string, number>> {
  // 7d 내 active 당근 매물 sku_id 별 카운트
  // source=eq.daangn AND listing_state=eq.active AND first_seen_at >= 7d
}
```

`Promise.all` 에 추가 + `buildCandidatePoolRows` input 에 전달.

### `src/lib/candidate-pool-builder.ts`
input 에 `daangnVolumeBySku?: Map<string, number>` 추가.
loop 안에 check 추가:
```ts
if (row.source === 'daangn' && row.skuId && input.daangnVolumeBySku) {
  const daangnVol = input.daangnVolumeBySku.get(row.skuId) ?? 0;
  if (daangnVol < 3) {
    invalidations.push({ pid, reason: "daangn_volume_below_3" });
    continue;
  }
}
```

## 영향 측정

당근 매물 ready 474건 분포:
- 10건+: 355 (74.9%)
- 5-9건: 74 (15.6%)
- 3-4건: 32 (6.8%)
- 2건: 9 (1.9%)
- **1건: 4 (0.8%)**

**3건 미만 (1~2건): 13건 (2.7%) ready 차단**.

## 예상 결과

- 다음 cron tick 부터 당근 sku 표본 < 3 매물 ready X
- 기존 ready 매물 중 영향 13건 → 다음 tick 에서 invalidate (reason: `daangn_volume_below_3`)
- 사용자 화면에서 당근 sparse 매물 노출 ↓ → 시세 정확도 ↑

## Follow-up

- 다른 카테고리 (전자기기/시계) 도 source-별 검사 확장 검토 (owner 결정 받기)
- 번장/중나 표본 부족 case 도 별도 검토 (안전결제 있어도 정확도 측면)
- "방금 거래" 73% 거짓 문제 (Wave 795 fix) 와 별개 — Wave 795 가 표시 layer fix, Wave 796 가 진입 layer fix.
