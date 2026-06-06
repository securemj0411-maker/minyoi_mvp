# Wave 1204 — 크레딧 죽은 코드 정리 1단계 (audit)

날짜: 2026-06-06
관련: Wave 1199 audit, owner "크레딧 쓸 일 없음" 결정
배경: 크레딧 결제 → 멤버십 모델 pivot. 크레딧 흐름 전체가 410/redirect로 봉인됨.

## 확인 (삭제 전)

- `/api/billing/me`·`cancel`·`manual-deposit`·`subscribe` 전부 **410** (legacy_credit_billing_disabled).
- `/billing/checkout`·`manual`·`processing` page.tsx는 **redirect("/plans")만**, client 컴포넌트 import 안 함 → client 전부 고아.
- `manual-deposit-history.tsx`·`onboarding-banner.tsx` 어디서도 import 안 됨 (죽은 컴포넌트).
- `cancelClientPlan` 사용처 0.
- **단, 살아있어 남긴 것**:
  - `manual-deposit-grant.ts` — admin-webhook·referral이 사용 (삭제 route와 무관).
  - `client-billing.ts` / `/api/billing/me`·`cancel` — app-nav·account-panel이 `loadClientPlan` import (항상 null이지만 코드 살아있음) → **2단계**.

## 1단계 삭제 (명확히 죽음 + 의존성 없음)

- `src/app/billing/` (checkout·manual·processing = page + client 6개 파일)
- `src/app/api/billing/manual-deposit/` (route + [id] + history)
- `src/app/api/billing/subscribe/route.ts`
- `src/components/manual-deposit-history.tsx`
- `src/components/onboarding-banner.tsx` (Wave 1203 "매물 2개 무료" 잔재도 여기 있었음)

## TS check
- src/ 코드 **clean**. `.next/types/validator.ts` stale 참조 에러는 빌드 캐시(gitignore)라 next build 시 자동 재생성.

## 2단계 (후속, 신중)
- `client-billing.ts` + `/api/billing/me`·`cancel` 삭제하려면 app-nav·account-panel의 `loadClientPlan` 호출(죽은 코드, 항상 null) 제거 필요 → app-nav clientPlan UI 사용 확인 후.
- `robots.ts:14`의 `/billing/checkout` disallow 정리(404라 무해하나 깔끔히).

## Sign-off
owner GO. 명확히 죽은 것 안전 삭제. client-billing 의존 체인은 2단계로 신중히.
