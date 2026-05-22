# 2026-05-22 Wave 540 — PC 작업 메뉴와 서비스 안내 라이트 톤 정리

## 결정
- 라이트 테마 배포 이후에도 PC `/me` 사이드 작업 메뉴와 `/how-it-works` 서비스 안내 화면에 기존 초록/베이지 톤이 남아 있어, 사용자 공통 화면의 톤을 추가 정리한다.
- 수익/상태 신호의 emerald 계열은 별도 의미 색으로 남기되, 페이지 구조·CTA·안내/설명 UI는 white/zinc/blue 계열로 맞춘다.

## 구현
- PC 작업 메뉴 sidebar, 로딩 skeleton, 모델 공략 카드의 배경/보더/텍스트를 white/zinc/blue 톤으로 변경했다.
- 서비스 안내 페이지의 hero, 비교 섹션, SVG 설명 그래픽, 원칙 카드, 기술 설명 카드에 남아 있던 old green/beige hex를 blue/zinc 계열로 교체했다.
- `light-theme-contract`에 `/how-it-works`와 `me-dashboard`를 포함해 beige background/border 및 old green hex 재유입을 막는다.

## 보류
- 운영자 전용 화면과 상태/수익/성공 의미색으로 쓰이는 emerald 계열은 이번 범위에서 제외한다.
