# 2026-05-19 Wave 358 — /me 빈공간 + sticky CTA + 모달 슬라이드 + 상세 사진 확대

사용자 요청 (한 메시지에 5가지):
1. /me 하단 빈 공간 처리 (매물 적을 때 푸터까지 white space)
2. "다른 매물 찾기" 데스크탑도 sticky bottom (현재 mt-6 위치 어색)
3. 🔍 이모지 → SVG
4. CTA 가시성 강화
5. Refresh Modal 재설계 — AI톤 X, 사이트 톤 + 위계 + CTA 살리기 + 슬라이드 업 애니메이션
6. 상세 페이지 (PackRevealModal) 사진 더 크게

## 결정

### 1. 빈 공간 — "다음 라운드" 안내 카드
매물 그리드 끝에 inline 카드:
- HourglassIcon + emerald 동그라미
- canRefresh / cooldown 상태별 메시지
- stats.freshLocked > 0 시 paywall 예고 줄 추가

### 2. Sticky CTA
- 모바일: 기존 `fixed bottom-4` FAB 유지
- 데스크탑: `mt-6 hidden sm:flex` → `sticky bottom-4 z-20 mt-6 hidden sm:flex` (스크롤 끝까지 따라옴)

### 3. 🔍 이모지 → SVG
- `<SearchIcon className="h-4 w-4" />` (icons.tsx에 이미 존재)
- 라벨: "🔍 다른 매물 찾기" → "다른 매물 찾기" + icon prefix

### 4. CTA 가시성
- 모바일 FAB:
  - text-sm → **text-base**
  - py-3 → **py-3.5**
  - shadow `0_16px_34px_rgba(34,49,39,0.28)` → **`0_20px_44px_rgba(34,49,39,0.38),0_4px_12px...`** (이중 shadow)
  - `ring-1 ring-white/10` 추가
- 데스크탑 sticky:
  - px-5 → **px-6**
  - py-2.5 → **py-3**
  - shadow 강화 (`0_16px_34px ... `) + hover translate

### 5. Refresh Modal 재설계

**애니메이션:**
- 상태: `refreshModalAnimating` boolean
- 진입: mount → `requestAnimationFrame` → animating=true → CSS `translate-y-0 opacity-100`
- 종료: `closeRefreshModal()` → animating=false → CSS `translate-y-full opacity-0` → 250ms 후 unmount
- 모바일: bottom sheet slide-up
- 데스크탑: scale-95 + translate-y-4 → 정상

**디자인 (사이트 톤):**
- 배경: `bg-[var(--brand-cream)]` (사이트 시그니처 컬러)
- backdrop: `bg-black/60 backdrop-blur-sm`
- 모바일 grab handle (위 1px × 10px zinc-300 둥근 막대)
- 모서리: `rounded-t-3xl` 모바일 / `sm:rounded-3xl` 데스크탑

**위계:**
- 헤더: text-xl 큰 타이틀 + text-sm 부제 + close X 버튼 (hover 효과)
- 메인 CTA (무료 30개): `bg-[var(--brand-accent-strong)]` 큰 버튼 (px-5 py-4) + 화살표 아이콘 + group-hover translate
- 보조 (크레딧 맞춤): amber-50/50 카드, 작고 차분하게
- Footer: zinc-500 hint

### 6. 상세 페이지 사진 확대

| 화면 | wave 357 | wave 358 |
|---|---|---|
| 모바일 (< sm) | h-[210px] full | **h-[290px] full** |
| sm | 180×180 | **240×240** |
| lg+ | 220×220 | **280×280** |

`sizes` prop도 일관 갱신 (240px, 280px).

## 변경 파일

### `src/components/explore-client.tsx`
- import: `SearchIcon, GiftIcon, TargetIcon, HourglassIcon` 추가
- state: `refreshModalAnimating` 신설 + `closeRefreshModal` helper
- useEffect: open 시 `requestAnimationFrame` → animating true
- 매물 grid 다음에 "다음 라운드" 안내 카드 (HourglassIcon + cooldown + paywall)
- 모바일 FAB: text-base + shadow 강화 + SearchIcon
- 데스크탑 sticky: `sticky bottom-4` + 강한 shadow + SearchIcon
- 모달 전체 재설계: bottom sheet, slide-up, brand-cream 배경, 헤더 위계, 메인 CTA + 보조 카드

### `src/components/pack-reveal-modal.tsx`
- `RevealProductImage` 사진 컨테이너 크기 클래스 + sizes prop 갱신 (210/180/220 → 290/240/280)

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗
- 모달 mount/animation race: `cancelAnimationFrame` cleanup으로 안전
- 모달 close timer: `clearTimeout` cleanup

## 톤 가이드

- 이모지 prefix (🔍🎲🎯💡) 신중 사용 — CTA엔 SVG, 안내문엔 OK
- 모달 = 사이트 톤 (`var(--brand-cream)` 배경) + 위계 (메인 CTA 가장 강조)
- 애니메이션은 부드럽고 빠르게 (250-300ms, ease-out)
