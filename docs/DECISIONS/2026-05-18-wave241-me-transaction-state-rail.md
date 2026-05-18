# 2026-05-18 Wave 241 — /me transaction state rail

## 배경

Wave 238에서 feedback type별 row 보존을 적용했고, Wave 240에서 삭제를 soft-hide로 바꿨다. 이제 `/me` 모달에서 사용자가 실제 거래 진행 상태를 남겨도 신고/보상/기존 피드백이 덮어써지지 않는다.

기존 모달의 주요 CTA는 `공략 보기`, `번개장터 열기`, `정보 오류 신고`였다. 리텐션을 높이려면 추천 이후의 실제 행동인 `문의 → 매수 → 포기/진행` 신호를 명시적으로 받아야 한다.

## 결정

1. `mvp_reveal_feedback.feedback_type`에 `contacted`, `passed`를 추가한다.
2. 기존 `bought`는 그대로 사용해서 SavedMoneyCounter와 연결한다.
3. 상품 모달 하단 고정 영역에 거래 상태 버튼을 추가한다.
   - `문의했어요` → `contacted`
   - `매수했어요` → `bought`
   - `포기했어요` → `passed`
4. 사용자가 누르면 `/me` 목록/현재 모달 상태를 optimistic update하고, 서버에는 기존 feedback API로 저장한다.

## 보류

1. `검수 완료`, `판매 등록`, `판매 완료`, 실제 매수가/판매가 입력은 다음 단계로 보류한다.
2. 상태 전용 테이블(`mvp_reveal_status`)은 아직 만들지 않는다. 현재는 type-scoped feedback row로 충분히 안전하다.
3. 상태 변경 실패 toast/rollback은 보류한다. 실패해도 다음 `/me` reload에서 서버 값으로 회복된다.

## 검증

- `/me` contract test에 transaction state CTA와 feedback type 허용을 추가했다.
- `git diff --check`
- `npx tsx --test tests/me-page-contract.test.ts`
- `npm run test:core`
- `npm run build`

