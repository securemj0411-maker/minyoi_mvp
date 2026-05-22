# 2026-05-22 Wave 537 — 원본 매물 CTA source logo / blue button

## 결정
- 상세 모달 하단 `원본 매물 보기` CTA를 토스식 파란색 버튼으로 변경했다.
- 번개장터/중고나라 source별 로고를 CTA의 주요 시각 신호로 노출한다.
- 기존 번개 아이콘 장식은 source logo를 흐리게 만들어 제거했다.

## 구현
- `pack-reveal-modal.tsx`의 fixed original listing CTA 배경을 `#3182f6`으로 변경했다.
- CTA 왼쪽 로고 캡슐을 흰색 원형으로 바꿔 실제 번개장터/중고나라 로고가 더 잘 보이게 했다.
- 원본 이동 전 확인 모달의 최종 이동 버튼도 같은 파란 톤과 source logo를 사용하도록 맞췄다.

## 보류
- `/me/preview-detail`의 정적 preview mock CTA는 별도 dirty 상태라 이번 배포 범위에서 제외했다.
