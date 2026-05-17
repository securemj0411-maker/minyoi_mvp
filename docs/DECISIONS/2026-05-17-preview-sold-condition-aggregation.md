# 2026-05-17 preview-pool: sold count condition_class 합산 fix

## 사용자 지적

> "스마트워치나 에어팟은 확실히 데이터 있어서 수요많은 거 잘 잡아질텐데
> 왜 아이패드 얘만 수요 보통 나오고 맥북 이나 다른건 수요가 안나옴???"

## 원인

`mvp_market_price_daily` schema:
- `(comparable_key, condition_class, date)` 별로 row 분산 (PK)
- 같은 SKU 의 sold_sample_count 가 condition (unopened/clean/normal/worn) 별로 나뉨

이전 코드:
```ts
for (const r of rows) {
  if (!soldByKey.has(r.comparable_key)) {
    soldByKey.set(r.comparable_key, r.sold_sample_count);
  }
}
```
→ **첫 row 만 사용**. order=date.desc 정렬 시 첫 row = 임의 condition (보통 alphabetical). threshold (3, 10, 30) 못 넘김.

### 검증 예시 (airpods_4_anc 05-17)
| condition | sold | active |
|---|---|---|
| clean | 2 | 5 |
| normal | 3 | 7 |
| unopened | **11** | 47 |
| worn | 1 | 17 |
| **합산** | **17** | 76 |

이전: clean 2 → "보통" 미달 (3 threshold).
새: 17 → **"🔥 수요 매우높음"** (30 threshold 근접, 다른 SKU 들 다 잡힘).

## Fix (commit `e72742e`)

```ts
// select 에 date + condition_class 포함
const rows = await fetchMarket(... +date+condition_class);
const latestByKey = new Map<string, { date: string; total: number }>();
for (const r of rows) {
  const cur = latestByKey.get(r.comparable_key);
  if (!cur || r.date > cur.date) {
    latestByKey.set(r.comparable_key, { date: r.date, total: r.sold_sample_count });
  } else if (r.date === cur.date) {
    cur.total += r.sold_sample_count;  // 같은 date 의 다른 condition 합산
  }
}
```

→ latest date 의 모든 condition 합산 = 진짜 SKU 수요.

## Test

288/288 pass.
