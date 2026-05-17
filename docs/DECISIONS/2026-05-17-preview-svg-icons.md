# 2026-05-17 preview-masked: SVG 아이콘 + 차익 단일 표시 fix

## 사용자 지적

> "촌스러운 이모지 말고 svg로 해라
> 그리고 수익이 왜 구간인데 예를들어 +300,000~300,000원으로 됌;
> 이럴거면 구간으로 보여주지말지"

## 박은 변경 (commit `e45de30`)

### 1. icons.tsx 추가 (14 신규 SVG, lucide-style)
- 카테고리: Smartphone / Tablet / Laptop / Watch / Headphone / Camera / Monitor / Speaker / Shoe / Bag / Bike
- 유틸: Lock / Unlock / Search

### 2. preview-masked-dashboard 이모지 제거
- CATEGORY_LABEL: emoji 제거, 텍스트만 ("📱 스마트폰" → "스마트폰")
- CATEGORY_ICON (emoji+gradient) → CATEGORY_GRADIENT + CATEGORY_SVG 분리
- 카드 thumbnail fallback: emoji → SVG (32x32)
- 카테고리 chip: emoji → SVG (12x12) + 텍스트
- 상단 hook: 🔥 LIVE → FlameIcon + LIVE
- 상단/하단 CTA: 🔓 → UnlockIcon, 🔥 → SearchIcon

### 3. profitLabel 함수 신설
```ts
function profitLabel(min, max) {
  if (Math.round(min) === Math.round(max)) return `+${min}원`;
  return `+${min}~${max}원`;
}
```
- min === max 면 단일 표시 (사용자 지적 "+300,000~300,000원" 어색 fix)
- 다르면 구간 그대로

## Test

288/288 pass.
