# Wave 885 - 당근 ready 적은 이유 조사 (read-only)

## 사용자 질문

> "지금 왜 당근 ready 가 적은지 조사 좀. 적은 게 아닌가?"

## 측정 — 정말 적나?

Source 별 conversion funnel:

| Source | active | classified | eligible | in_pool | ready | classify% | eligible→pool% | ready/active |
|---|---|---|---|---|---|---|---|---|
| bunjang | 360,644 | 75,980 | 68,039 | 3,638 | 630 | 21% | 5.3% | 0.175% |
| **daangn** | 88,963 | 5,590 | 5,226 | **70** | **57** | 6.3% | **1.3%** | 0.064% |
| joongna | 22,641 | 10,850 | 10,757 | 447 | 94 | 48% | 4.2% | 0.415% |

당근 ready=57 vs bunjang ready=630 → 표면적으론 1/11 수준.

## 진짜 원인 — systemic pool conversion 99% loss (Wave 783 발견)

당근만의 issue 가 **아님**. 모든 source 에서 eligible → pool 변환율 매우 낮음:

| Source | eligible→pool% |
|---|---|
| bunjang | 5.3% |
| daangn | 1.3% |
| joongna | 4.2% |

Wave 783 발견 (별도 wave #96 pending):

> shoe 19,226 eligible → 33 ready (99.8% loss)
> clothing 15,341 eligible → 79 ready (99.5% loss)
> bag 5,467 eligible → 3 ready (99.9% loss)

전체 카테고리에서 99% loss. 당근의 손실율은 평균보다 약간 좋은 정도.

## 당근 특화 분석

### 1. 카테고리 분포 (당근 5,590 classified 매물)

| Category | classified | eligible | in_pool | ready | score_dirty (대기) | missing (score 처리 후 pool 진입 X) |
|---|---|---|---|---|---|---|
| clothing | 2,051 | 1,966 | 39 | 30 | 23 | **1,904** ⚠️ |
| shoe | 1,359 | 1,306 | 20 | 17 | 20 | **1,266** ⚠️ |
| bag | 648 | 524 | 0 | 0 | 512 | 12 (Wave 412b broad block — 의도) |
| sport_golf | 429 | 428 | 3 | 3 | 424 | 1 |
| smartphone | 453 | 422 | 2 | 2 | 420 | 0 |
| earphone | 150 | 125 | 0 | 0 | 127 | -2 |
| game_console | 87 | 86 | 0 | 0 | 85 | 1 |

**핵심**: clothing 1,904 + shoe 1,266 = **3,170 매물이 score 처리 후에도 pool entry 자체 생성 안 됨**.

### 2. 가격 분포 — 헐값 paradox

당근 매물 vs bunjang 매물 (같은 SKU):

| SKU | bunjang median | daangn median | daangn/bunjang |
|---|---|---|---|
| polo-apparel-broad | 72,000 | 40,000 | **56%** |
| polo-pony-tee | 39,000 | 25,000 | **64%** |
| uniqlo-broad | 25,000 | 15,000 | **60%** |
| tommy-hilfiger-broad | 30,000 | 20,000 | **67%** |
| adidas-trefoil | 35,000 | 30,000 | 86% |

당근 = bunjang 시세의 **56-67%** (동네 직거래 default 헐값).

**역설**: 헐값 → 차익 크게 보여야 → ready 잘 되어야 함. 근데 ready 안 됨.

가능한 원인:
- `expected_profit_min` 계산 시 시세 sample 에 당근 매물도 포함 → median 끌어내려 → 차익 작아 보임.
- `negative_resell_gap` 같은 strict gate 발동.
- `placeholder_price` 검사 — 너무 round 한 가격 (10K, 15K, 20K) 의심.

### 3. in_pool → ready 변환율

| Source | in_pool | ready | ready/in_pool |
|---|---|---|---|
| bunjang | 3,638 | 630 | 17% |
| **daangn** | 70 | 57 | **81%** ✓ |
| joongna | 447 | 94 | 21% |

당근은 pool 진입만 하면 ready 비율 81% (다른 source 의 4-5배). 즉 **분류 / pool 진입만 통과하면 ready 잘 됨**.

병목 = candidate-pool-builder 의 `canEnterPool=false` cascade (entry 자체 생성 안 됨).

## 결론

1. 당근 ready=57 은 다른 source 와 비슷한 손실율 (99% loss systemic).
2. 진짜 원인 = Wave 783 의 systemic pool conversion 99% loss — 모든 source 공통.
3. 당근 특화 추가 원인: 헐값 매물이 시세 sample 끌어내려 차익 계산 왜곡 가능 (별도 검증 필요).
4. 당근 매물은 pool 진입만 하면 81% ready (의류/신발 catalog 매칭 정확함 — 인접한 source 가 동일 catalog 활용 중).

## 사용자 ultimate goal (caulee1227 instruction)

> "당근 매물을 번장이나 중고나라처럼 ready 되는 개수를 저정도 나오게 하는거임"

bunjang ready=630, joongna ready=94, daangn ready=57. daangn 을 bunjang 수준 (600+) 으로 올리려면:
- (a) classify율 6.3% → 20%+ (catalog 확장 필요 — 동네 직거래 매물 다양성 커버)
- (b) eligible→pool 변환율 1.3% → 5%+ (Wave 784 systemic loss audit 필요)
- (a)(b) 둘 다 충족 시 daangn ready ~500 가능.

## 즉시 actionable (이번 wave 885 에 박힘)

- Wave 885: `PIPELINE_TICK_SCORE_LIMIT 300 → 100` (commit 24f55e29) — score backlog 자연 소진 후 baseline 재측정 가능. 24h 후 funnel 재확인.

## 후속 wave (별도)

- **Wave 784 systemic pool conversion loss audit** (task #96 pending) — Wave 783 가설 검증:
  - score-worker `skipReasonCounts` 노출 + 분석
  - need_review parser flag 영향 측정
  - AI review unavailable rate 측정
  - top 5 invalidation reason 식별
  - gate 완화 검토 (사용자 합의 필요 — 정확성 trade-off)

## What Not To Do

- 당근만의 issue 라고 가정 X — systemic issue (99% loss across all sources).
- Gate 완화 (예: low_volume_sku threshold 낮춤) 즉시 박기 X — 사용자 합의 + 정확성 trade-off 검토 필요.
- 당근 ingest 자체 변경 X — funnel 의 후반 (pool gate) 이 문제. ingest 는 정상 작동 (5,226 eligible 만들어냄).
