# 2026-06-04 Wave 1054 — membership Telegram approval RPC fix

## Trigger

텔레그램 멤버십 입금 승인 링크를 누르면 운영자 세션 없이 승인되어야 하는데, production에서 HTTP 500 빈 화면이 발생했다.

## Root Cause

- 링크 route 자체는 세션을 요구하지 않았다.
- 실패 원인은 DB RPC `approve_mvp_membership_application` 내부의 `on conflict (user_ref)`였다.
- 해당 함수는 `returns table (... user_ref text, ...)` 형태라 `user_ref`가 반환 컬럼 변수와 테이블 컬럼 사이에서 ambiguous하게 해석됐다.
- `restFetch`는 Supabase 오류 응답을 반환하지 않고 throw하므로, GET 링크 route가 예외를 잡지 못해 Vercel 500 빈 화면으로 끝났다.

## Applied

- live Supabase DB에서 RPC conflict target을 `on conflict on constraint mvp_user_plans_pkey`로 교체했다.
- transaction rollback 테스트로 신청 #2 승인 RPC가 정상 결과를 반환하는 것을 확인했다.
- 동일 텔레그램 승인 링크를 다시 호출해 신청 #2를 실제 승인했다.
- DB에서 신청 #2가 `approved`, `decision_source=telegram`, `mvp_user_plans.status=active`로 반영된 것을 확인했다.
- codebase에도 wave1054 migration을 추가했다.
- approval helper에서 lookup/RPC/reject 예외를 잡아 구조화된 실패 결과를 반환하게 했다.
- GET 승인 route에도 최후의 try/catch를 추가해 같은 문제가 생겨도 빈 500 대신 실패 HTML을 반환하게 했다.

## Deferred

- 텔레그램 메시지 자체를 승인 완료 후 edit하는 기능은 보류한다.
- Vercel runtime 로그를 별도 대시보드로 집계하는 작업은 보류한다.
