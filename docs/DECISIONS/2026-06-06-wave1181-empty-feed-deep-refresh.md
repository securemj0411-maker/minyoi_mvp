# 2026-06-06 Wave 1181 — Empty feed deep refresh

## 결정

- 초기 fast feed가 0개를 반환하면 클라이언트에서 자동으로 한 번 더 deep refresh를 이어서 실행한다.
- 빈 상태 카드에도 `근처 매물 새로고침` 버튼을 노출한다.

## 배경

- 15만원 이하/당근 거리 우선은 cheap local 후보가 profit 상위 얕은 페이지에 안 잡힐 수 있다.
- 서버에는 quick 결과 0개 시 deep fallback이 있지만, 클라이언트 화면에서는 빈 상태가 먼저 고정되어 사용자가 “진짜 없는 것”처럼 느끼는 문제가 있었다.
- 빈 상태에는 가격대 확장과 외부 마켓 버튼만 있고, 현재 조건을 다시 확인하는 버튼이 없어 사용자가 직접 재조회할 수 없었다.

## 구현

- `emptyDeepRefreshRequestedRef`로 필터/지역 조합별 자동 deep refresh를 1회만 실행한다.
- deep refresh 중에는 빈 카드 문구를 “조건에 맞는 후보를 더 확인하는 중”으로 바꾸고 skeleton을 보여준다.
- 빈 카드에 현재 조건 새로고침 CTA를 추가했다.

## 보류

- 서버 응답 자체가 여전히 느린 경우에는 precomputed feed-card table 또는 cursor/chunk API가 필요하다.
- 이번 wave는 “있는 후보를 못 보여주는 빈 상태”를 먼저 막고, 완전한 응답 속도 구조 개선은 별도 wave로 분리한다.

## 검증

- `npm run lint -- src/components/explore-client.tsx`
