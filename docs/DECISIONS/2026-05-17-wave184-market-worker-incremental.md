# Wave 184 (2026-05-17) market-worker incremental — lookback + pagination

> **중요도: HIGH.** 시스템 누적 (raw_listings 154K, 30일 후 ~250K 추정) 에 대비한 근본 fix.
> 향후 wave B (raw_listings TTL) / wave C (market_price_daily rollup) 전제.

## 사용자 통찰 (이번 wave 의 origin)

> "그날 끝나면 그날 매물 평균내서 보관하고 다른 테이블 만들던가. 다음날도 모든 데이터 말고 그 당일 데이터 평균내고 이렇게 하다가 7일되면 1주일 평균 ... 내가 단순하게 생각한거임?? 근본적인 해결책이 있지 않을까?"

→ **단순한 게 아니라 표준 timeseries pattern (incremental aggregation + downsampling cascade).** AI 가 batch/concurrency/pagination 만 만지작거리고 있을 때 사용자가 "왜 매번 18K 다시 group 하지?" 근본 의문 제기. 정답.

## 진단

### 측정 1: Supabase PostgREST max-rows cap

```
curl /rest/v1/mvp_raw_listings?select=pid&limit=5000 -H "Range: 0-4999"
→ content-range: 0-999/151162
```

- 전체 active 매물 **151,162건**
- Range 0-4999 박아도 받는 건 **0-999 (1000건)** — PostgREST `max-rows=1000` 강제 cap
- `limit=5000` param 무시
- 어떤 limit/Range 박아도 한 GET = 1000 row max

### 측정 2: market-worker eligible 매물 분포

| listing_state | total | market_eligible | 60일+ | 90일+ |
|---|---|---|---|---|
| active | 151,170 | 16,453 | 0 | 0 |
| sold_confirmed | 2,208 | 1,637 | 0 | 0 |
| disappeared | 577 | 531 | 0 | 0 |
| missing_suspect | 97 | 91 | 0 | 0 |
| **전체** | **154,052** | **18,712** | **0** | **0** |

- 전체 9일짜리 시스템 (5/9 ~ 5/17). 누적 짧아서 60일+ 0건이지만 **TTL 정책 없음** — 9.4K → 60일 후 100K+ 추정.
- `mvp_raw_listings` 자체 cleanup 없음 (housekeeper 는 expired pool / detail_queue / observation payload 만).

### 측정 3: 기존 코드 동작 (Wave 132)

```ts
async function loadMarketStatRows(limit: number): Promise<ScorableRawRow[]> {
  const url = `${tableUrl("mvp_raw_listings")}?...&order=detail_enriched_at.desc.nullslast,last_seen_at.desc&limit=${limit}`;
  // limit=3000 호출해도 1000 row 만 받음 (PostgREST cap)
}
```

- baseline 측정: limit 3000 → **scored 990, upserted 60 keys, 7.7초**
- force limit 10000 → **scored 1000** (cap 동일), 24.7초
- → **eligible 18,712 의 5.4% 만 처리** 매 호출. 옛 매물 영구 누락 (order detail_enriched_at.desc 가 옛 매물 뒤로 밀어냄).

## 충돌 조사 (Explore agent)

조사 6 항목 (별 보고서):

| 항목 | 결론 | 본 wave 영향 |
|---|---|---|
| **marketStatsStage 호출 site** | market-worker route 전용. tick/lifecycle 과 독립 | 단일 caller — safe |
| **mvp_market_price_daily 읽기 위치** | pack-open (최신 1 row), market-history-chart (30일 range), candidate-pool-builder (skuMedian = 최신) | 옛 row 그대로 historical — 모두 안전 |
| **dirty_marked_rows** | `markRawScoreDirtyByComparableKeys` 이미 incremental 기초. baseline `market_score_dirty_marked_rows:1000` 정상 동작 | 변경 X |
| **invalidation queue** | `mvp_market_key_invalidation` — lifecycle state change (sold/disappeared) 자동 trigger. marketStatsStage 가 `loadMarketStatRowsByPids` 분기로 targeted upsert | 변경 X — sold/disappeared 자동 cover |
| **last_seen_at 신뢰도** | active 매물: 매 search tick (5~10분) 갱신. sold/disappeared: 마지막 활동 시점 유지 (last_seen_at 안 갱신, sold_detected_at 별도) | 28h lookback 면 active 매물 거의 다 cover. sold/disappeared 는 invalidation queue 가 별 경로로 처리 |
| **lookback window 영향** | 4일+ active 매물: 페치 안 됨 — 그러나 시세 row 어제 박힌 그대로 historical 유지. lifecycle state change 는 invalidation queue 가 trigger | **사용자 통찰의 "어제 row 안 건드림"** 과 정확히 일치 |

