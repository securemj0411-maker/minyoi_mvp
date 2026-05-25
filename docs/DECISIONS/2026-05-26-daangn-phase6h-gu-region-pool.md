# Daangn Phase 6h — 구·시·군 단위 region pool 111개 + round-robin shuffle

**날짜**: 2026-05-26
**Branch**: `codex/daangn-probe`
**Commits**: dcf84831
**Owner**: Claude (autonomous)

## 배경

Phase 6g 에서 동 단위 51 seed 로 복귀했으나 다음 문제 존재:
1. 51 동 → 서울 6 구만 cover (강남/송파/마포/은평 등 19 구 누락)
2. `selectDaangnCombos` linear iteration 으로 first 1-2 region 만 hit (region 30+ 영영 cover X)

User feedback: "더 다른 방법 없는지 충분히 찾고 진짜 없다 싶으면 방금 방법으로 하자".

## 충분히 찾은 대안들

| 방법 | 결과 | 사유 |
|------|------|------|
| Nationwide `?search=` only | ✗ | ElasticSearch region sharding 으로 empty payload |
| Daangn 시 자체 ID (`?in=서울특별시-?`) | ✗ | 광역시 자체 region 미존재 (구·동만) |
| Mobile/GraphQL API | ✗ | public 문서 없음, reverse engineering 위법 위험 |
| Jampot sitemap | ✗ | 35,245 buy-sell URL 주간 snapshot (lastmod 2026-05-20 = 6일 전), realtime 아님 |
| Popular keywords sitemap | ✗ | pre-generated `?in=구-id&search=` URL 모음 — 같은 endpoint |
| moajung 비밀 기법 | ✗ | 동일 구 단위 union (서울전체 = 25 구 fetch) |
| Daangn 공식 partner API | ✗ | public 발급 X |
| 구 단위 검색 (`?in=구-id`) | ✓ | **유일 sustainable 방법** — moajung 동일 |

## 조치

### 1. Region pool 51 동 → 111 구·시·군 단위 교체

`src/lib/daangn.ts` `DEFAULT_DAANGN_REGION_SEEDS`:

| 광역단체 | 수 | 비고 |
|---------|----|------|
| 서울특별시 | 25 | 전 구 |
| 부산광역시 | 16 | 전 구·군 |
| 인천광역시 | 10 | 전 구·군 |
| 대구광역시 | 8 | 전 구·군 |
| 대전광역시 | 5 | 전 구 |
| 광주광역시 | 5 | 전 구 |
| 울산광역시 | 5 | 전 구·군 |
| 경기도 | 37 | 분구 시 (수원/성남/고양/용인/안산/안양) + 핵심 시 |
| **총** | **111** | 한국 인구 ~75% cover |

ID 수집 방법: Daangn `/kr/regions/` 페이지 + WebFetch (brute scan 절대 X — IP block 위험).

### 2. `selectDaangnCombos` iteration depth-first round-robin

기존:
```typescript
for (region) for (query) for (cat) push  // first region 만 maxCombos cap 안에서 모두 채움
```

새 방식:
```typescript
// 1) per-region combo list 미리 build
// 2) depth=0 ⇒ 각 region 의 0번째 combo, depth=1 ⇒ 1번째, ...
//    → maxCombos=30 안에서도 30 region 골고루 hit
shuffleRegions=true: 매 tick 마다 region order 무작위
  → 24h 누적 시 111 region 모두 cover (~4시간마다 full cycle)
```

테스트 영향:
- shuffleRegions default false → test 결정성 유지
- 14/14 daangn-ingest.test.ts 모두 pass

## 예상 효과 (Vercel deploy 후)

| 지표 | 현재 (Phase 6g) | 예상 (Phase 6h) |
|------|----------------|-----------------|
| 24h distinct regions | 1 (서초4동, IP-default) | 30-50+ |
| 24h raw ingested | 41 | 200-500+ |
| 매물 다양성 | 1/51 | 30/111 per tick → 24h 100% |
| 24h pool_eligible | 5 (12%) | 30-50+ |

## 검증 plan (deploy 5-10min 후)

```sql
SELECT
  COUNT(DISTINCT daangn_region_id) AS distinct_regions,
  COUNT(*) AS raws,
  COUNT(*) FILTER (WHERE pool_eligible) AS eligible,
  array_agg(DISTINCT daangn_region_name ORDER BY daangn_region_name) AS regions
FROM mvp_raw_listings
WHERE source='daangn'
  AND created_at > NOW() - INTERVAL '15 minutes';
```

목표:
- distinct_regions > 5 (즉시 효과)
- raws > 60 (region 다양성으로 매물 증가)
- regions 에 서울 다양한 구 (강남/송파/마포 등) 등장 확인
