# Wave 252.A real — v3 clothing 매물 mixed-pool median 차단 (pack-reveal-modal + /me + admin-pool-browser)

date: 2026-05-20
status: applied
owner: claude-agent (자율) — 사용자 명시 plan, additive only

## 배경 — 이전 Wave 252.A 의 한계 (사용자 정직 인정)

이전 Wave 252.A commit `5927deb` 는 `admin-pool-browser` 의 `mvp_listings.sku_median` 만 band-aware fetch 로 교체.
하지만 사용자 코멘트 id 201/202 의 사용자 화면 (pack-reveal-modal / /me) 차익 표시는 **다른 경로**.

| 화면 | 경로 | sku_median 결정 |
|---|---|---|
| admin-pool-browser | `/api/admin/pool-listings` | `mvp_listings.sku_median` → Wave 252.A band-aware 박힘 |
| pack-reveal-modal | `/api/packs/me` + `/api/packs/reveals/detail` | `marketBasisForCandidate(comparable_key)` → mvp_market_price_daily row 직접 lookup |
| user-reveal-dashboard (/me 목록) | `/api/packs/me` | 동일 — `marketBasisForCandidate` |
| freemium pool (/api/packs/pool) | inline `bandAwareMedian` | Wave 247.2 박힘 |

**문제**: `marketBasisForCandidate` 와 inline `bandAwareMedian` 둘 다 `comparable_key` 그대로 `mvp_market_price_daily` 조회.
v3 매물 (Wave 216 이전 clothing parser — product_type 미박힘) 의 `comparable_key` 는 `clothing|<sku>|<grade>` 3 토큰.
같은 key 의 daily row 가 `mvp_market_price_daily` 에 존재 — 단 **그 row 는 mixed-pool 평균** (tee + hoodie + crewneck 섞임).
→ 사용자에게 잘못된 median 표시.

검증 SQL (2026-05-20):
```sql
-- v3 row (mixed pool — tee + hoodie + crewneck 섞임)
clothing|bape_tee|a_grade  | mint median 119,600원 (n=24)

-- v7 sibling rows (정확)
clothing|bape_tee|tee|a_grade    | mint median  78,200원 (n=6)
clothing|bape_tee|hoodie|a_grade | mint median 345,000원 (n=5)
```

v3 잔존 매물 분포 (`mvp_listing_parsed`):
- clothing 전체 v3 잔존: **2,917건** (v7: 1,576건)
- BAPE tee v3: 72건 (v7: 243건)

Wave 252.B step 1 의 clothing v3 재매칭 (2,386건) 진행 중 (별도 task `bcvgt1ijx`).
재매칭 완료 후 자동 정상화 — 단 그 사이 사용자에게 잘못된 median 노출 중.

## 사용자 카드 3 화면 정책 (memory `ui_changes_apply_to_all_card_screens`)

이전 Wave 252.A 가 admin-pool-browser 만 박은 것 — 본 wave 가 모든 화면 정합 완성:

| 화면 | 컴포넌트 | 본 wave fix |
|---|---|---|
| pack-reveal-modal (사용자) | `pack-reveal-modal.tsx` | ✅ `marketBasisForCandidate` 에 `v7SiblingPresence` 가드 |
| user-reveal-dashboard (/me) | `user-reveal-dashboard.tsx` | ✅ 동일 |
| admin-pool-browser | `admin-pool-browser.tsx` | ✅ `resolveSkuMedianForDisplay` 에 `v7SiblingPresence` 가드 |
| freemium pool (/explore) | `pool/route.ts` 의 `bandAwareMedian` | ✅ `v7SiblingPresence` 가드 |

## fix

### 1) `src/lib/band-aware-median.ts` 확장

- 신규 `isClothingV3Key(key)` — v3 clothing key 패턴 감지 (3 tokens, `clothing|<sku>|<grade>`).
- 신규 `loadV7SiblingPresence(headers, keys)` — v3 key 들의 v7 sibling row 존재 batch lookup.
  - PostgREST `or=(comparable_key.like.<prefix1>*, ...)` 으로 prefix 매칭.
  - 응답에서 `clothing|<sku>|<product_type>|<grade>` (4 tokens) 만 sibling 으로 인정.
