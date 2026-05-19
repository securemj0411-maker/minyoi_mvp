# 2026-05-19 Wave 355 — unopened/mint 사진 위 럭셔리 배지 ("전설템" 느낌)

사용자 지적:
1. "S급이랑 미개봉은 기존처럼 사진에 붙혀" — wave 354에서 메타 영역으로 옮긴 거 되돌리기
2. "거의 새것이 뭐냐..??" — S급은 그대로 "S급" 라벨
3. "미개봉도 S급 처럼 좀 그라데이션이나 등등 좀 존나 전설템 뽑은 느낌처럼 뱃지 좀 예쁘게 하셈" — unopened 배지 럭셔리하게

## 결정

### unopened/mint = 사진 위 배지 (ConditionPhotoBadge compact)
- 카드 사진 좌상단에 absolute positioning
- compact 모드 — mark 없이 라벨만, 짧고 강렬
- mint(S급) + unopened(미개봉) 둘 다 "전설/희귀" 시각 표현

### 나머지 5개 등급 = 메타 영역 ConditionChip friendly
- clean → "깨끗한 편"
- normal → "상태 보통"
- worn → "사용감 있음"
- low_batt → "배터리 약함"
- flawed → "하자 있음"

## 디자인 업그레이드

### unopened — "Legendary" 골드
```
border-[#ffd86b]/95
bg-[linear-gradient(135deg,
  #1a0d02_0%,    // 깊은 흑갈
  #5a3a06_22%,   // 다크 골드
  #d4a020_46%,   // 메탈릭 골드
  #fff0a8_64%,   // 밝은 골드 (하이라이트)
  #b88210_88%,   // 다크 골드
  #3d2406_100%)] // 흑갈
shadow-[0_0_28px_rgba(255,200,30,0.55),0_14px_32px_rgba(195,135,15,0.45)]
ring-2 ring-[#fff0ad]/70
```
- 6-stop metallic gradient (흑갈→다크골드→밝은골드→다크골드→흑갈)
- 강한 golden glow (28px blur radius)
- double ring 효과
- 컴팩트 라벨 "✦ 미개봉"

### mint — "S급 Emerald-Gold"
```
border-[#ecd37b]/95
bg-[linear-gradient(135deg,
  #071f19_0%,    // 깊은 흑녹
  #104434_42%,   // 다크 emerald
  #1d6b50_60%,   // emerald
  #e6c268_88%,   // gold
  #fff0ad_100%)] // 밝은 골드
shadow-[0_0_22px_rgba(230,194,104,0.45),0_12px_30px_rgba(8,48,35,0.40)]
ring-2 ring-[#fff0aa]/65
```
- 5-stop emerald → gold 그라데이션 (강화)
- golden glow + emerald shadow
- 컴팩트 라벨 "★ S급"

## 변경 파일

### `src/components/condition-chip.tsx`
- `PHOTO_BADGE_STYLES.unopened` className 전면 교체 (metallic gold)
- `PHOTO_BADGE_STYLES.unopened` compactLabel `"미개봉"` → `"✦ 미개봉"`
- `PHOTO_BADGE_STYLES.mint` className 강화 (5-stop + double ring)
- `PHOTO_BADGE_STYLES.mint` compactLabel `"S급"` → `"★ S급"`

### `src/components/explore-client.tsx`
- `ConditionPhotoBadge` import 추가
- 카드 사진 영역에 unopened/mint 시 `<ConditionPhotoBadge compact />` 박음
- 메타 영역 ConditionChip 조건: `conditionClass !== "unopened" && conditionClass !== "mint"`

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 시각 위계

```
unopened (전설) — 메탈릭 골드 ✦ 미개봉
   ↓
mint (희귀)    — emerald-gold ★ S급
   ↓
clean          — "깨끗한 편" (텍스트 sky chip)
normal         — "상태 보통" (텍스트 zinc chip)
worn           — "사용감 있음" (텍스트 orange chip)
low_batt       — "배터리 약함" (텍스트 yellow chip)
flawed         — "하자 있음" (텍스트 rose chip)
```
