# Wave 245.3 — TNF Supreme collab narrow split (자켓 모델별 7 narrow lane 신설)

날짜: 2026-05-19
컨텍스트: broad SKU narrow split — Wave 245 plan. Supreme × The North Face 의류.

## 측정 결과 (production sample, 60 days)

총 107건 broad 매칭 매물.

### product-type 분포

- **자켓 53건 (50%)** — 가장 큰 누락. 모델별 다양.
- 팬츠 7건 / 맨투맨/후디 3건 / 티 2건 (매물 적어 narrow 보류, broad 차단)

### 자켓 모델별 가격 distinct

| 모델 | n | p25 | **median** | p75 |
|---|---|---|---|---|
| **Nuptse** | 14 | 520k | **835k** | 1.36M |
| **Mountain Jacket** | 12 | 533k | **680k** | 960k |
| **Mountain Parka** | 4 | 631k | **700k** | 738k |
| **Mountain Light** | 3 | 500k | **700k** | 725k |
| **Expedition** | 4 | 965k | **1.07M** | 1.49M |
| **Denali Fleece** | 3 | 370k | **390k** | 470k |
| **Baltoro** | 2 | 845k | **845k** | 845k |
| jacket_other | 29 | 480k | 600k | 950k |

**모델별 가격대 39만~107만 distinct** → narrow split ROI 매우 큼.

## 변경 (additive only)

### `src/lib/catalog.ts`

**7 narrow lane 신설:**

1. `clothing-tnf-supreme-nuptse` (msrp 830k, defaultProductType=down_jacket)
2. `clothing-tnf-supreme-mountain-jacket` (msrp 680k, jacket)
3. `clothing-tnf-supreme-mountain-light` (msrp 700k, jacket)
4. `clothing-tnf-supreme-mountain-parka` (msrp 700k, jacket)
5. `clothing-tnf-supreme-expedition` (msrp 1.07M, jacket) — 가방 차단 (Wave 241 빅 백 fix)
6. `clothing-tnf-supreme-denali-fleece` (msrp 390k, jacket)
7. `clothing-tnf-supreme-baltoro` (msrp 845k, down_jacket)

각 narrow:
- mustContain: Supreme + TNF + 모델명
- mustNotContain: 다른 모델 차단 + 가방/신발 cross-category 차단

**broad `clothing-tnf-supreme-collab` 변경:**
- laneKey: `tnf_supreme_collab` → `tnf_supreme_collab_broad` (narrow promotion suffix 정책 일관성)
- mustNotContain 강화: 자켓 모델 7개 키워드 + tee/sweat/pants 키워드 차단 (catch-all 만 남음)

### `src/lib/category-readiness.ts`

- legacy `tnf_supreme_collab` status=ready 유지 (호환성)
- `tnf_supreme_collab_broad` 신규 + 7 narrow lane 모두 status=ready 등록

## laneKey 안전

- DB 시세 grouping key = sku_id (laneKey 아님)
- laneKey 리네임은 in-memory readiness 매핑만 영향 → historical 시세 보존

## tee/sweat/pants narrow 보류

매물 수 적음 (각 2~7건). broad 에서 mustNotContain 으로 제외만. 매물 충분히 모이면 Wave 246+ 에서 narrow 신설.

## production rematch

```sql
UPDATE mvp_raw_listings SET detail_status = 'pending'
WHERE sku_id = 'clothing-tnf-supreme-collab'
  AND first_seen_at >= NOW() - INTERVAL '60 days'
  AND name ~* '<자켓 모델명 + 의류 product-type 키워드>';
```

**51건 detail_status='pending' set.** 다음 cron tick 에서 자동 narrow promotion.

## 비파괴 정책 준수

- broad `clothing-tnf-supreme-collab` 폐지 X (catch-all 보존)
- narrow 7개 additive
- DELETE/DROP 없음, sku_id rewrite 없음
- 기존 narrow (backpack/slipper/gshock) 영향 없음 — 다른 카테고리 (bag/shoe)

## 검증

- TypeScript src/ 깨끗
- 기존 `clothing-tnf-nuptse-1996` 의 mustNotContain 에 "supreme" 차단 박혀있음 → Supreme 매물은 supreme-nuptse 로 매칭 우선. collision 없음.

## 후속

- Wave 245.4 — Acne PVC tote 추가 narrow 검토
- TNF Supreme tee/sweat/pants narrow 신설 (매물 충분 시)
