# 2026-05-18 Wave 255 — Help headset button

## 배경

사용자 요청: 오른쪽 아래 도움말 진입 버튼을 `?`가 아니라 헤드셋을 쓴 상담/AI 어시스턴트 버튼처럼 보이게 한다.

## 결정

1. 전역 도움말 floating button의 `?` 텍스트를 headset 아이콘으로 교체한다.
2. 버튼 접근성 라벨은 `AI 도움말 열기`로 더 명확하게 바꾼다.
3. 모달 헤더와 말풍선의 AI 아바타도 같은 headset 아이콘을 사용해 고객센터/AI 상담의 시각 언어를 통일한다.
4. 현재 프로젝트에 `lucide-react` 같은 아이콘 라이브러리가 없어, 기존 코드 스타일과 동일하게 작은 inline SVG 컴포넌트로 둔다.

## 보류

- 실제 상담 채팅/자유 입력은 보류한다. 이번 wave는 진입 버튼의 인지와 assistant-like 느낌을 강화하는 범위로 제한한다.

## 검증

- `tests/site-help-faq-contract.test.ts`에 `HeadsetIcon`과 새 aria label 검증 추가.
- `npx tsx --test tests/site-help-faq-contract.test.ts tests/me-page-contract.test.ts`
- `git diff --check`
- `npm run build`
