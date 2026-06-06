# Wave 1192e — 피드 거리쿼리를 candidate_pool 기준 RPC 로 (raw 31초 → 103ms)

날짜: 2026-06-06
관련: Wave 1189~1192d (피드 cold/snapshot/무한스크롤/empty), Wave 1191 (Medium 업글)

## 배경 — owner 통찰

owner: "snapshot 으로 바꿨는데 왜 1개만 먼저 나오고 나머지 단계적으로? 성능 높이고 편안한 서비스가 목적."

여러 미봉책 (무한스크롤 / 첫화면 24 / quick batch / empty 가드) 후, owner 가 근본 질문: "사용자 경험 + 지속가능성 trade-off 없고 더 효율적인 방법?"

## 근본 원인

기존 피드 거리쿼리: **raw_listings(3.5GB) 를 거리순으로 훑어서 ready 매물을 그 자리에서 골라냄.**
- cold 31초 (Wave 1189)
- quick(가까운 4 region, 1개) + remainder(전체, 130) 2단계 → "1개 먼저 + 스켈레톤 + 팍"

근데 그 "골라낸 결과"(ready 매물)는 **candidate_pool 에 이미 계산돼 있음** (4,553개, 작음).

## 측정 — candidate_pool 기준이 압도적

```
raw_listings 기준 거리쿼리:    cold 31,000ms
candidate_pool 기준 (RPC):        103ms   ← 300배
```

EXPLAIN: candidate_pool(Index Only Scan, 4553) ⋈ raw(region+price index) → 61 rows (15만↓), Execution 103ms.

## snapshot warmer vs candidate_pool 기준 (trade-off 비교)

| | 사용자 경험 | 지속가능성 |
|---|---|---|
| snapshot warmer | 빠름 | ❌ 동네 6,000개 미리 계산 (cron 부하) or 인기 동네만 (miss) |
| **candidate_pool 기준** | 빠름 | ✅ 미리 계산 0, 모든 동네 즉시, raw 안 건드림 |

→ candidate_pool 기준이 trade-off 없음. (owner 와 합의)

## 변경

### RPC `nearby_daangn_ready_feed(p_region_ids, p_price_max, p_limit)`
```sql
SELECT r.pid, 'daangn', r.daangn_region_id, r.daangn_region_name, r.price, 'active', r.last_seen_at
FROM mvp_candidate_pool p JOIN mvp_raw_listings r ON r.pid = p.pid
WHERE p.status='ready' AND r.source='daangn' AND r.listing_state='active'
  AND r.detail_status='done' AND r.daangn_region_id = ANY(p_region_ids)
  AND (p_price_max IS NULL OR r.price <= p_price_max)
ORDER BY r.last_seen_at DESC LIMIT least(p_limit, 500);
```
STABLE, SECURITY DEFINER. candidate_pool(작음) driving → raw pid PK join.

### route.ts (`src/app/api/packs/pool/route.ts`)
- nearby prefetch 의 raw_listings 거대 쿼리 → RPC 호출
- region batch loop → 전체 region 한 batch (RPC 0.1초라 분할 불필요)
- distance 정렬 + fetchReadyPoolRowsByPidChunks (PoolRow detail) 흐름 유지

## 효과

- 서버 거리쿼리 31초 → 0.1초
- quick page 가 근처 전체 region 봐도 빠름 → 1개 → 충분 (responsePageSize)
- 첫 화면 빠르게 + 무한스크롤 점진 (Wave 1192) + empty 가드 (Wave 1192d)
- "1개 먼저 + 스켈레톤 + 팍" 원천 해소

## 후속

- RPC 는 execute_sql 로 박음 → migration 파일 정리 별도
- client quick/remainder 2단계는 남지만 서버가 빨라 각 0.1초 (체감 한 번에)
- 다른 동네 (사당동 외) 도 같은 RPC 라 즉시

## TS check
`npx tsc --noEmit` — src/ 0 error.

## Sign-off
owner 추천 (candidate_pool 기준) 채택. 배포 후 화면 검증.
