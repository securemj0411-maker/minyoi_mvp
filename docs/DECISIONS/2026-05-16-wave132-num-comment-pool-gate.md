# Wave 132 — 댓글 수 >= 8 pool 진입 차단 (사용자 정책)

> 사용자 지적: "댓글수가 8개 이상 넘어가면 추천을 안해야겠는데?? 흥정 호가 괴리 생겨서 이건 추천해봤자 의미가 아예 없어".

## 1. 시간 + 동기
- 2026-05-16 진행 (Wave 131 commit 55f8447 후속)
- 사용자 직접 명령: 8개 이상 차단 + one-time backfill + 영구 gate

## 2. 발견
- `bunjang.ts:222`가 detail API의 `commentCount` 받지만 **pack-open 시점에만 사용** (DB persistent X)
- `mvp_raw_listings`에 `comment_count` 컬럼 자체 **없음**
- `raw_json`은 search 시점 데이터만 (`search.num_comment`는 거의 0 — search 시점엔 막 등록된 매물)
- 진짜 댓글 수가 DB에 없어서 score/pool 단에서 활용 불가
- DB 측정: active 80,184건 중 `search.num_comment >= 8`은 27건 (대부분 대량 판매업자 — 냉장고 세트, 미개봉 폰 다수)

## 3. 변경
### 3a. DB schema (migration `wave132_num_comment_column`)
- `mvp_raw_listings.num_comment` 컬럼 추가 (integer, nullable)
- partial index `idx_mvp_raw_listings_num_comment` (NOT NULL only)
- COMMENT: 댓글 수 정책 명시

### 3b. detail-worker 정규화 (`src/lib/tick-pipeline.ts`)
- detail enrich 위치 2곳 (normal + sold_confirmed) 모두 `num_comment: detail.commentCount` 박음
- ScorableRawRow type에 `num_comment: number | null` 추가
- `loadScorableRows` / `loadMarketStatRows` / `loadMarketStatRowsByPids` SELECT 컬럼에 `num_comment` 추가
- score 단계 (PipelineRow build)에 `numComment: row.num_comment` 박음

### 3c. PipelineRow type (`src/lib/pipeline.ts`)
- `numComment?: number | null` 필드 추가

### 3d. Pool gate (`src/lib/candidate-pool-builder.ts`)
- `PoolCandidateInput.numComment?: number | null` 추가
- `MAX_POOL_NUM_COMMENT = 8` const 신규
- `buildCandidatePoolRows` 안에서 `row.numComment >= 8` 차단 (reason `num_comment_above_8`)
- NULL/undefined는 통과 (detail 미수집 매물 → 다음 tick에서 재평가)

### 3e. One-time backfill (`scripts/wave132-backfill-num-comment.ts`)
- 현재 pool 매물 (status IN ready/reserved) pid list 조회
- 병렬(c=10) bunjang detail API fetch → commentCount 추출
- `mvp_raw_listings.num_comment` UPDATE
- num_comment >= 8 매물 `invalidate_mvp_pool_entry` RPC 호출 (pool 떨어뜨림)
- 통계 + 분포 출력
- `--probe=<pid,…>` 옵션: detail API 응답 진단

### 3f. Test (`tests/wave132-num-comment-gate.test.ts`)
6 케이스: num_comment 0 / 7 / 8 / 912 / null / undefined.

## 4. 검증
- 165/165 test pass (159 기존 + 6 신규)
- tsc clean
- **Detail API commentCount 정상 반영 검증**:
  ```
  pid=40516763 commentCount=912  ← 대량 판매업자 냉장고+세탁기
  pid=52257536 commentCount=569  ← 게이밍PC 본체 다수 판매
  pid=80147360 commentCount=386  ← 미개봉 아이폰16프로 다수
  pid=97663750 commentCount=337  ← 미개봉 아이폰15프로 다수
  pid=91607510 commentCount=208  ← 미개봉 갤럭시 S25 시리즈
  ```
  모두 search.num_comment와 일치 또는 약간 갱신됨.
- One-time backfill 결과 (419 pool 매물):
  - 성공 391 / 실패 28 (detail_null = 매물 사라짐)
  - 댓글 분포: 모두 0건 (pool 매물 = score 통과한 신선 매물 = 자연 필터)
  - 떨어뜨린 매물 0건 — pool 안엔 댓글 많은 매물 이미 없음

## 5. 위험
### 5a. Pool 매물 backfill 효과 0건
- Pool은 score 통과 + listing_type=normal + risk_hits=0 등 다 통과한 신선 매물만 들어옴
- 댓글 많은 매물 (대량 판매업자 등)은 score 단계 또는 다른 필터에서 자연 제거
- Gate 박은 효과는 marginal — 단 옛 매물이 pool 진입 시도할 때 안전장치

### 5b. NULL = 통과 정책
- detail 미수집 매물은 num_comment NULL → gate 통과
- 처음 등록된 매물이 detail-worker queue 대기 동안 pool 진입 가능
- detail enrich 후 num_comment >= 8이면 다음 score tick에서 차단 (score_dirty=true 마킹)
- 자연 deferred check — 단기 노출 가능 (1-2 tick 사이)

### 5c. 8 threshold 임의
- 사용자 명시 ("8개 이상")
- 향후 데이터 누적 후 분포 봐서 threshold 조정 가능 (5/10/15 등)
- 측정: `select count(*) from mvp_raw_listings where num_comment >= N group by N`

## 6. retention 효과 (가설)
- 옛 매물 (댓글 100+ 누적) 진입 차단 — 호가-실거래 괴리 큰 매물 추천 0
- 사용자 경험: 추천 매물 = "갓 올라온 신선 매물 + 거래 의향 있는 셀러"
- 시세 (Wave 130 condition + Wave 131 decay) + 매물 신선도 (Wave 132 댓글) = 3중 retention factor

## 7. 다음
- 24h~7d 데이터 누적 후 num_comment 분포 측정 → threshold 조정 결정
- 사업 보고서 L5b launch event reset (남은 항목)
- 보고서 외 A) 평균 차익 chip condition별 분리 / B) ConfidenceBreakdown sample 분리

## 8. 거론 금지
- raw_json.search.num_comment 활용 (search 시점이라 0뿐 — 의미 X)
- threshold 동적 조정 (사용자 명시 8 유지)
