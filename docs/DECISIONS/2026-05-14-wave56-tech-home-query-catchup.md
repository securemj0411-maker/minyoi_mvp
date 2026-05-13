# 2026-05-14 Wave 56 — Tech/Home Query Catch-up

## Decision

가전/테크/IT MVP 확장을 위해 `DEFAULT_SEARCH_QUERIES`에 monitor / speaker / game console / vacuum narrow queries를 추가하고, 즉시 local tick catch-up을 1회 실행했다.

추가 query count:

- 기존 `search_queries_total`: 39
- 변경 후 `search_queries_total`: 56
- 이론상 full pass 수집 상한: `56 * 96 = 5,376` search result rows

## Tick Result

Manual tick:

- endpoint: `/api/cron/tick?wait=1`
- collected: 1,054
- searchSucceeded: 17
- searchFailed: 0
- rawUpserted: 702
- queued: 392
- detailQueueSkipped: 290
- sellerUpserted: 586
- scored: 32
- aiApiCalls: 3
- poolUpserted: 2
- poolSkipped: 30
- timedOut: false

Cadence result:

- `search_queries_total=56`
- `search_queries_due=17`
- `search_queries_skipped_by_cadence=39`

즉 새 query 전체가 코드/서버에 반영됐고, 이번 tick에서는 cadence상 17개만 due로 실행됐다.

## New Query DB Snapshot

Window: `2026-05-13T22:15:00Z` 이후, Wave56 query만.

Raw rows:

- total new-query rows: 702
- detail done: 72
- detail pending: 352
- detail skipped: 278

Detail queue:

- pending: 352
- running: 0
- done: 17,297
- failed: 125

Parsed rows among new-query rows:

- parsed rows: 48
- needsReview=false: 33
- needsReview=true: 15
- categories: speaker 19 / monitor 10 / home_appliance 4 / null 15

SKU hits:

- `speaker-jbl-flip-6`: 19
- `monitor-xl2540k`: 5
- `monitor-27gl650f`: 2
- `monitor-27us550`: 2
- `monitor-39gx900a`: 1
- `home-appliance-dyson-v12-detect-slim`: 2
- `home-appliance-roborock-s8-pro-ultra`: 2

## Query-Level Notes

High raw volume:

- `JBL Flip 6`: 96 raw, 40 detail done, 19 SKU hits, 19 parser pass rows
- `닌텐도 스위치 OLED`: 96 raw, 68 pending, 0 SKU hits
- `플스5 디스크`: 96 raw, 65 pending, 0 SKU hits
- `플스5 디지털`: 93 raw, 68 pending, 0 SKU hits
- `로보락 S8`: 69 raw, 2 SKU hits, 2 parser pass rows
- `다이슨 V12`: 45 raw, 2 SKU hits, 2 parser pass rows
- `벤큐 XL2540K`: 32 raw, 20 detail done, 5 SKU hits, 5 parser pass rows

Important interpretation:

- JBL / monitor / Dyson V12 / Roborock S8 are already entering raw, detail, SKU, and parser paths.
- PS5 / Switch are entering raw in volume, but `sku_id` remains 0 because runtime catalog/adapter does not yet define the policy SKUs (`ps5_*_basic`, `switch_oled_base_unit_only`). This is the Wave55/PS5 root-cause track, not a cron failure.
- Detail remains the bottleneck: a follow-up detail-worker run processed `claimed=20 / enriched=20 / failed=0`, but hit `timedOut=true`. The system is working, but drains in small serverless chunks.

## Operating Health

After catch-up:

- pack-open-quality: sourceHealth `healthy`, reveal 42/48, activeReadyPool 360
- db-hotpaths: runs 36, failed 1, pg_stat ok
- top suspect: `detail_worker` cumulative 147.8s

## Follow-up

1. Let scheduled detail-worker continue draining the 352 pending details.
2. Run another status check after 2-3 detail-worker cycles.
3. Patch PS5/Switch runtime catalog/adapter in a separate Wave55/56 follow-up if owner wants those game-console lanes to parse into SKU/lane instead of raw-only collection.
4. Keep seller-name privacy rule unchanged: no top-level seller_name and no raw_json.shop_name.

## Follow-up Patch — Game Console Korean Edition Guard

Applied a narrow runtime parser/classifier fix after the Wave56 DB snapshot showed PS5/Switch raw volume but no PS5 SKU hits.

Changed:

- `src/lib/game-console-parser.ts`
  - recognized compact Korean PS5 edition wording:
    - `플스5 디스크`
    - `플스5 디지털`
    - same token family around `ps5`, `플스 5`, `플스5`, `플레이스테이션 5`
- `src/lib/pipeline.ts`
  - connected game-console scoped parser output back into global classification after catalog match.
  - `game_title`, accessory, damaged, buying, multi-bundle, and needs-review console rows are no longer allowed to pass just because catalog matched PS5/Switch tokens.

Guardrail:

- `플스5 디스크 본체 풀박스` + controller/full-set context can classify as normal PS5 Disc.
- bare `플스5 디스크` remains `unknown` because body/config context is missing.
- `PS5 디스크 게임 타이틀` is blocked as accessory/title noise, not a PS5 console.

Verification:

- `npm run test:core`: 135/135 pass
- `npx eslint src/lib/game-console-parser.ts src/lib/pipeline.ts tests/core-rules.test.ts --max-warnings=0`: pass
- `npx tsc --noEmit --pretty false`: pass

---

## Follow-up Measurement (2~3 detail-worker cycle 후)

read-only 측정. DB write 0, candidate_pool write 0, public promotion 0, DDL 0. patch 0 (Wave 56 본체 외).

### 1. Per-query 60분 활동 재측정

