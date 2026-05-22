# 2026-05-22 Wave 527 — 운영자 상세보기 크레딧 우회 기준 통일

## 결정
- `/me` 운영자 풀 접근 권한과 `나의 상품` 상세보기 크레딧 차감/부족 판정을 같은 계열의 권한으로 맞췄다.
- 기존에는 `admin email`만 상세보기 무제한이었고, `beta tester`는 운영자 풀을 볼 수 있으면서도 상세보기에서는 일반 유저처럼 크레딧 부족에 걸릴 수 있었다.
- `detail-access` helper에 `unlimited` 플래그를 추가하고, pool/detail/analysis API에서 `admin || beta tester`를 넘기도록 했다.

## 보류
- 크레딧 pill(`/api/credits/me`)에서 beta tester를 `∞`로 표시할지는 별도 UX 결정으로 남긴다.
- admin shadow mode를 상세보기에도 적용할지 여부는 정책 결정이 필요해 이번 수정에는 포함하지 않았다.

## 검증
- `npx tsx --test tests/explore-initial-preferences-contract.test.ts`
- `npm run build`
