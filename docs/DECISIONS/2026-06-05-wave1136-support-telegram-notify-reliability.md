# 2026-06-05 Wave 1136 - Support Telegram Notify Reliability

## 결정
- 고객상담 메시지 텔레그램 알림을 백그라운드 `void` 호출에서 `await` 호출로 변경했다.
- 고객이 입력한 원문은 Markdown 특수문자가 섞일 수 있으므로 `parseMode: null`로 plain text 발송한다.
- 발송 실패 시 상담 저장은 유지하고 서버 로그에 실패 reason을 남긴다.

## 보류
- 고객상담 텔레그램 알림에 바로 답장/처리 버튼을 붙이는 작업은 보류했다.
- 텔레그램 실패 재시도 큐는 별도 운영 안정화 작업으로 둔다.
