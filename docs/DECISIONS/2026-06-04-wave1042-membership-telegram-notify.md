# 2026-06-04 Wave 1042 — membership application Telegram notification fix

## Trigger

로그인 사용자가 멤버십 신청을 눌러도 운영자 Telegram 알림이 오지 않는 문제가 있었다.

## Findings

- `mvp_membership_applications`에는 pending 신청 row가 들어오고 있었다.
- 운영자 Telegram env와 bot/chat 연결 자체는 살아 있었다.
- 실제 신청 메시지는 `parse_mode: Markdown`에서 Telegram entity parse 400으로 실패했다.
- 기존 `/api/membership/apply`는 `notifyAdminTelegram()` 결과를 무시해서, 알림 실패가 나도 프론트에는 신청 완료처럼 보였다.

## Decisions

- `notifyAdminTelegram()`에 `parseMode: null` 옵션을 추가해 plain text 발송을 지원한다.
- 멤버십 신청 알림은 Markdown 없이 plain text로 보낸다.
- 신청 API는 `telegramSent`/`telegramReason`을 응답에 포함한다.
- 신청 row `admin_note`에 Telegram 성공/실패 이력을 남긴다.
- 프론트는 신청은 접수됐지만 Telegram 알림이 실패한 경우 별도 안내 문구를 보여준다.

## Applied

- 기존 pending 신청 1건은 plain text로 수동 재발송했고 Telegram 전송 성공을 확인했다.

## Deferred

- Telegram inline button으로 승인/거절하는 flow는 이번 범위에서 제외했다. 현재 운영 결정은 cau 운영자 페이지 기준으로 유지한다.
