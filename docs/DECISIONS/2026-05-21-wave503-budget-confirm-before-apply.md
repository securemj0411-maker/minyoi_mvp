# Wave 503 — Budget Confirm Before Apply

## Context
- 첫 피드 온보딩의 예산 선택 단계에서 금액 버튼을 누르는 즉시 예산 필터가 적용되고 온보딩이 닫혔다.
- 사용자는 금액을 고르는 행위와 되돌리기 어려운 확정 행위가 분리되어야 한다고 지적했다.

## Decision
- 금액 버튼은 `pendingBudget`만 변경한다.
- 실제 필터 저장과 온보딩 종료는 하단 CTA에서만 실행한다.
- 하단 CTA 문구는 선택된 금액을 반영해 `15만원↓로 확인하고 보기`처럼 확정 의미를 드러낸다.

## Verification
- `npx tsx --test tests/explore-initial-preferences-contract.test.ts`
- `npm run build`
