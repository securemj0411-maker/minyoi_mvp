# launch-113 — 비로그인 hook 강화: 이미 팔린 실제 매물 + "거래 완료" 라벨

**Date**: 2026-05-24
**Owner**: caulee
**Scope**: preview-pool data source 전환 + UI 정직 표시

## 배경

launch-111 의 카테고리 라벨 ("이어폰", "신발") + blur 사진 = hook 약함. 사용자 정정: "사진도 다 블러고 제목도 진짜 같지 않다".

전략: 실제 매물 보여주되 **이미 팔린 매물**로. 카탈로그 leak 우려 없음 (사용자가 가서 살 수 없음). "위는 이미 거래된 거고 로그인하면 진행 중 매물" fine print 안내.

## 변경

### server (preview-pool route)
- data source: `candidate_pool.status=ready` → **`mvp_raw_listings.listing_state IN (sold_confirmed, disappeared)` + `sold_detected_at >= 7일전`**
- 그 pid 로 `mvp_candidate_pool` JOIN + `expected_profit_max > 0`
- response 에 `name` (실제) + `thumbnailUrl` (실제) + `soldAt` 추가. `maskedName/blurredImage` 는 legacy fallback.

### client (preview-masked-dashboard)
- 사진: blur → 실제 thumbnailUrl + grayscale opacity-90 + "거래 완료" overlay 배지
- 제목: blur → 실제 item.name (line-clamp-2)
- 매입/시세: 만원대 band → 실제 `krw()` 정확값 (sold = leak 없음)
- "N시간 전 거래" / "N일 전 거래" `soldAgoLabel`
- 헤더 라벨: "오늘 추천 풀 정리됨" → "최근 거래된 실제 매물" (rose 톤)
- Fine print: "※ 우측 카드는 이미 거래 완료된 매물입니다. 로그인하면 지금 진행 중인 매물을 볼 수 있어요"

## 영향

- Hook 강함 — 실제 사진 + 매물명 + 정확 차익 보여줌.
- 정직 — "거래 완료" 배지 + 시간 표시 + fine print.
- 카탈로그 leak 0 — 이미 팔린 매물.
- 가입 incentive — "진행 중 매물 보려면 가입".

## 후속

launch-115 에서 UI 4가지 정정 (rose 톤 제거, 사진 배지/grayscale 제거, fine print 간소화, SSR 변환).
