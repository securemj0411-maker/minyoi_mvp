# 2026-05-17 preview-pool: condition_class 다양화 추가

## 사용자 지적

> "아직도 메인페이지 일반,사용감 이렇게 나오지 s급이런 매핑 안나오는데??
> /me운영자풀 안보임?? A급 이런식으로 나온다니까?"

## 원인

30만 이하 ready pool 의 condition_class 분포 (작업 전 확인):
| cc | count | distinct SKU |
|---|---|---|
| worn | 42 | 20 |
| **unopened** | **35** | 10 |
| **clean** | **30** | 14 |
| normal | 23 | 18 |
| **mint** | **20** | 7 |

→ unopened/clean/mint 합 **85 매물** 있음. 근데 메인 페이지 selection 알고리즘 = profit_band desc + profit_max desc 만. cc 다양화 없음.

profit 큰 매물 위주 = worn/normal 위주로 잡힘 → S급/A급/미개봉 chip 안 보임.

## Fix (commit `1801f11`)

3-tier fallback 다양화 추가 (pickFromTier):

```
1. sku + category + condition_class 다 dedup (strictest)
   → 1차에 다른 cc 매물 우선 pick
2. cc 중복 허용 (sku + category 만 dedup)
   → 2차로 부족분 채움
3. sku 만 dedup (category 도 중복 허용, fallback)
   → 3차로 부족분
```

## 효과

- 매번 5 매물 중 unopened/mint/clean 1-2개 포함 → S급/A급/미개봉 chip 표시
- ConditionChip 매핑 활성화 (worn/normal 만일 때 안 보였음)
- 카테고리 다양화 + sku dedup 유지

## ConditionChip 매핑 (변경 X — 단일 source)

| cc | label |
|---|---|
| unopened | 미개봉/새상품 |
| mint | S급 |
| clean | A급 |
| normal | 일반 |
| worn | 사용감 |
| flawed | 훼손 |
| low_batt | 배터리 저하 |

매핑 자체엔 문제 없었음 — selection 알고리즘이 다양화 안 해서 일부 cc 만 노출.

## Test

288/288 pass.
