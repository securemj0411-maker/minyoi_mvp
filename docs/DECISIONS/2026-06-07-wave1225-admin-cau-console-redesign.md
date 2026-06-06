# Wave 1225 — 관리자(cau) 콘솔 대대적 리디자인

날짜: 2026-06-07 (KST)
계기: owner — "관리자 페이지(cau) 진짜 개 허접한데 대대적으로 바꿔줄수있음?? 직관적이고 유지보수쉽고 위계나 접근성이나 다 완벽하게?"
브랜치: `redesign/admin-cau-console` (origin/main b6de3b90 에서 분기, 전용 worktree). main 미반영 — owner 검토 후 머지.
범위(owner 확정): 레이아웃=**왼쪽 사이드바**, 범위=**전부(단계별 커밋)**. 순수 프레젠테이션 — auth/비즈니스로직/API/난독화경로/한글카피 불변.

## 진단 (Explore×2 + Plan 에이전트)
- nav 2중구조(상단바 라우트6 + 오버뷰 페이지내 해시앵커4) + 서브페이지 "현재위치/뒤로" 없음.
- 공유 UI 0 — Button/Card/Badge/Table/Modal/Toast + 폴링 setInterval(4벌) + KST 포맷터(8벌) + 상태배지 색맵 + 모바일/데스크탑 이중레이아웃을 11개 패널이 각자 재구현.
- 팔레트 톤 튐: 대부분 zinc-950/blue인데 feedback-stats/explore-monitor/detail-events는 slate/sky·light-first(다만 .dark 래퍼로 다크 렌더 — "흰화면" 아님, 액센트 발산). 진짜 라이트 누출=feedback-stats error early-return + manual-deposit light 배지.
- 접근성: text-[8~11px] ~60곳, text-zinc-600/700 on 검정(~3:1 AA fail) ~22곳, 클릭 td/tr/div 키보드/포커스 없음, 모달 2개 Escape/focus-trap 없음, color-only 상태, role=alert/label 누락.
- 고아: manual-deposit-panel(수동입금 승인) 어디에도 미마운트=운영자가 못 봄. /admin/status nav 링크 0.

## 적용 (단계별 — 각 tsc clean + 개별 커밋)
- **P0 (fda5abc6)** 공유 UI 레이어 `CAU_DIR/_ui/` 신설(라우트-프라이빗): tokens(FONT 12px floor·INK muted=zinc-400·SURFACE·TONE·FOCUS·STATUS_TONE) / format(fmtKst·fmtWon·fmtKrwSign·fmtCountdown·secondsUntil·fmtRelativeAge) / hooks(usePolling[숨김탭 pause]·useCountdown·useKstClock·useDialogA11y) / 프리미티브(Button·Panel·SectionHeader·StatCard·StatusBadge·Badge·Notice·EmptyState·Spinner·Table셋·ResponsiveTable·RowButton·Modal·Drawer·Toast). plain className 상수맵(cva/clsx 미도입). 서버-ok(use client 미표기)와 client 분리.
- **P1 (997ebe1a)** 좌측 사이드바 앱 셸 `_ui/shell/`: layout.tsx 서버 유지(auth 22–39 verbatim) → `<AdminShell>{children}</AdminShell>`(children=prop ⇒ 서버페이지 서버렌더 보존, 셸 soft-nav 유지). TopBar(브랜드+KpiTicker[폴링 이전]+Clock+사이트로) + Sidebar(직무별 그룹 nav, usePathname active/aria-current, 모바일 Drawer) + Breadcrumb. admin-top-bar.tsx 삭제. **고아 manual-deposit → /manual-deposit 라우트 복구**(OPS_ADMIN_MANUAL_DEPOSIT_PATH 추가). /admin/status 사이드바 외부링크(↗).
- **P2 (dc084ee3)** 오버뷰 page.tsx: KPI 5개 StatCard화, 중복 4-pill nav 제거(사이드바가 nav 담당, 섹션 id 유지), OpsMetricCard 삭제.
- **P3a (696fb444)** feedback-panel(brief, dead code decide/pendingIds 정리) + manual-deposit-panel(라이트 배지/notice 누출 제거, per-row Countdown).
- **P3b (0e9ffd6f)** feedback-stats(error 라이트누출→Notice, KpiCard→StatCard, sky→blue) + explore-monitor(Stat 토큰화, 카드/error 통일).
- **P4a (d6a1fa00)** membership-applications + support-chat: notice/error→Notice(role=alert), 버튼→Button, 폰트/대비. (날짜포맷·Enter전송 keydown 보존)
- **P4b (0fe21018)** loss-reports + reveal-analytics: 폰트/대비/error→Notice, loss-reports 확장 클릭행 키보드(role=button+Enter/Space+focus-visible).
- **P4c (d263a91a)** members-table: 행/카드 클릭 키보드, 모달 2개(드로어+사진)에 useDialogA11y(Escape+focus-trap+복원+scroll-lock+aria-label), 폰트/대비.
- **P4d (c637bf4e)** detail-events(폰트·sky→blue, #hex 라이트base는 dark override라 보존) + 4 서브페이지 wrapper ▌헤더 폰트.

## 절대 불변 (가드레일 — 준수 확인)
- layout.tsx auth 블록(requireSupabaseUserFromCookies → /login redirect → isAdminUser → notFound) byte-identical. 난독화 경로·honeypot(admin-traps)·기존 admin-routes 상수값.
- 모든 /api/admin/* 라우트 + auth + `x-minyoi-admin-action` 헤더. 데이터/비즈니스로직(reconcile·Promise.all·approveMembershipApplication·KPI·statusLabel·카테고리라벨). 폴링 간격값(5/5/10/30s). force-dynamic/runtime. 한글 카피 verbatim. 날짜 포맷 사이트별 보존.
- 범위 밖: src/components/AdminPoolBrowser 등 대형 공유 컴포넌트 내부(미변경, pool/page 래퍼만).

## 검증
- 각 단계 `tsc --noEmit`: cau/_ui 0 에러(베이스라인 47은 전부 tests/ 기존, 무관).
- a11y grep 스윕: cau 전 패널 text-[<12px] **0**, unguarded text-zinc-600/700 **0**.
- dev(3100) 스모크: 전 8개 admin 라우트 컴파일 성공 + 307 redirect(auth gate 정상), RSC/module 에러 0. P1에서 셸 RSC 경계(server→client AdminShell, children prop) 별도 확인.

## 후속 (선택, owner 결정)
- /admin/status(751줄, 별 layout, 순수 라이트) 다크 재테마 — 이번 deferred(링크만).
- dense 운영 페이지(loss-reports/reveal-analytics/detail-events)의 font-mono·영문 라벨 "터미널톤" 유지 — a11y 중립이라 보존. de-terminal화 원하면 별도.
- 대형 패널(members-table 등) 내부의 잔여 inline 구조를 _ui Table/Modal 컴포넌트로 추가 치환(현재는 a11y+팔레트+고임팩트 컴포넌트만 — 깊은 dedup은 점진).
- 배포: 브랜치 push=프리뷰(prod 미반영). main 머지 시 Vercel prod 배포.
