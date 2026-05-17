# 2026-05-17 user-reveal-dashboard ConditionChip 추가

## 사용자 지적

> "지금 우리 매핑 s,a,b,c이런걸로 바꾼거같은데 아님??
> 운영자풀 /me 거기서 한번 확인해보셈; 비슷하게 맞춰야되지 않을까?"

원인:
- ConditionChip (S급/A급/사용감/훼손 매핑) 박은 commit `c3765c2`
- **admin-pool-browser + pack-reveal-modal** 에는 ConditionChip 사용 ✅
- **user-reveal-dashboard (/me 나의 상품)** 누락 ❌
- /me 페이지 에 S/A/B/C 매핑 안 보였음 (사용자 confirm)

## 박은 변경 (commit `17bd8d1`)

- `ConditionChip` import 추가
- `item.marketBasis?.conditionClass` 사용 (pack-reveal-modal 패턴 동일)
- 매물 카드 name 옆에 chip 표시 (truncate 와 같이 flex)

## 4 화면 통일 완료

| 화면 | ConditionChip |
|---|---|
| pack-reveal-modal | ✅ |
| admin-pool-browser | ✅ |
| user-reveal-dashboard | ✅ (이 PR) |
| preview-masked-dashboard | ✅ |

매핑 (단일 source: `condition-chip.tsx`):
- unopened → **미개봉/새상품**
- mint → **S급**
- clean → **A급**
- normal → 일반
- worn → 사용감
- flawed → 훼손
- low_batt → 배터리 저하

## "평균 N일 회전" 미표시 = 데이터 없음

`mvp_market_velocity` 데이터가 모든 SKU 에 있는 게 아님 (sold 매물 시점 추적 — 회전이 빠른 인기 SKU 위주). 데이터 없으면 chip 자연 미표시 (정상).

## Test

288/288 pass.
