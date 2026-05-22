# 2026-05-22 — Launch HIGH batch 2 (빠른 3개)

## #1 가품 위험 chip — 3 화면 카드 grid 추가
- explore-client (메인 feed): 매물 카드 메타 영역에 `⚠ 정품 확인` chip
- user-reveal-dashboard (보관함): verdict chip 옆에 동일 chip
- admin-pool-browser (운영자 풀): 동일 chip
- 조건: `detectBrandDepth(category).brand.counterfeitRisk === "high"` 만
- 메모리 룰: **3 화면 일관성** 룰 충족 (modal 엔 이미 박혀 있음)

## #2 신규 셀러 chip — 고위험 카테고리만
- 위치: explore-client 카드 메타
- 조건: `sellerReviewCount === 0` + 가품 위험 high 카테고리 (명품/음향)
- 카피: `! 신규 셀러` + title "거래 후기가 없어요. 가품 위험 큰 상품은 더 보수적으로 확인"
- **차단 안 함** (옵션 C — 일반인 친화 + 풀 규모 보호). 일반 카테고리는 신규 셀러 통과.

## #3 refresh modal 모바일 뒤로가기
- `explore-client.tsx` 의 refresh modal (새 30개 받기)
- 이전: popstate handler 없음 → iOS swipe-back / 안드로이드 back 시 페이지 이탈
- 변경: `pack-reveal-modal` 와 동일 패턴 — `history.pushState` 박고 popstate 시 close
- 사용자 frustration ↓

## 영향
- 코드: 3 파일 (explore-client, user-reveal-dashboard, admin-pool-browser)
- DB / env: 변경 X
- 사용자 영향: 보호 chip 노출 ↑ + 모바일 뒤로가기 정상

## 검증
- TypeScript compile clean
- 3 화면 같은 매물 = 같은 chip 표시 (Apple AirPods Max, LV 가방 등)
- 모바일 뒤로가기 = 모달만 닫힘 (페이지 이탈 X)

## 메모리 룰
- 일반인 친화 + 보호: 가품 위험 노출 ↑
- 3 화면 일관성: 카드 UI 변경 시 admin / user / modal 다 적용 ✓
- 정직 카피: 차단 대신 chip (정보 제공)
