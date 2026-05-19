# 2026-05-19 Wave 360 — 모달 nav 사진 위 floating (당근식)

사용자 영감: 당근 캡쳐 — 별도 nav bar 없이 뒤로가기 / 홈 / 공유가 사진 좌상/우상에 floating으로 박힘. 수직 공간 절약.

## 결정

### 기존 sticky nav bar 제거 → absolute floating
**이전**:
```tsx
<div className="sticky top-0 ... border-b ... bg-[#fffdf9]/95 backdrop-blur px-2.5 py-1.5">
  <div className="flex min-h-8 items-center justify-between gap-3">
    <button ←></button>
    <button>대시보드</button>
  </div>
</div>
```
모달 상단 ~44px 영역을 nav bar로 차지.

**이후**:
```tsx
{/* 모달 컨테이너 className에 "relative" 추가 */}
<button className="absolute left-3 top-3 z-20 ..." aria-label="상세 닫기">
  <svg /> {/* chevron-left */}
</button>
<button className="absolute right-3 top-3 z-20 ...">대시보드</button>
```
사진 영역이 모달 top까지 full bleed. nav 두 개가 좌상/우상 floating.

### 디자인
- 좌상 ←: `bg-white/85 backdrop-blur` + `ring-1 ring-black/5` + `shadow-[0_4px_14px_rgba(0,0,0,0.18)]` (어두운 사진 위에도 잘 보임)
- 우상 대시보드: `bg-[var(--brand-accent-strong)] text-cream` 사이트 시그니처 컬러 + 같은 shadow
- 모바일: `left-3 top-3` / 데스크탑: `sm:left-4 sm:top-4`
- 활성 시 `active:scale-95` 마이크로 인터랙션
- 둘 다 `h-9` 통일 사이즈
- 이모지 ✕ → chevron-left SVG

### 스크롤 안전성
- nav는 **모달 컨테이너 (relative) 기준 absolute** — scroll 영역 밖
- 사용자가 매물 정보 스크롤해서 사진이 화면 밖 나가도 nav는 모달 box 상단에 머무름
- 모달 컨테이너 자체는 scroll 안 함 (scroll은 내부 `scrollAreaRef`)

### 닫기 동선
- 좌상 ← (back)
- 우상 "대시보드" 버튼
- 좌측 backdrop 클릭 (이미 있음)
- ESC 키 (이미 있음)
- refunded 분기 안 "닫기" (이미 있음)

## 변경 파일

`src/components/pack-reveal-modal.tsx` (line 3128~3160):
- 모달 컨테이너 className에 `relative` 추가
- sticky nav bar div 제거 → 두 개 absolute button으로 대체
- ← 이모지 → chevron-left SVG
- 사이즈 통일 (h-8 → h-9), padding 통일

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 효과

- 모달 상단 ~44px 수직 공간 회수
- 사진이 full bleed로 더 임팩트 있게 보임
- 모바일 좁은 화면에서 매물 정보가 더 위로 올라옴 (스크롤 덜 필요)
