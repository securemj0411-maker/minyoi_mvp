# Wave 57 — PS5 detail drain 병목 분석 + Bose/Sony WH/desktop query 추가

> Status: Track 1 **no-write 분석 only.** Track 2 **code patch + test/build 통과**, DB write 0, candidate_pool write 0, public promotion 0, DDL 0, RPC 0. mvp_search_queries 자동 등록은 cron의 정상 동작으로 다음 housekeeper cycle에서 처리됨 (manual sync 없음).

## Track 1 — PS5 detail queue drain 병목 분석

### 1.1 표면 측정

- PS5 5 query 합 raw_listings: **324**
- mvp_detail_queue entry: **228** (96 미진입 — 31+25+7+13+20)
- detail_done: **0** (224 pending + 4 done?? 실측 228 pending / 0 done)
- detail_queue 전체 status:
  - done 17,377 / pending 280 / failed 125 (PS5 외, 모두 exhausted)
- 22:44 (PS5 push 시점) 이후 updated_at 기준: **NON_PS5 done 120 / NON_PS5 pending 8 / PS5 0건 진전**

### 1.2 detail_queue 진입 실패 96건 (raw → queue insert 단계)

| query | raw | queue | skipped(no_queue_row) |
|---|---:|---:|---:|
| 플스5 디스크 | 96 | 65 | 31 |
| 플스5 디지털 | 93 | 68 | 25 |
| PS5 디지털 | 56 | 49 | 7 |
| PS5 디스크 | 46 | 33 | 13 |
| PS5 슬림 | 33 | 13 | 20 |
| **합** | **324** | **228** | **96 (29.6%)** |

96건은 tick 결과의 `detailQueueSkipped` (Wave 56 catch-up tick에서 290 reported, 그 중 일부)에 해당. raw row가 detail enrichment에 적합하지 않다고 판단된 rows (예: 이미 detail_status=done 또는 listing_state가 active 아님 등).

→ skip 자체는 정상 동작. **PS5 차별 skip은 아님**.

### 1.3 detail_queue claim 순서 — bottleneck 본질

`claim_mvp_detail_queue` SQL function (production):
```sql
order by q.available_at asc, q.created_at asc, q.priority desc
limit batch_size for update skip locked
```

- 280 pending 전건 available_at = 22:43:57 (모두 due_now).
- created_at: NON_PS5 oldest 22:44:06.78 vs PS5 oldest 22:44:06.85 — NON_PS5가 ~70ms 빠름.
- priority desc는 3차 tiebreaker.
- 결과: **created_at 정렬에서 PS5는 NON_PS5 뒤로 밀림**. detail-worker 배치 20 × 4-5회 호출 후에야 PS5 차례.

PS5 자체 priority 분포:
- 17 rows priority 1050-1374 (high)
- 211 rows priority 100-145 (low)
- avg 365
- NON_PS5 avg 620, max 1865

priority가 tertiary tiebreaker라 created_at 동일 ms 내 짝지어 처리될 때만 효과. 같은 second 내 microsecond 차이가 결정적.

### 1.4 detail-worker 실제 처리율

- Wave 55 측정: 60분당 detail_worker run 17회 × batch 20 = 이론 340 capacity.
- 실측 22:44~23:00 (16분) NON_PS5 done +120 = ~7.5 row/min ≈ 450 row/hour.
- 같은 16분 PS5 done +0 = **PS5 진전 0**.

PS5 228 rows를 비우려면 NON_PS5 backlog가 모두 처리된 후 PS5 차례. 현재 NON_PS5 8 pending + 새로 inflow (분당 ~3 row). PS5 cycle 도달까지 추정 **30~60분 추가 필요**.

### 1.5 판정 — **parser 문제 아니라 detail drain + queue ordering 병목**

- PS5 raw 324건 중 228건은 queue 정상 진입.
- claim ordering이 created_at 우선이라 같은 시점 batch에서 NON_PS5에 밀림.
- detail-worker 처리율은 평시 수준 (회당 batch 20 처리 정상).
- parser 패치 효과는 PS5 detail_done이 1건이라도 발생한 후에만 검증 가능. 현 시점 **검증 불가**.

### 1.6 추가 detail-worker 호출 — 보류

추가 manual detail-worker fire는 DB mutation을 일으킴 (queue claim → locked_until update). 사용자 지시 "DB mutation 없이 리포트만" 준수 위해 **보류**. 자연 cron이 30~60분 내 PS5 cycle 도달 예상.

