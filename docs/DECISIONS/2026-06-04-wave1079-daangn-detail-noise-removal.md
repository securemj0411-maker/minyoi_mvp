# 2026-06-04 Wave 1079 - 당근 상세 노이즈 제거

## 결정

- 당근마켓 상세에서는 `최종 매입가 체크` 비용 분해표를 숨긴다.
- 당근 직거래는 배송비, 결제 수수료, 재판매 수수료가 대부분 0원이라 표를 길게 보여줘도 추가 정보가 거의 없다.
- 사용자는 상단의 매입가, 시세, 예상 순익, 판매속도, 판매자 신뢰, 비교매물을 먼저 봐야 한다.
- 상세 하단의 `거래 상태/진행 전` 드롭다운과 `시세 추천 유의사항`은 제거한다.

## 구현

- `src/components/pack-reveal-modal.tsx`
  - `CostAssurancePanel`은 당근 매물이면 `null`을 반환한다.
  - `ModalActionFooter`는 거래 상태 조작 UI를 제거하고, 정보 오류 신고 버튼만 남긴다.
  - 상세 하단의 `시세 추천 유의사항` details 블록을 삭제했다.

- `tests/daangn-profit-copy-contract.test.ts`
- `tests/me-page-contract.test.ts`
  - 당근 비용표 숨김, 하단 유의사항 제거, 거래 상태 UI 제거를 계약으로 고정했다.

## 보류

- `onFeedback` prop은 부모 컴포넌트 호환 때문에 이번 변경에서는 유지한다.
- 거래상태 데이터/API 자체는 내역/운영 흐름에서 쓸 수 있어 제거하지 않는다.

## 검증

- `npx tsx --test --test-name-pattern "Daangn profit copy|removes generic bottom disclaimer|removes transaction state controls|post-buy follow-up states|detail modal leads with money" tests/daangn-profit-copy-contract.test.ts tests/me-page-contract.test.ts tests/detail-modal-density-contract.test.ts`
  - 5개 통과
- `npx eslint src/components/pack-reveal-modal.tsx tests/daangn-profit-copy-contract.test.ts tests/me-page-contract.test.ts`
  - 에러 0개, 기존 미사용 경고 9개
- `npm run build`
  - 통과
