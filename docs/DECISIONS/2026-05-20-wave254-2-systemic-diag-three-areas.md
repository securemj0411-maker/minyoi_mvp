# Wave 254.2 — 1타 2피 systemic 진단 (3 영역)

날짜: 2026-05-20
상태: 진단 only (fix 자율 X — 사용자 결정 대기)
연관 Wave: 252.A/B/C, 253, 254
원칙: whack-a-mole 종료 — 비슷 패턴 1타 2피 일괄 fix

## 요약

- **영역 1 (PostgREST UPDATE pattern audit)** — `markRawScoreDirtyByComparableKeys` 가 `loadParsedRowsByComparableKeys` 를 통해 dirty 마킹할 pid 를 수집하는데, 후자가 PostgREST max-rows=1000 cap 인식 없이 단일 GET 으로 처리 → hot SKU 의 score_dirty 누락 가능. 동일 패턴 추가 검출 없음 — fix 1개 → 영역 3 sku_median stale 38% 동시 해소.
- **영역 2 (fashion condition Wave 203~209 미적용)** — `parseFashionMobility` 가 `conditionFromText` 호출 X. fashion 매물 17,590건 (clothing 4,442 + shoe 11,354 + bag 1,691 + bike 103) 의 condition_notes 100% 빈 배열. cosmetic_wear negation / damage variant / refurbished split 등 미적용. pid 408858108 가젤 ("약간 하자가있어" + mint) 같은 매물 다수 존재. Wave 252.A 의 sku_median spread 부정확성 일부 원인.
- **영역 3 (mvp_listings 컬럼 갱신 path)** — mvp_listings 는 `scoreStage` 한 곳에서만 upsert. 단 score_dirty 가 false 이면 scoreStage 가 row 안 처리. 결과 sku_median 5,373 매물 비교 중 38% (≥5% 차이) / 14% (≥20%) stale. 영역 1 fix 시 자동 해소.

## 영역 1 — score_dirty propagation + PostgREST UPDATE pattern audit

### A.2 (가설 G4) — markRawScoreDirty propagation 결함

**root cause 확정 (코드 read)**

```
mvp/src/lib/tick-pipeline.ts
  3229:  const markedDirty = await markRawScoreDirtyByComparableKeys(recomputedKeys)
  1926-1938:  markRawScoreDirtyByComparableKeys
              → loadParsedRowsByComparableKeys(unique, 5000)
              → patchRowsByIds(... chunk 50, score_dirty=true)
  2049-2062:  loadParsedRowsByComparableKeys (= 누락 지점)
              for chunk of comparableKeys (chunkSize=REST_KEY_READ_CHUNK_SIZE=50):
                url ?...&comparable_key=in.(${encoded})&parse_confidence=gte.0.65&needs_review=eq.false&limit=${Math.max(limit, chunk.length * 100)}
                ↑ PostgREST max-rows=1000 cap 인식 X — Range header 없음, pagination 없음
                ↑ 같은 코드 본문 line 1988-1991 에 "PostgREST max-rows=1000 강제 cap" 명시
                ↑ Wave 184 의 `loadMarketStatRows` 는 pagination 함, 본 함수는 안 함 (drift)
```

**측정 (production)**

- 가장 큰 comparable_key: `airpods|airpods_pro_2` 790 rows / `airpods_4_anc|usbc` 445 rows
- parse_confidence ≥0.65 + needs_review=false 제외 후 평균 4.36 rows/key, max 513 rows/key (7,115 keys 총 31,032 rows)
- chunk 50 keys × max 513 = ~25,000 rows 잠재 — 1000 cap 으로 안전 marg 거의 없음. hot SKU bundled chunk 에서 누락 위험.

**영향 매물 (영역 3 추정)**

```sql
mvp_listings vs latest mvp_market_price_daily (comparable_key + condition_class JOIN)
  total_pairs=5,373, stale ≥5%=2,022 (38%), ≥10%=1,101 (20%), ≥20%=754 (14%), exact=2,146 (40%)
```

