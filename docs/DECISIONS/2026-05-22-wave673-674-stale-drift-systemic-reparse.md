# Wave 673-674 — Stale parser_version drift systemic reparse

## 발견

shoe LATEST_PARSER_VERSION = v23 (Wave 662), 매물 분포:
- v11: 8,686 (50%)
- fashion-mobility-v3: 3,636
- v16: 1,158
- v15: 779
- v21: 726
- v23: 239 (1.4%) ← LATEST
- v19/v18/v20: 1071

= 99% stale. drift gate (tick-pipeline.ts `isParsedStale`) 자동 reparse 큐 들어가야 하지만 정체 또는 누락.

clothing v30 LATEST, bag v23 LATEST 동일 패턴.

## 조치

systemic SQL — 모든 stale comparable_key UPSERT to invalidation 큐:

```sql
INSERT INTO mvp_market_key_invalidation (comparable_key, source, reason, priority, last_event_at, status)
SELECT DISTINCT p.comparable_key, 'parser_drift', 'wave673_*_stale_drift', 80, now(), 'pending'
FROM mvp_listing_parsed p
WHERE p.category = 'shoe'
  AND p.parser_version != 'wave92-shoe-v23'
ON CONFLICT (comparable_key) DO UPDATE SET ...;
```

shoe: 1085 lane, clothing/bag: 485 lane (총 1570 lane).

전체 pending: 2429 → 3999.

## 영향

- cron market-worker 1h tick × 500 claim_limit = 8h 안에 처리
- catalog 강화 (Wave 593-672) 적용되도록 강제 reparse
- 매물 실제 reparse는 별도 path (parseListingOptions) — invalidation은 시세 재산정

## Why

cycle 자율 진행 중 v11/v15 stale 매물 발견 → catalog 강화 적용 안 되는 게 큰 누락. drift gate 동작 확인 필요 (별도 task).

## How to apply

LATEST_PARSER_VERSION_BY_CATEGORY 박힐 때마다 동일 systemic invalidate. drift gate 자동화 미완성 상태.

## 후속

- drift gate (tick-pipeline `isParsedStale` + cron 호출 path) 동작 audit
- 매물 본체 reparse (parser_version stamp 갱신) — invalidation은 시세 reparse만이라 별개
