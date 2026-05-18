# 2026-05-18 Wave 253 — Global help FAQ

## 배경

사용자 요청: 화면 오른쪽 아래 고정 `?` 도움말을 누르면 사람들이 자주 궁금해할 FAQ를 볼 수 있게 한다. 특히 등급 차이, 미개봉과 S급 관계, 등급 분류 기준, 시세 정확도, 손해 가능성, 상태별 시세 보정, 고객센터/피드백 보상 정책을 한 곳에서 설명해야 한다.

## 결정

1. Root layout에 `SiteHelpFaq`를 추가해 모든 페이지 오른쪽 아래에 도움말 버튼을 고정한다.
2. FAQ는 모달/바텀시트 형태로 띄운다.
3. 첫 질문 2개는 기본으로 열어 등급 체계를 바로 이해하게 한다.
4. 피드백 안내는 상품 보기 모달의 `정보 오류 신고`를 기준으로 설명한다.
5. 피드백은 운영자 검수 후 적절하면 토큰 3개 지급, 1인당 횟수 제한 없음으로 명시한다.

## 보류

- 전역 도움말에서 특정 상품 신고 모달을 직접 여는 것은 보류한다. 특정 pid 컨텍스트가 필요하므로, 이번 wave는 `/me#my-reveals-list`로 안내한다.
- FAQ 콘텐츠를 DB/CMS로 관리하는 것은 보류한다. 현재는 제품 신뢰 문구를 빠르게 고정하기 위해 코드 상수로 둔다.

## 검증

- `tests/site-help-faq-contract.test.ts` 추가.
- `npx tsx --test tests/site-help-faq-contract.test.ts tests/me-page-contract.test.ts` 통과.
- `git diff --check` 통과.
- `npm run build` 통과.