**또한 24h 동안 mvp_listings 갱신 안 된 row 12,736 / 48h+ 9,957 / 총 29,372** — score_dirty propagation 끊긴 매물 분명히 존재.

### 추가 PATCH 사이트 audit (1타 2피 확장)

전수 검사 (`method:"PATCH"` 35건 + `patchRows*` 통해 22 추가 사이트):

| File | LineNo | Chunk size | Conflict guard | Cap-aware | 비고 |
|------|--------|-----------|----------------|-----------|------|
| `tick-pipeline.ts:395` `patchRows` (universal) | – | n/a (filter-driven) | n/a | n/a | 한 row OR 작은 in.() — OK |
| `tick-pipeline.ts:403` `patchRowsByIds` | REST_WRITE_CHUNK_SIZE=50 | n/a | n/a | OK (chunk 명시) |
| `tick-pipeline.ts:1922,1935,4458` `patchRowsByIds(mvp_raw_listings, ..., score_dirty)` | 50 | n/a | n/a | OK |
| `tick-pipeline.ts:1327,1417,1420,1427` raw touch updates | 50 | n/a | n/a | OK |
| `tick-pipeline.ts:2209` patchRows mvp_market_key_invalidation | filter | n/a | n/a | OK |
| `tick-pipeline.ts:3792` patchRows mvp_search_queries chunk 50 | 50 | n/a | n/a | OK |
| `rematch-helpers.ts:213` PATCH ?sku_id=in.()&listing_state=eq.active&detail_status=eq.done | **unbounded — 한방 PATCH** | n/a | PostgREST max-rows PATCH 도 same cap? (확인 필요) | **잠재 누락**: 12K v3 매물 같은 큰 batch → 1000 PATCH cap 가능. Wave 252.B 12K 본 trigger 가 silently 1000 만 PATCH 된 의심 |
| `rematch-helpers.ts:288` PATCH ?pid=in.() | batchSize=DEFAULT_BATCH=5000 (옵션) | n/a | URL 길이만 분할, cap 안 봄 | **잠재 누락**: 한 chunk 가 5000 — PostgREST cap 1000 이면 4000 silently miss |
| `rematch-helpers.ts:134` fetchPidsBySkuIds | PAGE=1000 + offset loop | n/a | OK (pagination 함) | OK |
| `rematch-helpers.ts:367-377` 같은 pagination | OK | n/a | OK | OK |
| `ai-l2-shadow-audit.ts:401` PATCH mvp_candidate_pool | chunk 200 | n/a | n/a | OK |
| `pack-open.ts` 7 PATCH | per-pid | n/a | n/a | OK |
| `tick-pipeline.ts:2049` `loadParsedRowsByComparableKeys` | **chunk 50 × per-key 평균 4 / max 513** | n/a | **NOT cap-aware** | **CRITICAL — 본 wave 진단 root cause** |

**1타 2피 fix 옵션 (사용자 결정 대기)**:

1. **`loadParsedRowsByComparableKeys` pagination** — Wave 184 `loadMarketStatRows` 의 `PAGE=1000` + offset loop 같은 패턴 도입. 가장 간단, 다른 효과 없음. score_dirty propagation 정상화 → mvp_listings sku_median 자동 catch-up.
2. **rematch-helpers `triggerRematchForSkus` chunk PATCH** — 5000 한방 → 500/chunk 분할 + offset PATCH. Wave 252.B 본 trigger silent 누락 의심 fix.
3. **PostgREST max-rows guard helper** — `restFetchPaginated` 같은 helper 신설 + `loadParsedRowsByComparableKeys` / `triggerRematchForSkus` 등 모두 동일 이용. 미래 drift 차단.

옵션 3 권장 (drift 영구 차단). 옵션 1 만 fix 시 동일 bug 다른 위치 재발 가능.

### 부분 A.2 (사용자 명시) — `markRawScoreDirty` console.log 1h 모니터 plan

