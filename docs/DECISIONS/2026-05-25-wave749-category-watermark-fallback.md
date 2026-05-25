# Wave 749 — Category Watermark Fallback for Card Thumbnails

- 시간: 2026-05-25 KST
- 트리거: 사용자 요청 — "우리 지금 피드에 사진 워터마크 이 html보고 따라하는게 좋을듯 다크모드랑 라이트모드 나눠서". HTML 레퍼런스 `/Users/iminje/Downloads/deuktem_category_watermarks.html` + SVG 22장 (`public/deuktem_watermarks_svg/{light,dark}/`).
- 발견: 매물 카드 썸네일 `thumbnailUrl=null` 일 때 현재 빈 회색 div 또는 텍스트 "없음/이미지 없음/사진 없음" 단순 fallback. 시각적 정보 0. 카테고리 식별도 X.

## 변경

### 새 컴포넌트
- `src/components/category-watermark.tsx` (신규)
  - `CategoryWatermark` named + default export
  - props: `category?: SkuCategory | string | null`, `comparableKey?: string | null`, `size?: number` (기본 64), `className?: string`
  - 매핑: Sku["category"] → 사용 가능한 워터마크 11종 (bag/camera/clothing/console/golf/headphones/laptop/phone/ring/shoe/watch)
    - earphone → headphones, smartwatch/watch → watch, smartphone → phone
    - tablet/laptop/desktop/monitor → laptop (가장 비슷한)
    - speaker → headphones, camera → camera, game_console → console
    - shoe → shoe, bag → bag, sport_golf → golf, clothing → clothing
    - home_appliance/small_appliance/bike/drone/perfume/kickboard/lego → null (워터마크 없음)
  - 다크/라이트 분기: `dark:hidden` + `hidden dark:block` 으로 SVG 두 장 토글
  - 부모는 `position:relative` 필요 (inset:0 fill)

### 4개 카드 화면 적용 (memory 원칙: 3화면 일관성)
1. `src/components/explore-client.tsx` line ~2538 — `item.thumbnailUrl` null 분기에 CategoryWatermark (size 60)
2. `src/components/user-reveal-dashboard.tsx` line ~1514 — null 분기 (size 56)
3. `src/components/admin-pool-browser.tsx` line ~544 — null 분기 100x100 placeholder 안에 (size 64)
4. `src/components/pack-reveal-modal.tsx` — 7개 thumbnail 렌더 포인트 모두 적용:
   - line ~2246 big image (size 120) + "사진 준비 중" 텍스트
   - line ~2678 "내 매물" 작은 썸 (size 28)
   - line ~2743 비교 매물 리스트 (size 32, card.marketBasis.comparableKey 사용)
   - line ~4489 modal big image (size 110) + "사진 준비 중"
   - line ~4995 "내 매물" detailed mode (size 28)
   - line ~5037 비교 매물 detailed mode (size 32)
   - line ~6609 related items horizontal cards (size 72)

### 디자인 (HTML 레퍼런스 따름)
- 라이트 모드: 흰 원형 배경 (#ffffff) + 토스 블루 stroke (#0064FF)
- 다크 모드: 어두운 원형 배경 (#14161c) + 흰 stroke
- 원형 배지 형태 — 사진 obscure 안 함 (어차피 사진 없을 때만 표시)

## 검증
- `npx tsc --noEmit` — 내가 만지지 않은 site-help-faq.tsx 의 pre-existing merge conflict 76 에러 외, 5개 touched 파일 모두 0 에러
- SVG 22장 (light/dark × 11종) 이미 `public/deuktem_watermarks_svg/` 에 존재
- Next.js `<Image unoptimized>` 로 SVG 직접 서빙

## 위험
- 없음. fallback path 만 교체 — thumbnail 이 있는 매물 (대부분) 은 동작 변화 X.
- 매핑 없는 카테고리 (home_appliance, small_appliance, bike, drone, perfume, kickboard, lego) 는 워터마크 없이 빈 영역 — 기존 동작과 동일.

## 다음
- 사용자 commit 결정 대기.
- (선택) future: 매물에 항상 작은 카테고리 뱃지 우상단 표시 (사진 있어도) — 이번엔 안 함.
- ring SVG 가 있지만 SKU 카테고리에 ring 없음. 미래 액세서리 카테고리 추가 시 활용 가능.
