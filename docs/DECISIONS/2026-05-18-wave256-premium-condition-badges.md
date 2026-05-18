# 2026-05-18 Wave 256 — Premium condition badges

## 배경

사용자 피드백: `/me` 카드와 상품 모달 사진 위의 S급/A급 등급 배지가 너무 평범하고 멋이 없다. 등급은 신뢰와 프리미엄감을 만드는 핵심 UI라 단순 라벨보다 더 명확한 시각 체계가 필요하다.

## 결정

1. `ConditionPhotoBadge`를 단순 텍스트 라벨에서 `등급 마크 + 상태 라벨` 구조로 바꾼다.
2. 미개봉은 `N`, S급은 `S`, A급은 `A`, 일반은 `B`, 사용감은 `C`, 훼손은 `D`, 배터리 저하는 `B-` 마크를 쓴다.
3. S급은 emerald/gold 금속 톤, A급은 pearl sky/teal 톤으로 더 고급스럽게 분리한다.
4. 작은 썸네일에서도 무너지지 않도록 compact badge는 `max-width`, `truncate`, 작은 mark box를 사용한다.
5. 등급 분류 로직은 건드리지 않고, 사진 위 표시 스타일만 바꾼다.

## 보류

- 등급 배지를 SVG/이미지 에셋으로 분리하는 것은 보류한다. 현재는 Tailwind class 기반이 빠르고 색상/다크모드 대응이 쉽다.
- 등급 애니메이션은 보류한다. 카드 리스트에서 과한 움직임은 시선 피로를 만들 수 있다.

## 검증

- `tests/me-page-contract.test.ts`에 grade mark, mark class, premium badge radius 계약 추가.
- `npx tsx --test tests/me-page-contract.test.ts tests/site-help-faq-contract.test.ts`
- `git diff --check`
- `npm run build`
