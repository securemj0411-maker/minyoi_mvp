# 2026-05-17 poolMaxExposure 1 → 5 (일률)

## 사용자 결정

> "무료 사용자에게 돌아간 풀은 최대 5명까지 공유가능 어떄??
> 어차피 랜덤이라서 똑같은거 걸릴 확률도 낮긴해서 UX너무 망치치는 않을거 같은데"

tier 별 분리 (무료 5 / 유료 1) 대신 일률 5 — 복잡도 회피. 유료 차별화는 quota / 무제한 등 다른 측면.

## 박은 변경 (commit `de88062`)

### `pool-policy.mjs`
```ts
// 이전:
export function poolMaxExposure(_band) {
  return 1;
}

// 새:
export function poolMaxExposure(_band) {
  return 5;
}
```

### SQL mass update
```sql
UPDATE mvp_candidate_pool
SET max_exposure = 5
WHERE status IN ('ready', 'reserved') AND max_exposure = 1;
-- 251 매물 update
```

## 효과

- 풀 5배 효율 — 같은 매물 5명까지 reveal 가능
- 신규 welcome 5 매물 = 다른 사용자 풀 영향 ↓
- 285 ready 매물 → 약 1,425 reveal slot (이론치)

## Trade-off

- "1매물 1인" 정책 폐기 — 사용자 명시 OK
- 랜덤 selection 이라 같은 매물 보일 확률 ~1/N (낮음, UX 영향 미미)

## 향후

- 사용자 base 커지면 (>50명/일 가입) tier 분리 (B) 검토
- pool 부족 모니터링

## Test

288/288 pass.