- 확장 `bandAwareMedianForListing(...)` — optional `v7SiblingPresence` parameter. v3 stale 시 null.
- 확장 `resolveSkuMedianForDisplay(...)` — v3 stale 시 raw sku_median 도 차단 (역시 mixed-pool 산정).

### 2) `src/lib/pack-open.ts`

- 신규 `fetchV7SiblingPresence(comparableKeys)` — 동일 정책, TTL 캐시 10분.
- `marketBasisForCandidate` 확장: optional `v7SiblingPresence` parameter.
  - v3 stale 시 `priceSource: "v3_pending_rematch"` + `medianPrice: null` 반환.
  - 기존 `currentNetProfitFromMarketPrice` 가 medianPrice=null 이면 차익 계산 skip → 사용자 잘못된 차익 노출 X.
- `RevealMarketBasis.priceSource` union 에 `"v3_pending_rematch"` 추가.
- `executePackOpen` 내부도 v7SiblingPresence batch fetch 추가.

### 3) 사용자 화면 4 라우트 wire

- `src/app/api/packs/me/route.ts` — /me 목록 batch fetch + 전달.
- `src/app/api/packs/reveals/detail/route.ts` — 단일 매물 fetch + 전달.
- `src/app/api/packs/pool/analysis/route.ts` — /explore 클릭 시 lazy-fill.
- `src/app/api/listings/[pid]/market-source/route.ts` — 시세 근거 페이지.

### 4) 운영자 + freemium pool 화면 2 라우트 wire

- `src/app/api/admin/pool-listings/route.ts` — `loadV7SiblingPresence` import + `resolveSkuMedianForDisplay` 전달.
- `src/app/api/packs/pool/route.ts` — `loadV7SiblingPresence` import + `bandAwareMedian` inline 가드 + `buildItems` 에 v3Stale 시 skuMedianFinal=0.

### 5) `src/components/market-history-chart.tsx`

- `priceSource` prop union 에 `"v3_pending_rematch"` 추가 (type 정합).

## 정책 가드 (사용자 메모리 준수)

- **비파괴 / additive only** — DB UPDATE/DELETE/DROP 없음. 새 컬럼/테이블 없음.
- **decision log** — 이 문서.
- **3 화면 정책** — pack-reveal-modal + user-reveal-dashboard (`/me`) + admin-pool-browser + freemium pool 모두 적용.
- **사용자 친화** — 잘못된 median 노출 차단. medianPrice=null → 기존 Wave 249 unavailable 가드 활용 (사용자에게 비교 불가능 표시).
- **test:core 회귀** — 19 fails == 19 pre-existing fails (UI snapshot tests in `me-page-contract.test.ts`). 본 wave 신규 fail X.
- **typecheck (`src/`)** — 0 errors.

## 자동 정상화

Wave 252.B step 1 (clothing v3 2,386건 재매칭) 완료 후:
- v3 매물의 `comparable_key` 가 v7 패턴 (4 tokens) 으로 update.
- 본 가드의 `isClothingV3PackOpenKey` 가 false 반환 → 정상 fetch.
- v7 sibling 가드 자동 무효화 → 정확한 median 노출.

캐시 (10분 TTL) 자동 만료 후 새 v7 매물 즉시 정상 median 노출.

## 잔존 한계

- shoe / bag 도 product_type 토큰 사용 (Wave 92) — 동일 v3-stale 문제 가능. 본 wave 는 clothing 만 가드.
  → 후속 wave (252.D?) — `isShoeV3Key` / `isBagV3Key` 추가.
- 새로 들어오는 매물의 catalog 매칭 단계에서 v3 → v7 자동 매칭은 별도 wave.

## 측정 (commit 후)

- `priceSource = "v3_pending_rematch"` 비율 (production /me 응답): 사용자 풀의 ~13% clothing 매물.
- Wave 252.B step 1 완료 후 비율 monitoring.

## refs

- 사용자 코멘트 id 201/202 — BAPE tee 4배 spread 원인.
- Wave 251.4 — 비교 매물 list product_type filter (display fix).
- Wave 252.A (5927deb) — admin-pool-browser 만 band-aware. 부분 fix.
- Wave 252.B step 1 — clothing v3 강제 rematch 2,386건 (별도 task `bcvgt1ijx`).
- Wave 249 — sku_median_unavailable 가드 (본 wave 의 medianPrice=null fallback 활용).
