# 2026-05-21 Wave 458 — shoe broad stale rows + buy-request false positive 정리

## 배경

Wave 456~457에서 Adidas Stan Smith/Gazelle/Superstar/Samba broad를 보수적으로 좁힌 뒤, 남아 있는 shoe broad active rows를 `ruleMatch` 기준으로 재감사했다.

## 결정

- Off-White Blazer, Jack Purcell special variants, Louis Vuitton named models, Gucci slide/brand-stuffed, Song for the Mute Shadowturf, Y-3 jersey 등 현재 룰로 더 이상 해당 broad에 남기면 안 되는 stale rows 14건은 `sku_id = null`, `listing_type = unknown`, `score_dirty = true`로 정리했다.
- `구매` / `매입` 전역 차단은 유지하되, 정상 판매 문구는 예외로 살렸다.
  - `국내 매장 구매`, `백화점 구매`, `구매 영수증/내역` 등 구매 이력 문구
  - `구매 시 당일 배송` 같은 판매 CTA
  - `명품 매입 문의`, `최고가 매입` 같은 판매자 서비스 문구
- 실제 역경매/구매요청 문구인 `구매합니다`, `삽니다`, `(구매 43)`, `매입합니다`는 계속 차단한다.

## 검증

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 160 pass / 0 fail
- `npx tsx scripts/wave458-shoe-broad-audit.ts`
  - 상위 active shoe broad groups 모두 `currentDiff = 0`
  - `shoe-converse-chuck70-high-broad`, `shoe-balenciaga-triple-s-broad`, `shoe-hermes-broad` 정상 매물 유지 확인

## 보류

- 사이즈별 회전률/표본 분리는 별도 wave에서 다룬다. 현재 wave는 SKU/비교군 혼입 방지와 stale row 제거에만 집중했다.
