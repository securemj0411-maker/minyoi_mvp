# 2026-05-19 Wave 356 — unopened/mint 배지 미니멀 럭셔리로 재설계

사용자 지적: "미개봉이랑 S급 너무 촌스러워 디자인"

## 원인 분석

Wave 355에서 박은 디자인이 노골적인 RPG 게임 톤:
- 6-stop metallic gradient (#1a0d02 → #5a3a06 → #d4a020 → #fff0a8 → #b88210 → #3d2406)
- 강한 골드 glow (`0_0_28px rgba(255,200,30,0.55)`)
- double ring (`ring-2 ring-[#fff0ad]/70`)
- ✦/★ 심볼 prefix

→ 90년대 PowerPoint 워드아트 톤. 미뇨이 일반인 사용자 UI에 안 맞음.

## 결정

**모던 미니멀 럭셔리** — Apple/Linear/Stripe 톤 참고:
- 어두운 단색 배경 (zinc-950) — 사진 어떤 색에도 contrast 확보
- 가는 액센트 보더 (amber-400/40 또는 emerald-400/40)
- 액센트 색 텍스트 (amber-200 또는 emerald-200)
- 부드러운 검정 shadow — glow 제거
- 심볼 prefix 제거 — 라벨만 깔끔하게

## 디자인 비교

### Wave 355 (촌스러움)
```css
border-[#ffd86b]/95
bg-[linear-gradient(135deg, 6-stop)]
shadow-[0_0_28px..., 0_14px_32px...]
ring-2 ring-[#fff0ad]/70
compactLabel: "✦ 미개봉"
```

### Wave 356 (모던 럭셔리)
```css
border-amber-400/40
bg-zinc-950/95
text-amber-200
shadow-[0_4px_12px_rgba(0,0,0,0.25)]
compactLabel: "미개봉"
```

## 변경 파일

`src/components/condition-chip.tsx` — `PHOTO_BADGE_STYLES.unopened` + `PHOTO_BADGE_STYLES.mint` 전면 교체:
- 그라데이션 → 단색 zinc-950
- glow → 부드러운 검정 shadow
- double ring → 가는 단일 보더
- ✦/★ 심볼 제거

## 시각 위계

- **unopened**: zinc-950 + amber-200 = 골드 액센트 (전통적 "프리미엄")
- **mint**: zinc-950 + emerald-200 = 에메랄드 액센트 (S급 = 깨끗함)

두 배지 구조 동일 + 색만 다름 → 일관성 + 색으로만 미묘 위계.

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗
