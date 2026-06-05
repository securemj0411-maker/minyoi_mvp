# Wave 1170 — 고객센터 1:1 상담 소유자 범위 강화

## 배경
- 고객센터 1:1 상담에서 다른 아이디로 상담한 채팅 내역이 보이는 것 같다는 보고가 있었다.
- 개인정보/상담내역 이슈라 실제 DB 오염 여부와 프론트 stale state 가능성을 같이 확인했다.

## 확인
- 현재 DB 기준 `mvp_support_conversations` 8건, `mvp_support_messages` 17건을 확인했다.
- 메시지의 `conversation_id`와 부모 상담의 `auth_user_id`가 다른 케이스는 0건이었다.
- 같은 계정에 중복 open 상담이 생긴 케이스도 0건이었다.
- 즉, 저장 데이터 자체에 타인 메시지가 섞인 흔적은 확인되지 않았다.

## 결정
- 사용자가 오해할 수 있는 stale UI도 개인정보 사고처럼 취급하고 막는다.
- 고객센터 버튼을 열 때 기존 conversation/messages/composer/send state를 즉시 비운 뒤 새 상담을 로드한다.
- Supabase auth 상태가 바뀌면 상담창을 닫고 고객센터 state와 안읽음 배지를 초기화한다.
- `/api/support/chat` 메시지 조회를 `conversation_id` 단독이 아니라 `conversation_id + auth_user_id` 이중 조건으로 제한한다.
- realtime 구독도 conversation 기준으로 구독하고, payload의 `conversation_id`와 `auth_user_id`를 다시 검증한다.
- DB migration으로 `mvp_support_messages(conversation_id, auth_user_id)`가 부모 `mvp_support_conversations(id, auth_user_id)`와 반드시 맞도록 composite FK를 추가한다.

## 보류/주의
- migration은 코드와 함께 배포되어야 실제 DB 제약까지 적용된다.
- 기존 데이터에는 owner mismatch가 없어서 정리 쿼리는 필요하지 않았다.
- 관리자 고객센터 화면 구조 개편은 별도 wave로 처리한다.