대안: PS5 만 우선 처리하려면 detail_queue priority를 PS5 rows에 대해 일괄 1900+로 boost하는 DB write가 필요 — Wave 57 범위 외.

## Track 2 — Bose / Sony WH / desktop 자연어 query 추가

### 2.1 변경

`src/lib/pipeline-config.ts` DEFAULT_SEARCH_QUERIES에 7 query 추가 (56 → **63**):

```ts
// Wave 57: Bose / Sony WH / desktop natural-language coverage
"보스 QC", "Bose QC",
"WH-1000XM", "소니 헤드폰",
"맥미니", "아이맥", "맥스튜디오",
```

### 2.2 검증

- `npx tsc --noEmit` clean
- `npm run test:core` **135/135 pass**
- 총 query 수: 63 (module load 확인)

### 2.3 예상 동작

| query | queryFamily 반환 | decideCadence 분기 | 초기 동작 |
|---|---|---|---|
| 보스 QC / Bose QC | unknown | line 91-100 (isHarvestable=false) | mode=gather, cadence=5m, keepFresh=true |
| WH-1000XM / 소니 헤드폰 | unknown | 동일 | 동일 |
| 맥미니 / 아이맥 / 맥스튜디오 | unknown | 동일 | 동일 |

→ 7 query 전건 **gather + 5분 주기**로 가동. yield-based downrank (`decideCadence` line 102-118)는 evidence 누적 후 적용.

### 2.4 예상 영향

- Bunjang 검색 호출: 7 query × (60/5) = **84 호출/hour 추가**. 총 query 63 × 12 = 756 호출/hour (cadence 5m 기준 상한, 실제는 yield-based downrank로 더 적음).
- raw_listings 신규: query별 0~100 raw 예상 (JBL Flip 6 96 raw, 다이슨 V12 45 raw 사례 기반). 7 query 합산 200~400 raw/cycle 추정.
- detail_queue 진입: raw 중 active sale + new pid → 추가 ~150~300 queue entries/hour 발생 가능. **현재 PS5 backlog와 경쟁** — 두 트랙 catch-up 시간 추가됨.
- SKU 매칭: 결정론 narrow lane (bose-qc-ultra, bose-qc45, sony-wh-1000xm4, sony-wh-ch520, desktop-mac-mini-m2-256, desktop-imac-m3-24, desktop-mac-studio-m2 등)에 자연 inflow 확보 예상.

### 2.5 mvp_search_queries DB 자동 등록

Wave 56과 동일 메커니즘: housekeeper / tick search stage가 `DEFAULT_SEARCH_QUERIES`를 매 cycle 비교해서 mvp_search_queries에 upsert. **manual sync 불필요**. Wave 56 17 query도 자동 등록되었음 (Wave 56 follow-up에서 17/17 확인됨).

### 2.6 원칙 ack
- Track 1: DB mutation 0 / public 0 / candidate_pool 0 / DDL 0 / RPC 0 ✓
- Track 2: code patch만 / DB write 0 / candidate_pool 0 / public 0 / DDL 0 / RPC 0 ✓
- PS5 parser 판정 보류 (detail_done 늘기 전까지): ✓
- Bose/Sony WH/desktop query coverage 추가 우선: ✓
- 위험 mutation 순간만 멈춤: ✓ (Track 1 manual detail-worker fire 보류)

## 변경/검증/위험

- 변경: `src/lib/pipeline-config.ts` 7-line addition + comment (Track 2)
- 검증: tsc clean / test:core 135/135 / module load 63 queries
- 위험: 매우 낮음. rollback은 7-line removal.
- 다음 (Wave 58+):
  - PS5 detail catch-up 자연 cycle 1-2h 후 재측정 → parser patch 효과 (sku_id ps5-* binding) 확인
  - 7 신규 query natural inflow 60~120분 후 측정 (raw/detail/parsed/sku/pool)
  - JBL 플립6 (한글 압축) raw=0 cleanup 결정

## 남은 blocker

1. R3 contentHash 더블체크 path
2. needs-owner 407 stale row 사인오프
3. Phase A backup table DROP (2026-05-21+)
4. PS5 lanes owner decision (Wave 56 patch 일부 해소, detail catch-up 후 재평가)
5. **PS5 detail-worker 큐 228 catch-up** (Wave 56 후속, 자연 cycle 대기)
6. **Wave 57 +7 query 첫 cycle 측정** (본 wave 신규, 1~2h 후)
7. JBL 플립6 (한글 변형) raw 0 cleanup (사이드 발견)

→ **남은 blocker 7건**.
