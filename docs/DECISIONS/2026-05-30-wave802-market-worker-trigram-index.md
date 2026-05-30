# Wave 802 — market-worker statement timeout fix (trigram GIN index)

## 사용자 보고

> "[득템잡이] 운영 알림 source: bunjang status: healthy -> healthy 긴급 Market: 40% 실패 (4/10)"
> "다른 세션에서 작업한 거도 다 참고해 다 이유있어서 그렇게 작업한건데 뭔가 실수가 있는건지 등 파악하고 클루지 말고 파괴적이지 않고"

## 진단

**실패 패턴**: `mvp_collect_runs.error_message` 6/18 (33-40%) 실패, 다 동일 에러:
```
Supabase REST failed 500 GET /rest/v1/mvp_listing_parsed?
  select=...&comparable_key=like.shoe|airmax_97|*|c_grade
  &parse_confidence=gte.0.65&needs_review=eq.false&order=pid.asc&limit=300
→ {"code":"57014", "message":"canceling statement due to statement timeout"}
```

**다른 세션 작업 검토 — 다 정당**:
- Wave 715 (condition grading): `comparable_key` 4-segment 도입 (`shoe|<sku>|<size>|<tier>`) — 정당, 시세 정확도 ↑
- Wave 722 (tier-aware median): tier 별 시세 분리 — 정당, spread 줄임
- Wave 743 (drift gate reparse): parser version bump → 270K 매물 재처리 — 정당
- Wave 756 (comparable_key fragmentation fix): condition tier 명시 — 정당
- **누락 (운영자 slip)**: 각 wave 후 index 영향 검토 안 함 → 점진적 누적 → 임계 도달

**Root cause**: `comparable_key LIKE 'shoe|<sku>|%|<tier>'` 는 wildcard 중간 패턴. 기존 btree index (`mvp_listing_parsed_comparable_idx`) 는 LIKE prefix-only 만 지원 → 활용 불가 → planner 가 270K row 풀스캔 → 28.9초 (Supabase 30s timeout 직전).

EXPLAIN:
- 풀스캔 `Rows Removed by Filter: 270,792` (= 0.04% 매칭, 99.96% 버림)
- buffers: hit=243528 read=28051

## Fix — Trigram GIN index

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE mvp_listing_parsed ALTER COLUMN comparable_key SET STATISTICS 1000;

CREATE INDEX CONCURRENTLY mvp_listing_parsed_comparable_trgm_idx
ON mvp_listing_parsed USING gin (comparable_key gin_trgm_ops)
WHERE needs_review = false AND parse_confidence >= 0.65;

