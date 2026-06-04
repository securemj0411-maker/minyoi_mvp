# 2026-06-04 Wave 1073 - 직거래 상세 열기 전 확인 모달 제거

## 결정

- 멤버십 상세 무제한 구조에서는 직거래 전용 매물을 열기 전에 별도 확인 모달을 띄우지 않는다.
- 직거래/거래 가능 지역 정보는 상세 화면의 상품 정보로 남기되, 상세 분석 진입 자체를 한 번 더 막지 않는다.

## 배경

- 기존 모달은 상세 열람 시 크레딧이 소모되던 구조에서 실수 클릭을 막기 위한 장치였다.
- 현재는 승인된 멤버십 사용자가 상세 분석을 무제한으로 볼 수 있으므로, `열기 전 확인`, `그래도 상세 분석 열기`, `다른 매물 볼게요` 단계가 불필요한 마찰이 됐다.

## 구현

- `src/components/explore-client.tsx`
  - `DirectTradeConfirmModal`, `DirectTradeConfirmState`, `directTradeConfirm` state를 제거했다.
  - `openItemDetail()`이 직거래 전용 여부와 상관없이 바로 `/api/packs/pool/detail-access`를 호출하도록 변경했다.
  - 직거래 확인 모달에서만 쓰던 `/api/packs/pool/direct-location` 호출 경로를 제거했다.

- `tests/free-plus-entitlement-contract.test.ts`
  - direct-only 매물이 멤버십 상세 접근에서 바로 상세를 여는 정책으로 계약을 갱신했다.

## 검증

- `npx eslint src/components/explore-client.tsx tests/free-plus-entitlement-contract.test.ts`
- `npx tsx --test --test-name-pattern "direct-only items open detail directly" tests/free-plus-entitlement-contract.test.ts`

## 보류

- `explore-client.tsx`에 남아 있는 `hasSeenPaywall`, `markPaywallSeen` 관련 eslint warning은 이번 직거래 모달 제거와 직접 관련이 없어 별도 정리 대상으로 둔다.
