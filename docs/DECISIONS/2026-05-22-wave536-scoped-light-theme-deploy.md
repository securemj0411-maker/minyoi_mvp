# 2026-05-22 Wave 536 — 라이트 테마 scoped 배포

## 결정
- parser/pool 배포는 별도 scoped 커밋으로 완료되어, 라이트 모드 베이지 제거 작업은 배포에 포함되지 않았다.
- 배포 화면에서 베이지가 계속 보이는 문제를 먼저 줄이기 위해, 전역 light token과 hard-coded beige class remap만 별도 scoped 커밋으로 배포한다.

## 구현
- `globals.css`의 라이트 배경을 `#f5f7fb`, 카드/cream 계열을 white, 주요 CTA를 blue 계열로 바꾼다.
- 기존 화면에 남은 cream/beige Tailwind arbitrary class는 `html:not(.dark)` 전역 remap으로 white/gray/blue 계열에 맞춘다.
- 브라우저 light `theme-color`도 새 light background에 맞춘다.

## 보류
- 네비게이션 위계, 크레딧 충전 페이지 문구, 피드 UX, 직거래 확인 모달 등 다른 UI 변경은 아직 unrelated dirty와 섞여 있어 이번 scoped 테마 배포에는 포함하지 않는다.
- 컴포넌트별 hard-coded color 직접 치환과 회귀 테스트는 다음 UI 전용 커밋에서 정리한다.
