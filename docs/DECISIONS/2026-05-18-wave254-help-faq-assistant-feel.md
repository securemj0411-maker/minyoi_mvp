# 2026-05-18 Wave 254 — Help FAQ assistant feel

## 배경

사용자 요청: 오른쪽 아래 고정 도움말이 단순 FAQ가 아니라 AI 어시스턴트처럼 느껴지게 한다. 실제 LLM을 붙이지 않고도 최대한 자연스럽고 즉시 답변해주는 느낌을 만들어야 한다.

## 결정

1. `SiteHelpFaq`를 정적 accordion에서 대화형 도움말 패널로 바꾼다.
2. 전역 버튼에 작은 `AI` 배지를 붙여 도움말 진입점의 성격을 명확히 한다.
3. FAQ 질문을 누르면 사용자 질문 말풍선과 어시스턴트 답변 말풍선으로 보여준다.
4. 답변 전 짧은 typing dot 상태를 넣어 즉시 응답하는 AI 비서 느낌을 만든다.
5. 실제 AI/실시간 상담처럼 과장하지 않고, FAQ 기반 가이드라는 선을 유지한다.

## 보류

- 실제 LLM 호출은 보류한다. 비용, 속도, 답변 품질 관리, 운영자 정책 검수 문제가 있어 지금 단계에서는 scripted FAQ가 더 안전하다.
- 사용자가 직접 자유 텍스트를 입력하는 검색/질문 기능은 보류한다. 입력을 받으면 실제 AI 답변 기대가 생기므로, 이번 wave는 질문 칩 기반으로 제한한다.

## 검증

- `tests/site-help-faq-contract.test.ts`에 assistant 느낌의 핵심 문구 검증을 추가한다.
- `npx tsx --test tests/site-help-faq-contract.test.ts tests/me-page-contract.test.ts`
- `git diff --check`
- `npm run build`