ANALYZE mvp_listing_parsed;
```

## 검증 결과

| 패턴 | Before | After |
|---|---|---|
| `shoe\|airmax_97\|%\|c_grade` | **28,915 ms** (timeout) | **22.6 ms** (1,280x) |
| `shoe\|airmax_97\|%\|with_box` | (timeout 예상) | 16.5 ms |
| `shoe\|adidas_superstar_broad\|%\|unknown_condition` | (timeout 예상) | 45.5 ms |
| `shoe\|nike_shox_tl_broad\|%\|b_grade` limit 1000 | (timeout 예상) | 31.4 ms |

EXPLAIN: `Bitmap Index Scan on mvp_listing_parsed_comparable_trgm_idx` 박힘 → 100-700 row index hit → 30-100 row final.

## 가장 큰 함정 (놓칠 뻔)

**Partial predicate 매칭** — 첫 시도 시 `WHERE needs_review IS FALSE` 박았는데 query 는 `needs_review = false` 박힘. PostgreSQL planner 가 두 expression 을 different 로 인식 → partial index 활용 불가 → 여전히 seq scan.

**해결**: partial WHERE 를 query 와 정확 일치하는 `needs_review = false AND parse_confidence >= 0.65` 로 재박. 이후 정상 활용 → 1,280x speedup.

**교훈**: partial index 만들 때 query 의 WHERE 절과 **literal 일치** (operator, NULL 처리 포함) 박아야 함.

## Trade-off

| 항목 | 영향 |
|---|---|
| Read 성능 | 28.9초 → **22-45ms** (~600-1300x) |
| Disk | +21 MB (trgm 인덱스) |
| Write overhead | GIN trgm 은 insert 시 ~10-50μs (negligible) |
| Lock | `CONCURRENTLY` = **table lock 없음**, online build |
| Build time | ~30초 (background) |
| Rollback | `DROP INDEX CONCURRENTLY mvp_listing_parsed_comparable_trgm_idx;` 한 줄 |
| Extension | `pg_trgm` (Supabase 표준 extension, 거의 모든 프로젝트 박혀있음) |

**파괴적 X** — 기존 데이터 변경 X, 기존 인덱스 유지, rollback 가능.

## 비파괴 보장

- 기존 6개 index 다 유지 (`mvp_listing_parsed_comparable_idx` 등)
- 기존 query 패턴 변경 X — DB only fix
- 코드 변경 X — `loadParsedRowsByShoeSizeSiblingKeys` 그대로
- Wave 715/722/743/756 logic 유지

## 추가 발견

**Statement timeout per role**:
- `anon`: 3s
- `authenticated`: 8s
- `service_role`: NULL (PostgREST default ~30s)
- `postgres`: default

market-worker 가 service_role 로 query → ~30s timeout 박힘. 본 fix 후 22-45ms → 여유 큰 margin.

**Alert noise — bunjang status: healthy → healthy 인데 critical alert**:
- 의도된 design: source health (실제 매물 수집) vs internal worker (market-worker) 분리 신호
- `proposeSourceStatus` 의 `sourceWorkerFailureStatus` 가 market_worker 같은 internal worker 의 failure 를 source health 에 반영 X (의도)
- 그러나 `workerFailureAlerts` 는 internal worker 도 alert 박음 → 사용자 알림 모순 보임
- 본 fix 후 market-worker 안 실패 → alert 자체 안 박힘 → 모순 해소

## 복원 가이드 (위험 신호 시)

**위험 신호**:
- Insert latency 갑자기 ↑ (~ms 단위)
- 새 query 패턴 도입 시 trgm 안 잡힘 (selectivity 문제)

**즉시 fallback** (3 단계):
1. Index drop (lock 없이):
   ```sql
   DROP INDEX CONCURRENTLY mvp_listing_parsed_comparable_trgm_idx;
   ```
2. Statistics 원복:
   ```sql
   ALTER TABLE mvp_listing_parsed ALTER COLUMN comparable_key SET STATISTICS -1;
   ```
3. Extension drop (필요 시 — 다른 곳 활용 안 하면):
   ```sql
   DROP EXTENSION IF EXISTS pg_trgm;
   ```

## What Not To Do

- partial WHERE 를 `IS FALSE` 박지 X — query 의 `= false` 와 mismatch → 활용 불가
- partial WHERE 조건 query 와 다르게 박지 X — planner 가 inclusion 인식 못 함 가능
- 두 가지 index (text_pattern_ops + trgm) 둘 다 박지 X — trgm 으로 wildcard 중간 + prefix 다 cover (text_pattern_ops 는 prefix-only). 코드 wildcard 중간 패턴 박으면 trgm 만 박음.
- `ORDER BY pid ASC` 박힌 query 라도 작은 결과 (<300 row) 면 sort cost 무시 가능. 큰 결과 (10K+) 면 별도 검토 필요.
- 새 wave 박을 때 query 패턴 추가하면 EXPLAIN 박아서 trgm 활용 확인.

## 향후 audit 필요

- 다른 LIKE wildcard 중간 패턴 query 있는지 확인 (다른 column 에도)
- 운영 cron 의 query pattern audit 정기화
- DBA health check cron 박자 — 1주에 1번 EXPLAIN ANALYZE

## 검증 SQL (1시간 후)

```sql
-- 1. market-worker 실패율 감소
SELECT
  DATE_TRUNC('hour', started_at) AS hour,
  COUNT(*) FILTER (WHERE status = 'succeeded') AS succeeded,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed
FROM mvp_collect_runs
WHERE request_path LIKE '%market-worker%'
  AND started_at >= NOW() - INTERVAL '4 hours'
GROUP BY hour ORDER BY hour DESC;

-- 2. Index 활용 확인
SELECT
  indexrelname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexrelname = 'mvp_listing_parsed_comparable_trgm_idx';
```

기대:
- 실패율: 33-40% → 0%
- idx_scan: 매 cron 마다 ~수십회 증가

## 관련 변경

- DB only — 코드 변경 없음
- Decision log 박음 (`docs/DECISIONS/2026-05-30-wave802-market-worker-trigram-index.md`)

## Related Waves

- Wave 715 / 722 / 743 / 756 — `comparable_key` 4-segment 도입 + reparse
- Wave 724 / 725 — cron lock / Supabase REST timeout 작업
- Wave 798x — market outlier filter 작업
- **Wave 802 (now)** — trigram GIN index 박음 (1,280x speedup, alert noise 해소)
