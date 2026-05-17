# Wave 193 (2026-05-18) condition fallback minSamples 3 → 1

> **상태: HIGH visibility fix.** 시세 매칭 정확도 직접 영향.

## 사용자 보고

> "Apple Watch SE2 40mm GPS · 매입 200,000원 · 시세 110,400원 · +55,905원"
> "왜 S급 등급 분류인데 시세 11만원?? 시세 근거 sample 다 s급인거 같은데 11만원짜리가 없는데??"
> "근본적인 원인이 뭐임?"

## 진단

### 매물 정확 분류 (parser 정상)
- pid 406974440 "애플워치 SE2 40mm GPS 배터리효율 100"
- parser: `condition_class = "clean"` (S급, battery_perfect note)
- comparable_key: `applewatch|applewatch_se2|40mm|gps`

### 시세 분포 (5/17, 같은 SKU)
| condition | active median | blended | sample |
|---|---|---|---|
| **clean** | 200,000 | **184,000** | **1건** |
| normal | 120,000 | 110,400 | 3건 |
| worn | 170,000 | 156,400 | 1건 |
| low_batt | 110,000 | 101,200 | 1건 |
| unopened | 250,000 | 230,000 | 1건 |

→ 정상 순서 (unopened > clean > worn > low_batt > normal). normal 3건이 우연히 저가 매물 bias.

### 매칭 로직 (`pickByConditionFallback`)
1. clean chain: `["clean", "normal", "worn", "all"]`
2. **minSamples = 3** (default)
3. clean sample 1건 → 미달 → skip
4. normal sample 3건 → ✅ 매칭
5. 결과: condition="normal", 시세 110,400, `fallbackUsed=true` ("인접 등급 fallback" 라벨)

### 사용자 frustration 근본 원인

- **clean 매물에 normal 시세 표시** → -90K 손해 인식 (실제 clean 매칭 시 -16K)
- minSamples 3 정책이 sample 부족 카테고리에 부적합
- 시세 sample bias (normal 3건 우연히 저가) → fallback 가격 < target condition 가격

## 변경

### `src/lib/condition-fallback.ts:54`

```ts
// Before
minSamples = 3,

// After (Wave 193)
minSamples = 1,
```

- default 3 → 1. caller 전부 default 사용 (pack-open / tick-pipeline).
- condition-specific 시세 우선. sample 1건이라도 그 condition 시세 사용.
- outlier 위험: UI 의 confidence / sampleCount 라벨로 사용자 인지.

## 검증

### typecheck
```
npx tsc --noEmit --pretty false → 변경 파일 에러 0
```

### RPC 직접 검증 (사용자 매물 강제 갱신)

```sql
SELECT * FROM recompute_reveal_current_profits(ARRAY['applewatch|applewatch_se2|40mm|gps']);
→ updated_count: 6, invalidated_count: 1
```

| pid | snapshot | current | market_invalidated_at |
|---|---|---|---|
| 406974440 | +55,905 | **-16,000** | 2026-05-17 16:12 ✅ |

→ clean 시세 (184K) - 매입 (200K) = -16K. 정확.

## 영향 (whack-a-mole 검증)

| 변경 영역 | 위험 | 영향 |
|---|---|---|
| `pickByConditionFallback` default | ⚠️ outlier 가능 | sample 1건 매물 시세 우연 bias 시 부정확. UI 신뢰도 라벨로 완화 |
| pack-open marketBasisForCandidate | ✅ 같은 helper | reveal 화면 시세 매칭 정확도 ↑ |
| tick-pipeline marketBasisForCandidate | ✅ | landing showcases 등 동일 |
| RPC `recompute_reveal_current_profits` | ✅ 무관 | SQL fallback chain (COALESCE) — minSamples 미사용. 이미 1건이라도 사용 |

### 부작용 가능성

- sample 1건 매물의 시세가 outlier (가품/잘못된 분류) 면 시세 왜곡
- 완화: `mvp_market_price_daily` 의 confidence 컬럼 (high/medium/low) + sample count UI 표시
- 추후 측정: 시세 부정확 신고 ("inaccurate_report") 비율 변화

## 다음 (자동 진행)

- Wave 190+191 의 `recompute_reveal_current_profits` cron 이 다음 market-worker tick 후 자동 sweep
- API `/packs/me` 가 marketBasisForCandidate 시 minSamples=1 적용 → 화면 정확 매칭
- 사용자 본 매물 다음 fetch 시 시세 184K (clean) + 차익 -16K + 추천 무효 badge

## Lesson

1. **default minSamples 의 의미 비결정성** — 보수적 3 이 정확성 보장하는 듯 보였지만 sample 부족 카테고리에 시세 bias 유발. precision vs recall trade-off 의 default 가 모든 SKU 에 맞지 않음.
2. **시세 sample 수와 신뢰도 분리** — sample 1건이라도 condition-specific 우선 + 신뢰도 라벨로 사용자 보호. 시세 자체 숨김보다 정확.
3. **사용자 frustration trigger = 가격 역전 mismatch** — clean 매물에 normal 시세 표시 (normal < clean 정상 reverse). minSamples 정책이 무의식적으로 가격 역전 유발. fix 후 시세 순서 정상.
