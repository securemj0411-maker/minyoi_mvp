# 2026-05-18 Wave 242 — /me post-buy states

## 배경

Wave 241에서 `/me` 모달에 `문의했어요 / 매수했어요 / 포기했어요` 거래 상태 rail을 추가했다. 다음 retention 루프는 매수 이후 사용자가 어디까지 진행했는지 남기는 것이다.

다만 실제 매수가/판매가 입력은 사용자의 심리적 부담과 회계성 데이터 정책이 엮인다. 이번 wave에서는 금액 입력 없이 상태 신호만 받는다.

## 결정

1. `mvp_reveal_feedback.feedback_type`에 `inspected`, `listed`, `resold`를 추가한다.
2. 모달 거래 상태가 `매수함` 이후일 때 `매수 후 진행` 영역을 보여준다.
   - `검수 완료` → `inspected`
   - `판매 등록` → `listed`
   - `판매 완료` → `resold`
3. `/me` 표시 우선순위는 `resold > listed > inspected > bought` 순서로 둔다.
4. 저장 방식은 기존 feedback API를 유지한다. Wave 238의 type-scoped unique 덕분에 신고/보상 row와 충돌하지 않는다.

## 보류

1. 실제 매수가/판매가/실현 수익 입력은 보류한다.
2. `판매 완료` 시 수익 카운터를 실제 수익으로 전환하는 작업은 보류한다.
3. 상태 변경 실패 rollback/toast는 보류한다. 다음 `/me` reload에서 서버 상태로 회복된다.

## 검증

- `/me` contract test에 post-buy 상태를 추가했다.
- `git diff --check`
- `npx tsx --test tests/me-page-contract.test.ts`
- `npm run test:core`
- `npm run build`
- 라이브 DB에 `20260518103853_reveal_feedback_post_buy_states.sql`을 적용했다.
- `mvp_reveal_feedback_feedback_type_check` 조회 결과 `inspected`, `listed`, `resold`가 포함된 것을 확인했다.
