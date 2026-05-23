# launch-110 — 운영자 페이지 모바일 카드 layout (가로 스크롤 제거)

**Date**: 2026-05-24
**Owner**: caulee
**Scope**: cau admin 패널들 모바일 reflow

## 배경

운영자가 모바일에서 cau 페이지 보면 가로 스크롤 끝까지 가야 승인/거절 버튼 보임:
- `ManualDepositPanel` — `min-w-[900px]` 테이블
- `FeedbackReviewFull` — `min-w-[1100px]` 테이블
- `MembersTable` — 6 컬럼 (좁은 모바일에선 짤림)

사용자 frustration: "모든 게 너무 모바일 친화적이지 않다".

## 변경 (`md` breakpoint dual layout)

3개 패널 모두 모바일은 카드, desktop 은 기존 테이블 유지 (회귀 0).

### ManualDepositPanel (md 미만)
- 입금자명 + 신청 ID + 상태 뱃지 한 줄
- 패키지/금액/남은시간/신청시각 2열 grid
- 승인/거절 버튼 full-width gap-2 (큰 터치 타겟)

### FeedbackReviewFull (md 미만)
- 카테고리 + sold_out 풀 제외 뱃지 + status
- 닉네임 + 이메일 + 매물 ID + 메시지 (max-h-24 scroll)
- approve +20 / reject 풀 너비 버튼

### MembersTable (md 미만)
- 체크박스 + 닉네임 + 잔액 한 줄
- 이메일 + provider + "탭하여 상세" 안내
- 기존 drawer 그대로 (grant/revoke/block)

## 영향

모바일에서 가로 스크롤 없이 한 화면에 액션 버튼 보임. desktop 회귀 0.

## 남은 모바일 작업

- MemberDrawer (회원 클릭 시 열리는 드로어) — 별도 wave 권장
- AdminPoolBrowser (POOL 페이지) — 동일 패턴 적용 가능
- AdminTopBar KPI ticker — 가로 8셀, 모바일 가로 스크롤 (overflow-x-auto 이미 박힘)
