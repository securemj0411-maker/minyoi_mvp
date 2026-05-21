# Wave 492 — 중고 마켓 안전/출처 정합성 정리

## 결정
- 번개장터/중고나라 공통 사기 예방 레이어를 별도 도메인 헬퍼로 분리했다.
  - 공통 멈춤 신호: 선입금, 외부 결제 링크, 외부 메신저, 입금자명 변경, 신분증 인증 요구, 사진 도용 의심.
  - UI 문구는 "안전합니다/보상됩니다" 같은 보장성 표현을 피하고, "멈추세요/확인하세요/보류하세요" 중심으로 정리한다.
- 중고나라 seller UI는 평점이 아니라 신뢰지수/거래후기/안심거래 판매 이력으로 표시한다.
  - 중고나라 source에서는 "평점 N점", "우수 셀러", "평점 양호"를 노출하지 않는다.
  - 번개장터 source는 기존 평점/후기 표현을 유지한다.
- 중고나라 거래방식/배송비는 source-aware로 해석한다.
  - 직거래만: `배송비 0원 · 직거래 전제`, 무료배송 배지 금지.
  - 배송비 포함: `배송비 0원 · 배송비 포함`, 무료배송 단정 금지.
  - 배송비 별도/알 수 없음은 기본 배송비 가정과 구매 전 확인 문구를 유지한다.
- 수익 계산과 상세/쉬운모드/운영자 풀/나의 상품 API가 같은 shipping assumption을 공유하도록 맞췄다.
- 중고나라 상품에는 구매 전 단계에서 사기조회 링크(`https://web.joongna.com/fraud`)를 제공한다.
- 중고나라 상세 refresh는 중고나라 detail fetcher를 쓰도록 분기했다. 차단/일시 실패를 "삭제됨"으로 오인하지 않도록 실패 시 false invalidation을 피한다.

## 구현
- `src/lib/marketplace-safety.ts` 추가.
- `/api/packs/pool`, `/api/packs/pool/detail-access`, `/api/packs/me`, pack open 경로에 source-aware seller/transaction/shipping 필드를 전파했다.
- 상세 모달/쉬운모드/리스크 바/운영자 풀 카드/나의 상품 fallback detail이 같은 안전/배송 해석을 쓰게 연결했다.
- 중고나라 detail 파서가 상세 이미지 배열을 넘기도록 보강했다.

## 보류
- 중고나라 시세조회(`linePrices`, `scatterPrices`, `items`, `chatCount`, `jnPayBadgeFlag`)는 아직 trusted median에 섞지 않는다.
- 다음 wave에서 PoC/리포트로만 수집 가능성을 확인하고, 우리 자체 시세와 어떻게 섞을지는 별도 논의 후 결정한다.

## 검증
- `npx tsx --test tests/marketplace-safety.test.ts tests/detail-beginner-guide-contract.test.ts` 통과.
- `npm run build` 통과.
- 넓은 `/me` 계약 테스트(`tests/me-page-contract.test.ts`)는 기존 모바일 레이아웃/문자열 계약 기대값 10건이 깨져 있어 별도 정리가 필요하다. 이번 wave의 build/type에는 영향 없음.
