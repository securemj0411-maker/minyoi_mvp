# 2026-05-17 user-reveal-dashboard 매입·시세·수익률 표시

## 사용자 지적

> "/me 나의 상품 왜 시세는 안나옴?? 왜 상품 보기를 눌러야되지..??"

기존 카드에 매물 가격만 표시, 시세 (sku_median) 안 보임 → 사용자 카드 클릭해서 모달 열어야 시세 봄. 불편.

## 박은 변경 (commit `5848cdf`)

카드 layout:

```
[image] 매물명 + ConditionChip
        매입 ₩X · 시세 ₩Y · 시간 · 상태
        +N원 (emerald chip) + +Z% (amber chip)
        verdict chips (signals)
        피드백 (있을 시)
```

- `item.marketBasis?.medianPrice` 활용 (이미 fetch 됨, 추가 작업 X)
- 수익률 = avg profit / price × 100

## 4 화면 패턴 통일

| 화면 | 매입 · 시세 · 수익률 |
|---|---|
| pack-reveal-modal | ✅ |
| admin-pool-browser | ✅ |
| **user-reveal-dashboard** | ✅ (이 PR) |
| preview-masked-dashboard | ✅ |

## Test

288/288 pass.
