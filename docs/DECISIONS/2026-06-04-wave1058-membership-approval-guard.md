# Wave 1058 — Membership Approval Guard

## Context

사용자가 멤버십 신청 후 `입금했어요`를 누르자마자 프론트에 `멤버십 가입 완료`가 뜬다고 보고했다. 직전 wave에서 예약 Telegram의 승인 링크를 제거했지만, 즉시 완료 토스트가 뜨는 조건과 이전 Telegram 링크 잔존 가능성을 추가로 점검했다.

## Findings

- `MembershipApplicationClient`의 polling은 latest application 상태가 pending이어도 `/api/membership/status`의 `isMember`가 true면 바로 완료 토스트와 `/me` redirect를 실행했다.
- 최근 DB에서 `deposit_confirmed_at = null`인데 `decision_source = telegram`으로 승인된 과거 신청이 있었다. 예약 Telegram에 승인 링크가 들어가던 이전 구조의 결과다.
- 이전에 발송된 Telegram 승인 링크가 남아 있으면, 코드 배포 후에도 해당 링크가 호출될 수 있다.

## Decisions

- 프론트는 `isMember === true`만으로 승인 완료를 표시하지 않는다. latest application `status === "approved"`일 때만 완료 토스트와 `/me` redirect를 실행한다.
- 서버 승인 함수는 `decisionSource !== "admin"`인 경우 `deposit_confirmed_at`이 없는 신청을 승인하지 않고 `deposit_not_confirmed`를 반환한다. 이로써 이전 Telegram 링크와 자동승인 cron 모두 입금확인 없는 신청을 승인할 수 없다.
- 실제 guard 검증으로 pending renewal application `#3`에 telegram approve를 호출했고, `deposit_not_confirmed`, `activated=false`로 차단되는 것을 확인했다.

## Deferred

- 과거에 이미 잘못 승인된 테스트 계정의 plan/application 정리는 별도 운영 데이터 정리로 분리한다.
