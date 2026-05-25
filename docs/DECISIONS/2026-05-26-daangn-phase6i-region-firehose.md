# Daangn Phase 6i — Region firehose 모드 (keyword combo 제거)

**날짜**: 2026-05-26
**Branch**: `codex/daangn-probe`
**Commit**: e0aebb19
**Owner**: Claude (autonomous, 외부 critique 반영)

## 배경

Phase 6h 에서 111 구 단위 region pool + round-robin shuffle 구현 했으나
외부 critique 로 **수집 primitive 자체가 잘못됨** 지적 받음.

### Critique 요약 (4 points)
1. **keyword × region combo 는 수집 primitive 가 아님** ← 가장 큰 손해
2. uniform round-robin → velocity-weighted scheduling 필요
3. 진짜 sustainability 위협은 endpoint 가 아니라 IP
4. 당근 realtime 자체 과투자 — 시세엔진 강등 + freshness 는 번장/중나에

## 검증

`?in=구-id` 단독 fetch (no keyword) 동작 확인:
- 강남구 (id 381): 의류/가방/시계/책 등 **카테고리 무관 다양 매물**
- 서초구 (id 362): 50+ matters, "더보기" pagination
- category_id filter 도 작동 (남성패션 14 등)

→ 1번 정확. 지역 firehose 가 진짜 corpus 수집 primitive.
   `?in=구&search=keyword` 는 사용자 query 용 — 우리는 코퍼스 만들 때 잘못 사용.

## 조치

### 1. `buildDaangnSearchUrl` empty param 생략

```typescript
// Phase 6i: empty/0 categoryId 시 filter 생략 (전체 카테고리 firehose)
if (input.categoryId != null && String(input.categoryId).trim() && String(input.categoryId) !== "0") {
  params.set("category_id", String(input.categoryId).trim());
}
// Phase 6i: empty search 시 param 생략 (region firehose 모드)
if (input.search && input.search.trim()) {
  params.set("search", input.search.trim());
}
```

### 2. 새 helper `selectDaangnFirehoseCombos`

- region 만 iterate (no keyword × no category)
- `maxRegions = maxCombos` (region 하나당 1 combo)
- shuffle 시 매 tick 다른 region pick

### 3. `runDaangnIngest` 분기

- `useRegionFirehose: boolean` (default **true**) 옵션
- true: firehose combo 사용 (production)
- false: legacy keyword combo 사용 (실험/테스트 fallback)
- sentinel 추가:
  - `DAANGN_FIREHOSE_QUERY = { label: "firehose", search: "", categoryIds: [] }`
  - `DAANGN_FIREHOSE_CATEGORY = { id: 0, name: "전체" }`

## 로컬 dry-run 측정 (IP soft-blocked 상태)

| 측정 | Phase 6h (keyword) | Phase 6i (firehose) | 배율 |
|------|-------------------|---------------------|------|
| combos | 30 | 30 | 1x |
| **articles** | 0-1 | **7,988** | **~8000x** |
| ongoing | 0 | 7,595 | — |
| detailFetched | 0 | 15 (cap) | — |
| duration_ms | 18000 | 35000 | 2x |

→ 30 region × ~266 matters/region. Production Vercel IP 는 IP block 없으므로
   유사하거나 더 많은 throughput 기대.

## 예상 production 효과

- raw ingest / tick: 41 → 7000-8000 (200x)
- 24h 누적 raw: ~50K-100K unique (heavy dedup 후)
- pool_eligible: 5 → 100-500 추정 (classifier 의 match rate 따라)

## Downstream load 우려 & 대응

- DB write 폭증: idempotent upsert (source, pid) 이라 unique 만큼만 effective
- score_dirty=true 폭증: score-worker 의 daangn lane budget (cdf30497 commit) 가
  proportional 분배 — bunjang/joongna 영향 없게 cap 처리
- AI L2 classification load: 우선 raw 만 ingest, AI 는 pool_eligible 만 → 자연스럽게 cap

이상 시 별도 wave 로 chunk-size 조정.

## 후속 work (별도 wave)

| wave | 내용 | 우선순위 |
|------|------|---------|
| 6j | velocity-weighted scheduling — hot 강남 매 tick, cold 시골 hourly | medium |
| 6k | IP rotation 인프라 (residential/mobile proxy) — Vercel 차단 hedge | low (사업 단계) |
| 6l | 당근 source role 재정의: shipping_possible 만 realtime, direct_only 는 sitemap backfill | medium |

## 검증 plan (deploy 5-10min 후)

```sql
-- raw throughput
SELECT
  date_trunc('hour', created_at) AS hour,
  COUNT(*) AS raws,
  COUNT(*) FILTER (WHERE pool_eligible) AS eligible,
  COUNT(DISTINCT daangn_region_id) AS regions
FROM mvp_raw_listings
WHERE source='daangn'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY 1 ORDER BY 1 DESC;
```

목표:
- raws > 500 / 5min tick (이전 ~4)
- regions > 10 / 5min (이전 1)
- eligible > 50 / 5min (이전 0.5)

이상 시 production 의 ingest path 가 firehose 적용 확인.