```ts
// tick-pipeline.ts:1926
async function markRawScoreDirtyByComparableKeys(comparableKeys: string[]): Promise<number> {
  // ... existing
  const parsedByPid = await loadParsedRowsByComparableKeys(unique, 5000);
  const pids = [...parsedByPid.keys()];
  console.log('[mark-score-dirty]', {
    comparableKeyCount: unique.length,
    pidsFound: pids.length,
    pageSize: 50,
    samplePids: pids.slice(0, 10),
    // ↓ cap miss detection — 50 key chunk 마다 1000 cap 이면 한 chunk 가 1000 정확히 반환됐는지 측정
    capMissSuspicion: pids.length >= unique.length * 100,
  });
  // ... existing patch
}
```

옵션 1 fix 와 같이 박으면 fix 효과 직접 측정 가능 (before/after).

## 영역 2 — fashion condition 분석 결함

### 근거 (코드 read)

```
mvp/src/lib/option-parser.ts
  1656-1662:  export function parseListingOptions(input):
                if (category0 === "shoe" || ... "clothing")
                  return parseFashionMobility(input);  ← Wave 203~209 함수 통과 X
  1744:       const { conditionScore, conditionNotes } = conditionFromText(text, batteryHealth, batteryCycles, category);
                ↑ fashion 분기엔 이 코드 도달 X
  1148:       function conditionFromText (Wave 203~209 핵심 함수)
              - cosmetic_wear negation
              - battery_high_health
              - buy_intent block
              - refurbished split
              - damage variant
              - earphone single
              - accessory bundle
              - objective measurement override

mvp/src/lib/parsers/wave92-fashion-mobility.ts
  742-744:    const fromMeta = bunjangLabelToConditionClass(input.bunjangConditionLabel);
              conditionClassResult = resolveConditionClass(fromMeta, conditionClassResult, false);
  749:        // "신발/가방/자전거는 condition_notes 미구현 → class 기반 fallback"
  781:        conditionNotes: [],   ← 명시적으로 빈 배열
  782-783:    // "Wave 130: fashion/mobility는 condition_notes 추출 미구현 → default normal"
```

**fashion 매물 condition 결정 path** (parseConditionTier — wave92 자체 코드, Wave 130-170 시리즈):
- 정규식 chain (s_grade → reject → b/c hasCSignal → seller disclaimer → A 표기 / 1-3회 / 4-9회 / 10+회)
- bunjang label (NEW/LIKE_NEW/...) worse-of merge

**누락된 분석** (option-parser Wave 203~209 가 다른 카테고리에 적용):
| Wave | 함수 | fashion 적용 여부 | 영향 |
|------|------|-----------------|------|
| 203 | battery_high_health | N/A (electronic 전용) | – |
| 203 v50 | 미개봉+배터리 모순 | N/A | – |
| 204 v51 | buy-intent (구함/삽니다/매입) broad 차단 | **미적용** | fashion 구매 의도 매물 차단 X — 시세 부풀림 |
| 205 v52 | refurbished 분리 (공식 vs 사설/부분) | **미적용** | 사설 수리 fashion (가죽 수선 등) refurbished 표시 X |
| 206 | damage signal 변형 ("떨어트림" 등) | **미적용 (fashion 일부 wave92 자체 정규식엔 있음)** | overlap 확인 필요 |
| 207 | earphone single-side | N/A | – |
| 208 v53 | "X용 + 액세서리" 호환 매물 차단 | **미적용** | "BAPE 용 후크 백" 같은 매물 BAPE 매칭 잘못 |
| 209 v54 | objective measurement override (cosmetic_wear negation) | **미적용** | "사용감 적음" 같은 negation 미세 차이 — wave92 도 어느 정도 있음 |

### SQL 측정 (production)

```sql
SELECT category, COUNT(*) AS total, 
  COUNT(*) FILTER (WHERE parsed_json->'condition_notes' = '[]'::jsonb OR parsed_json->'condition_notes' IS NULL) AS empty_notes,
  ...
FROM mvp_listing_parsed WHERE category IN ('clothing','shoe','bag','bike') GROUP BY category;

bag      total=1,691  empty_notes=1,691 (100%)  mint=266   clean=403   normal=651   worn=249   flawed=11
bike     total=103    empty_notes=103   (100%)  mint=0     clean=2     normal=95    worn=3     flawed=0
clothing total=4,442  empty_notes=4,442 (100%)  mint=613   clean=1,663 normal=1,241 worn=531   flawed=29
shoe     total=11,354 empty_notes=11,354 (100%) mint=2,351 clean=1,641 normal=5,635 worn=1,054 flawed=44
```

