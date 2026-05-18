# 2026-05-18 Wave 258 — Compact condition label-only

## 배경

사용자 피드백: `/me` 카드 그리드에서는 `A A급`, `B 일반`, `N 미개봉`처럼 마크와 라벨을 함께 보여주는 방식이 중복이고, 작은 썸네일에서는 말줄임으로 깨져 보인다.

## 결정

1. `ConditionPhotoBadge`의 `compact` 모드는 등급 마크를 제거하고 짧은 라벨만 보여준다.
2. compact 라벨은 `미개봉`, `S급`, `A급`, `B급`, `사용감`, `훼손`, `배터리`로 바로 읽히게 한다.
3. 상세 모달/큰 사진의 non-compact 모드는 기존처럼 `마크 + 전체 라벨`을 유지한다.
4. compact 배지는 `whitespace-nowrap`와 작은 pill padding을 사용해 `...` 말줄임이 생기지 않게 한다.

## 보류

- 전체 앱의 `normal` 등급 명칭을 `일반`에서 `B급`으로 바꾸는 것은 보류한다. 이번 변경은 작은 카드 배지 가독성에 한정한다.

## 검증

- `tests/me-page-contract.test.ts`에 compact label-only 계약을 갱신한다.
- `npx tsx --test tests/me-page-contract.test.ts tests/site-help-faq-contract.test.ts`
- `git diff --check`
- `npm run build`
