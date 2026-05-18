# 2026-05-18 Wave 239 — Saved Money report compensation

## 배경

Wave 182c 이후 사용자에게 노출되는 보상 루프는 `inaccurate_report` 중심이다. 하지만 `/api/packs/me/saved-money`의 `compensationGrantedThisMonth` 집계는 과거 `loss_report`만 조회하고 있었다.

결과적으로 사용자는 정보 오류 신고로 토큰 +3을 받았는데, `/me` 상단 Saved Money Counter에는 보상 토큰이 누락될 수 있었다.

## 결정

1. `compensationGrantedThisMonth` 집계를 `loss_report + inaccurate_report`로 확장한다.
2. UI 배지 문구를 `손해 보상 토큰`에서 `신고 보상 토큰`으로 바꾼다.
3. `/me` contract test에 Saved Money Counter 보상 집계 기준을 추가한다.

## 보류

1. `inaccurate_report`가 운영자에 의해 `dismissed` 처리될 때 토큰 회수 여부는 정책 결정이 필요해서 보류한다.
2. 실제 수익/손실 기반 Closing Loop는 다음 P0 거래 상태 rail 작업에서 다룬다.

## 검증

- `git diff --check`
- `npx tsx --test tests/me-page-contract.test.ts`
- `npm run test:core`
- `npm run build`

