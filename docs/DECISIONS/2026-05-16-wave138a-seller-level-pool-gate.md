# Wave 138a — 셀러 단위 pool 차단 (qty 위장 업자 탐지)

> 사용자 명령: "셀러 감지되면 차단" + "qty 1개로 여러개 똑같은거 올리는 애도 차단".

## 1. 시간 + 동기
- 2026-05-16 (Wave 137 commit 64a40d3 후속)
- Wave 137 qty>1 차단 우회 패턴 발견: 같은 셀러가 qty=1 매물 N개 따로 등록

## 2. DB 발견

### 같은 셀러 + 같은 매물명 반복 등록 (qty 위장)
```
sha256:0499...  "에어팟 프로2 본체(C타입)"               46건
sha256:7451...  "[최저가/번장1등] 큐베이스 가상악기..."     45건 (불법 SW)
sha256:f296...  "전국출장매입 갤럭시탭/아이패드/애플워치"  40건 (출장 매입업자)
sha256:5004...  "리퍼급 갤럭시s23FE 256GB"               36건 (대량 리퍼)
sha256:135e...  "갤럭시S23FE 대량보유"                    28건 ⚡ "대량보유" 명시
sha256:9962...  "타이틀리스트 TSR2/TSR3 일본 직수입"      28건×2 (수입업자)
sha256:5004...  "갤럭시S24 256G 무잔상 52.5만"           25건
```

→ qty=1 매물을 검색 노출 다중화로 분산 등록 = Wave 137 qty 차단 우회.

## 3. 변경

### 3a. `src/lib/candidate-pool-builder.ts`
- `PoolCandidateInput.sellerUid?: string | null` 추가
- `MAX_POOL_LISTINGS_PER_SELLER = 1` const (셀러당 1 매물 strict)
- `buildCandidatePoolRows`:
  - input에 `existingPoolSellerCounts?: Map<sellerUid, count>` 추가
  - batch 내 seller counter + existing 합산 ≥ 1이면 차단
  - rows를 score 내림차순 sort → 가장 높은 매물만 통과

### 3b. `src/lib/pipeline.ts`
- `PipelineRow.sellerUid?: string | null` 추가

### 3c. `src/lib/tick-pipeline.ts`
- score 단계에서 `row.seller_uid` → `PipelineRow.sellerUid` 매핑
- `loadExistingPoolSellerCounts()` 함수 신규: pool ready 매물의 seller_uid count
- `buildCandidatePoolRows` 호출 시 `existingPoolSellerCounts` 전달

### 3d. One-time DB 정리
- pool에서 같은 seller_uid 매물 중 score 최고 1건 빼고 모두 invalidate
- **71건 차단** (Top: 403ae 28매물→1, f068b 12→1, 8d30d 11→1 등)

### 3e. Test (5 신규)
- 같은 셀러 1개 → 통과
- 같은 셀러 batch 3개 → 1개만 통과 (score 가장 높은 것)
- 같은 셀러 existing 1 + 신규 → 차단
- 다른 셀러 다수 → 모두 통과
- sellerUid null → 통과

## 4. 검증
- 177/177 test pass (172 + 5 신규)
- tsc clean
- One-time backfill: 71건 차단

## 5. 누적 효과 (Wave 132 + 137 + 138a)
```
Wave 132 (댓글 ≥ 8):        94건 차단
Wave 137 (qty > 1):         19건 차단
Wave 138a (셀러 N ≥ 2):     71건 차단
─────────────────────────────────
총: 184건 사용자 노출 전 차단 (=대량 판매업자/위장 업자)
```

## 6. 위험
### 6a. score 가장 높은 1건 통과 — 진짜 1:1 거래 셀러도 score 1건만 노출
- 정상 셀러가 다양한 매물 1개씩 가지면 (예: 아이폰 + 워치 + 에어팟) → 그 중 1개만 노출
- 위험: 정상 1:1 거래 셀러 over-rejection. Pool 다양성 ↓
- 단 일반인이 다양한 카테고리 동시 판매 = 거래 활발한 사람 (셀러) ≈ 업자 가까움
- 보수적 차단 정당

### 6b. score 가장 높은 1건 ≠ 가장 좋은 매물
- score 단계가 priceGap+velocity+safety로 계산. 정확함
- score 동률 시 confidence DESC 적용

### 6c. existing count fetch race
- buildCandidatePoolRows 호출 직전 fetch — 다른 tick과 race 가능 (작음)
- 다음 tick에서 자연 보정

## 7. 다음
- **Wave 138b — 같은 description 다중 셀러 차단** (다중 ID 사기 그룹)
  - DB 발견: 동일 description text 27건/7명 셀러 (복붙 = 같은 사람 다중 ID)
- 24h 효과 측정

## 8. 거론 금지
- MAX_POOL_LISTINGS_PER_SELLER 2 이상 — 우선 strict 1 (사용자 명령)
- 셀러 reputation 기반 예외 — 별도 wave
