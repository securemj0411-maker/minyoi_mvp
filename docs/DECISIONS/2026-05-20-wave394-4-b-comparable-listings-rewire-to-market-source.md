# Wave 394.4.b — ComparableListingsPanel rewire to /api/listings/[pid]/market-source

날짜: 2026-05-20
영역: pack-reveal-modal (ComparableListingsPanel) + /api/market/comparable-listings 삭제

## 배경

Wave 394.4 에서 신규 endpoint `/api/market/comparable-listings` 만들어서 ComparableListingsPanel 연결. 그러나 사용자 테스트 → "비교 매물 불러오기 실패" 출력 (fetch 500).

### 근본 원인

신규 endpoint 가 `mvp_listings` table 에서 `comparable_key=eq.${ck}` 로 fetch — `mvp_listings` 에는 **`comparable_key` 컬럼이 없음**. supabase REST 가 400 또는 빈 결과 반환.

미뇨이 스키마:
- `mvp_listings` — 매물 enriched (pid, name, price, url, thumbnail_url, sku_name, sku_median, description_preview, image_count)
- `mvp_listing_parsed` — 파싱 결과 (pid, **comparable_key**, **condition_class**, parsed_json, parse_confidence, needs_review)
- `mvp_raw_listings` — 매물 raw (pid, **sale_status**, **listing_state**, last_seen_at, sku_id, thumbnail_url, name, price, query)

즉 `comparable_key` 매물 fetch 는 두 단계 (parsed → raw 또는 listings) JS join 필요.

## 사용자 reference

> "야 근데 /me운영자풀에 시세 근거보기 눌렀을때 나오는 sample끼리 비교 매물 그거 참고하면되지않을까?"

**정답.** 이미 `/api/listings/[pid]/market-source` endpoint 가 존재. Wave 90 (2026-05-15) 에 박힘.

### market-source endpoint 강점 (우리 endpoint 보다 훨씬 풍부)

- `comparable_key` (parsed) → `pid` list → `mvp_raw_listings` join (정확)
- `COMPARABLE_EXCLUDE_NOTES` 적용 — 위험/박스 미개봉 등 노출 X (condition-policy.ts 단일 source)
- `condition_class` 정확 매칭 — 본 매물 cc 와 다른 cc 매물 제외 (Wave 130 사용자 코멘트 #95 fix)
- `clothing_product_type` 필터 — BAPE tee vs hoodie 가격 4배 차 false-comp 차단 (Wave 251.4)
- `listing_type=normal` — 광고/이벤트 매물 제외 (Wave 90)
- `risk_hits=0` — 가품/사기 risk 있는 매물 제외
- `saleStatus + listingState` 동시 표시 (시스템 분류 + 셀러 설정)
- Rate-limit 60/60s (우리 30/60s 보다 관대)

## 변경

### 1. 신규 endpoint 삭제

**`src/app/api/market/comparable-listings/route.ts`** — 제거.

### 2. ComparableListingsPanel rewire

```diff
- fetch(`/api/market/comparable-listings?ck=${ck}&cc=${cc}&excludePid=${pid}&limit=6`)
+ fetch(`/api/listings/${card.pid}/market-source`)
```

response 매핑:
```diff
- type ComparableListing = { pid, name?, url?, thumbnailUrl?, price?, conditionClass?, saleStatus?, lastSeenAt?, soldAt? }
+ type ComparableListing = { pid, name, price, thumbnailUrl, saleStatus, listingState, lastSeenAt, sourceQuery, bunjangUrl }
```

filter + slice:
```ts
const filtered = (j.comparables ?? [])
  .filter((c) => c.listingState !== "disappeared")  // 사라진 매물 제외
  .slice(0, 6);
```

판매상태 매핑 — `listingState` 우선, `saleStatus` fallback:
- "sold" (listingState) 또는 "SOLD_OUT" / "sold" (saleStatus) → 판매완료 (emerald)
- "reserved" / "RESERVED" / "예약중" (saleStatus) → 예약중 (amber)
- 기타 → 판매중 (zinc)

## 영향

- Panel fetch 동작 (실패 → 정상)
- USP 정면 효과 그대로 + 데이터 풍부도 ↑ (위험 매물 제외 + condition 정확 매칭)
- market-source endpoint 가 admin/baseline pool 에서도 사용 중 — 일관성 자동 확보 (메모리 룰 3화면)

## 사이드 효과

- market-source endpoint payload 크기 큼 (limit 80 + ourListing + marketDailyStats + liveStats 다 동봉). 우리는 `comparables` slice 6개만 사용. 다른 필드 무시.
- 후속에 비용 부담 측정해서 light endpoint 신규 가치 있는지 결정 가능 (현재는 reuse 우선).

## 원칙

- 사용자 명시 reference 우선 (DRY) — 신규 만들지 말고 기존 활용
- 일관성 (메모리 룰 `ui_changes_apply_to_all_card_screens`) — admin 풀과 같은 endpoint
- USP 정면 (band-aware) + 데이터 안전성 (위험 매물 제외) 1타 2피