**모든 17,590 fashion 매물 condition_notes 100% 빈 배열 확인.** 이건 의도된 design (Wave 130-170 fashion 정책: notes 대신 tier-class 사용) 이지만, score-stage 의 `conditionNotesScore.includes("new_or_open_box")` (tick-pipeline.ts:4346) 와 referencePrice gating 등 다른 stage 가 condition_notes 의존 → fashion 매물은 다나와 reference price 분기 자동 통과 X.

### pid 408858108 verification (사용자 제공)

```
pid=408858108 (아디다스 가젤 볼드 화이트)
  description: "새상품 + 약간 하자가있어"
  parser_version: wave92-fashion-mobility-v4   ← v7 drift (Wave 236d 이후 stale)
  condition_class: mint   ← 잘못 (description "하자" 신호 무시)
  condition_score: 0.95
  condition_notes: null   ← 빈 배열
  comparable_key: shoe|gazelle_og_broad|type_unknown|240|a_grade
  parse_confidence: 0.9
  needs_review: false
```

**double 잘못**: 
1. parser_version v4 → v7 (drift, ensureParsedRows 가 catch 하는데 score_dirty 안 박혀서 작업 안 됨)
2. condition_class='mint' but description 에 "하자" — wave92 자체 정규식이 negation/disclaimer 처리 → "하자가있어" 가 자동 negation 으로 잡혔을 가능성. `/하자\s*없|손상\s*없/` 같은 정규식 + isSellerDisclaimer 일부 match.

### #202 BAPE Tee (사용자 제공 — 영역 3 도 같이) 

```
pid=407160018
  name: 베이프 마일로 반팔티
  price: 70,000
  sku_median (stored): 109,500     ← stale
  comparable_key: clothing|bape_tee|tee|a_grade
  condition_class: mint
  parsed_parser_version: wave216-clothing-v7
  parsed_confidence: 1
  
  실제 today market_price_daily (clothing|bape_tee|tee|a_grade):
    mint   → blended 78,200 (active 6, sold 0)
    clean  → blended 64,400 (active 1, sold 0)
    normal → blended 92,000 (active 2, sold 0)
  
  sku_median 109,500 (stale, 어디서 왔는지 불명 — 옛 broad sku_median?) 
  현재 정확값 = 78,200 (mint 매물 매칭)
  → stale 차이 31,300 (~40%)
```

### Sample 30 — fashion mint/clean + 하자/스크래치 description 매물

위 SQL 결과 (random sample 30 건) 에서 다음 매물 condition_class 잘못 의심:
- pid 393717160 타미힐피거 백 — "내부 얼룩 있습니다" / class='clean' (실제 c-grade)
- pid 408197957 LV Alma BB — "약간의 기스, 오염 등 사용감 있음" / class='mint' (실제 c-grade)
- 나머지 28건 — 대부분 wave92 정규식이 정확히 처리 (negation / disclaimer / 1-3회 시착 등). false positive rate sample 기준 ~7% (2/30).

**1타 2피 fix 옵션 (사용자 결정 대기)**:

1. **fashion 분기에 `conditionFromText` 호출 추가** — buy-intent/refurbished/accessory bundle 같은 일반 신호 fashion 도 적용. wave92 자체 condition tier 와 worse-of merge. 영향: 17,590 매물 reparse 필요 → 영역 1 fix 후 진행 권장.
2. **Wave 130 fashion condition_notes 정책 재검토** — 시세 fallback 분기에 condition_notes 의존 코드 점검 (referencePrice gating 등) 필요한 곳만 분리 처리. design 의도 유지.
3. **No-op** — wave92 정규식 충분하고 sample 30 false rate 7% 라면 기존 유지 (사용자 정책 §12b 정확성 우선 위배 가능).

