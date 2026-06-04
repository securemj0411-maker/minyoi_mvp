# 2026-06-05 Wave 1104 — 피드백 FAB를 1대1 고객센터 채팅으로 전환

## 결정

- 전역 우하단 `피드백` 버튼을 `고객센터`로 변경하고, 보상형 피드백 폼 대신 1대1 상담 채팅 모달로 교체했다.
- 사용자 상담 메시지는 `/api/support/chat`을 통해 저장하고, 사용자 화면은 `mvp_support_messages` Supabase Realtime insert 구독으로 새 답변을 받는다.
- 운영자 페이지에 `1대1 고객상담` 패널을 추가해 상담 목록, 새 메시지 배지, 상담원 답장, 상담 종료/재오픈을 처리한다.
- DB에는 `mvp_support_conversations`, `mvp_support_messages`를 추가하고, authenticated 사용자는 본인 상담 row만 select할 수 있게 RLS를 설정했다.
- 실제 원격 DB에 마이그레이션 SQL을 직접 적용했고, Realtime publication 등록과 RLS select 정책 존재를 확인했다.

## 보류

- 운영자 패널은 API 기반 자동 새로고침으로 갱신한다. 사용자 화면은 Supabase Realtime으로 답변을 받는다.
- 기존 매물 오류 제보/피드백 API는 삭제하지 않았다. 상세 매물 오류 신고 흐름과 운영자 검수 흐름은 별도 기능으로 남긴다.
