# 2026-06-04 Wave 1059 — membership Telegram approval confirmation POST

## Context
- 신규 가입과 연장 예약 모두 사용자가 `입금했어요`를 누른 직후 멤버십이 바로 승인되는 증상이 있었다.
- 최근 `mvp_membership_applications` row를 확인하니 id 6/7/8 모두 `deposit_confirmed_at` 이후 1~2초 안에 `decision_source = telegram`으로 승인됐다.
- `scheduled_auto_approve_at`은 입금확인 시점 기준 5분 뒤였으므로 자동승인 cron이 아니라 Telegram 승인 링크 경로가 원인이었다.

## Decision
- `/api/admin/membership-applications/decide`의 token GET은 더 이상 승인/거절 mutation을 실행하지 않는다.
- token GET은 확인 HTML만 렌더링하고, 실제 승인/거절은 확인 버튼이 보내는 POST + `confirm=1`에서만 실행한다.
- `/api/membership/deposit-notify` Telegram 메시지 본문에서는 raw 승인/거절 URL을 제거하고 inline button은 “확인 열기”로 바꿨다.

## Why
- Telegram/브라우저/link preview가 raw URL을 미리 열면 GET side effect만으로 DB가 바뀔 수 있다.
- 세션 없는 운영자 링크는 유지하되, 링크 preview와 사용자 명시 클릭을 분리해야 한다.
- 프론트 완료 처리는 기존대로 DB application status가 `approved`일 때만 일어난다.

## Deferred
- Telegram callback_query 기반의 진짜 one-tap 승인 UI로 바꾸는 작업은 보류한다.
- 현재는 URL 버튼 → 확인 페이지 → POST 버튼 구조로 안전성을 우선한다.
