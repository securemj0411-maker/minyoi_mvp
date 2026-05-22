# 2026-05-22 Wave 531 — 토스식 라이트 모드 전환

## 결정
- 라이트 모드는 크림/베이지 기반 Claude 톤에서 토스식 흰색/연회색/파란 CTA 톤으로 전환한다.
- 다크 모드는 기존 사용자 평가가 좋아서 변경하지 않는다.
- 수익/차익 신호는 기존 emerald 계열을 유지한다. 주요 액션과 서비스 신뢰/정보 CTA만 blue 계열로 정리한다.

## 구현
- 전역 light token을 `#f5f7fb` 배경, `#ffffff` 카드, `#191f28` 본문, `#3182f6` 액션 중심으로 변경했다.
- 기존 컴포넌트에 하드코딩된 cream/beige hex는 `html:not(.dark)` 전역 리맵으로 neutral/blue light palette에 맞췄다.
- 브라우저 라이트 theme-color도 `#f5f7fb`로 변경했다.
- 첫 피드 온보딩 full-screen 배경과 하단 gradient도 새 라이트 배경에 맞췄다.
- 2차 정리에서 네비게이션, 푸터, `/me` shell, 비회원 프리뷰, 상세 모달 shell, 인증/법적 페이지 등 사용자 공통면의 hard-coded beige 배경/보더를 직접 white/zinc/blue 계열로 치환했다.
- `light-theme-contract`에 네비/푸터/상세 shell/비회원 프리뷰가 beige 배경/보더를 직접 칠하지 않도록 회귀 테스트를 추가했다.

## 보류
- 일부 세부 컴포넌트의 그림자/라운딩/spacing은 그대로 유지했다. 실제 화면 검수 후 과한 카드감이 남으면 component-level로 추가 정리한다.
- 운영자 전용 페이지는 주요 사용자 라이트 경험보다 우선순위를 낮춘다.
