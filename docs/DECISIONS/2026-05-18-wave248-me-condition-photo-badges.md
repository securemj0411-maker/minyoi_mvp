# 2026-05-18 Wave 248 — /me condition photo badges

## 배경

사용자 요청: `/me` 카드와 상품 보기 모달에서 미개봉만 사진 위 뱃지가 붙는 상태를 모든 등급으로 확장한다. 등급은 사진 위에 직접 보여주고, 기존에 텍스트 영역에 반복 표시되던 등급 chip은 줄여 정보 밀도를 낮춘다.

## 결정

1. `UnopenedPhotoBadge` 역할을 `ConditionPhotoBadge`로 일반화한다.
2. 사진 위 뱃지는 `unopened`, `mint`, `clean`, `normal`, `worn`, `flawed`, `low_batt` 전체를 지원한다.
3. 미개봉/새상품과 S급은 더 밝고 프리미엄하게, A급은 중간 강조, 일반/사용감/훼손/배터리는 점점 절제된 색감으로 둔다.
4. `/me` 카드 제목 옆 등급 chip은 제거한다. 카드에서는 사진 위 뱃지가 등급의 주 위치다.
5. 상품 보기 모달 상단 가격 박스의 등급 chip도 제거한다. 모달 사진 위 뱃지가 동일하게 등급을 담당한다.

## 보류

- 운영자풀, preview masked dashboard 등 `/me` 외부의 기존 `ConditionChip`은 유지한다. 이번 wave는 사용자 `/me` 카드/모달 중복 정보만 줄인다.
- 시세 근거 섹션의 condition 기준 설명은 유지한다. 사진 뱃지는 매물 자체 등급 표시이고, 시세 근거 섹션은 "어떤 등급끼리 비교했는지" 신뢰 설명 역할이 다르다.

## 검증

- `/me` contract test를 모든 등급 사진 뱃지 + 중복 chip 제거 기준으로 갱신했다.
- `npx tsx --test tests/me-page-contract.test.ts` 통과.
- `npx tsx --test tests/me-page-contract.test.ts tests/me-mobile-first-cta-contract.test.ts` 통과.
- `git diff --check` 통과.
- `npm run build` 통과.
