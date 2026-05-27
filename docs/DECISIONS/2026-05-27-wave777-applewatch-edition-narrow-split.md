# Wave 777 — Apple Watch 케이스 재질 + 에디션 narrow SKU 세분화

- 시간: 2026-05-27 KST
- 트리거: owner — "애플워치 sku 더 세분화해야할 거 같은데?? db에 들어온 거 봐봐 에르메스랑 다른 시리즈 엄청 많음. 가격차 나는 에디션들 다 분류해야 할 듯."

## 발견 — 시세 dilution 심각

폭넓은 audit (`mvp_raw_listings` query + Apple KR + 시중 시세):

### 가장 큰 문제 — 케이스 재질 분리 안 됨

| SKU | 매물 median (혼합) | 알루미늄 cluster | 티타늄/스테인리스 cluster | 분리 필요 |
|---|---|---|---|---|
| applewatch-series10 | ₩400K | ₩370K | **티타늄 ₩600K** (+₩230K, 177건) | HIGH |
| applewatch-series8 | ₩250K | ₩190K | **스테인리스 ₩278K** (+₩88K, 85건) | HIGH |
| applewatch-series11 | ₩430K | (혼합) | **티타늄 ₩780K** (+₩350K, 15건) | MED |
| applewatch-series9 | ₩290K | (혼합) | 스테인리스 ₩420K (+₩130K, 44건) | MED |
| applewatch-series7 | ₩160K | (혼합) | 스테인리스 ₩198K (+₩38K, 33건) | LOW |

### Hermès leak — 가격 거품 위로

| SKU | Hermès leak 건수 | Hermès median | 거품 |
|---|---|---|---|
| applewatch-series9 | 13건 | ₩1.0M | 일반 ₩290K 위로 +₩710K (block **없었음**) |
| applewatch-ultra3 | 6건 | ₩1.5M | 일반 ₩925K 위로 (block 있는데 stale sku_id) |
| applewatch-series11 | 3건 | ₩1.48M | 일반 ₩430K 위로 (block 있는데 stale) |
| applewatch-series7 | 8건 | ₩410K | 일반 ₩160K 위로 |

### DB 현황 (catalog patch 전)
- 애플워치 관련 매물 ~9,003건
- null sku_id 4,844건 (54%) — 분류 안 되어 시세 산정 제외
- 현재 catalog: Hermès SKU `series8-hermes`, `series10-hermes` 만 격리
- 티타늄 / 스테인리스 narrow 분리 **전혀 없음**

## 변경

### A. 신규 SKU 9개 (`src/lib/catalog.ts` L6976~)

티타늄 (2):
- `applewatch-series10-titanium` (msrp ₩999K)
- `applewatch-series11-titanium` (msrp ₩999K)

스테인리스 (3):
- `applewatch-series7-stainless` (msrp ₩749K)
- `applewatch-series8-stainless` (msrp ₩849K)
- `applewatch-series9-stainless` (msrp ₩849K)

Hermès (4 — 기존 S8/S10 + 4 추가로 시리즈 전체 커버):
- `applewatch-series7-hermes` (msrp ₩1,549K)
- `applewatch-series9-hermes` (msrp ₩1,799K)
- `applewatch-series11-hermes` (msrp ₩1,899K)
- `applewatch-ultra3-hermes` (msrp ₩2,149K — Apple KR 공식 정가 확인)

각 SKU 패턴 (series10-hermes 따라):
- mustContain 3축: 애플워치 + 시리즈X + 재질/에디션 token
- mustNotContain: sibling 시리즈 + se/ultra + 다른 재질/에디션 + 부품/단품 차단

### B. 기존 SKU mustNotContain patch

- `applewatch-series7`: + 에르메스/hermes/스테인리스/스테인레스/stainless
- `applewatch-series8`: + 스테인리스/스테인레스/stainless (Hermès 이미 있음)
- `applewatch-series9`: + 에르메스/hermes/스테인리스/스테인레스/stainless (**Hermès block 이전엔 없었음 — leak 13건 fix**)
- `applewatch-series10`: + 티타늄/titanium (Hermès 이미 있음)
- `applewatch-series11`: + 티타늄/titanium (Hermès 이미 있음)

### C. DB rematch trigger (destructive — owner confirm 완료)

```sql
UPDATE mvp_raw_listings 
SET sku_id = NULL, score_dirty = true, detail_status = 'pending'
WHERE sku_id IN (
  'applewatch-series7','applewatch-series8','applewatch-series9',
  'applewatch-series10','applewatch-series11','applewatch-ultra3'
)
  AND listing_state = 'active' AND price > 50000;
```

**영향 매물**:
- series10: 394건
- series11: 252건
- series9: 205건
- series7: 130건
- series8: 124건
- ultra3: 71건
- **합계 1,176건 sku_id NULL 처리** → 다음 cron tick 재매핑

검증 (UPDATE 후):
- 애플워치 active 매물 중 sku_id NULL: 4,435건 (기존 3,259 + 추가 1,176)
- score_dirty=true: 2,109건
- detail_status='pending': 1,301건

## 예상 결과 (cron 처리 후, ~17h 이내)

1,176건 재매핑 + 기존 null 4,844건 일부 흡수:
- titanium / stainless / hermes 신규 SKU 에 ~400건+ 흡수
- 시세 dilution 해소 — series10/series11 알루미늄 cluster median 정확해짐
- 운영자/사용자 화면에서 매물 분류 정확도 ↑

## Follow-up

- **사이즈 분리 (41/45/49mm)**: 별도 wave. 10~20% 가격차 검증 필요
- **GPS vs Cellular**: 별도 wave. 10~15% 가격차
- **Apple KR 정확한 정가 확인**: S10/S11 티타늄 정가 추정 999K — Apple 페이지 직접 capture 필요
- **Ultra3 Hermès 한국 정가 ₩2,149K** 확인 ([clien.net/19057845](https://www.clien.net/service/board/news/19057845))
- **Sentinel ₩999,999,999** (pid 393050623): bunjang "판매완료" 마커. 시세 산정에서 cutoff 적용 별도 wave

## 출처

- Apple Watch Series 10 Korea: [Apple KR Watch shop](https://www.apple.com/kr/shop/buy-watch)
- Apple Watch Ultra 3 Hermès: [Apple KR Hermès Ultra 3](https://www.apple.com/kr/shop/buy-watch/apple-watch-hermes-ultra)
- 시세 ground truth: DB `mvp_raw_listings` 직접 query (번장 + 중고나라 + 당근 통합)
