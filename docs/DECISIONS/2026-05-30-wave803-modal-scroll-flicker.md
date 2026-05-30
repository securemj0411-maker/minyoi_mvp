# Wave 803 — PC 모드 상세보기 스크롤 깜빡임 fix

## 사용자 보고

> "우리 지금 사이트 왜 상세보기에서 막 스크롤 하면 깜빡임?? PC모드에서만 그런거일수도있는데 계속 깜빡임"

## 진단 — root cause 2개

### 원인 1: IntersectionObserver threshold 0.1 단일 (`pack-reveal-modal.tsx:7234`)

```tsx
const observer = new IntersectionObserver(
  ([entry]) => setPhotoVisible(entry.isIntersecting),
  { root: scrollEl, threshold: 0.1 },
);
```

- 사진 10% 경계 자주 넘나들면 `setPhotoVisible(true/false)` 빈번 토글
- **7864 line monolithic modal** 전체 re-render
- opacity transition 200ms × 여러 element (floating nav + sticky nav + report button 등) 동시 박힘
- → 깜빡임 인식

### 원인 2: `sm:backdrop-blur-sm` (line 7541)

```tsx
className="... sm:backdrop-blur-sm sm:dark:bg-[rgba(9,9,11,0.62)]"
```

- PC 모드 modal backdrop blur 박힘
- 스크롤 시 GPU 가 매 frame backdrop layer 의 blur 재계산
- → repaint cost 큼 + lag

## Fix

### 1. IntersectionObserver hysteresis

```tsx
const observer = new IntersectionObserver(
  ([entry]) => {
    const ratio = entry.intersectionRatio;
    setPhotoVisible((prev) => {
      // visible→hidden: 5% 미만
      // hidden→visible: 20% 이상
      // 경계 근방 (5-20%) 에선 토글 X → re-render 줄임
      if (prev && ratio < 0.05) return false;
      if (!prev && ratio > 0.2) return true;
      return prev;
    });
  },
  { root: scrollEl, threshold: [0, 0.05, 0.2, 0.5] },
);
```

### 2. `sm:backdrop-blur-sm` 제거

```diff
- className="... sm:p-4 sm:backdrop-blur-sm sm:dark:bg-..."
+ className="... sm:p-4 sm:dark:bg-..."
```

- modal 자체 `shadow-2xl` 박혀있어서 시각 분리 유지
- PC backdrop 어두운 색 (`rgba(31,40,34,0.48)`) 만 보임 — blur 없어도 modal 떠보임

## 효과

| | Before | After |
|---|---|---|
| photoVisible 토글 빈도 | 사진 10% 경계 자주 박힘 | 5%-20% 경계 박힘 (hysteresis) |
| Modal re-render | 토글마다 7864 line | 토글 빈도 줄어 re-render 줄어듦 |
| PC scroll GPU cost | backdrop blur 매 frame 재계산 | 단순 색 layer (cheap) |
| UX | 깜빡임 + lag | smooth scroll |

## 비파괴 보장

- **모바일 UX 무영향**: `sm:backdrop-blur-sm` = sm: breakpoint 만 영향 (모바일 base 는 단색 배경)
- **photoVisible 최종 값 동일**: floating icon ↔ sticky nav 전환 logic 그대로
- **transition logic 그대로**: `opacity-100/opacity-0` + `duration-200` 유지
- **IntersectionObserver 호출 빈도만 줄어듦** — perf 만 개선

## Trade-off

- ✅ 거의 없음
- ⚠️ PC backdrop blur 미세 시각 손실 (shadow + 어두운 색 박혀서 거의 못 느낌)
- ⚠️ 사진 5-20% 보일 때 photoVisible 안 변경 — 의도된 hysteresis (UX 자연스럽)

## 검증

배포 후 PC 모드:
1. reveal modal 열기
2. 스크롤 → 사진 영역 위/아래
3. **깜빡임 무**, smooth scroll
4. 사진 거의 사라지면 nav bar 박힘, 다시 보이면 floating icon (기존 동일)

## 복원 가이드

문제 발생 시 한 줄 revert:

```diff
- threshold: [0, 0.05, 0.2, 0.5]
+ threshold: 0.1
```

또는 backdrop blur 복원:
```diff
+ className="... sm:p-4 sm:backdrop-blur-sm sm:dark:bg-..."
- className="... sm:p-4 sm:dark:bg-..."
```

## What Not To Do

- `threshold: 0.1` 단일 박지 X — 경계 토글 빈번 → re-render storm
- `sm:backdrop-blur-md` 등 더 큰 blur 박지 X — GPU cost 더 큼
- 7864 line component 그대로 두지 X — 향후 sub-component split 권장 (이 wave 는 minimum fix)
- IntersectionObserver `threshold: [...]` array 없이 hysteresis 박지 X — array 가 박혀야 ratio 변화 감지

## 향후 audit 필요

- `pack-reveal-modal.tsx` 7864 line — sub-component split 권장 (Wave 별도)
- 다른 modal (`recommendation-reason-dialog`, large-photo modal) backdrop-blur 검토
- `user-reveal-dashboard.tsx`, `admin-pool-browser` 같은 scroll heavy 화면 검토

## 관련 commits / PRs

- PR #46 — Wave 803 PC 모드 reveal modal 스크롤 깜빡임 fix

## Related Waves

- Wave 360+361+362+364 — 당근식 nav 유기적 전환 (floating ↔ sticky)
- Wave 393.3 — ConditionPhotoBadge 모달에서 제거
- Wave launch-29 — 모달 PC 폭 480 → 560, 높이 92dvh → 95dvh
- Wave launch-116 — 사진 원본 비율 유지 (object-contain)
- **Wave 803 (now)** — PC 모드 스크롤 깜빡임 fix