→ **충돌 없음.** 본 wave 단일 함수 변경 + config 1 line + lookback env 추가.

## 변경

### 1. `src/lib/tick-pipeline.ts` `loadMarketStatRows` (L1897)

**Before** (Wave 132):
```ts
async function loadMarketStatRows(limit: number): Promise<ScorableRawRow[]> {
  const url = `${tableUrl("mvp_raw_listings")}?select=${columns}&detail_status=eq.done&...&order=detail_enriched_at.desc.nullslast,last_seen_at.desc&limit=${limit}`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as ScorableRawRow[];
}
```

**After** (Wave 184):
```ts
const DEFAULT_MARKET_STATS_LOOKBACK_HOURS = 28;
const MARKET_STATS_PAGE_SIZE = 1000;
async function loadMarketStatRows(limit: number): Promise<ScorableRawRow[]> {
  const lookbackHours = Math.max(1, Math.min(168, Number(process.env.PIPELINE_MARKET_STATS_LOOKBACK_HOURS ?? 28) || 28));
  const sinceIso = new Date(Date.now() - lookbackHours * 3600 * 1000).toISOString();
  const baseUrl = `${tableUrl("mvp_raw_listings")}?...&last_seen_at=gte.${sinceIso}&order=last_seen_at.desc`;
  const rows: ScorableRawRow[] = [];
  for (let offset = 0; offset < limit; offset += MARKET_STATS_PAGE_SIZE) {
    const pageLimit = Math.min(MARKET_STATS_PAGE_SIZE, limit - offset);
    const url = `${baseUrl}&limit=${pageLimit}&offset=${offset}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    const chunk = (await res.json()) as ScorableRawRow[];
    rows.push(...chunk);
    if (chunk.length < pageLimit) break;
  }
  return rows;
}
```

변경점:
- **last_seen_at lookback filter** (`gte.${28h ago}`) — 옛 매물 자동 제외 (incremental 핵심)
- **pagination loop** — PostgREST 1000 cap 우회. limit 까지 chunk 별 페치 후 합침
- **order** `detail_enriched_at.desc.nullslast, last_seen_at.desc` → `last_seen_at.desc` 단일 — detail_enriched 우선 정책이 옛 매물 누락 원인
- **env override** `PIPELINE_MARKET_STATS_LOOKBACK_HOURS` (1~168 시간) — 운영 조정 가능

### 2. `src/lib/pipeline-config.ts` `marketStatsLimit` (L337)

```ts
// Before
marketStatsLimit: envInt("PIPELINE_MARKET_STATS_LIMIT", 3000, 100, 10000),
// After (Wave 184)
marketStatsLimit: envInt("PIPELINE_MARKET_STATS_LIMIT", 8000, 100, 20000),
```

- default 3000 → **8000** (28h lookback 안 매물 6.7K 측정, 마진 포함)
- max 10000 → **20000** (운영 여유)

## 검증

### typecheck
```
npx tsc --noEmit --pretty false → 변경 파일 에러 0
```

### 로컬 실측 비교

| Test | lookback | limit | scored | upserted | total time | maxDuration |
|---|---|---|---|---|---|---|
| Baseline (Wave 132) | none | 3000 | 990 (cap 1000) | 60 keys | 7.7초 | 90 |
| Force test | none | 10000 | 1000 (cap) | 514 keys | 24.7초 | 90 |
| **Wave 184 incremental** | 28h | 8000 (pagination) | 565~991 (변동 분 따라) | 19~90 keys | 4~8초 | 90 |

- Wave 184 시간 ≤ baseline → **pagination + lookback 함께 적용해도 시간 작음** (변경 매물만 페치 효과)
- 일정 시점부터 매물 변동 분 작아짐 (invalidation 큐 소진) — 다음 cycle 부터 안정.

### DB 28h lookback 안 매물 측정
```sql
SELECT COUNT(*) FROM mvp_raw_listings WHERE ... AND last_seen_at >= NOW() - INTERVAL '28 hours'
→ 6,749 매물
```
- 8000 limit / 1000 page = 7 chunks 면 다 cover.
- 한 chunk ≈ 0.8s → 7 chunks ≈ 5.6s + group/upsert ≈ 2s → 총 ~8s. **maxDuration 90 안에 안전.**

## 위험 + 미해결 issue

### 위험

1. **4일+ active 매물 시세 stale 위험**:
   - 28h lookback 밖 active 매물은 페치 안 됨 → 시세 row 어제 박힌 그대로
   - 다행히 decay weight 코드 (Wave 131) 가 옛 매물 비중 낮춤 → 시세 trend 영향 작음
   - **lifecycle invalidation 은 별 경로 (sold/disappeared 자동 trigger)** — listing_state 변경 cover

2. **niche SKU (예: MacBook Air i3) 처리 불가**:
   - i3 매물 11개 측정 — **1개만 28h 안**, 나머지 10개 last_seen 87~160h 전
   - search-worker 가 i3 SKU 검색 cadence 낮음 — 본 wave 의 scope 밖
   - 별 wave (Wave 185?) 에서 search query 강화 필요

3. **PostgREST `offset` 큰 값 perf**:
   - offset=7000 같은 쿼리도 DB 가 7K row skip 해야 — perf 영향. 8K limit 까진 ok.
   - 50K+ 까지 가면 cursor-based pagination 으로 전환 권장.

### 미해결 issue → 별 wave

| Issue | 권장 wave |
|---|---|
| `mvp_raw_listings` TTL 없음 (60일+ disappeared/sold cleanup) | Wave 185 — housekeeper sweep 추가 |
| `mvp_market_price_daily` rollup 없음 (daily 30일+ → weekly → monthly) | Wave 186 — 장기 storage 절약 |
| niche SKU search cadence (i3, 옛 모델 등) | Wave 187 — search query 정책 |
| comparable_key schema migration 후 pool stale (iPad mini 6 a15 케이스) | 사용자 다른 세션 SKU 작업으로 자동 해결 path |

## 다음 액션

### 즉시

1. 로컬 1~2일 모니터링 — invalidation 큐 소진 후 정상 cycle 확인
2. niche SKU (i3 등) 시세 row 박히는지 확인 (안 박히면 Wave 185~187 필요)

### 운영 조정 옵션 (env)

| env | default | 의미 |
|---|---|---|
| `PIPELINE_MARKET_STATS_LOOKBACK_HOURS` | 28 | lookback 시간. niche SKU 우선이면 72~168 시도 |
| `PIPELINE_MARKET_STATS_LIMIT` | 8000 | 한 cron 최대 페치. eligible 매물 늘면 (카테고리 추가 시) 12000~16000 |

## Lesson

1. **사용자 통찰이 AI 보다 정확했음** — AI 가 batch/concurrency/pagination 만 만지작거리는 동안 사용자가 "왜 매번 다 처리?" 근본 의문 제기. AI 가 답을 못 본 게 아니라 **질문을 못 한 것**. 사용자가 추상화 한 단계 위에서 봄.

2. **표준 패턴 명명** — 이번 fix 는 timeseries DB 의 standard pattern (incremental aggregation, lookback window). 정통 솔루션. 사용자 단어 "단순" 이지만 실제로 best practice.

3. **충돌 조사 가치** — Explore agent 로 6 항목 사전 조사 → invalidation queue 가 이미 sold/disappeared cover 한다는 발견. 본 wave 가 그 경로 안 건드려도 됨을 확신.

4. **PostgREST max-rows=1000** 은 Supabase 의 hard cap. limit param 늘려도 무의미. pagination 필수. 향후 대규모 query 모두 동일 패턴 필요.

5. **niche SKU 별 이슈** — incremental 의 한계. search cadence 안 따라가면 lookback 늘려도 의미 X. 본 wave 범위 밖.