| query | raw_60m | raw_total | detail_done | parsed | clean | sku_id | pool |
|---|---:|---:|---:|---:|---:|---:|---:|
| 닌텐도 스위치 OLED | 96 | 96 | 8 | 6 | 4 | 1 | 0 |
| JBL Flip 6 | 77 | 96 | 43 | 33 | 19 | 1 | 0 |
| 플스5 디스크 | 96 | 96 | **0** | 0 | 0 | 0 | 0 |
| 플스5 디지털 | 93 | 93 | **0** | 0 | 0 | 0 | 0 |
| 로보락 S8 | 67 | 69 | 2 | 2 | 2 | 1 | 0 |
| PS5 디지털 | 56 | 56 | **0** | 0 | 0 | 0 | 0 |
| PS5 디스크 | 46 | 46 | **0** | 0 | 0 | 0 | 0 |
| 다이슨 V12 | 43 | 45 | 2 | 2 | 2 | 1 | **1** |
| PS5 슬림 | 33 | 33 | **0** | 0 | 0 | 0 | 0 |
| 벤큐 XL2540K | 28 | 32 | 27 | 8 | 5 | 1 | 0 |
| 다이슨 V15 | 24 | 24 | 0 | 0 | 0 | 0 | 0 |
| LG 27GL650F | 3 | 5 | 5 | 3 | 2 | 1 | 0 |
| 스위치 OLED | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| LG 27US550 | 1 | 3 | 3 | 3 | 2 | 1 | **1** |
| LG 39GX900A | 1 | 2 | 2 | 1 | 1 | 1 | 0 |
| Roborock S8 | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| JBL 플립6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

총: raw +670 / detail 92 / parsed 58 / clean 36 / pool +2.

### 2. SKU narrow lane 결정론 정상 (parsed_at < 3h)

| sku_id | category | rows | clean |
|---|---|---:|---:|
| speaker-jbl-flip-6 | speaker | 7 | 7 |
| switch-oled | game_console | 5 | 5 |
| monitor-xl2540k | monitor | 4 | 4 |
| monitor-27gl650f | monitor | 2 | 2 |
| monitor-27us550 | monitor | 1 | 1 |
| monitor-39gx900a | monitor | 1 | 1 |
| home-appliance-dyson-v12-detect-slim | home_appliance | 2 | 2 |
| home-appliance-roborock-s8-pro-ultra | home_appliance | 2 | 2 |

→ **8 narrow lane 결정론 binding 정상** ✓.

### 3. PS5 parser patch 검증 — 보류 (detail 큐 적체)

- PS5 5 query 합 raw: **324** / detail_done: **0** / detail_pending: **324**
- PS5 SKU bound: **0** (raw → detail enrichment 단계 통과 못함)
- 비교: JBL Flip 6 detail 처리율 45%, Switch OLED 8%, PS5 0%. 큐 FIFO/priority 영향 의심.

→ patch 자체 효과는 검증 불가. 다음 1~3h detail cycle 후 재측정 필요.

### 4. mvp_search_queries DB sync — **완전 일치**

Wave 56 추가 17 query 모두 mvp_search_queries에 등록 (17/17):
- category=unknown / cadence_minutes=5 / mode=gather / enabled=true / last_scanned_at=2026-05-13 22:50 UTC
- last_observed=0 (yield 평가 미실시, 다음 housekeeper cycle에서 갱신)

→ **추가 동기화 불필요.**

### 5. 잔여 갭 — Bose / Sony WH / desktop 자연어 query 0건

| 카테고리 | 자연어 Korean keyword query 등록 | 24h SKU 매칭 (source) |
|---|---:|---|
| Bose 헤드폰 (QC Ultra / QC45) | **0** | 0 (synthetic wave16/wave20_speaker_bose_boost: 만) |
| Sony WH-1000XM / WH-CH520 | **0** | 0 |
| desktop (Mac mini / iMac / Mac Studio) | **0** | iMac 31 + Mac mini 6 (전부 synthetic `wave17/22_desktop_boost:` query, 자연어 0) |

Wave 55 권고 9 query (Bose 4 / Sony WH 4 / desktop 3) 중 **Wave 56에서 0개 추가됨**. 3 카테고리는 자연 cron coverage 그대로 0.

추가 후보 (Wave 57+ 사인오프 별도):
- Bose: "보스 QC" / "Bose QC" / "보스 큐씨"
- Sony WH: "WH-1000XM" / "소니 헤드폰" / "소니 WH"
- desktop: "맥미니" / "아이맥" / "맥스튜디오"

### 6. JBL 플립6 변형 raw 0 — 사이드 발견

압축 표기 "JBL 플립6"은 0 raw. "JBL Flip 6" (영어+띄어쓰기)는 96 raw. 변형 query는 효과 없음 → 청소 후보 (별도 결정).

### 7. 결론

- Wave 56 patch 효과 검증: **8 narrow lane SKU 결정론 binding 정상**. pool 진입 2건 (Dyson V12, LG 27US550).
- DB sync 100% — 추가 동기화 없음.
- **PS5 patch 효과 검증 보류** — detail 큐 324건 적체, 1~3h 후 재측정.
- **Bose / Sony WH / desktop 자연어 query 9건 갭 잔존** — Wave 57+ 사인오프 별도.
- JBL 플립6 (한글) 변형 raw 0 — 청소 후보.

### 8. 남은 blocker (재정렬)

1. R3 contentHash 더블체크 path
2. needs-owner 407 stale row 사인오프
3. Phase A backup table DROP (2026-05-21+)
4. PS5 lanes owner decision (Wave 56 patch 일부 해소, detail catch-up 후 재평가)
5. **Bose / Sony WH / desktop 자연어 query 추가** (Wave 57+)
6. **PS5 detail-worker 큐 324건 catch-up** (본 follow-up 신규)

