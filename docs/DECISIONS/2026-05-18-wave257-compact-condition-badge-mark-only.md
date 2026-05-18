# 2026-05-18 Wave 257 — Compact condition badge mark-only

## 배경

사용자 피드백: `/me` 카드가 여러 열로 보일 때 사진 위 등급 배지가 `C 사...`, `N 미...`처럼 말줄임 처리되어 잘 안 보인다. 작은 썸네일에서는 `등급 마크 + 라벨` 조합이 공간을 너무 많이 잡아먹는다.

## 결정

1. `ConditionPhotoBadge`의 `compact` 모드는 등급 마크만 보이게 한다.
2. 상세 모달/큰 사진의 non-compact 모드는 기존처럼 `등급 마크 + 전체 라벨`을 유지한다.
3. compact 모드에서도 접근성/의미 보존을 위해 라벨은 `sr-only`로 남긴다.
4. compact 마크는 `h-6 min-w-6` 크기로 키워 그리드에서 멀리서도 읽히게 한다.

## 보류

- 카드 본문에 별도 등급 텍스트를 다시 추가하는 것은 보류한다. 카드 본문은 이미 차익/시세/상태 정보가 많아 복잡해질 수 있다.
- 등급 legend를 카드 영역에 상시 노출하는 것은 보류한다. 필요하면 전역 도움말 FAQ에 등급표를 더 강화한다.

## 검증

- `tests/me-page-contract.test.ts`에 compact mark-only 계약 추가.
- `npx tsx --test tests/me-page-contract.test.ts tests/site-help-faq-contract.test.ts`
- `git diff --check`
- `npm run build`
