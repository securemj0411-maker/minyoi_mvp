# 2026-05-18 Wave 259 — Seek-more step modal

## 배경

사용자 피드백: `/me`의 `더 찾아보기` 모달이 큰 모달 안에 또 카드가 들어간 형태라 시각적으로 답답하다. 또한 첫 설정에서 예산과 스타일을 한 화면에 동시에 물어 일반 사용자에게 부담스럽다.

## 결정

1. `더 찾아보기` 외곽 모달을 `max-w-xl`로 줄이고, `RecommendationWorkspace`에 `surface="modal"`을 넘겨 내부 카드 껍데기를 제거한다.
2. 개인화 질문을 `예산 → 스타일` 2단계 플로우로 분리한다.
3. 현재 질문 번호와 progress bar를 보여준다.
4. 단계 전환에 `seekStepIn` 애니메이션을 넣어 화면이 갑자기 바뀌는 느낌을 줄인다.
5. 저장된 조건 이후의 추천 수 선택/고급 검색 흐름은 기존 기능을 유지한다.

## 보류

- 예산 선택 즉시 다음 단계로 넘어가는 동작은 유지한다. 사용자가 원하면 추후 `다음` 버튼만으로 이동하도록 바꿀 수 있다.
- 실제 추천 결과를 별도 모달로 다시 띄우는 흐름은 이미 `/me` 리스트 강조 방식으로 정리되어 있으므로 이번 wave에서 건드리지 않는다.

## 검증

- `tests/me-page-contract.test.ts`에 모달 surface, 1문항 step flow, 애니메이션 계약을 추가했다.
- `npx tsx --test tests/me-page-contract.test.ts tests/site-help-faq-contract.test.ts`
- `git diff --check`
- `npm run build`
