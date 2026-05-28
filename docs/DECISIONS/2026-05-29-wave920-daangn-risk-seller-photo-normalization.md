# 2026-05-29 Wave 920 — 당근 위험 신호 seller/photo 정규화

## 결정
- 당근마켓 seller 위험 신호는 `shop_review_count=0`을 신규 판매자/후기 0건으로 해석하지 않는다.
- 당근은 UI에서 후기/평점 중심 표현을 쓰지 않고, 매너온도 기준으로 `매너온도 미확인`, `매너온도 N°C`만 노출한다.
- 당근 `image_count=0`은 과거 search-only row의 "상세 사진 수 미확인"으로 처리하고, 위험 신호에서 `사진 0장`으로 단정하지 않는다.
- 당근 detail HTML의 `images[]`를 파싱해 detail 수집/실시간 검증 시 `image_count`를 갱신한다.

## 구현
- `src/lib/daangn.ts`: `DaangnSearchArticle.images` 파싱 추가.
- `src/lib/daangn-ingest.ts`: 당근 raw upsert에 실제 detail image count 저장.
- `src/lib/risk-score.ts`, `src/components/risk-score-bar.tsx`: 당근 seller/photo 위험 신호 source-aware 분기.
- `src/components/pack-reveal-modal.tsx`: 쉬운모드 구매 전 체크에서 당근은 후기 대신 매너온도 확인으로 표시.
- `src/app/api/packs/pool/detail-access/route.ts`, `src/lib/pack-open.ts`: 당근 live/detail 확인 시 사진 수·매너온도·댓글 수를 갱신.

## 보류
- 기존 DB에 이미 `image_count=0`으로 저장된 당근 row의 대량 backfill은 이번 wave에서 하지 않는다. 사용자가 상세를 열거나 cron detail이 다시 돌면 점진 갱신된다.
