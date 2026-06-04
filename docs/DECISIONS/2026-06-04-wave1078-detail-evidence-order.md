# 2026-06-04 Wave 1078 - 상세 정보 순서 재정렬

## 결정

- 상세 상단에서 `구매 판단` boilerplate 카드는 제거한다.
- 사용자는 판단 문구보다 숫자와 근거를 먼저 봐야 한다.
- 상세 첫 흐름은 `예상 순익/매입가/시세 -> 판매속도/거래안전 -> 판매자 신뢰 -> 비교매물 -> 시세 그래프` 순서로 둔다.
- 시세 그래프는 보조 시각화이고, 실제 신뢰 근거는 비교매물 리스트가 먼저다.

## 구현

- `src/components/pack-reveal-modal.tsx`
  - `<PurchaseDecisionHeader card={card} />` 호출을 제거했다.
  - `PurchaseDecisionHeader` 함수 자체도 삭제해서 `구매 판단/근거 확인 후 판단` boilerplate가 다시 살아날 여지를 줄였다.
  - `<ComparableListingsPanel />`을 `<DetailMarketGraphSection />` 위로 이동했다.

- `tests/detail-modal-density-contract.test.ts`
- `tests/detail-beginner-guide-contract.test.ts`
- `tests/free-plus-entitlement-contract.test.ts`
- `tests/me-page-contract.test.ts`
  - 쉬운모드 CTA 부재, 판매자 신뢰 패널 유지, 비교매물 우선 순서를 계약으로 고정했다.

## 보류

- 실제 배포 화면 확인은 Vercel `main` 배포 완료 뒤 진행한다.

## 검증

- `npx tsx --test tests/detail-modal-density-contract.test.ts tests/detail-beginner-guide-contract.test.ts tests/condition-tier-display-contract.test.ts`
  - 10개 통과
- `npx eslint src/components/pack-reveal-modal.tsx tests/detail-modal-density-contract.test.ts tests/detail-beginner-guide-contract.test.ts tests/free-plus-entitlement-contract.test.ts tests/me-page-contract.test.ts`
  - 에러 0개, 기존 미사용 경고 9개
- `npm run build`
  - 통과
