# Wave 245.2 — FOG Essentials narrow split (6 narrow lane 신설)

날짜: 2026-05-19
컨텍스트: broad SKU narrow split — Wave 245 plan. FOG Essentials.

## 측정 결과 (production sample, 60 days)

총 100건 broad 매칭 매물 — product-type 분포 거의 동률.

| product-type | n | p25 | **median** | p75 |
|---|---|---|---|---|
| **hoodie** | 19 | 105k | **160k** | 194k |
| **crewneck/sweat** | 10 | 61k | **72k** | 112k |
| **tee** | 19 | 47k | **55k** | 85k |
| **pants** | 18 | 80k | **95k** | 184k |
| **shorts** | 4 | 40k | **60k** | 111k |
| **jacket** | 5 | 155k | **182k** | 190k |
| other (베스트/니트/플리스/모자/카라티) | 25 | 55k | 68k | 99k |

**핵심 — product-type 별 가격대 2~3배 차이** (hoodie 160k vs tee 55k vs jacket 182k). broad 시세 grouping 부정확. narrow split 효과 매우 큼.

## 변경 (additive only)

### `src/lib/catalog.ts`

**6 narrow lane 신설:**

1. `clothing-fog-essentials-hoodie` (msrp 160k, defaultProductType=hoodie)
2. `clothing-fog-essentials-crewneck` (msrp 72k, defaultProductType=crewneck)
3. `clothing-fog-essentials-tee` (msrp 55k, defaultProductType=tee)
4. `clothing-fog-essentials-pants` (msrp 95k, defaultProductType=pants)
5. `clothing-fog-essentials-shorts` (msrp 60k, defaultProductType=shorts)
6. `clothing-fog-essentials-jacket` (msrp 180k — multi: jacket/coat/아노락)

각 narrow:
- mustContain: 피어오브갓/피오갓/fear of god/fog + essentials/에센셜 + product-type 키워드
- mustNotContain: 기존 차단 (kids/Main Line 시즌/Zegna/Nike) + 다른 narrow 키워드 차단

**broad `clothing-fog-essentials` 변경:**
- laneKey: `fog_essentials` → `fog_essentials_broad` (Wave 223 narrow promotion `_broad` suffix 정책)
- mustNotContain 강화: narrow 키워드 fallback 차단 (catch-all only — 베스트/니트/플리스/카라티/모자 만 broad)
- 신발 cross-category 차단 (컨버스/척70/converse) — production sample 에 발견

### `src/lib/category-readiness.ts`

- `fog_essentials` legacy 유지 (호환성, status=ready)
- `fog_essentials_broad` 신규 + narrow 6개 모두 status=ready 등록

## laneKey 리네임 안전성

- DB `mvp_listings.sku_id` 가 시세 grouping key (laneKey 아님)
- laneKey 는 `evaluateLaneReadinessForSku` (in-memory readiness 매핑) 만 사용
- 따라서 laneKey 변경해도 historical 시세 데이터 영향 없음
- 단 호환성 위해 legacy `fog_essentials` LANE_READINESS 도 보존

## production rematch

```sql
UPDATE mvp_raw_listings SET detail_status = 'pending'
WHERE sku_id = 'clothing-fog-essentials'
  AND first_seen_at >= NOW() - INTERVAL '60 days'
  AND name ~* '<6 product-type 키워드>';
```

**78건 detail_status='pending' set.** 다음 cron tick 에서 자동 narrow promotion.

## 비파괴 정책 준수

- broad `clothing-fog-essentials` 폐지 X (catch-all 로 보존)
- narrow 6개 additive
- DELETE/DROP 없음, sku_id rewrite 없음

## 검증

- TypeScript src/ 깨끗
- 비파괴 — historical 시세 보존

## 후속

- Wave 245.3 — TNF Supreme collab 의류 narrow split
- Wave 245.4 — Acne PVC tote 추가 narrow 검토
