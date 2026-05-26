# Wave 758b — 매너온도 0.0°C "거래 보수적" 오표시 버그 fix

- 시간: 2026-05-26 KST
- 트리거: 사용자 보고 — "왜 우리 상세페이지에 0도 라고나옴?? 실제 당큰 페이지 들어가면 59.0°C 인데". 당근은 가입 즉시 36.5°C 시작 → 0.0°C 는 실질적으로 나올 수 없는 값.

## 발견 — Root cause: `cleanNumber(null) === 0` JS quirk

매너온도 표시 chain:
1. DB `daangn_manner_temperature` (numeric NULL) → 497,070 / 497,431 row 가 NULL (backfill 미완)
2. `facts.daangnMannerTemperature` → null
3. **`cleanNumber(null)` → `Number(null)` === `0`** ⚠️
4. mannerTemp = 0 → tier `below_avg` (< 30°C) → "거래 보수적" headline + "사진·구성품·만남 장소를 더 신중히 확인하세요" body
5. 모든 NULL row 매물이 일괄적으로 0.0°C "거래 보수적" 으로 잘못 표시됨

DB sweep 결과:
- NULL: 497,070 row (99.93%)
- 정확히 0: **0 row**
- 0 < x < 36.5: 7 row (29~36.4, 실제 데이터)
- ≥ 36.5: 354 row

즉 DB 에는 0 박힌 row 가 한 건도 없는데, 표시 layer 의 `cleanNumber` 함수가 NULL → 0 으로 변환해서 사용자에게 잘못된 신뢰 경고를 보내고 있었음. 큰 false negative — 정상 셀러를 "거래 보수적" 으로 표시.

## 변경

### `src/lib/marketplace-safety.ts` — `cleanNumber` 함수 정상화

```ts
function cleanNumber(value: unknown): number | null {
  // Wave 759 (2026-05-26): Number(null) === 0 / Number("") === 0 인 JS quirk 차단.
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
```

이전 버전: `Number(null)` 이 NaN 이 아니라 `0` 을 반환하는 JS quirk 때문에 NULL → 0 으로 broken. 명시적으로 `null/undefined/""` 를 null 처리.

영향 범위 점검:
- `cleanNumber` 사용처 12군데 중 대부분 `?? 0` 패턴 (값 없으면 0 으로 fallback 명시) → 결과 동일
- 직접 할당하는 곳 (`joongnaTrustScore`, `sellerReviewRating`, `activityScore`, `reliabilityScore`) → null 처리가 의미적으로 정확 (점수 없음 ≠ 점수 0)

### `src/lib/marketplace-safety.ts` — 매너온도 0 명시적 차단 (defensive)

```ts
const rawMannerTemp = isDaangn ? cleanNumber(facts.daangnMannerTemperature) : null;
const mannerTemp = rawMannerTemp != null && rawMannerTemp > 0 ? rawMannerTemp : null;
```

당근 매너온도는 가입 즉시 36.5°C 부터 시작이라 **0 은 어떤 경로로 들어와도 비정상값**. cleanNumber fix 가 root cause 를 해결하지만, 표시 layer 에서도 0 을 차단해서 다른 ingest 경로 (raw_json fallback, 기존 데이터 등) 에서 0 이 들어와도 안전.

### `src/components/pack-reveal-modal.tsx` — 동일 defensive 처리

`safety.sellerTrust.mannerTemperature` 이 0 이어도 "정보 없음" fallback 으로 표시되도록 동일 패턴 적용.

## 사용자 영향

Before fix:
- 매너온도 backfill 미완 매물 (97% 이상) → 모두 "당근 매너온도 0.0°C · 거래 보수적" 으로 표시됨
- 사용자가 정상 셀러에게 잘못된 경고 받음 → 거래 위축

After fix:
- 매너온도 없는 매물 → "당근 매너온도 정보 없음 · 당근 앱에서 셀러 프로필을 누르면 확인 가능" fallback 표시
- 매너온도 있는 매물 (실제 값) → 정확한 tier 메시지

## Follow-up

- 매너온도 backfill — 현재 354 / 497,431 (0.07%) 만 backfill. 사용자 노출 빈도 높은 매물 우선 backfill 필요. 별도 wave 에서 다룰 예정.
- `Number(null) === 0` 같은 JS quirk 다른 곳 검토. `Number(false) === 0`, `Number([]) === 0`, `Number([1]) === 1` 등도 trap.
