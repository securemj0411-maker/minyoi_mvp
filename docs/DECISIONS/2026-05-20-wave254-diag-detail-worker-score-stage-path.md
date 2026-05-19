# Wave 254 — detailStage / scoreStage path 진단 (read only)

## 결론 요약 (3 lines)

1. **detail-worker 자체는 정상 작동**: 2분 cron 마다 ~190~200 매물 enrich, parser_version 'wave216-clothing-v7' 잘 박힘 (사용자 매물 #202 BAPE Tee 검증 완료).
2. **scoreStage 가 marketStatsStage 의 markRawScoreDirty 결과를 못 따라잡음** — system-wide **sku_median stale 12,547건 / 20,569 active = 61%**.
3. **clothing v3 매물 2,318건 — Wave 253 fix A backfill 후도 detail-worker 처리율 0.2%** (done=4건). queue INSERT 됐지만 다른 신선 매물에 밀려 claim 안 됨.

## 진단 결과 — 3 영역

### A. detailStage parseListingOptions 호출 path

**code path** (`mvp/src/lib/tick-pipeline.ts:1560 detailStage`):
- 매 batch 800 claim → `Promise.all` concurrency 15 (TICK_DETAIL_CONCURRENCY default 15)
- 매 매물:
  1. `fetchDetail(claim.pid)` (line 1588)
  2. sold-out 신호 강하면 → sold_confirmed 처리, queue done, return
  3. `parseListingOptions` 호출 (line 1664) — **stale 체크 없이 무조건 reparse**
  4. `upsertRows("mvp_listing_parsed", [parsed], "pid")` (line 1764) — 신선 parser_version + comparable_key 박힘
  5. raw `score_dirty: true` patch (line 1707) — schema 있으면
  6. detail_queue `markQueueDone(claim.queue_id)` (line 1822)

**결론**: detail-worker 자체는 **정상**. parser v7 잘 박힘. 사용자 매물 #202 (pid 407160018) 검증:
- parser_version: `wave216-clothing-v7` ✓
- comparable_key: `clothing|bape_tee|tee|a_grade` ✓
- parse_confidence: 1.0, needs_review: false ✓
- detail_enriched_at: 2026-05-19 13:03:02 ✓

### B. /api/cron/detail-worker manual 호출 — skip 결정

production data 로 path 완전 가시화됨 — manual 호출 불필요:
- recent 1h `/api/cron/detail-worker` runs (2분 cron, 36 runs / 1h+):
  - enriched: 평균 190~200 (max 198 — TICK_DETAIL_LIMIT 200 cap)
  - duration: ~21s
  - upserted: 9~25 (parsed_listing 신선 row)
- v3 매물 2,318건 — Wave 253 fix A 후 done=**4건만**. Wave 253 helper 가 detail_queue INSERT IGNORE 박았지만 (Wave 253 fix A push 9d6a5eb), **다른 신선 매물 (oldest pending 17:11) 이 queue 우선 처리됨** → v3 매물 queue 안에서 starved.

### C. scoreStage 호출 path (root cause #2)

**code path** (`mvp/src/lib/tick-pipeline.ts:4166 scoreStage`):
1. `loadScorableRows(config.tickScoreLimit=800)` — filter:
   - `score_dirty=eq.true` (line 1911)
   - `detail_status=eq.done`
   - `listing_type=eq.normal OR listing_type_override=eq.normal`
   - `sku_id=not.is.null`
   - `listing_state=eq.active`
   - **order: `last_seen_at.desc` limit 800**
2. `ensureParsedRows` — parser_version stale 시 force reparse (Wave 216 fix, line 2091)
3. `loadMarketPriceStats` — comparable_key 별 시세 fetch
4. `marketGroupKey` + `preciseComparableKey` + `pickMarketStatByCondition` 으로 marketStat 결정
5. `skuMedian = trustedMedian ?? fallbackMedian` (line 4348)
6. `upsertRows("mvp_listings", listingUpserts, "pid")` — 박힘

**cron entry**:
- `/api/cron/tick` 2분 cron → `runSearchScorePipeline` → **search + score** (detail skip!)
- `/api/cron/detail-worker` 2분 cron → `runDetailWorkerPipeline` → **detail only** (score skip!)
- `/api/cron/market-worker` 1h cron → `runMarketStatsPipeline` → marketStatsStage

즉 **tick 2분 마다 scoreStage 돌긴 함** (cron 자체는 정상).

**그러나 system-wide root cause**:
- 시스템 dirty 매물 distribution:
  - score_dirty=true: **201,580건**
  - + detail_status=done: **22,312건**
  - + active: **14,226건**
  - + sku_id NOT NULL: **437건**
  - + (listing_type=normal OR override=normal): **8건만**
- 즉 한 tick scoreStage 가 처리 가능한 정상 dirty 매물 **8건**.
- 그러나 **stale_sku_median 매물 12,547건** (market 시세 listing 이후 갱신됨 + dirty=false).

**핵심 모순**:
- markRawScoreDirty (`mvp/src/lib/tick-pipeline.ts:1926`) 가 marketStatsStage 에서 호출되면 같은 comparable_key 의 80 매물 모두 dirty=true 박혀야 함.
- 그러나 BAPE Tee comparable_key 80매물 검사 결과:
  - parse_confidence=1.0, needs_review=false → 필터 통과 (line 2057)
  - 그러나 80매물 **전부 score_dirty=false** ← **dirty 한 번도 안 박힘**.

**가능한 root cause 가설** (확정은 추가 진단 필요):

1. **가설 G1 — markRawScoreDirty silent fail**: `loadParsedRowsByComparableKeys` limit 5000 인데 chunk 별 read 가 어떤 row 만 가져옴. URL 길이 한도 (chunk REST_KEY_READ_CHUNK_SIZE) 일 수도. catch fail handler (`tick-pipeline.ts:3230`) 는 console.error 만, 영향 X.
2. **가설 G2 — marketStatsStage 호출 빈도 부족**: `/api/cron/market-worker` 1h cron 만 호출. 1h 사이 신선 detail enrich (mvp_market_key_invalidation queue 등록) 가 1h 안에 dirty mark 못 받음. 매물 #202 의 경우 detail enrich 13:03 → market invalidate 13:03 → 1h cron 다음 호출 14:22 — **그러나 매물 #202 last_seen_at=13:00 이라 28h lookback 이전 → loadMarketStatRows page 에 들어옴**. 그 시점 marketStatsStage 가 markRawScoreDirty 호출했어야.
3. **가설 G3 — recomputedKeys preciseComparableKey filter**: `tick-pipeline.ts:3216~3220` — `recomputedKeys` 는 `preciseComparableKey` 통과한 매물의 comparable_key 만 박힘. 즉 시세 박힌 (mint condition 80 매물 중 8건이 mint condition 시세 sample) 매물의 comparable_key 만 dirty mark 대상. 그러나 같은 comparable_key 의 다른 condition (clean/normal) 매물도 dirty 박혀야 시세 변경 반영됨 — `markRawScoreDirtyByComparableKeys`는 comparable_key 만 보고 조건 무관 — **same comparable_key 80 매물 모두 dirty 박아야 함**.
4. **가설 G4 — scoreStage 가 처리 후 clearScoreDirty 호출하지만, 그 이전 markRawScoreDirty 가 못 박은 매물은 dirty=false 그대로**. 즉 markRawScoreDirty 가 한 번도 매물 #202 row 박지 못함. **가장 가능성 높음**.

**가장 의심되는 코드** (`tick-pipeline.ts:1926~1938`):
```ts
async function markRawScoreDirtyByComparableKeys(comparableKeys: string[]): Promise<number> {
  if (!(await rawScoreDirtySchemaAvailable())) return 0;
  const unique = [...new Set(comparableKeys.filter(Boolean))];
  if (unique.length === 0) return 0;
  const parsedByPid = await loadParsedRowsByComparableKeys(unique, 5000);  // ← limit 5000
  const pids = [...parsedByPid.keys()];
  if (pids.length === 0) return 0;
  for (const chunk of chunkArray(pids, REST_WRITE_CHUNK_SIZE)) {
    await patchRowsByIds("mvp_raw_listings", chunk, { score_dirty: true }, REST_WRITE_CHUNK_SIZE);
  }
  return pids.length;
}
```

그리고 `loadParsedRowsByComparableKeys` (line 2049):
```ts
async function loadParsedRowsByComparableKeys(comparableKeys: string[], limit: number) {
  const unique = [...new Set(comparableKeys.filter(Boolean))].slice(0, limit);  // ← comparable_keys 자체 limit 5000
  const columns = "...";
  const rows: ParsedListingRow[] = [];
  for (const chunk of chunkArray(unique, REST_KEY_READ_CHUNK_SIZE)) {
    const encoded = chunk.map((key) => encodeURIComponent(key)).join(",");
    const url = `${tableUrl("mvp_listing_parsed")}?select=${columns}&comparable_key=in.(${encoded})&parse_confidence=gte.0.65&needs_review=eq.false&limit=${Math.max(limit, chunk.length * 100)}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    rows.push(...((await res.json()) as ParsedListingRow[]));
  }
  return new Map(rows.map((row) => [row.pid, row]));
}
```

**문제 의심점**: 
- `limit=${Math.max(limit, chunk.length * 100)}` — chunk REST_KEY_READ_CHUNK_SIZE default 100 가정 시 `chunk.length * 100 = 10,000` — OK.
- **그러나 PostgREST default max-rows=1000 cap** (Wave 184 코멘트 line 1988~1991 확인) — `limit=10000` 박아도 **1000개 만 return**. 80 매물 같은 comparable_key 검색 시 OK (80 < 1000). but **대규모 comparable_key (예: shoe broad/clothing tee 처럼 1000+ 매물 키)** 일부만 fetch → 그 매물 dirty 안 박힘.

**그러나 BAPE Tee 80 매물 case 에서도 80 < 1000 — 다 박혀야 정상**. 즉 G4 fail path 별도 root cause 가능성 (예: REST PATCH error swallow, PostgREST timeout, etc).

추가 진단 필요 (사용자 결정 후 진행):
- `markRawScoreDirty` console.error 로그 확인 (Vercel logs)
- 강제 fire `/api/cron/market-worker` → markRawScoreDirty 결과 dirty 매물 count 측정
- BAPE Tee 80 매물 force dirty=true 박은 후 scoreStage 통과 시 sku_median 78,200 박히는지 검증

### 추가 발견 — clothing v3 stale 잔존

- v3 매물 2,318건, done=**4건** (0.2%) ← Wave 253 fix A 14k backfill 후 잔존
- v3 매물 score_dirty=true=**2,318건** (Wave 253 helper rematch trigger 박음)
- v3 active=2,257, done=4 — **detail-worker 처리 X**
- 원인: detail_queue 안에 신선 매물 (오늘 collect, ranked higher 또는 oldest pending 17:11 등) 가 우선 claim 됨

## fix 옵션 제안 (Wave 254 sub-wave plan)

**모든 옵션 사용자 결정 대기. agent 자율 X.**

### sub-wave A — root cause fix (score_dirty propagation)

**A.1 (정보 only)**: Vercel logs 에서 markRawScoreDirty 호출 횟수 + dirty pids 박힌 count log 추적 — code 변경 없이 1h 관찰.

**A.2 (작은 코드 변경)**: `markRawScoreDirtyByComparableKeys` 에 명시적 dirty count + comparable_key 별 박힌 pid 수 console.log 추가. release → 1h 모니터.

**A.3 (직접 fix)**: `markRawScoreDirtyByComparableKeys` 에 retry 추가 or `loadParsedRowsByComparableKeys` 의 `parse_confidence>=0.65 AND needs_review=false` filter 제거 (시세 sample 자격은 별도, dirty mark 은 모든 매물 박아야).

### sub-wave B — sku_median backfill (12,547건)

**B.1 (force dirty)**: `mvp_raw_listings.score_dirty = true` 강제 박기 — comparable_key 별로 시세 변경된 매물만. helper script:
```sql
UPDATE mvp_raw_listings r
SET score_dirty = true
FROM mvp_listings l, mvp_listing_parsed lp
WHERE r.pid = l.pid::bigint
  AND r.pid = lp.pid
  AND r.detail_status = 'done'
  AND r.listing_state = 'active'
  AND r.sku_id IS NOT NULL
  AND (r.listing_type = 'normal' OR r.listing_type_override = 'normal')
  AND EXISTS (
    SELECT 1 FROM mvp_market_price_daily mpd
    WHERE mpd.comparable_key = lp.comparable_key
      AND mpd.condition_class = lp.condition_class
      AND mpd.computed_at > l.updated_at + INTERVAL '1 hour'
  );
