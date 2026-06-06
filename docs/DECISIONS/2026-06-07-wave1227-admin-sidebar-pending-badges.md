# Wave 1227 — 관리자 사이드바 대기-건수 뱃지

날짜: 2026-06-07 (KST)
계기: owner — "왼쪽 네비에서 상담/입금확인 등 뱃지로 몇 건인지 보여줘야 현실적이지 않냐." (운영 콘솔 기본기)

## 적용
- 신규 `GET /api/admin/nav-counts` (auth: requireSupabaseUser + isAdminUser). count=exact 4쿼리(인덱스, 가벼움):
  - depositRequests = mvp_membership_applications (status=pending & deposit_confirmed_at not null) — 입금했어요 누른 멤버십
  - manualDeposits = mvp_manual_deposit_requests (status=pending)
  - openSupport = mvp_support_conversations (status=open)
  - pendingFeedback = mvp_user_feedback (status=pending)
- `_ui/shell/nav.ts`: NavBadgeKey/NavCounts 타입 + 4개 항목에 badge 키(멤버십 입금확인/수동입금/고객상담/손해신고).
- `_ui/shell/AdminShell.tsx`: `/api/admin/nav-counts` 30초 폴링(usePolling, 숨김탭 pause) → navCounts state → 데스크탑+모바일 Sidebar 에 전달.
- `_ui/shell/Sidebar.tsx`: 항목 우측에 카운트 뱃지(>0 일 때만, bg-rose-500, 99+ 클램프, aria-label "대기 N건").

## 검증
- tsc cau/_ui/nav-counts 0 에러(베이스라인 47=tests/).
- 실 스키마/데이터 확인(execute_sql): deposit 0 · manual 0 · **open_support 8** · feedback 0 → 상담 뱃지 8 정상 표시, 나머지 0(미표시). 컬럼/테이블명 정확.
- next build ✓ Compiled (EXIT 0).

## 비고
- 비용: admin 탭당 30초 4 count = 무시할 수준.
- 후속(선택): 상담은 open 대신 admin_unread>0(안 읽은) 기준으로 좁힐 수도. 현재는 "열린 상담" 수.
