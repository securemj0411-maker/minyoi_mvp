# 2026-05-17 — 브랜드명 미뇨이 → 차익잡이 변경 (프론트엔드)

## 사용자 결정

- 사이트 이름 brainstorm 후 "차익잡이" 선택
- 선택 이유: 차익(사용자 이익) + 잡이(순한국어, 낚시잡이/멸치잡이 톤) = 친근 + 캐릭터화 가능
- 4자, 100% 한국어, 일반인 친화

## 검토한 후보 (참고)

- 호갱노노 패러디: 노호갱, 호구나라, 호구반값
- MZ 슬랭: 떡락나라, 떡락AI, 떡락캐처
- 차익 시리즈: 차익AI, 차익나라, 차익팩, 차익픽
- 캐처/잡이: 차익잡이 ⭐, 떡락잡이, 마진잡이
- 영문 (어려움 X): Trove, Loot, Snap (제외)
- 점유 확인 제외: 콕딜 (건축자재+보험), 줍줍 (joobjoob.co.kr), 노다지 (nodaji.net), 콕콕 (콕콕티비/직구)

## 변경 범위

### 프론트엔드 UI 텍스트 (20 파일, 56 occurrences "미뇨이" + 1 "Minyoi Account")

`perl -i -pe 's/미뇨이/차익잡이/g'` 일괄 치환:

- `src/app/layout.tsx` — SITE_NAME, marquee 코멘트
- `src/app/privacy/page.tsx` — title "차익잡이 개인정보처리방침"
- `src/app/refund-policy/page.tsx` — body + title
- `src/app/plans/layout.tsx` — description
- `src/app/youth-policy/page.tsx` — title
- `src/app/how-it-works/page.tsx` — description, body, svg aria-label, table 헤더
- `src/app/terms/page.tsx` — body + title
- `src/app/admin/status/page.tsx` — h1 "차익잡이 진행 현황"
- `src/app/billing/checkout/checkout-client.tsx` — h1 + row label
- `src/components/app-nav.tsx` — 헤더 로고 (3 곳)
- `src/components/dashboard.tsx` — 헤더 로고
- `src/components/preview-masked-dashboard.tsx` — h1 + 소개
- `src/components/safety-stats-marquee.tsx` — "오늘 차익잡이 AI가 차단한 상품 수"
- `src/components/auth-form.tsx` — 소개 텍스트 + "Minyoi Account" → "차익잡이"
- `src/components/playbook-overview.tsx` — 가이드 텍스트 (4 곳)
- `src/components/app-footer.tsx` — 상호명, 서비스명 (mock)

### 시스템 영역 (UI 노출되는 메시지)

- `src/app/api/me/account/delete/route.ts` — 탈퇴 응답 메시지
- `src/app/api/telegram/webhook/route.ts` — 텔레그램 봇 메시지 (3 곳)
- `src/lib/hotdeal.ts` — 핫딜 텍스트
- `src/lib/operational-notifier.ts` — 운영 알림 prefix

### 변경 X (영향 큼, 별도 작업 필요)

- **storage key**: `minyoi-theme-v1`, `minyoi-candidate-actions-v1`, `minyoi-user-ref-v1`, `minyoi-onboarding-dismissed-v1`, `minyoi-hide-high-profit-warning-v1` — 변경 시 기존 사용자 localStorage 데이터 손실
- **event name**: `minyoi:credits-changed` — listener 도 동시 변경 필요
- **global key**: `__minyoiCronGuard` (cron-guard.ts)
- **도메인**: `minyoi-mvp.vercel.app` (robots.ts, sitemap.ts, hotdeal.ts)
- **이메일**: `help@minyoi.kr` (privacy, refund-policy, youth-policy, app-footer)
- **how-it-works.tsx 객체 key**: `row.minyoi` (UI 노출 X, dev only)

## 검증

- `grep "미뇨이"` 잔존: **0건** ✅
- `npm run test:core` → 288/288 pass ✅

## 다음 (별도 작업)

- 도메인/이메일/스토리지 키 변경 — 사용자 영향 큼, 마이그레이션 계획 필요
- 로고/SVG 디자인 (현재 텍스트 로고만)
- favicon 변경
- OpenGraph 이미지 변경
- Vercel 도메인 변경 (chaikjabi-mvp.vercel.app 등)

## 위험

- footer "상호명: 차익잡이" → 실제 법인명이 다르면 법적 표기 정정 필요. 현재 footer mock (코멘트 명시).
- "Minyoi" 영문 표기 → 영문 브랜드명 결정 필요 (Chaikjabi / Chaikjab / 다른 변형?)
