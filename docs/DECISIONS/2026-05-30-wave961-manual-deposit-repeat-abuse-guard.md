# Wave 961 — Manual Deposit Repeat Abuse Guard

## 결정

- 계좌이체 자동지급은 PG 승인 전 임시 흐름이므로, 같은 사용자의 최근 24시간 승인/자동지급 이력이 있으면 추가 신청을 막고 고객센터 오픈카톡으로 안내한다.
- 최근 24시간 안 거절 이력이 있는 사용자도 반복 신청을 막는다. 입금 확인이 어려운 사용자는 자동지급 흐름으로 다시 들어오지 않게 한다.
- 기존 30분 차단은 유지한다. 즉 짧은 재클릭은 그대로 막고, 실제 지급/거절 후 반복 악용은 24시간 단위로 막는다.
- Supabase/PostgREST raw error body가 사용자 응답에 섞여 나가던 문구를 generic message로 바꿨다. 세부 내용은 서버 로그에만 남긴다.
- `/billing/manual`과 `/billing/processing` 양쪽에서 API가 내려준 `supportUrl`을 오픈카톡 링크로 보여준다.

## 보류

- legitimate heavy buyer가 하루에 여러 번 계좌이체 충전하려는 케이스는 오픈카톡 운영자 수동 처리로 우회한다. PG 승인 전 임시 정책이라 자동처리 UX보다 손실 방어를 우선했다.
- 일일 누적 금액/크레딧 cap을 DB RPC로 강제하는 방식은 다음 단계로 보류했다. 이번 wave는 요청 생성 단계에서 반복 신청을 막는다.
- 텔레그램 승인 링크 HMAC/POST-confirm 보강은 별도 wave로 남겼다.

## 검증

- `tests/manual-deposit-abuse-guards.test.ts`로 24시간 성공/거절 가드, raw error 비노출, client support link 계약을 추가한다.
