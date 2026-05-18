# Wave 216 — clothing 카테고리 parser 분기 신규 + brand 구분 fix (2026-05-19)

## 사용자 명시

> "지금 왜 옷들이 ready에 안들어옴? 뭐한ㄴ는거지?"

→ Wave 215 ready 승격 후에도 candidate_pool clothing 0건 진단 + fix.

## 진짜 근본 원인 (Wave 215 가짜 fix)

Wave 215는 lane ready / category ready 승격 + reparse + market_invalidation enqueue 했지만, **clothing 매물이 시세 daily 자체에 진입 안 함**. 진단 결과:

| 단계 | shoe | clothing | bag |
|------|------|----------|-----|
| raw_listings sku_id 박힘 | OK | OK (1708) | OK |
| listing_parsed row | 4992 | 1253 | 1094 |
| parsed usable (conf≥0.65 + !needs_review) | **4124 (82%)** | **0 (0%)** ❌ | OK |
| market_price_daily | 1058 | **0** ❌ | 122 |
| candidate_pool | 172 | **0** ❌ | 0 |

**원인:** `parseFashionMobility` (option-parser dispatcher 분기) 가 shoe/bag/bike 만 처리. **clothing 카테고리 parser 분기 자체가 없음**. dispatcher 가 default 분기 (전자기기 전용 로직) 진입 → confidence 0.45 + needs_review=true 박힘 → `upsertMarketPriceDaily` filter (`parse_confidence < 0.65 || needs_review`) 에 다 걸려 시세 daily 0건.

추가 발견 2: `modelFromSku` 가 `slice(2)` 라서 brand 정보 손실. `clothing-acne-apparel`/`clothing-reebok-apparel`/`clothing-fila-apparel` → 모두 `apparel` 한 key 로 묶임. clothing 은 brand 가 가격 결정 핵심 → 시세 망가짐.

추가 발견 3: `ensureParsedRows` 는 `missing` 만 re-parse → 새 parser version 박혀도 옛 row 영원히 stale.

## 코드 fix (3 곳)

### 1. `src/lib/parsers/wave92-fashion-mobility.ts`
- dispatcher 가드: `clothing` 도 허용
- clothing 분기 신규: condition tier (S급/A급/B급/C급/reject) 만 추출, 사이즈 무관, model + condition tier → comparable_key
- `modelFromSku(skuId, skuName, category)` — clothing 만 slice(1) → brand 포함 (polo_pony_tee, stussy_basic_tee, tnf_purple_label, acne_apparel 등)
- 새 const `PARSER_VERSION_W216_CLOTHING = "wave216-clothing-v2"`

### 2. `src/lib/option-parser.ts`
- dispatcher: `category0 === "clothing"` 도 `parseFashionMobility` 로 dispatch.

### 3. `src/lib/tick-pipeline.ts`
- `LATEST_PARSER_VERSION_BY_CATEGORY` 신규 — 카테고리별 최신 parser version 명시.
- `isParsedStale(row)` — parsed.parser_version 이 expected 와 다르면 stale.
- `ensureParsedRows` — stale row 도 missingRows 에 포함 → 새 parser version 박히면 자동 re-parse.

## 1회성 reparse 결과

`scripts/reparse-wave216-clothing.ts` (1708 clothing raw_listings 다 ruleMatch+parser 재실행).

| 버전 | usable ratio |
|------|-------------|
| 옛 dispatcher default | 0% (0/1253) |
| v1 (clothing 분기 추가) | 95.9% (1638/1708) |
| **v2 (brand 포함)** | **99.4% (1698/1708)** ⭐ |

새 comparable_key 분포 (top):
- `clothing|polo_pony_tee|unknown_condition` 179
- `clothing|polo_rrl|unknown_condition` 82
- `clothing|stussy_basic_tee|unknown_condition` 59
- `clothing|polo_pique_classic|unknown_condition` 58
- `clothing|bape_tee|unknown_condition` 51
- `clothing|tnf_purple_label|unknown_condition` 41
- `clothing|tnf_supreme_collab|unknown_condition` 36
- `clothing|stussy_hoodie|unknown_condition` 35
- `clothing|patagonia|unknown_condition` 30
- `clothing|arcteryx|unknown_condition` 28
- ...
- 146 unique keys

## market_invalidation enqueue

```sql
INSERT INTO mvp_market_key_invalidation (comparable_key, source, reason, priority, status, ...)
SELECT DISTINCT comparable_key, 'wave216_clothing_parser_fix', 'parser_version drift fix', 10, 'pending', ...
FROM mvp_listing_parsed WHERE category='clothing' AND parse_confidence>=0.65 AND needs_review=false;
```

→ 146 clothing comparable_keys pending. 다음 market-worker cron (5분) 이 시세 daily 계산.

## verify

- test:core **556/556 pass** ✅

## 다음 자동 진행 (cron 자연 처리)

1. **5분 cron** (market-worker): 146 clothing keys 시세 daily 박힘
2. **그 다음 cron** (score-stage + candidate-pool-builder): clothing 매물 풀 진입 시도 (profit gate + AD floor 0.30 + spread check 통과 시)
3. **24h+ 후 정식 측정** — 사용자 풀 clothing 노출 수

## 자기 평가 (Wave 215 sloppy fix)

Wave 215 는 lane / category readiness 승격 + reparse + enqueue 다 했지만 **시세 파이프라인 진단 안 했음**. 사용자 의심 받기 전:
- mvp_market_price_daily clothing 0건 검증 안 함
- mvp_listing_parsed clothing usable 검증 안 함
- comparable_key 형식 검증 안 함 (sku_id 와 comparable_key 가 다른 형식인지 모름)

사용자 "지금 왜 옷들이 ready에 안들어옴?" 받고서야 5단계 (raw → parsed → daily → pool → ready) 다 측정. 메모리 정책 ("같은 실수 재발 방지: 5단계 모두 확인 원칙") 위반 → 재발.

다음 wave 부터: ready 승격/매칭률 측정 전에 무조건 mvp_market_price_daily 카테고리 카운트 + mvp_listing_parsed usable ratio 검증.

## decision log

이 파일 push 후 사용자에 정직한 보고 + 24h+ 후 정식 풀 진입 측정.
