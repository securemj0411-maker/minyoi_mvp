# 2026-05-19 Wave 287 — 상품 상세 다크모드 라이트 그라데이션 제거

## 결정
- `/me` 상품 상세의 라이트 전용 `bg-[linear-gradient(...#fffdf9...)]` 표면에 `dark:bg-none`을 추가했다.
- 다크모드에서는 배경 이미지를 끄고 `dark:bg-zinc-*` 또는 `dark:bg-emerald-*` 색만 적용되게 했다.
- 대상은 상품 이미지 오버레이, 추천 이유 패널, 안전 확인 패널, 매물 정보 카드, 시세 그래프 카드다.

## 이유
- Tailwind의 `dark:bg-zinc-900`은 `background-color`만 바꾸고 기존 `background-image` gradient를 지우지 못한다.
- 그래서 다크모드에서도 크림/흰색 gradient가 남아 상품 상세가 밝게 떠 보였다.

## 검증
- `tests/me-page-contract.test.ts`에 다크모드 gradient 제거 계약을 추가했다.
