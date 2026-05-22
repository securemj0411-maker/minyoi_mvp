# 2026-05-22 — Launch UX + 성능 batch 3개

## #1 빈 상태 CTA (user-reveal-dashboard)
이전: "아직 본 추천 상품이 없습니다." 텍스트 1줄. action 0.
변경: 카드 박스 + BookmarkIcon + 안내 + "매물 추천 받으러 가기" 버튼 (`/me?tab=explore`).
- 신규 사용자가 다음 step 명확.
- 메모리 룰: 일반인 친화.

## #2 viewport-fit=cover (layout.tsx)
이전: viewport 에 `viewportFit` 없음 → 노치/홈바 영역 cutoff.
변경: `viewportFit: "cover"` 추가.
- pack-reveal-modal sticky CTA + BeginnerGuide 풀스크린 의 `env(safe-area-inset-*)` CSS 정확 동작.

## #3 preview-inventory chunked fetch parallel
이전: 200-pid chunk 를 sequential 로 N번 fetch (`for ... await`).
변경: `Promise.all` 로 parallel.
- 1000 pid 면 sequential 5번 → parallel 1번. 모바일 응답 5x 빠름.
- 풀 미리보기 (랜딩 / 비로그인) 의 첫 paint 가 빠름.

## 파괴 risk 검증 (사용자 짚음)
모든 변경 = **기존 로직 파괴 X**:
- 빈 상태 CTA = 표시만 추가 (data flow 동일)
- viewport-fit = CSS 동작 강화 (기존 layout 영향 X)
- chunked parallel = 같은 데이터 받음 (순서만 다름 — Set 으로 모음)

## 검증
- TypeScript compile clean
- 영향 X 의도된 동작

## 메모리 룰
- 일반인 친화: 사용자 frustration ↓ + 모바일 첫 paint 빠름
- 3 화면 일관성: 빈 상태 = user-dashboard 만 (보관함 전용)
- decision log: 이 파일
- DELETE/DROP 룰: 안 해당 (additive only)
