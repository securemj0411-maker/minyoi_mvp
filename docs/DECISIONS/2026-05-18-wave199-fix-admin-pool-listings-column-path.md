# Wave 199 — admin pool API "pool_listings_failed" fix

## 사용자 보고

> "운영자 풀 매물 검증 ... 에러: pool_listings_failed"

## 원인

Wave 184 (Phase 0 L4) 박을 때 admin pool API select 컬럼 위치 잘못 추정:

| 컬럼 | 의도된 테이블 (Wave 184 가정) | 실제 위치 |
|---|---|---|
| description_preview | mvp_listings | ✅ 둘 다 (listings + raw) |
| image_count | mvp_listings | ✅ 둘 다 |
| **shop_review_rating** | mvp_listings | ❌ **raw_listings 만** |
| **shop_review_count** | mvp_listings | ❌ raw_listings 만 |
| **free_shipping** | mvp_listings | ❌ raw_listings 만 |
| **num_faved** | mvp_listings | ❌ raw_listings 만 |
| **num_comment** | mvp_listings | ❌ raw_listings 만 |

→ PostgREST 가 `mvp_listings?select=...,shop_review_rating,...` 호출 시 컬럼 없음 → **400 Bad Request** → `restFetch` throw → catch block → response "pool_listings_failed".

운영자 풀 페이지 진입 시 매번 fail. Wave 184 이후 (오늘 새벽) 부터 발생.

## fix

### listings select — 5개 컬럼 제거
```ts
mvp_listings?select=pid,name,price,sku_name,sku_median,thumbnail_url,url,description_preview,image_count
                                                                       ^^^^^^^^^^^^^^^^^^^^^^^ 유지
```

### raw_listings select — 5개 컬럼 추가
```ts
mvp_raw_listings?select=pid,sku_id,sale_status,listing_state,last_seen_at,query,seller_uid,
  shop_review_rating,shop_review_count,free_shipping,num_faved,num_comment
```

### items.map — `l.` → `r.` 변경
```ts
sellerReviewRating: r.shop_review_rating != null ? Number(r.shop_review_rating) : null,
sellerReviewCount:  r.shop_review_count != null ? Number(r.shop_review_count) : null,
freeShipping:       Boolean(r.free_shipping),
numFaved:           r.num_faved != null ? Number(r.num_faved) : null,
numComment:         r.num_comment != null ? Number(r.num_comment) : null,
```

## 비파괴 검토

- 컬럼 select 위치만 변경 — DB 변경 X
- 응답 shape 그대로 (PoolItem 타입 그대로)
- RiskScoreBar / verdict / liquidity 모두 동일 데이터 받음 (위치만 다름)

## Test

`npm run test:core`: **412/412 pass**.

## 점검 방법 (배포 후)

1. https://minyoi-mvp.vercel.app/cau~~ 진입 (admin 로그인 상태)
2. 운영자 풀 페이지 정상 로드 확인
3. 매물 카드에 RiskScoreBar + verdict chip 표시 확인

## Linked

- `2026-05-17-wave184-security-audit-phase1.md` (원인 박힌 wave)
- `2026-05-17-l4-risk-score-chip.md` (RiskScoreBar 박은 첫 wave)
- `2026-05-17-wave187-liquidity-curve-admin-pool.md`
- `2026-05-17-wave190-score-flags-from-listing-analysis.md`
