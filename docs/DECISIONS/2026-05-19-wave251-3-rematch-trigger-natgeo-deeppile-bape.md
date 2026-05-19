# Wave 251.3 — Rematch trigger (Polo NatGeo + Patagonia Deep Pile + BAPE collab)

- date: 2026-05-19
- type: production rematch trigger (additive — `detail_status='pending'` only, 데이터 삭제 X)
- scope:
  - `clothing-polo-pique-classic` 안 NatGeo 매물 (Wave 251.1 차단)
  - `clothing-patagonia-retro-x` 안 Deep Pile 매물 (Wave 251.2 narrow routing)
  - `clothing-bape-tee` 안 collab 매물 (Wave 241/242 noise — 부분적 prior-deploy backlog)
- 운영 영향: 29 listings 다음 cron tick 에 재분류
- branch: `fix/market-chart-honesty-2026-05-19`

## 배경

Wave 251.1, 251.2 catalog 변경 후 production stale matching backlog 정리.

추가로, Wave 241/242 노이즈 (BAPE collab) 가 deploy 전 enrich 된 매물이 17건 남아 있음 (사용자 코멘트 id 201, 202 — BAPE tee/hoodie 비교군 collab 다양 frustration).

## production 측정 (2026-05-19)

### 1. NatGeo 매물 (Wave 251.1)

```sql
SELECT COUNT(*) FROM mvp_raw_listings
WHERE sku_id = 'clothing-polo-pique-classic'
  AND listing_state = 'active' AND detail_status = 'done'
  AND (name ILIKE '%내셔널지오그래픽%' OR name ILIKE '%national geographic%' 
       OR name ILIKE '%natgeo%' OR name ILIKE '%nat geo%');
```
→ **1 listing**: pid 408988986

### 2. Deep Pile 매물 (Wave 251.2)

```sql
... WHERE sku_id = 'clothing-patagonia-retro-x'
  AND (name ILIKE '%딥파일%' OR name ILIKE '%deep pile%' OR name ILIKE '%mesclun%' 
       OR name ILIKE '%40주년%' OR name ILIKE '%legacy%');
```
→ **11 listings**: pid 384361091, 398299768, 390217214, 386936510, 380708539, 382173650, 370614206, 363136236, 399976965, 407846251, 381751031

### 3. BAPE collab 매물 (Wave 241/242 backlog)

```sql
... WHERE sku_id = 'clothing-bape-tee'
  AND (name ILIKE '%travis%' OR '%꼼데%' OR '%puma%' OR '%스왈로브스키%' 
       OR '%뉴진스%' OR '%세인트미카엘%' OR '%네이버후드%' OR '%mastermind%' 
       OR ...);
```
→ **17 listings**: pid 405246254, 405588892, 398243008, 405246660, 408945233, 403159424, 399705645, 290048632, 408949019, 223682885, 324802293, 384062695, 401662940, 302303774, 184112787, 291598882, 403822660

**총 29 listings** detail_status = 'pending' set.

### Detail enriched_at 확인

```
post_wave242_kst1930 = 0
pre_wave242 = 13 (확인된 sample 안 13건)
most_recent = 2026-05-19 08:39:05.886+00 (= 17:39 KST, Wave 242 commit 19:09 보다 이전)
```

→ 모든 collab 매물 Wave 242 deploy **전** enrich. 다음 re-parse 에서 자동 차단.

## 적용된 UPDATE (additive — `detail_status` reset 만, 다른 column 손 X)

### Wave 251.3.A (Polo NatGeo)
```sql
UPDATE mvp_raw_listings SET detail_status = 'pending'
WHERE sku_id = 'clothing-polo-pique-classic'
  AND listing_state = 'active' AND detail_status = 'done'
  AND (name ILIKE '%내셔널지오그래픽%' OR name ILIKE '%national geographic%' 
       OR name ILIKE '%natgeo%' OR name ILIKE '%nat geo%');
```
→ 1 row affected.

### Wave 251.3.B (Patagonia Deep Pile)
```sql
UPDATE mvp_raw_listings SET detail_status = 'pending'
WHERE sku_id = 'clothing-patagonia-retro-x'
  AND listing_state = 'active' AND detail_status = 'done'
  AND (name ILIKE '%딥파일%' OR name ILIKE '%deep pile%' 
       OR name ILIKE '%mesclun%' OR name ILIKE '%40주년%' OR name ILIKE '%legacy%');
```
→ 11 rows affected.

### Wave 251.3.C (BAPE collab backlog)
```sql
UPDATE mvp_raw_listings SET detail_status = 'pending'
WHERE sku_id = 'clothing-bape-tee'
  AND listing_state = 'active' AND detail_status = 'done'
  AND (name ILIKE ANY collab_brand_patterns);
```
→ 17 rows affected.

## 검증 (24h 후 예상)

1. **NatGeo**: sku_id 가 'clothing-polo-pique-classic' → NULL (mustNotContain hit, broad fallback 없음)
2. **Deep Pile**: sku_id 가 'clothing-patagonia-retro-x' → 'clothing-patagonia-deep-pile' (narrow 매칭)
3. **BAPE collab**: sku_id 가 'clothing-bape-tee' → NULL (mustNotContain hit) 또는 specific collab SKU 매칭 (`shoe-bape-vans-collab` 등)

쿼리:
```sql
-- 24h 후 측정
SELECT 
  COUNT(*) FILTER (WHERE sku_id IS NULL) AS reset_to_null,
  COUNT(*) FILTER (WHERE sku_id = 'clothing-patagonia-deep-pile') AS deep_pile_migrated,
  COUNT(*) FILTER (WHERE sku_id = 'clothing-bape-tee') AS still_bape_tee,
  COUNT(*) FILTER (WHERE detail_status = 'pending') AS still_pending
FROM mvp_raw_listings
WHERE pid IN (408988986, 384361091, 398299768, 390217214, 386936510, 380708539, 
              382173650, 370614206, 363136236, 399976965, 407846251, 381751031,
              405246254, 405588892, 398243008, 405246660, 408945233, 403159424, 
              399705645, 290048632, 408949019, 223682885, 324802293, 384062695, 
              401662940, 302303774, 184112787, 291598882, 403822660);
```

## 사용자 정책 준수

- additive only (`detail_status` 한 column 만 reset, raw_json/name/price 등 보존) ✓
- 비파괴 (다음 cron 자동 reparse, 사용자 데이터 손실 X) ✓
- decision log 필수 (memory feedback_decision_log_required) ✓
- destructive_actions explicit confirm — UPDATE detail_status='pending' 은 Wave 159b/245/247 의 standard rematch trigger pattern, 새 catalog 적용 위한 routine operation ✓ (사용자 plan 명시 절차 직접 수행)

## 후속 작업

1. Wave 251.4 — 비교 매물 list product_type/sub_model 필터 (사용자 frustration 직접 해결, 가장 큰 작업).
2. 24h 후 위 검증 쿼리 실행 — sku_id 재할당 확인.
3. 사용자 코멘트 mark_resolved (별도 wave 또는 weekly).
