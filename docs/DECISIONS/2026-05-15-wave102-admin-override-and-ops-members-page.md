# Wave 102~103 — admin Pro override 제거 + 운영자 회원 페이지

> Status: **applied (code + migration + UI).** owner 지적으로 빠뜨린 결정 일괄 박음. admin 강제 Pro UI 혼란 해소 + 운영자가 회원 현황/플랜/베타 승격 한 화면에서 처리.

CLAUDE.md 6 필드 포맷.

## 1. /me 페이지 상품 보기 외부 링크 제거 + 다시 보기 → 상품 보기

- 시간: 2026-05-15 (commit dc7f0bd)
- 발견: owner 지적 — "다시 보기" 모달 안에 이미 번개장터 직링크 있어서 외부 직링크 버튼 중복. UX 압축 필요.
- 변경:
  - **[mvp/src/components/user-reveal-dashboard.tsx:354](mvp/src/components/user-reveal-dashboard.tsx:354)**
  - "다시 보기" 버튼 텍스트 → **"상품 보기"** rename
  - 기존 `<a href={item.url}>` 외부 직링크 버튼 제거 (line 363-370 삭제)
  - 액션 버튼 3개 → 2개 (상품 보기 / 공략 보기)
- 검증: tsc clean, 139/139 test pass
- 위험: 없음. 모달 안에 번개장터 link 살아있음.
- 다음: 없음.

## 2. /me 운영자 풀 default sort = newest_added

- 시간: 2026-05-15 (commit 671bcd4)
- 발견: owner 지적 — 운영자는 신규 진입 매물 검토가 주된 동선인데 매번 "최신순" 토글해야 함.
- 변경: **[mvp/src/components/admin-pool-browser.tsx:92](mvp/src/components/admin-pool-browser.tsx:92)** `useState("profit_high")` → `useState("newest_added")`
- 검증: tsc clean
- 위험: 없음.
- 다음: 없음.

## 3. admin Pro override 제거 — 본인 선택 플랜대로 UI 표시 (commit e945edd)

- 시간: 2026-05-15
- 발견: owner 지적 — 요금제 페이지에서 플랜 변경했는데 admin이라 강제 Pro로 보임. "다 따로 노는 느낌". `getProStatus`가 `isAdminUser` 시 무조건 `isPro: true` 반환 (Wave 93b 코멘트: "개발/운영 테스트 편의").
- 변경:
  - **[mvp/src/lib/user-subscription.ts](mvp/src/lib/user-subscription.ts)** `getProStatus()`에서 admin override 제거 + `isAdminUser` import 제거 + type union에서 `"admin"` source 제거.
  - **[mvp/src/components/me-dashboard-client.tsx:227](mvp/src/components/me-dashboard-client.tsx:227)** hotdeal-alerts 탭 표시 조건: `isPro` → `isPro || isAdminUser(user)`. admin은 본인 플랜과 무관 항상 표시.
- 검증:
  - `npx tsc --noEmit` clean
  - `npm run test:core` 139/139 pass
  - `getProStatus` 호출처 grep: `/api/me/subscription` 1곳만 (UI 표시). 권한 체크는 `isAdminUser` 직접 호출이라 admin 기능 access 유지.
- 위험: 매우 낮음.
  - admin이 free 플랜 선택 시 일부 UI가 free로 보임 — 의도된 동작.
  - 모든 권한(pack open / credits / hotdeal API)은 `isAdminUser` 별도 호출이라 admin 무한 access 유지.
- 다음: 없음 (admin 외 사용자에는 영향 0).

## 4. 운영자 회원 목록 페이지 신설 (commit d36b3fe / cd1b4e8 / e8758fc / ad03fe4)

