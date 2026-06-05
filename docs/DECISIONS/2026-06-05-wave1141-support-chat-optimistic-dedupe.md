# 2026-06-05 Wave 1141 — 고객상담 optimistic 메시지 중복 방지

## 결정
- 1대1 고객상담에서 사용자가 메시지를 보내는 즉시 임시 메시지를 표시하되, Supabase Realtime INSERT 또는 POST 응답으로 실제 메시지가 도착하면 같은 본문/발신자/짧은 시간대의 임시 메시지를 실제 메시지로 치환한다.
- 기존에는 Realtime이 POST 응답보다 먼저 오면 실제 메시지가 새 항목으로 추가되고, POST 응답 후에야 임시 메시지가 제거되어 사용자 화면에 순간적으로 2개가 보였다.

## 구현
- `src/components/site-help-faq.tsx`
  - `mergeSupportMessage()`를 추가해 실제 DB 메시지 id 중복을 막고, id가 음수인 optimistic 메시지와 매칭되면 교체한다.
  - Realtime INSERT 핸들러와 POST 응답 처리 모두 같은 병합 함수를 사용한다.

## 보류
- 클라이언트 생성 message id를 DB 컬럼으로 저장하는 방식은 schema 변경이 필요하므로 이번 작업에서는 보류했다.
