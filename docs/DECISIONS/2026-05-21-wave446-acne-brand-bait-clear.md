# 2026-05-21 Wave446 — Acne brand-listing bait clear

## 배경
- Wave444/445 이후 Acne broad 잔여를 샘플링했더니, 실제 Acne Studios 본품이 아닌 브랜드 나열/스타일 bait 가 3건 남아 있었다.
  - `르샵 양털 뽀글이 아크네 무스탕 소유 착용 55`
  - `모스키노 아크네 바나나 스팽글 자수 티셔츠`
  - `시스템 티셔츠 한섬 헬무트랭 아크네스튜디오 타임 이자벨마랑 마쥬`

## 결정
- `르샵/leshop/le shop` 은 Acne apparel broad/tee 에 들어오지 못하게 차단했다.
- `모스키노`, `시스템/한섬/...` 류는 Wave444 에서 tee guard 로 이미 차단했으며, 이번 wave 에서는 기존 DB stale row 를 정리했다.
- 이 3건은 다른 narrow SKU 로 옮기지 않고 `unknown` 으로 내렸다.

## DB 적용
- dry-run: active `clothing-acne-apparel` 중 bait candidates 3건.
- 적용:
  - `mvp_raw_listings`: 3건 `listing_type=unknown`, `sku_id=null`, `sku_name=null`, `score_dirty=true`.
  - `mvp_listing_parsed`: 3건 stale row delete.
  - `mvp_candidate_pool`: 3건 stale row delete 시도.

## 검증
- 재 dry-run:
  - bait candidates: 0건.
  - active `clothing-acne-apparel` 잔여: 49건.
- 테스트:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 결과: 192 pass / 0 fail

## 보류
- 남은 broad 49건은 대부분 실제 Acne product type row 로 보인다.
  - shorts 8, jacket 10, dress 5, knit 5, pants 4, type_unknown 6 등.
- 다음 wave 에서는 repeated product-type generic lane 으로 좁힐지, broad+product_type 유지가 더 안전한지 판단한다.
- 사이즈별 회전률 bucket 보정은 별도 wave 로 진행한다.
