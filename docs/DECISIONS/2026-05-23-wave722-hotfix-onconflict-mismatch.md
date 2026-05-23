# Wave 722 hotfix — production cron 3시간 정체 (ON CONFLICT mismatch)

**Date**: 2026-05-23
**Severity**: 🚨 P0 — market_stats aggregation 3시간 정체

## 발견

postgres logs:
```
"error_severity":"ERROR",
"event_message":"there is no unique or exclusion constraint matching the ON CONFLICT specification",
"timestamp": 1779540500946000  // 13:08 UTC
```

`mvp_market_price_daily.computed_at` 최신: 10:12 UTC (3+ 시간 정체).

## 원인 분석

1. Wave 722 schema migration 적용 — PK (date, comparable_key, condition_class) → (date, comparable_key, condition_class, condition_tier)
2. Wave 722 code push (de7ca52) — `upsertRows(..., "date,comparable_key,condition_class,condition_tier")`
3. Vercel deploy 시간차 OR cache — production cron이 OLD code의 3-col on_conflict 보냄
4. 4-col PK는 3-col on_conflict와 매칭 안 됨 → PostgREST ERROR → cron 실패

## 즉시 fix — partial UNIQUE INDEX (backward compat)

```sql
CREATE UNIQUE INDEX mvp_market_price_daily_legacy_3col_compat
  ON mvp_market_price_daily (date, comparable_key, condition_class)
  WHERE condition_tier = '';
NOTIFY pgrst, 'reload schema';
```

### 효과
- OLD code (3-col on_conflict, condition_tier='' default 사용) → partial unique index 매칭 ✓
- NEW code (4-col on_conflict, condition_tier='A'/'B'/etc) → PK 매칭 ✓
- 두 path 양립 → cron 정상화

### 안전성
- 4-col PK는 그대로 → tier-aware design 유지
- 3-col partial index는 condition_tier='' (sentinel) row만 적용 → tier-bucketed row의 uniqueness 보존
- additive 변경, rollback 가능

## 검증 plan

다음 market-worker cron (시간:12 매시간) 후:
1. `mvp_market_price_daily.computed_at > 13:30 UTC` 확인 → cron 정상 작동
2. postgres logs ERROR 추가 발생 X
3. `condition_tier != ''` row 박힘 확인 (shoe/clothing aggregation)

## 관련 commit

- de7ca52 Wave 722 / Stage 5 code push (3시간 전)
- (이 hotfix는 schema-only — migration만 적용)

## Lesson learned

Schema migration + code deploy 시간차로 OLD code가 NEW schema 친화 안 됨:
- Backward-compatible migration 적용 시 OLD on_conflict가 매칭될 수 있도록 partial unique index 추가
- 혹은 schema 적용을 deploy 완료 후로 미루기 (안전 first)