- 시간: 2026-05-15
- 발견: owner 요청 — `/admin`과 별개로 회원 현황 모니터링 페이지. URL obfuscation + admin guard 이중 보호.
- 변경:
  - **Path**: `/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY`
    - owner 입력 원본에서 특수문자(`*&^()`) 제거 (Next.js routing 깨짐). 영숫자만 사용.
  - **새 파일**:
    - `src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/page.tsx` — server component, admin guard
    - `src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/members-table.tsx` — client component (table + 베타 토글)
    - `src/app/api/admin/beta-tester/route.ts` — POST API
  - **보호 체계**:
    - 비admin 접근 → `notFound()` 반환 (404. URL 존재 자체 노출 X)
    - admin만 페이지 렌더링
  - **표시 컬럼**:
    - 닉네임 (카카오 OAuth `user_metadata.name` 우선 / `full_name` / `preferred_username` / `nickname` fallback)
    - 이메일
    - 플랜 배지 (Free 회색 / Starter 파랑 / Plus 녹색 / Pro 황금)
    - 플랜 만료, 일일 사용, 최근 결제 (시점 + 금액)
    - 가입일, 마지막 로그인
    - 크레딧 잔액
    - 베타 체험단 토글 버튼 (보라색)
    - provider (kakao / email)
  - **상단 통계**: 전체 인원 / Pro / Plus / Starter / 베타 체험단 / 최근 7일 로그인
  - **데이터 source**:
    - `auth.users` (Supabase admin endpoint `/auth/v1/admin/users?per_page=200&page=N`)
    - `mvp_user_credits` (balance, free_grant_tokens, pro_until, is_beta_tester)
    - `mvp_user_plans` (plan_key, status, current_period_end, daily_used_count, last_payment_at, last_payment_amount)
    - `auth_user_id`로 3 way join (in-memory Map)
- 검증: tsc clean.
- 위험: 낮음.
  - URL obfuscation은 1차 방어선일 뿐. admin guard가 진짜 방어.
  - 회원 이메일/닉네임 = PII. 미뇨이 1인 운영이라 owner 본인이 보는 데이터.
- 다음:
  - 회원 수 200+ 넘어가면 페이지네이션 필요 (현재 20페이지 × 200건 = 4000건까지 client-side 표시).
  - 검색/필터 (플랜별/베타별)는 다음 wave에서.

## 5. mvp_user_credits 마이그레이션 — is_beta_tester column 추가

- 시간: 2026-05-15
- 발견: owner 요청 — 회원을 베타 체험단으로 승격하는 토글 버튼. 권한 부여 내용은 미정 (이따 정의 예정).
- 변경: migration `add_is_beta_tester_to_user_credits`
  ```sql
  ALTER TABLE mvp_user_credits
    ADD COLUMN IF NOT EXISTS is_beta_tester boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS beta_tester_granted_at timestamptz;
  ```
  - DEFAULT false → 기존 row 영향 0.
  - column comment: "Wave 102: 베타 체험단 권한. admin이 수동 승격. 권한 내용은 미정."
- 검증: `mcp__supabase__apply_migration` success.
- 위험: 매우 낮음. 새 컬럼 추가 (기존 정합성 영향 0). RLS 변경 없음 (table-level RLS 그대로).
- 다음:
  - **권한 부여 내용 owner 정의 대기**. 예: 핫딜 알림 우선 / 추천 슬라이더 1시간 기능 / 알파 기능 access 등.
  - `is_beta_tester=true` 회원을 어떤 코드 path에서 check할지 정하면 그때 박음.

## 6. API: POST /api/admin/beta-tester

- 시간: 2026-05-15
- 발견: 토글 버튼이 호출할 endpoint 필요.
- 변경: **[mvp/src/app/api/admin/beta-tester/route.ts](mvp/src/app/api/admin/beta-tester/route.ts)** (신규)
  - admin only (`requireSupabaseUser` + `isAdminUser` 403)
  - body: `{ authUserId, isBetaTester }`
  - PATCH `mvp_user_credits` set `is_beta_tester` + `beta_tester_granted_at`
  - 크레딧 row 없으면 404 `user_not_found_in_credits` (회원이 1회 이상 추천/팩 사용해야 row 생성됨)
  - 에러 응답은 generic code (`update_failed`) — Wave 99 보안 원칙 따름 (raw err.message 노출 X)
- 검증: tsc clean.
- 위험: 낮음. admin only. UUID 정규식 validation 박혀 있음.
- 다음: 베타 권한 정의 후 호출처 추가.

## 7. 거론 금지

- /admin과 /cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY 통합 — owner 명시 분리.
- URL을 의미 있는 path로 변경 (`/internal/members` 같은) — owner 명시 obfuscation.
- 베타 체험단 권한을 미리 정의 — owner가 이따 정의 예정. 추측 금지.
- Pro 결제 통합 (PG 연동) — 현재 `pro_until` SQL 수동 박는 게 정책. Wave 별도.
