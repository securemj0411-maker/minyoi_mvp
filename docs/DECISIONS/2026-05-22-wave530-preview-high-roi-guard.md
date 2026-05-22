# 2026-05-22 Wave 530 — 비회원 프리뷰 고수익률 이상치 차단

## 결정
- 비회원 메인 `/api/preview-pool`도 `/me` 풀 빌더와 같은 성격의 고수익률 이상치 가드를 적용한다.
- `ready` 상태만 믿으면 과거 stale ready row 또는 cleanup 전 row가 비회원 홈에 노출될 수 있어, preview API에서 한 번 더 방어한다.
- 기준은 풀 빌더 정책과 맞춘다.
  - 전자제품 계열: ROI 40% 이상 차단
  - 약한 신호(confidence 낮음, condition 불명 등): ROI 45% 이상 차단
  - 일반 카테고리: ROI 60% 이상 차단
  - 신발/가방/의류 등 시세 변동 큰 카테고리: ROI 70% 이상 차단

## 보류
- DB의 stale ready row 자체를 정리하는 것은 score/housekeeper 쪽 wave로 별도 진행한다.
- 비회원 카드 문구 `N% 낮음`은 이번에는 유지하되, 고수익률 이상치가 빠진 뒤에도 과하게 보이면 문구를 `예상 차이` 중심으로 바꾼다.

## 검증
- `npm run build`
- 로컬 `/api/preview-pool` 응답에서 preview ROI 최대값 확인
