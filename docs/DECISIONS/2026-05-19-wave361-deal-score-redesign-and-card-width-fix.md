# 2026-05-19 Wave 361 — 득템 점수 재설계 + nav 아이콘만 + 카드 width 수정

사용자 3가지 지적:
1. "득템 미터" → **"득템 점수"** 이름
2. 당근 36.8°C는 **우측에 작게** — wave 359의 text-4xl + 큰 박스는 무식
3. nav 버튼이 **흰 카드로 박혀서 사진을 가림** — 당근식은 아이콘 + drop-shadow만, 카드 X
4. 우상 "대시보드" 텍스트 버튼 → **홈 아이콘**
5. /me 카드 hover/click 시 **흰 배경이 텍스트 길이만큼만 차지** (button width 부족)

## 결정

### 1. 득템 점수 — 우측 작은 인라인 (당근 36.8°C 톤)

**이전 (Wave 359)**:
- 카드 위 풀폭 cream 그라데이션 박스
- `text-4xl ... 37.8°C` + 라벨 칩 + thermometer SVG
- 클릭 가능 "득템 미터 — 근거 보기" 큰 라벨

**이후**:
- 매물 제목과 **같은 행 우측** (flex items-start gap-3)
- `text-base font-bold tabular-nums` 작게 (당근식)
- 아래 `text-[10px] underline` "득템 점수" 텍스트 (클릭 가능)
- 클릭 → 제목 행 다음에 4개 근거 패널 인라인 펼침

**구조 분리** (state 충돌 방지):
- `DealMeterButton` — 우측 작은 버튼 (state는 부모가 관리)
- `DealEvidencePanel` — 별도 컴포넌트, expanded 시 렌더
- `RevealCardItem`에 `dealExpanded` useState

### 2. Floating nav — 아이콘만 (카드 제거)

**이전 (Wave 360)**:
- `bg-white/85 backdrop-blur` 둥근 카드 + `ring-1` + shadow
- 우상 "대시보드" 텍스트 pill 버튼

**이후**:
- 카드/배경 **완전 제거** — SVG icon only
- `text-white` + `filter: drop-shadow(0 2px 6px rgba(0,0,0,0.55))` (사진 위 visibility)
- 좌상: chevron-left SVG (h-7 w-7)
- 우상: **home SVG** (h-6 w-6) — "대시보드" 텍스트 X
- `active:scale-90` 마이크로 인터랙션

### 3. 카드 button width — `w-full` 추가

**원인**: button 기본 `display: inline-block` + `display: grid` 적용해도 width는 content-sized. 부모 div가 grid 아니면 (모바일 divide-y만) 자식 button이 row 전체 width 안 채움.

**증상**: 카드 active 상태에서 `bg-zinc-50` 적용되는 영역이 텍스트 길이까지만. 우측 흰 공간이 카드 밖.

**수정**: `className`에 `w-full` 추가 (`grid w-full grid-cols-[120px_minmax(0,1fr)]`).

## 변경 파일

### `src/components/pack-reveal-modal.tsx`
- `DealMeter` 컴포넌트 → `DealMeterButton` + `DealEvidencePanel` 두 개로 분리
- `RevealCardItem`에 `dealExpanded` useState 추가
- 매물 제목 행을 `flex items-start gap-3`로 변경, 우측에 `<DealMeterButton />`
- 제목 행 다음에 `{dealExpanded ? <DealEvidencePanel /> : null}`
- floating nav 좌상/우상 둘 다 `bg`/`ring`/`backdrop-blur` 제거 → `text-white` + `drop-shadow` filter
- 우상 텍스트 "대시보드" → home SVG (path d="m3 9 9-7 9 7v11... + M9 22V12h6v10")

### `src/components/explore-client.tsx`
- 카드 button className에 `w-full` 추가 (grid + w-full)

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 시각 비교

### 득템 점수
```
이전:
┌─────────────────────────┐
│  37.8°C  [강추]    🌡  │
│  득템 미터 — 근거 보기 ▾│
└─────────────────────────┘
[매물 제목]

이후:
[매물 제목 좀 김 (flex-1)]  37.8°C
                             득템 점수 (underline)
[펼치면 4줄 근거]
```

### Nav
```
이전: [흰 카드 ←]      [brand 카드 "대시보드"]
이후: ←                                       🏠
      (흰 stroke + 검은 drop-shadow)
```