옵션 1 권장 — accessory bundle 차단 (208 v53) 같은 패턴은 fashion 에서도 동일 가치.

## 영역 3 — mvp_listings 컬럼 갱신 결함 inventory

### Schema (20 컬럼)

```
pid, url, name, price, sku_name, sku_median, description_preview, shipping_fee,
shipping_fee_general, shipping_source, estimated_buy_cost, gross_resell_gap,
net_gap_after_shipping, source_json, generated_at, created_at, updated_at,
image_url_template, image_count, thumbnail_url
```

### 갱신 path (전수 추적)

| 컬럼 | upsert 시점 | 소스 | 갱신 조건 |
|------|-----------|------|----------|
| 전체 19개 (created_at 제외) | `scoreStage` → `toListingOutputRows` (score-output-mapper.ts) → `upsertRows("mvp_listings", listingUpserts, "pid")` | `PipelineRow` (scoreStage scoredRows) | `listingOutputChanged(row, existing)` 가 diff 검출 시 만 upsert (score-output-mapper.ts:113). diff = url/name/price/sku_name/sku_median/description_preview/image_*/shipping_*/estimated_buy_cost/gross_resell_gap/net_gap_after_shipping 중 하나 변경 시 |
| sku_median | tick-pipeline.ts:4402 `skuMedian: Math.round(skuMedian)` — referencePrice / trustedMedian / fallbackMedian 순 | mvp_market_price_daily (comparable_key + condition_class 매칭) | scoreStage 가 row 처리해야 함 — `loadScorableRows` 가 `score_dirty=eq.true` 필터. **score_dirty 박혀야 sku_median 갱신** |

### **결론: 모든 mvp_listings 컬럼은 scoreStage 한 path 만으로 갱신 → score_dirty 누락 시 모든 컬럼 stale.**

### pid 407160018 BAPE Tee 검증 (위 영역 2 데이터 재인용)

```
sku_median       109,500 ← 30,300 stale vs 시세 78,200 (mint 매물 매칭)
shipping_fee     3,000 / shipping_source detail_api_trade
gross_resell_gap 39,500   ← 잘못 (109,500 - 70,000 = 39,500 — but 실제 78,200 - 70,000 = 8,200)
estimated_buy_cost 73,000
net_gap_after_shipping ?  ← gross 기반 → 잘못
updated_at  2026-05-19 13:06   ← 어제 갱신, 오늘 시세 변동 catch 안 함
raw last_changed_at 2026-05-19 13:00
raw score_dirty   false   ← 갱신 후 dirty 해제됨. 이후 시세 변동 trigger 안 됨.
raw pool_eligible false
```

**확인**: scoreStage 가 어제 처리 → sku_median 109,500 박힘 → score_dirty=false. 오늘 market_price_daily 가 78,200 으로 변경됐어도 `markRawScoreDirtyByComparableKeys` 가 본 pid 못 잡음 (영역 1 PostgREST cap) → re-score 안 함 → mvp_listings 그대로.

### 영역 3 1타 2피 fix 옵션 (사용자 결정 대기)

1. **No-op (영역 1 fix 의존)** — 영역 1 `loadParsedRowsByComparableKeys` pagination fix 만으로 sku_median + gross_resell_gap + net_gap_after_shipping + shipping_* 모두 자동 catch-up. 가장 가벼움.
2. **scoreStage 강제 backfill (one-shot)** — 영역 1 fix 후 1회 manual trigger 로 12,736 24h+ stale row 강제 reparse + rescore. Wave 253 fix A 같은 패턴.
3. **mvp_listings full refresh job (cron 신설)** — 매일 1회 모든 active mvp_listings row 의 score_dirty=true 강제. score-stage 무차별 부담. 영역 1 fix 가 정상 작동하면 불필요.

옵션 1 + 2 권장. 옵션 3 은 부작용 (cron 부하) 큼.

## 통합 fix plan (사용자 결정 대기)

### sub-wave 분리 안

