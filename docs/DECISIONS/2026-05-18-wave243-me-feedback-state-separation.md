# 2026-05-18 Wave 243 — /me feedback state separation

## 배경

Wave 238에서 feedback row를 `feedback_type`별로 저장하게 바꿨지만 `/me` 응답은 여전히 pid별 대표 feedback 하나만 내려줬다.
이 구조에서는 정보 오류 신고처럼 우선순위가 높은 row가 있으면 `매수함`, `판매 등록`, `판매 완료` 같은 거래 진행 상태가 모달 rail과 카드에서 가려질 수 있다.

## 결정

1. `/api/packs/me`는 대표 feedback과 별개로 `transactionFeedbackType`/`transactionFeedbackNote`, `reportFeedbackType`/`reportFeedbackNote`를 내려준다.
2. 거래 진행 상태는 `resold > listed > inspected > bought > contacted > passed` 순서로 고른다.
3. 신고 상태는 `inaccurate_report > loss_report` 순서로 고른다.
4. `/me` 카드에서는 개발자 enum을 그대로 노출하지 않고 `거래 상태 · 매수함`, `정보 신고 완료`처럼 사용자 문구로 표시한다.
5. 모달의 거래 상태 rail은 대표 feedback이 아니라 `transactionFeedbackType`을 기준으로 복원한다.

## 보류

- 사용자에게 보여줄 거래 상태 timeline/필터는 보류한다. 먼저 enum 노출과 신고/거래상태 충돌부터 끊는다.
- 실제 매수가/판매가 입력은 Wave 242와 동일하게 보류한다.

## 검증

- `/me` contract test에 신고/거래상태 분리 회귀 테스트를 추가했다.
- `git diff --check`
- `npx tsx --test tests/me-page-contract.test.ts`
- `npm run build`
- `npm run test:core`
