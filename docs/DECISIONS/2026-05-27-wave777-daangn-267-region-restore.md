# Wave 777 — daangn ingest 5 → 267 region 복원 (firehose, 전국 cover)

## 사용자 결정

> "원래대로 돌리면 안 됨?? 다른 세션이 한 건 배포용이 아니잖아. 우리 지금 번개장터 급 유입이 되야 되는데 예전처럼. 존나 ready 로 많이 들어가야 되는데. 미스매칭 firehose 방식 상관없으니까 옛날로 되돌리면 안 됌? 모든 지역으로 하고?"

## 배경

다른 Claude 세션이 박은 Wave 775 (category-firehose) + Wave 776 (267 region + raw filter) 모두 revert 됨:
- Wave 775 revert: 사용자 결정 (테스트용)
- Wave 776 revert: raw filter 로직 실패 (region 267 자체는 검증 통과)

Revert 후 상태 (변경 전):
- `maxCombos default = 5` (코드)
- 한 cycle 당 5 region 랜덤 shuffle
- 267 region pool 다 cover 하려면 53 cycle (= 4.4시간 신선도)
- 시간당 매물 유입 ~4,000개

사용자 의도: **번개장터 급 매물 유입** (이전 ready 200+ 폭증 시기 수준).

## 변경

`src/lib/daangn-ingest.ts` line 556:

```diff
-  const maxCombos = boundedInt(options.maxCombos, 5, 1, 200);
+  const maxCombos = boundedInt(options.maxCombos, 267, 1, 300);
```

- 한 cycle 안 전국 267 region 다 fetch
- 병렬 (Promise.all) — 시간 ~5-10초
- firehose 유지 (카테고리/키워드 필터 X)

## 효과

| | Before | After |
|---|---|---|
| Region/cycle | 5 (랜덤) | **267 (전국)** |
| 신선도 | **4.4시간** | **5분** |
| 매물 유입 추정 | ~4,000/h | **~50,000+/h** (53배 ↑) |
| Fetch 시간 | ~50s | ~5-10s (병렬) |
| 매칭율 (분류) | 6% (94% 잡화) | 6% (그대로 — firehose 유지) |

## 안전 검증

- Wave 776 (revert) 의 region 267 부분 = rate-limit Phase 2 검증 통과
  - 267 region 병렬 fetch lambda 300s 한도 안 (5-10초)
- Wave 776 revert 사유 = raw filter 로직 실패. region 늘림 자체는 안전.
- 사용자 결정: 미스매치 6% (94% 잡화) 상관없음 — firehose 유지.

## Trade-off

- 당근 rate limit 위험 약간 ↑ (5 → 267 region 병렬). Wave 776 검증 통과.
- DB 부담 ↑ (94% 잡화 raw insert). 사용자 합의 — "미스매치 상관없음".
- Vercel lambda 비용 거의 동일 (병렬이라 시간 그대로).

## 복원 가이드 (위험 신호 시)

**위험 신호**:
- 429 / 403 HTTP 응답 (당근 IP 차단)
- daangn_worker fetch 실패율 ↑
- daangn raw 매물 추가율 갑자기 0

**즉시 fallback**:
```bash
vercel env add DAANGN_INGEST_MAX_COMBOS production
# 값: 5
```

env 박으면 다음 cron 부터 즉시 5 region 으로 복원. 코드 변경 불필요.

또는 코드 revert:
```diff
-  const maxCombos = boundedInt(options.maxCombos, 267, 1, 300);
+  const maxCombos = boundedInt(options.maxCombos, 5, 1, 200);
```

## 검증 SQL (1시간 후)

```sql
-- 매물 유입 추이 — 53배 ↑ 확인
SELECT DATE_TRUNC('hour', first_seen_at) AS hour, COUNT(*) AS new_listings
FROM mvp_raw_listings
WHERE source = 'daangn' AND first_seen_at >= NOW() - INTERVAL '2 hours'
GROUP BY hour ORDER BY hour DESC;

-- ready 매물 추이 — 200+ 폭증 기대
SELECT cp.category, COUNT(*) AS ready_cnt
FROM mvp_candidate_pool cp
JOIN mvp_raw_listings r USING (pid)
WHERE r.source = 'daangn' AND cp.status = 'ready'
GROUP BY cp.category
ORDER BY ready_cnt DESC;
```

## 관련 commits

- `ac6fe178` feat(daangn): Wave 777 — maxCombos 5 → 267 (전국 region firehose)
- `47a5e426` Merge PR #39

## Related Waves (history)

- Wave 760-764: region pool 점진 확장 (111 → 267, 전국 cover)
- Phase 6i: firehose 모드 (keyword/category filter X)
- Wave 775 (revert): category-firehose 시도
- Wave 776 (revert): 267 region + raw filter (filter 실패)
- **Wave 777 (now)**: 267 region firehose (사용자 결정 복원)

## What Not To Do

- 미스매치 (94% 잡화) 해결 위해 카테고리 filter / round-robin 박지 X — 사용자 명시적 "미스매치 상관없음" 결정.
- raw level filter 박지 X — Wave 776 실패 (매물 drop 위험).
- region 더 늘리지 X — 267 = 전국 cover 완료.
