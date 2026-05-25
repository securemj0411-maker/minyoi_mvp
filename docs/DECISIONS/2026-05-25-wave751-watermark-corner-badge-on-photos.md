# Wave 751 — 카테고리 워터마크 corner 배지 (사진 위 항상 표시)

- 시간: 2026-05-25 KST
- 트리거: 사용자 보고 — "왜 워터마크 안바꿈?? 바꾸긴했냐??? 예전이랑 똑가튼데"

## 발견
Wave 749 에서 카테고리 워터마크를 **썸네일 없을 때 fallback** 으로만 박았음. 번개장터 매물은 거의 다 사진 있어서 fallback path 안 탐 → 사용자는 변화 못 봄.

사용자 의도는 **HTML 레퍼런스처럼 사진 위 워터마크 overlay** 였음.

## 변경

### `src/components/category-watermark.tsx`
- `variant` prop 추가 (`"fallback" | "corner"`, 기본 fallback).
- `corner` 모드: `absolute bottom-1 right-1` + drop-shadow → 사진 우하단 작은 배지 (사진 안 가림).

### 4개 카드 화면 — 사진 위에 corner 배지 추가
1. `src/components/explore-client.tsx` — 피드 카드 (size 24)
2. `src/components/user-reveal-dashboard.tsx` — 내 매물 (size 22)
3. `src/components/admin-pool-browser.tsx` — 운영자풀 (size 26) + Image 를 relative div 안으로 wrap
4. `src/components/pack-reveal-modal.tsx` — 5개 thumb 위치:
   - modal big image (size 44)
   - "내 매물" small thumb (size 16)
   - 비교 매물 list (size 18)
   - related items horizontal card (size 28)
   - detail-mode 내 매물 + 비교 (size 16/18)

### 동작 매트릭스
| 케이스 | 표시 |
|---|---|
| thumbnailUrl 있음 | 사진 + 우하단 corner 배지 (size 16~44) |
| thumbnailUrl 없음 | 중앙 fallback 배지 (size 28~120, Wave 749 그대로) |

## 검증
- `npx tsc --noEmit` — 5개 touched 파일 0 에러
- light/dark 모드 자동 분기 (SVG dark: variant 토글) Wave 749 그대로 작동

## 위험
- 사진 우하단에 배지 항상 표시되니 사진 정보 일부 가림 (배지 크기 작아서 ~5% 영역).
- soldout overlay 와 좌하단 source-tag 와 충돌 없음 (위치 다름).
- pack-reveal-modal 큰 사진 (640px 매물 상세) 의 corner 44px 는 살짝 클 수도 — 운영 후 조정 가능.

## 다음
- 운영 후 사용자 피드백 받아 corner 크기/위치 미세 조정.
- 추후: 워터마크 클릭 시 카테고리 필터링으로 점프 (선택 기능).
