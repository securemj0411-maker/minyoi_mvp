# 2026-05-19 Wave 362 — 득템 점수 100점 만점 + 홈 ← 옆 + 짤림 fix

사용자 3가지:
1. 홈 버튼이 당근처럼 ← **옆**에 (지금 우상은 분리됨)
2. 득템 점수가 우측에서 짤려 보임
3. °C 그만 — "**100점 만점에 몇 퍼센트**" 식 (당근 흉내 X)

## 결정

### 1. 100점 만점 점수 (°C 제거)

`calculateDealTemperature` (35.0~39.5 °C) → `calculateDealScore` (0~100점):

```
baseline 50점
+ profitPct × 1.5 (cap +40)   ← 가장 강한 가중치
+ confidence: 0.8+ → +8 / 0.6+ → +4
+ seller: 4.8+ & 30+리뷰 → +6 / 4.5+ → +2
+ sampleCount: 20+ → +4 / 10+ → +2
```

라벨 + 색 (이전과 동일 위계):
| score | 라벨 | 색 |
|---|---|---|
| 90+ | 핫 | rose |
| 80+ | 강추 | orange |
| 70+ | 좋음 | emerald |
| <70 | 보통 | zinc |

### 2. 표시 단순화 (짤림 fix)

**이전 (Wave 361)**:
```
37.8°C
득템 점수 (underline)
```
+ label "강추 · 득템 점수" 추가하면서 너무 김

**이후 (단순화)**:
```
85 /100  (score 큰 + /100 작은)
득템 점수 (underline)
```
- `whitespace-nowrap` 추가
- label은 펼침 패널에서만 노출 (UI는 점수 + 색만)
- 가로 폭 작아짐 → 좁은 영역에서도 안 짤림

### 3. Floating nav — 좌상 그룹 (← + 🏠 나란히)

**이전**:
- `<` 좌상 + 🏠 우상 (분리)

**이후**:
- 둘 다 좌상에 `flex items-center gap-1`로 묶음 (당근식)
- 우상은 비움
- 사진 visibility 더 좋아짐 (한쪽만 nav)

## 변경 파일

`src/components/pack-reveal-modal.tsx`:
- `DealTemperature` type → `DealScore`, helper `calculateDealTemperature` → `calculateDealScore`
- `DealMeterButton` UI: `°C` → `점/100`, whitespace-nowrap, label 제거
- floating nav 좌상 ← + 🏠 한 `<div className="absolute left-3 top-3 flex gap-1">` 안에

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗
