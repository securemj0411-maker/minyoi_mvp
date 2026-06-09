# Wave 1231 — GA4 설치 + 회원가입 전환 이벤트 (구글애즈 전환추적)

날짜: 2026-06-09 (KST)
계기: owner — 구글애즈 회원가입 전환추적 설치. 구글 새 전환설정이 GA4를 필수로 요구(수동 코드 경로 막힘) → owner가 GA4 속성 생성 → 측정ID `G-Z2KRCXE0LK`.

## 배경
- 광고 14 콜드클릭 → 가입 0 → OAuth 시도 0(랜딩에서 이탈). 구글 전환 입찰로 가려면 전환 데이터가 필요.
- 구글애즈 신 전환플로우 = GA4 이벤트 기반. GA4 속성 만들고 `sign_up` 이벤트를 사이트에서 발사하는 방식으로.

## 적용
- `src/app/layout.tsx` `<head>`: GA4 gtag.js (`G-Z2KRCXE0LK`) + config 주입. (raw `<script>`, 기존 카카오/테마 스크립트 패턴과 동일.)
- `src/components/gtag-signup-tracker.tsx` (client, 신규): URL `?signup=new` 감지 시 `gtag('event','sign_up')` **1회** 발사 + URL 정리(중복 방지). gtag 로드 retry(최대 5s).
- `src/app/auth/callback/route.ts`: `exchangeCodeForSession` 후 `authUser.created_at` 이 **2분 내면 신규가입** → finalNext 에 `?signup=new` 부착. **기존 회원 로그인은 안 붙음**(created_at 오래됨) → "로그인/가입 경계 없음" 문제 해결.
- layout `<body>`: `<GtagSignupTracker />` 전역 렌더(어느 페이지 착지하든 감지).

## 동작
- **신규 가입**: 카카오 OAuth → `/auth/callback`(신규 판정) → `/plans?signup=new` → GtagSignupTracker가 GA4 `sign_up` 발사 → GA4 수집.
- **기존 로그인**: `?signup=new` 없음 → 발사 안 함.

## 검증
- dev:3000: gtag.js(`G-Z2KRCXE0LK`) 로드 + config 렌더 확인. tsc 47(= baseline, tests/), 내 파일 0.

## 남은 owner 작업 (가입이 실제로 발생한 뒤)
1. GA4 → Admin → Events → `sign_up` 을 **"key event"** 로 표시.
2. GA4 속성 ↔ 구글애즈 **링크** (GA4 Admin → Product links → Google Ads links).
3. 구글애즈에서 `sign_up` key event 를 **전환으로 import**.
4. 전환 10~30개 쌓이면 캠페인 입찰을 **"전환 최대화"** 로 전환.

## 후속 / 주의
- **프라이버시**: GA4 = 분석 쿠키·추적. `/privacy` 에 "분석도구(Google Analytics) 사용·접속기록 수집" 고지 권장(PIPA). (mvp_ad_visits IP 수집과 함께 묶어서.)
- 이메일 autoconfirm 가입(즉시 세션, 콜백 우회 케이스)은 미커버 — 주 동선이 카카오라 minor. 필요 시 auth-form 에 동일 플래그 추가.
