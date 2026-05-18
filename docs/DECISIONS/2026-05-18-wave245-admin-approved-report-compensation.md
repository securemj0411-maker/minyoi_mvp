# 2026-05-18 Wave 245 — Admin-approved report compensation

## 배경

사용자 확인: `/me`에서 사용자가 정보 오류를 신고하면 "적절한 신고일 때 운영자가 승인해서 토큰을 줘야 한다". 기존 구현은 신고 즉시 `compensation_granted_tokens=3`을 기록하고 `refundUserCredits(+3)`를 호출했다. 운영자 페이지는 `/cauleexxy.../loss-reports`에 있었지만, 승인/기각은 상태 표시만 바꾸고 실제 지급 시점은 제어하지 못했다.

## 결정

1. `loss_report`, `inaccurate_report` 제출 시점에는 `compensation_granted_tokens=0`으로 pending row만 만든다.
2. 운영자 페이지 `/cauleexxy.../loss-reports`에서 `resolved` 처리할 때 토큰 +3을 지급한다.
3. 지급은 `review_mvp_reveal_feedback_report()` RPC로 묶는다.
   - report row를 `for update`로 잠근다.
   - 이미 보상된 row면 다시 지급하지 않는다.
   - 미보상 row를 `resolved`로 승인하면 `mvp_user_credits.balance`를 올리고 `mvp_credit_ledger`에 기록한다.
   - feedback row의 `compensation_granted_tokens`를 갱신한다.
4. 기존 즉시 지급된 과거 row는 `compensation_granted_tokens > 0`이므로 승인해도 중복 지급하지 않는다.
5. 운영자 UI 문구를 `보정 완료` 중심에서 `승인/지급` 중심으로 바꾼다.

## 보류

- 이미 즉시 지급된 과거 신고를 기각할 때 토큰을 회수하는 로직은 넣지 않는다. 회수는 사용자 신뢰와 정책 공지가 필요하므로 별도 결정이 필요하다.
- 신고 승인 시 어떤 알고리즘 보정이 실제로 수행되었는지 자동 연결하는 것은 보류한다. 이번 wave는 보상 지급 시점과 운영자 처리 루프를 먼저 고정한다.

## 검증

- `/me` contract test에 "신고 즉시 지급 금지 + 운영자 승인 지급" 회귀 테스트를 추가했다.
- `git diff --check` 통과.
- `npx tsx --test tests/me-page-contract.test.ts` 통과.
- `npm run test:core` 통과.
- `npm run build` 통과.
- 라이브 DB에 `review_mvp_reveal_feedback_report()` RPC 적용 완료.
- 라이브 DB 권한 확인: `anon=false`, `authenticated=false`, `service_role=true`.
