# Wave 769 — market-worker 빈도 30분 (임시) — per-source 시세 sample 누적 가속

## 사용자 결정

> "ㅇㅇ ㄱㄱ 박자. 그리고 로그 작성 — 나중에 다른 세션에서 1시간으로 다시 변경할 수 있도록 일단 기억용으로 로그"

## 배경

- Wave 886 (PR #29 + #30): per-source 시세 (당근 전용 시세) 활성화
- Wave 768 (PR #36): score-worker 당근 우선 (quota 15% → 40%)
- 두 wave 시너지 — 당근 매물 빠르게 ready 진입
- 단 **market-worker 매시간 1번** = per-source 시세 sample 누적 느림

## 변경

`vercel.json`:
```diff
-      "schedule": "12 * * * *"
+      "schedule": "12,42 * * * *"
```

- 매시간 12분만 실행 → 매 30분 (12, 42 분에 실행)
- per-source 시세 sample 누적 속도 **2배**
- 당근 sample ≥ 3 도달 시간 단축 → 당근 전용 시세 활용 효과 빠르게 발현

## Trade-off

- Vercel lambda 비용 + 최대 ~2만원/월 (매시간 1회 → 2회 = 2배)
- DB load 약간 ↑ (market-worker per-source 추가 write 포함)
- 사용자 합의 — "당근 빠르게 들어와야" 의도와 일치

## 임시 변경 — 나중에 되돌릴 조건

다음 조건 충족 시 매시간 (`12 * * * *`) 으로 복원:

1. **당근 sample 충분히 누적됨**:
   ```sql
   SELECT source, COUNT(*) AS keys,
     COUNT(*) FILTER (WHERE active_sample_count + sold_sample_count >= 3) AS keys_with_3plus_samples
   FROM mvp_market_price_daily_per_source
   WHERE date = CURRENT_DATE AND source = 'daangn'
   GROUP BY source;
   ```
   `keys_with_3plus_samples ≥ 500` 정도면 충분.

2. **당근 ready 매물 안정** (예: 500+) — Wave 768 효과 발현 완료.

3. **Vercel 비용 부담 시** — usage dashboard 에서 cost 한도 임박 시 즉시 복원.

## 복원 방법

```diff
   {
     "path": "/api/cron/market-worker",
-    "schedule": "12,42 * * * *"
+    "schedule": "12 * * * *"
   },
```

또는 사용자 결정에 따라 더 자주 (예: `*/15 * * * *` 매 15분) 박을 수도.

## 24h 후 측정 SQL

```sql
-- per-source 시세 누적 추이
SELECT
  source,
  COUNT(*) AS sample_rows,
  COUNT(DISTINCT comparable_key) AS unique_keys,
  COUNT(*) FILTER (WHERE active_sample_count + sold_sample_count >= 3) AS keys_with_3plus,
  ROUND(AVG(active_sample_count + sold_sample_count)) AS avg_sample
FROM mvp_market_price_daily_per_source
WHERE date = CURRENT_DATE
GROUP BY source;

-- 당근 ready 추이
SELECT category, COUNT(*) AS ready_cnt
FROM mvp_candidate_pool cp
JOIN mvp_raw_listings r USING (pid)
WHERE r.source = 'daangn' AND cp.status = 'ready'
GROUP BY category
ORDER BY ready_cnt DESC;
```

## What Not To Do

- 매 30분 보다 더 자주 박지 X (예: 매 15분 / 매 분) — DB write 부담 큼.
- 다른 cron 동시에 frequency ↑ 박지 X — Vercel concurrency 한도 영향.
- 복원 전에 사용자 명시적 동의 받기 — 임시 변경이지만 비용 직접 영향.

## 관련 PR

- Wave 768: PR #36 (score-worker 당근 우선)
- Wave 886: PR #29 + #30 (per-source 시세)
- Wave 769: (이번 PR — market-worker 매 30분)
