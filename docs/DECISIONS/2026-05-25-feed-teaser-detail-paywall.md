# 2026-05-25 feed teaser / detail paywall 재정의

## 결정
- 피드 자체는 무료 탐색으로 둔다. `더 찾아보기`에 크레딧을 쓰게 만들면 탐색비 + 상세비 이중 과금으로 느껴진다.
- 대신 `/api/packs/pool` 응답은 항상 teaser feed로 내려준다.
  - 숨김: 실제 pid, 원문 제목, 정확 가격, source, 원문 링크, seller/지역, comparable key.
  - 노출: 상품군/상태, 가격대, 수익대, 시세 대비 할인 신호, 판매자 신호, 시세 신뢰 신호, 약블러 썸네일.
- 상세보기의 가치는 "숨긴 정보 해제"가 아니라 "구매 실행 가능한 정확 정보 + 분석"으로 정의한다.
- 상세 진입 `/api/packs/pool/detail-access`는 기존처럼 차감 전에 실시간 원본 검증을 수행한다.
  - 판매완료/삭제/댓글 과다/분류 이탈/차익 소실이면 상세 접근 전에 차단하므로 크레딧 허탕 차감이 발생하지 않는 구조다.

## 구현
- `src/app/api/packs/pool/route.ts`
  - `buildTeaserFeedItems()` 추가.
  - credit 보유자/무료 잔여 상세 여부와 무관하게 `feedPreviewLocked=true` teaser를 반환.
  - `accessToken` + synthetic pid로 상세 접근은 유지.
  - source/link/comparable key는 피드 응답에서 제거.
  - `priceSignalLabel`, `sellerSignalLabel`, `marketSignalLabel`, 가격대 라벨을 추가.
- `src/components/explore-client.tsx`
  - `creditFeedEnabled`/자동 infinite feed 모델 제거.
  - 카드가 teaser 상태를 직접 인식하고, 제목·정확가·출처 잠금 대신 가치 신호를 보여주도록 변경.
  - `더 찾아보기`는 모든 사용자에게 무료/수동 append 동작으로 정리.
  - 상세는 기존 `detail-access` 서버 검증 후 exact item으로 교체.
- `tests/free-plus-entitlement-contract.test.ts`
  - 기존 "credit holder exact feed" 계약을 "free teaser feed + detail exact access" 계약으로 갱신.

## 보류
- `/plans` 충전 페이지 가격표/카피 개편은 다음 wave로 보류.
- 무료 상세 횟수(현재 3회) 자체를 1회로 바꾸는 정책 변경은 가격 페이지 wave에서 함께 결정.
- 실사진 blur/워터마크는 일반 사용자 우회 비용을 높이는 수준이다. 이미지 URL 자체를 프록시/서버 변환해 완전히 감추는 작업은 비용/성능 이슈가 있어 별도 검토.

## 검증
- `npx tsx --test tests/free-plus-entitlement-contract.test.ts` 통과.
- `npm run build` 통과.
- 참고: `tests/explore-initial-preferences-contract.test.ts`와 `tests/light-theme-contract.test.ts`는 기존 계약 drift로 실패한다. 이번 변경 파일 외 영역이다.
