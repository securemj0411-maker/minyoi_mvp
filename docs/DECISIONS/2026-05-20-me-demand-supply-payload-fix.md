# 2026-05-20 — /me 수요·공급 measurements 측정 누락 P0 fix

## 결정

velocity P0 fix(2026-05-19) 와 같은 패턴 깊이 감사를 수요·공급 측정에 적용.
결과: **cron은 정상, 데이터는 풍부. 다만 `/api/packs/me`가 payload를 하드코딩 `null`로 박아 보내 사용자가 "데이터 부족" 영구 출력**.

## 발견 (Audit)

### 데이터 자체는 풍부
- `mvp_market_price_daily`: 11,134 row · 5,030 keys · last_computed 2026-05-19 15:22 UTC ✅
- `mvp_raw_listings`: 최근 24h 26,569건 · 분 단위 수집 중 ✅
- 같은 카드도 reveal/pool 라우트에선 정상 표시

### 진짜 문제 — `/api/packs/me/route.ts:677-678` 하드코딩
```ts
velocityBasis: null,      // ← 사용자가 list 모달에서 무조건 null 받음
skuListingFlow: null,
```

비교:
- [`/api/packs/reveals/detail`](../../src/app/api/packs/reveals/detail/route.ts) → velocityBasis ✅ skuListingFlow ✅
- [`/api/packs/pool/analysis`](../../src/app/api/packs/pool/analysis/route.ts) → 둘 다 ✅
- **`/api/packs/me`** → ❌ 둘 다 null

[Wave 216 결정](2026-05-18-wave216-me-page-mobile-overhaul.md) "목록은 가볍게 유지, reveal/detail에서 lazy-load" 의도였으나 — 실제로 사용자가 `/me` 매물 클릭 시 모달이 `/me` payload 직접 사용하고 reveal/detail 별도 호출 안 함 → demand·supply 영구 미표시.

### 추가 발견 P0 — sample-floor 부재
[pack-reveal-modal.tsx:1145](../../src/components/pack-reveal-modal.tsx#L1145) `marketActivityDisplay`:
```ts
const demandRatio = active > 0 && soldRecent > 0 ? soldRecent / active : null;
```
N=1, N=2 표본도 ratio 계산 → "수요 활발/약함" 단정. velocity P0-1에서 게이트화한 정직성 원칙 미적용.

## 변경 (What)

### 1. `/api/packs/me/route.ts`
- **Import 추가**: `fetchLatestMarketVelocity`, `velocityBasisForCandidate`, `loadCategoryReadinessMap`
- **신규 helper**: `loadSkuListingFlowBatch(skuIds)` — sku_id 단위 7일 listing 유입 batch fetch. reveal/detail의 단일 헬퍼를 N+1 회피 batch 버전으로 확장
  - PostgREST `in.()` 한 번 호출 + JS 집계
  - 50,000 row limit (충분)
- **`Promise.all` 확장** (line 605~616): marketStats + referencePrices 옆에 velocityStats + readinessMap + skuFlowByIdMap 추가
- **L677-678 채움**: `velocityBasis = velocityBasisForCandidate(...)` + `skuListingFlow = skuFlowByIdMap.get(skuId)`

### 2. `pack-reveal-modal.tsx:1140-1156`
- **Sample-floor 게이트**: `demandSampleSize = active + soldRecent`. `< 5`이면 `demandRatio = null` → "수요 활발/약함" 단정 X
- **Sub 카피**: 표본 부족 시 `표본 N건 — 누적 중` 명시 → 사용자가 "왜 데이터 부족인지" 즉시 인지

## 안전성
- batch fetch는 `/me` 목록당 1번 추가 round-trip (sku_id dedupe). 평균 페이지 20개라 trivial
- skuListingFlow PostgREST `in.()` query string 길이 = sku_id 약 20개 × 평균 10자 = 200자. 한도(8KB) 한참 안 됨
- velocity는 이미 `fetchLatestMarketVelocity`가 캐시(TTL) 보유 — 같은 key 재호출 시 캐시 hit
- sample-floor 5는 휴리스틱 — A/B test 후 7~10 조정 검토

## Velocity 케이스와 차이

| | velocity (어제) | demand·supply (오늘) |
|---|---|---|
| 근본 원인 | cron 8일 미실행 | API payload 하드코딩 null |
| 데이터 | 119 row stale | **11k row + 5k keys 정상** |
| 사용자 영향 | 거짓 "약 2일" 표시 | "데이터 부족" 정직 but false negative |
| 거짓말 정도 | 새빨간 거짓 | 정직 but 측정 누락 |

## 후속 (P1)

1. **supplyAvg=0 분기** — count24h > 0인데 7일 평균 0이면 "오늘 매물 N건 (드문 SKU)" 같이 표시. 현재는 null로 떨어져 표시 X
2. **condition_class 분리 demand** — marketBasis는 condition별 fetch하지만 demand는 active/sold 합산만. velocity P1-E와 같이 condition 분리
3. **cron-watchdog UI 게이트** — market-worker stale (computed_at > 24h) 시 sub에 "시세 업데이트 지연 중" 표시
4. **unit test snapshot** — `marketActivityDisplay` 7~8 케이스 (null/저표본/정상/공급공급공/수요활발 등)

## 관련

- Audit 보고서: 본 세션 agent (af66df971a21c3316)
- Velocity P0 fix: docs/DECISIONS/2026-05-19-velocity-p0-fix.md
- Wave 216 (lazy-load 의도): docs/DECISIONS/2026-05-18-wave216-me-page-mobile-overhaul.md (확정 안 됐을 수도 — 추측)
- 메모리: "수익 보장 X / 정보 제공만 명시" — demand 카피도 같은 정직성 원칙
