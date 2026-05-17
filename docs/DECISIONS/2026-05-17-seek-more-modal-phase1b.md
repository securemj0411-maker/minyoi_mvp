# 2026-05-17 "더 찾아보기" — view switch → 모달 (Phase 1b)

## 사용자 지적

> "그리고 더 찾아보기하면 모달식으로 열려야지 ;; 왜 아예 다른 페이지처럼 나오는거지"

Phase 1a 박을 때 view switch (`setActiveView("recommend")`) 로 박았는데, 사용자 처음 명시 = "모달". Phase 1b 박음.

## 박은 변경

`src/components/me-dashboard-client.tsx`:
- recommend view section 폐기 (페이지 전환 X)
- `seekMoreOpen: boolean` state 추가
- "더 찾아보기" 클릭 → `setSeekMoreOpen(true)` → fixed inset-0 모달 띄움
- 모달 안에 OnboardingBanner + SafetyStatsBadge + RecommendationWorkspace 그대로
- ✕ 버튼 (right-top absolute) + backdrop 클릭 닫힘
- max-w-4xl + scroll (overflow-y-auto)

## Nested modal 동작

- RecommendationWorkspace 가 자체적으로 PackRevealModal 띄움
- 모달 안에 모달 (nested) — z-index 분리로 정상 작동
- 카드 뽑기 진행 시:
  1. 더 찾아보기 모달 열림 (z-40)
  2. 카드 뽑기 버튼 클릭
  3. PackRevealModal 띄움 (자체 z-index 가 더 높음 — pack-reveal-modal 내부 fixed)
  4. reveal 끝나면 PackRevealModal 닫힘
  5. 더 찾아보기 모달은 그대로 (계속 카드 뽑기 가능)

## 옛 deeplink 처리

- `?view=recommend` URL → history view 로 자연 fallback (recommend 분기 폐기됨)
- 모달 자동 open X (사용자 의도 = 명시적 클릭만)

## Test

288/288 pass.

## Commit

- 코드 변경이 다른 세션 commit (`0e5c8a6` Wave 159e detail-worker invalidate) 에 squash 됨 (worktree 환경 특성)
- 변경 검증: `grep "seekMoreOpen"` 코드 박힘 확인
- 이미 push 됨 (origin/main)
