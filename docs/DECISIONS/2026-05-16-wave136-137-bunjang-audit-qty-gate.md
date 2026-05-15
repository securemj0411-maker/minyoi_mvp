# Wave 136 + 137 — bunjang.ts API audit + qty > 1 pool 차단

> Wave 132 commentCount 매핑 실수 재발 방지 audit → 새로운 발견 `product.qty` (수량) field = 대량 판매업자 신호.

## 1. 시간 + 동기
- 2026-05-16 (Wave 135 commit 2ec9548 후속)
- 사용자 명령: "너가 추천하는대로 진행" → audit + 발견 기반 차단 자동 진행

## 2. Wave 136 — bunjang.ts API field 매핑 audit

### 2a. 검증 방법
- detail API raw response 직접 dump (`scripts/wave132-backfill-num-comment.ts --audit=pid,...`)
- 모든 field 매핑 vs 실제 응답 key 비교

### 2b. 검증 결과
| Field | 매핑 | Raw response | 결과 |
|---|---|---|---|
| viewCount | metricsData.viewCount | ✅ | OK |
| favoriteCount | metricsData.favoriteCount | ✅ | OK |
| commentCount | metricsData.buntalkCount (Wave 132b) | ✅ | OK |
| shopReviewRating | shop.reviewRating | ✅ | OK |
| shopReviewCount | shop.reviewCount | ✅ | OK |
| shopFollowerCount | shop.followerCount | ✅ | OK |
| shopSalesCount | shop.salesCount | ✅ | OK |
| shopProshop | shop.proshop.isProshop | ✅ | OK |
| shopOfficialSeller | shop.isOfficialSeller | ✅ | OK |
| shopJoinDate | shop.joinDate | ✅ | OK |
| conditionLabel | product.condition (LIKE_NEW 등) | ✅ | OK |

**결과: Wave 132 commentCount 외 다른 wrong path 없음.**

### 2c. 새 발견 — `product.qty` field
audit 중 raw response에서 미사용 field 발견:
```
일반 매물:
  pid 402009410 (아이패드)    qty=1
  pid 398031598 (워치)        qty=1
대량 판매업자 (Wave 132 차단된 매물):
  pid 40516763 (냉장고세트)   qty=88
  pid 52257536 (게이밍PC)     qty=35
  pid 80147360 (아이폰 미개봉) qty=26
```
qty > 1 = 대량 판매업자 1:1 거래 X = pool 차단 신호. Wave 137로 즉시 적용.

## 3. Wave 137 — qty > 1 pool 진입 차단

### 3a. DB schema (migration `wave137_qty_column`)
- `mvp_raw_listings.qty` integer 컬럼 추가
- partial index `idx_mvp_raw_listings_qty` (qty > 1 only)

### 3b. 코드 (Wave 132 패턴 재사용)
- `bunjang.ts` DetailData.qty 추가 + product.qty 매핑
- `tick-pipeline.ts` detail-worker 2 위치 (normal + sold_confirmed) qty 박음
- `ScorableRawRow.qty` + SELECT columns 추가
- `PipelineRow.qty` + score 단계에서 row.qty 박음
- `candidate-pool-builder`:
  - `PoolCandidateInput.qty` optional 추가
  - `MAX_POOL_QTY = 1` const
  - `row.qty > 1` 차단 (reason `qty_above_1`)
  - NULL은 통과 (detail 미수집 → 다음 tick 재평가)

### 3c. One-time backfill (`scripts/wave137-backfill-qty.ts`)
- 332 pool 매물 detail fetch → qty 박음
- 결과: **19건 떨어뜨림** (qty > 1)
  - 분포: 1(294) / 2-5(17) / 6-20(2) / 21-50(2) / 50+(1)
  - Top: qty 555 / 50 / 26 / 18 / 10 (모두 대량 판매업자)

### 3d. Test (6 신규)
- qty 1 / 2 / 88 / null / undefined 케이스

## 4. 검증
- 172/172 test pass (165 + 7 신규: Wave 134 audit 2 + Wave 137 6)
- tsc clean
- backfill 실측: 19건 추가 차단 ✓
- Wave 132 댓글 + Wave 137 qty 합산: 113건 사용자 노출 전 차단

## 5. 위험 / 학습

### 5a. audit 패턴 영구화 필요
- 외부 API field 매핑 시 raw response dump + UI 비교 = 정책으로 정착
- `scripts/wave132-backfill-num-comment.ts --audit=pid,...` 진단 도구 재사용 가능

### 5b. qty = 1 default
- 사용자가 1개만 올린 매물 = 정상. qty = 0인 매물 (이상)도 통과 (NULL 처리)
- 매물 등록 시 default qty가 1이라 거의 모든 일반 매물 통과

### 5c. NULL = 통과
- detail 미수집 시 차단 못 함 — 다음 tick에서 enrich 후 재평가
- pool warmer는 detail enrich 우선순위 높음 (대부분 즉시 처리됨)

## 6. retention 효과
- Wave 132 댓글 ≥ 8 차단 (옛 누적 신호)
- Wave 137 qty > 1 차단 (즉시 신호)
- 둘 다 적용 시 대량 판매업자 매물 거의 0% pool 진입

## 7. 다음
- 24h 후 효과 측정 (qty > 1 추가 진입 시도 횟수)
- 사업 보고서 7-Layer 거의 끝 (L7만 보류)
- 다음 ROI 후보: 사용자 reveal feedback 집계 대시보드, 또는 다른 audit

## 8. 거론 금지
- qty > 5 등 더 느슨한 threshold — 1이 가장 엄격 (사용자가 다수 보유 = 거래의지 낮음)
- qty 자동 catalog narrow lane 우회 — 검증 안 됨
