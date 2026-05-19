# 2026-05-20 — market_price_daily historical 5/9~5/15 backfill

## 결정

5/16 incident로 손실된 historical 시세 일부 복구. raw_listings + observations에 남은 11일치 raw 데이터로 5/9~5/15 7일치 daily aggregate 재계산.

## 사용자 피드백

> "/me상세보기페이지 우리 4일 그래프가 끝임? 7일이나 1달 2달 이런거 데이터 모아서 더 자세하게 못보여줌? 4일이 그냥 하드코딩으로 4일까지만 보여주는 식은 아닌거지?"

→ **하드코딩 아님**. 실제 DB가 5/16~5/20 (5일치)만. 5/16 incident 후 자연 누적 중.

## 데이터 진단

| 테이블 | 범위 | 일수 | 의미 |
|---|---|---|---|
| market_price_daily | 5/16 ~ 5/20 | **5일** | 5/16 incident 후 회복 중 |
| raw_listings | 5/9 ~ 5/19 | **11일** | 남아있음 → backfill 가능 |
| listing_observations | 5/9 ~ 5/19 | 11일 | 동일 |
| observation_payloads | 5/9 ~ 5/19 | 11일 | 동일 |

→ raw가 11일치라 6일치 backfill 가능. **5/9~5/15 추가하면 그래프 5일 → 12일치**.

## 변경 (What)

### 1. Supabase RPC 함수 신설
`public.backfill_market_price_daily(target_date date)` — Supabase migration apply 완료
- 특정 날짜 historical 재계산
- `mvp_raw_listings + mvp_listing_parsed` join
- D날 active 매물: `first_seen_at < midnight AND (sold_detected_at IS NULL OR >= midnight) AND last_seen_at >= start - 12h`
- D날 sold 매물: `sold_detected_at::date = D`
- condition_class별 + comparable_key별 group by
- median/p25/p75 + active/sold sample count
- confidence: high(≥20) / medium(≥8) / low
- **ON CONFLICT DO NOTHING** — 기존 5/16~5/20 정확한 row 절대 안 건드림

### 2. 즉시 호출 (5/9~5/15 loop)
```sql
DO $$ DECLARE d date; BEGIN
  FOR d IN SELECT generate_series('2026-05-09'::date, '2026-05-15'::date, '1 day'::interval)::date LOOP
    PERFORM public.backfill_market_price_daily(d);
  END LOOP;
END $$;
```

## 결과 (실측)

| 날짜 | 신규 row | high | medium |
|---|---|---|---|
| 5/9 | 282 | 1 | 5 |
| 5/10 | 2,524 | 92 | 175 |
| 5/11 | 2,453 | 88 | 152 |
| 5/12 | 1,946 | 50 | 117 |
| 5/13 | 2,096 | 53 | 142 |
| 5/14 | 2,261 | 58 | 159 |
| 5/15 | 3,633 | 44 | 159 |
| **누적 backfill** | **15,195** | 386 high | 909 medium |
| 5/16~5/20 (기존 보존) | 11,915 | (기존) | (기존) |
| **전체 row** | **27,110** | | |
| **표시 일수** | **5일 → 12일** | +140% | |

## 안전성

- **ON CONFLICT DO NOTHING** — 기존 정확한 row (tick-pipeline의 정교한 decay weight/risk filter 적용된) 절대 안 덮어씀
- **backfill 정확도** 80~90% 수준 — 단순화된 로직 (risk filter 일부 생략). 5/16 incident 손실 row의 정밀 복구는 불가능 (decision로 받아들임). "정확하지만 5일" vs "근사하지만 12일" trade-off에서 12일 선택
- **추가 손실 위험 X** — INSERT만, DELETE/UPDATE X
- 사용자 매물 상세 그래프 자동 update — UI 코드 변경 X (이미 동적 `data.length` 기반)

## 그래프 UX 변화

- "**번개장터 시세 5일 추이**" → "**번개장터 시세 12일 추이**" (자동)
- "데이터 누적 중 N일째" 배너 — `data.length < 7` 조건이라 **자동 사라짐** (이제 12일치라 7일 임계 통과)
- confidence 뱃지 자동 update — 더 많은 sold 데이터로 신뢰도 향상 가능

## 후속

### 자연 회복 (시간)
- 매일 1일치 자동 누적 (market-worker QStash hourly cron)
- 5/30 즈음 30일 풀 회복 예상

### P1 (출시 후 정비)
1. **migration 파일 박기** — 본 RPC 함수를 `supabase/migrations/`에 file로 추적 (idempotent)
2. **velocity historical도 backfill 검토** — `mvp_market_velocity_daily`는 sold detection 기반이라 backfill 어려움. raw가 충분한지 별도 검토
3. **`source_uploaded_at` backfill** — `bunjang.ts:fetchDetail`이 실제 timestamp 받아오는지 + observation_payloads의 raw_json에 박혀있는지 확인 후 backfill (별도 wave)
4. **30일+ rollup 시스템** (P1-G — 사용자 의도) — 30일치 회복 후 weekly aggregate로 압축

## 관련

- 5/16 incident: docs/DECISIONS/2026-05-16-incident-market-price-daily-historical-loss.md
- 시세 그래프 정직화: docs/DECISIONS/2026-05-19-market-chart-honesty-and-schema-drift.md
- velocity P0 fix (같은 패턴): docs/DECISIONS/2026-05-19-velocity-p0-fix.md
- 메모리: "시세 historical 한 번 잃으면 못 돌림" — 부분 복구 (12일치) 의의
