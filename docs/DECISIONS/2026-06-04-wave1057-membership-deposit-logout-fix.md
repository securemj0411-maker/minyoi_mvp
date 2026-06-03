# Wave 1057 — Membership Deposit And Logout Flow Fix

## Context

사용자가 세 가지 문제를 보고했다.

- 멤버십 연장 예약에서 `입금했어요`를 눌러도 운영자 텔레그램 입금확인 요청이 오지 않음.
- 로그아웃 후 메인 페이지로 이동하지 않음.
- 신규 가입 후 입금완료 전후로 바로 멤버십이 승인되는 것처럼 보임.

## Findings

- `/api/membership/deposit-notify`가 현재 멤버이면 pending 신청을 조회하기 전에 `alreadyMember`로 조기 반환했다. 그래서 active member의 renewal pending application은 입금확인 텔레그램이 발송되지 않았다.
- `/api/membership/apply`의 예약 생성 텔레그램에 승인/거절 링크가 포함되어 있었다. 이 구조에서는 사용자가 실제로 `입금했어요`를 누르기 전에도 Telegram 링크로 승인이 가능하다.
- 최근 DB에서 `deposit_confirmed_at = null`인데 `decision_source = telegram`으로 승인된 신규 신청이 확인됐다. 로컬스토리지 캐시보다 예약 텔레그램 링크 구조가 주된 원인이다.
- `deposit-notify`는 기존 `scheduled_auto_approve_at`이 있으면 재사용했다. 과거 시간이 남은 pending row라면 입금확인 직후 자동승인 cron에 바로 잡힐 수 있다.
- `AppNav` 로그아웃은 Supabase signOut 뒤 client state만 지우고 route replace/refresh를 하지 않았다.
- pending application 조회 일부가 `limit=1`만 쓰고 최신순 정렬을 하지 않아 예전 pending row를 잡을 수 있었다.

## Decisions

- 예약 생성 Telegram은 “입금 대기” 알림만 보낸다. 승인/거절 링크는 사용자가 `입금했어요`를 눌러 `/api/membership/deposit-notify`가 호출된 뒤에만 보낸다.
- `deposit-notify`는 pending application을 먼저 조회하고, 최신 pending이 renewal이면 active member라도 텔레그램 입금확인 요청을 보낸다.
- 입금확인 시 `scheduled_auto_approve_at`은 항상 현재 클릭 시점 기준 5분 뒤로 재설정한다.
- 로그아웃 후 `/`로 `router.replace`하고 `router.refresh`한다.
- pending application 조회는 최신 신청을 우선하도록 `order=created_at.desc`를 적용한다.

## Deferred

- 이미 잘못 승인된 테스트 계정의 승인 취소/정리는 운영 데이터 변경이라 이번 코드 수정에서는 자동으로 되돌리지 않았다.
