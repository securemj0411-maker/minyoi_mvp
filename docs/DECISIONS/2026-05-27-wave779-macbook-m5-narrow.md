# Wave 779 — MacBook M5 narrow lanes (iPad M5와 동일 패턴 누락 fix)

- 시간: 2026-05-27 KST
- 트리거: sweep audit — "iPad Pro M5 는 Wave 766 에서 추가됐는데 MacBook M5 는 누락" (owner 조던 Hi/Low 패턴 동일).

## 발견

DB 매물 분포 (M5 매물):
- `macbook-pro` broad: 240건 (median ₩2.8M, max ₩9.2M)
- null sku_id: 163건 (median ₩1.98M)
- `macbook-air` broad: 136건 (median ₩1.7M)
- **합계 539건이 M5 매물인데 broad/null 에 묶임**

iPad Pro M5는 Wave 766에서 narrow 추가됨. MacBook M5는 동일 시점에 누락 → owner 지적의 패턴 동일.

## 변경 — 신규 SKU 7개

### MacBook Air M5 (2)
- `macbook-air-m5-13-256` (msrp ₩1,690K, 16GB base)
- `macbook-air-m5-15-256` (msrp ₩1,990K, 16GB base)

### MacBook Pro M5 (5)
- `macbook-pro-14-m5-256` (msrp ₩2,490K, base M5 chip)
- `macbook-pro-14-m5-pro-24-512` (msrp ₩3,290K)
- `macbook-pro-14-m5-max-36-1tb` (msrp ₩4,890K)
- `macbook-pro-16-m5-pro-24-512` (msrp ₩3,990K)
- `macbook-pro-16-m5-max-36-1tb` (msrp ₩5,490K)

### 기존 SKU patch
- `macbook-air-m4-15-256`: mustNotContain 에 m5 차단 추가 (sibling)
- `macbook-pro-16-m4-max-36-1tb`: mustNotContain 에 m5/m5 max 차단

(다른 M4 SKU 도 m5 차단 추가하면 안전하지만 새 ingest 에서 M5 narrow 가 우선 매칭되므로 영향 미세)

## DB rematch

```sql
UPDATE mvp_raw_listings 
SET sku_id = NULL, score_dirty = true, detail_status = 'pending'
WHERE sku_id IN ('macbook-pro', 'macbook-air')
  AND listing_state = 'active' AND price > 500000 AND name ~* 'M5';
```

영향 매물: ~376건 (broad → narrow reroute, null 163건 + broad 240+136 중 일부).

## 추정 정가 — 확인 필요

Apple KR 공식 정가 직접 capture 못 함. 추정값:
- MBA M5 13": ₩1,690K (M4: 1,390K, 보통 +200~300K)
- MBA M5 15": ₩1,990K
- MBP 14" M5 base: ₩2,490K
- MBP 14" M5 Pro: ₩3,290K
- MBP 14" M5 Max: ₩4,890K
- MBP 16" M5 Pro: ₩3,990K
- MBP 16" M5 Max: ₩5,490K

Follow-up: Apple KR 정가 확인 후 msrpKrw 갱신.
