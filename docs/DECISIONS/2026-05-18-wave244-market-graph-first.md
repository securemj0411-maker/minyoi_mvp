# 2026-05-18 Wave 244 — /me 시세 그래프 우선 노출

## 배경

사용자 지적: `/me` 상품 모달의 `시세 그래프 · 시장 분석` 영역에서 "일반 기준 / 번개 일반 매물 추이 / 같은 상태 매물 우선 사용" 설명이 그래프보다 먼저 보여서, 정작 그래프가 한눈에 들어오지 않는다.

Wave 242에서 공통 boilerplate를 `왜 이걸 추천했나요?` 메인에서 빼고 접힘 영역으로 옮겼듯, 그래프 영역도 같은 원칙을 적용해야 한다.

## 결정

- `MarketHistoryChart`를 `MarketGraphTrustLine`보다 먼저 렌더링한다.
- 기존 그래프 신뢰 설명은 삭제하지 않고 `그래프 기준 보기` 접힘 영역으로 옮긴다.
- 접힌 summary에는 `상태 기준 · 데이터 소스`만 짧게 노출하고, 상세 설명은 사용자가 열었을 때만 보이게 한다.

## 보류

- 그래프 내부 legend/axis 디자인 재작업은 보류한다.
- `그래프 기준 보기` 클릭률이나 이해도 이벤트 트래킹은 아직 붙이지 않는다.

## 검증

- `/me` contract test에 `MarketHistoryChart`가 `MarketGraphTrustLine`보다 먼저 렌더링되는지 확인하는 계약을 추가한다.
- `git diff --check`
- `npx tsx --test tests/me-page-contract.test.ts`
- `npm run build`