```
**destructive (영향: scoreStage 부하 ↑ 약 11K matter rows 1 tick 안에 처리 못 함 → tickScoreLimit=800 cap 으로 14 ticks 분산)**. 사용자 승인 필수.

**B.2 (점진적 backfill)**: 위 query 1000건씩 chunk — last_seen_at desc 우선. tickScoreLimit 안에 들어오도록.

### sub-wave C — clothing v3 stale (2,318건)

**C.1 (관찰 only)**: 24h 더 기다림 — detail-worker 우선순위 queue order 변경 없이 v3 매물 자연 처리. Wave 253 fix A push 후 1 day 안 됨 (push 시점 9d6a5eb 어제).

**C.2 (queue priority bump)**: `mvp_detail_queue` 에서 v3 매물 pid 만 priority 박아서 우선 claim. helper:
```sql
UPDATE mvp_detail_queue SET priority = 100
WHERE pid IN (SELECT pid FROM mvp_listing_parsed WHERE parser_version = 'wave216-clothing-v3');
```
(priority column 있는지 확인 필요)

**C.3 (TICK_DETAIL_LIMIT bump)**: 200 → 400. throughput 2x. but Vercel function 90s maxDuration 안에 못 끝낼 가능성. 사용자 승인 필수.

## 다음 step (사용자 결정 대기)

1. **sub-wave A** 가설 G4 확정 — Vercel logs 또는 추가 code log → markRawScoreDirty 가 정말 작동 안 함을 증명.
2. 확정 후 → sub-wave A.3 (filter fix or retry) — destructive code fix, 사용자 승인 필수.
3. sub-wave B (sku_median backfill 12k) — destructive UPDATE, 사용자 승인 필수.
4. sub-wave C (v3 매물 잔여) — 우선 24h 더 관찰, 그 후 결정.

## 사용자 정책 준수 확인

- destructive UPDATE/INSERT 직접 박지 **X** — 진단 only
- 코드 변경 박지 **X** — 진단 only
- destructive script 진단 전 박지 **X**
- 추측 기반 detail-worker fix 박지 **X**
- 모든 발견 즉시 decision log 박음 (memory feedback_log_findings_even_before_fix)

## 첨부 데이터 — production sample

### 사용자 매물 #202 (pid 407160018, BAPE 마일로 반팔티)

| 컬럼 | 값 |
| --- | --- |
| mvp_listing_parsed.parser_version | wave216-clothing-v7 |
| comparable_key | clothing\|bape_tee\|tee\|a_grade |
| condition_class | mint |
| parse_confidence | 1.0 |
| needs_review | false |
| detail_enriched_at | 2026-05-19 13:03:02 |
| **mvp_listings.sku_median** | **109,500** (stale — 정확 78,200) |
| mvp_listings.updated_at | 2026-05-19 13:06:07 |
| mvp_listings.generated_at | 2026-05-19 13:06:07 |
| mvp_raw_listings.score_dirty | **false** ← 한 번도 dirty mark 안 됨 |
| mvp_raw_listings.last_seen_at | 2026-05-19 13:00:27 ← 4.85h 전, 그 후 search 안 잡음 |

### BAPE Tee 같은 comparable_key + mint 시세 변천

```
2026-05-19 mint  active_median=85,000  blended=78,200  sample=6 — computed_at 13:22:09
```

### 같은 comparable_key 다른 매물 sku_median 변화

```
13:06 batch (mint row 박히기 16분 전)
  pid 407160018 (#202)  sku_median=109,500  detail_enriched=13:03:02
  pid 409058071          sku_median=109,500  detail_enriched=13:03:04
13:10~13:20 batch
  pid 339092991          sku_median=109,500  detail_enriched=13:09:07
  pid 345894090          sku_median=109,500  detail_enriched=2026-05-18 18:27
  pid 399705645          sku_median=109,500  detail_enriched=2026-05-19 06:27
13:25 batch (mint row 박힌 13:22 직후)
  pid 409047667          sku_median= 78,200  detail_enriched=13:21:05
  pid 408233960          sku_median= 78,200  detail_enriched=13:21:05
  pid 408096137          sku_median= 78,200  detail_enriched=13:21:03
  pid 408093670          sku_median= 78,200  detail_enriched=13:21:03
  pid 406365091          sku_median= 78,200  detail_enriched=13:21:01
15:51~16:20 batch
  pid 409083765          sku_median= 78,200  detail_enriched=15:57:02
  pid 374922490          sku_median= 78,200  detail_enriched=16:18:01
  pid 407833519          sku_median= 78,200  detail_enriched=16:18:01
  pid 398610583          sku_median= 78,200  detail_enriched=16:18:01
```

**pattern 명백**:
- 매물이 **새로 detail-enrich 될 때**만 score_dirty=true 박힘 (raw_listings PATCH at line 1707) → 다음 tick scoreStage 통과 → sku_median 박힘
- markRawScoreDirty 의 propagation 은 **작동 안 함** — BAPE Tee 13:06 batch 5건 모두 13:22 mint row 박힌 후 dirty mark 안 됨.

### 시스템 전반 sku_median stale 분포

```
Total active 매물 (detail=done + sku_id NOT NULL): 20,569
sku_median 시점에 market 시세 X = 이후 market 시세 갱신: 12,549건 (61%)
  + score_dirty=false (mark 안 됨): 12,547건 (99.98%)
  + 1h+ stale: 11,011건
  + 6h+ stale: 7,148건
```

### parser_version 분포 (clothing)

```
wave216-clothing-v7  2,033건 (done 1,947, active 2,025, dirty 40)
wave216-clothing-v3  2,318건 (done 4, active 2,257, dirty 2,318) ← stuck
wave216-clothing-v4    164건 (done 144, active 164, dirty 1)
```

### detail_queue 현황

```
done:        48,490
pending:      8,988 (oldest 17:11, newest 17:55)
failed:         240
processing:       5
```

### recent /api/cron/* runs (1h)

| time | path | duration | enriched | scored |
| --- | --- | --- | --- | --- |
| 17:55:01 | tick | running | - | - |
| 17:54:01 | detail-worker | 21.8s | 197 | 0 |
| 17:51:01 | detail-worker | 20.3s | 195 | 0 |
| 17:50:00 | tick | 65.4s | 0 | 47 |
| 17:48:00 | detail-worker | 21.7s | 196 | 0 |
| 17:45:01 | tick | 70.5s | 0 | 28 |
| 17:45:00 | detail-worker | 21.8s | 197 | 0 |
| 17:22:01 | **market-worker** | 9.9s | 200 | 1,935 |

market-worker 17:22 1h 안 1건. invalidation 처리 enriched=200. score-dirty 박힘 count 모름.

## 관련 파일

- `mvp/src/lib/tick-pipeline.ts:1560 detailStage`
- `mvp/src/lib/tick-pipeline.ts:1664 parseListingOptions 호출`
- `mvp/src/lib/tick-pipeline.ts:1707 score_dirty=true patch`
- `mvp/src/lib/tick-pipeline.ts:1902 loadScorableRows (filter)`
- `mvp/src/lib/tick-pipeline.ts:1926 markRawScoreDirtyByComparableKeys`
- `mvp/src/lib/tick-pipeline.ts:2049 loadParsedRowsByComparableKeys (filter parse_confidence>=0.65)`
- `mvp/src/lib/tick-pipeline.ts:2091 isParsedStale`
- `mvp/src/lib/tick-pipeline.ts:3189 marketStatsStage`
- `mvp/src/lib/tick-pipeline.ts:3229 markRawScoreDirty 호출`
- `mvp/src/lib/tick-pipeline.ts:4166 scoreStage`
- `mvp/src/lib/tick-pipeline.ts:4262 clearScoreDirty (line 4262 handledPids)`
- `mvp/src/lib/tick-pipeline.ts:4621 runTickPipeline`
- `mvp/src/lib/tick-pipeline.ts:4636 runSearchScorePipeline`
- `mvp/src/lib/tick-pipeline.ts:4675 runDetailWorkerPipeline`
- `mvp/src/lib/parsers/wave92-fashion-mobility.ts:427 PARSER_VERSION_W216_CLOTHING='wave216-clothing-v7'`
- `mvp/src/lib/tick-pipeline.ts:2070 LATEST_PARSER_VERSION_BY_CATEGORY`
- `mvp/src/app/api/cron/tick/route.ts` — runSearchScorePipeline
- `mvp/src/app/api/cron/detail-worker/route.ts` — runDetailWorkerPipeline

## status

진단 완료. sub-wave A/B/C plan 사용자 결정 대기.

## sign

- 보고 author: agent (priceless-wing-533c88)
- 시점: 2026-05-20 KST
- 추가 진단 대기 (markRawScoreDirty silent fail 가설 G4 확정 위해)