1. **Wave 254.3 영역 1 fix** — `loadParsedRowsByComparableKeys` pagination + `triggerRematchForSkus` PATCH chunking + (옵션) shared helper. 가장 시급 (38% sku_median stale 직접 원인).
   - 영향 매물: 12,736+ 잠재 자동 자정상화.
   - dry-run plan: A.2 console.log 1h 모니터 → fix 적용 → before/after 측정.
   - test: `markRawScoreDirtyByComparableKeys` unit + integration (Wave 253 같은 helper test 패턴).

2. **Wave 254.4 영역 3 일회성 backfill** — Wave 254.3 fix 적용 후, 24h+ stale 의심 12,736 row + sku_median ≥10% mismatch 1,101 row 강제 score_dirty=true. 다음 cron 에 자동 reparse. additive only.

3. **Wave 254.5 영역 2 fashion conditionFromText 통합** — option-parser.ts 의 일반 신호 (buy-intent / accessory bundle / refurbished split) fashion 분기 에도 호출. wave92 condition tier + worse-of merge. design 결정 (사용자) 필요:
   - (a) fashion 도 condition_notes 본격 추출 (Wave 130 design 변경)
   - (b) 일반 신호만 호출 (condition_notes 빈 배열 유지) — 가장 보수적
   - (c) no-op — Wave 92 정규식 충분

### 우선순위

P0: Wave 254.3 (영역 1) — 다른 모든 fix 의 prerequisite
P1: Wave 254.4 (영역 3 backfill) — Wave 254.3 이후
P2: Wave 254.5 (영역 2) — 사용자 design 결정 필요

### 위험

- **영역 1 fix 박으면 cron 부하 일시적 spike** (1000 cap 으로 매 tick miss 매물 이번엔 다 fetch + dirty 마킹 → score-stage 부담). Wave 252.B 의 12K rematch 같은 패턴. dry-run + 시간대 안전 plan 필요.
- **영역 2 fix 박으면 17,590 fashion 매물 reparse trigger** (parser_version bump 필요?). Wave 252.B clothing v3→v7 rematch 같은 패턴. 사용자 명시 결정 필요.
- **영역 3 backfill — score-stage condition AI 호출 daily limit (PIPELINE_SCORE_AI_CONDITION_DAILY_LIMIT) 영향**: 12,736 row 한꺼번에 처리 시 limit 초과 → AI condition 호출 skip. acceptable (기존 condition_class 유지).

## 발견 (별도 audit 권장)

1. **rematch-helpers `triggerRematchForSkus` PATCH 1000-cap 잠재 누락** — Wave 252.B 본 trigger 12K → silent 1000 PATCH 만 됐는지 확인 필요. 만약 그렇다면 11K 매물 아직 v3 stuck. SQL 측정:
   ```sql
   SELECT parser_version, COUNT(*) FROM mvp_listing_parsed
   WHERE parser_version LIKE '%v3' AND category='clothing'
   GROUP BY parser_version;
   ```

2. **`loadParsedRowsByComparableKeys` 의 limit 파라미터 의미 불명** — Math.max(limit, chunk.length * 100) 으로 5000+50*100=5000 까지 받지만 PostgREST cap 1000. limit param 자체가 의도하는 cap 미작동.

3. **score_dirty 가 false 박히는 시점 audit** — `clearScoreDirty` (line 1917) 가 모든 처리된 row dirty 해제. 만약 scoreStage 가 deadline 으로 일부 row 만 처리하면 (line 4256) 나머지 row 는 dirty=true 유지 — 정상. 그런데 영역 1 의 propagation 끊김으로 시세 변동 후 다시 dirty 박힘 자체가 안 되는 게 문제.

## 사용자 결정 필요 항목

1. Wave 254.3 영역 1 fix 진행? (P0)
2. Wave 254.3 옵션 1/2/3 중 어느 것?
3. Wave 254.5 fashion condition design 결정 (a/b/c)?
4. 발견 #1 측정 진행?

---

진단 only — fix 자율 X. 사용자 결정 대기.
