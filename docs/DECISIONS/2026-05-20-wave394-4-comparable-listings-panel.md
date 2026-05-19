# Wave 394.4 — Sample 시세 매물 노출 (외부 review #3, USP 정면)

날짜: 2026-05-20
영역: pack-reveal-modal (매물 상세 모달) + /api/market/comparable-listings (신규 endpoint)

## 배경

외부 사업 검토 리뷰 #3 + 사용자 본인 강조:
> "8개 매물 비교 테이블 (근데 우리 sample로 쓰는거 공개하면서 가시적으로 뭐랑 비교하는지 보이면? 현재 /me 운영자풀처럼 시세근거 sample제품 직접 볼수있으면? 진짜 좋을듯??"

미뇨이 USP = band-aware (같은 모델 / 같은 상태 매물끼리만 비교). 그런데 매물 모달이 시세 그래프 + count 만 보여주고 어떤 매물로 비교했는지 노출 안 함. 사용자가 "이 시세 진짜 신뢰 가나" 의심 해소 못 함. Wave 394.4 = USP 정면 강화.

## 변경

### 1. 신규 backend endpoint

**`/api/market/comparable-listings/route.ts`** (신규)

- query: `ck` (필수), `cc` (옵션), `strict=1` (옵션), `limit` (default 8, max 16), `excludePid` (옵션 — 현재 매물 제외)
- response: `{ comparableKey, conditionClass, strictCondition, listings: ComparableListing[] }`
- 패턴: `/api/market/history` 와 동일 (auth 없음, rate-limit 30 req/60s, conditionFallbackChain)
- source: `mvp_listings` WHERE `comparable_key = ck` AND `sale_status IN (ready, reserved, sold)` AND `price > 0`
- ordering: `price.asc`, overfetch ×3 후 fallback chain JS 적용
- listing 항목: pid, name, url, thumbnailUrl, price, conditionClass, saleStatus, lastSeenAt, soldAt

### 2. 신규 frontend component

**`ComparableListingsPanel`** (pack-reveal-modal.tsx 안)

위치: 시세 그래프 카드 안, `SkuListingFlowMini` 다음 (시세 그래프 + 비교 매물 = 한 묶음 = "시세 근거" 단위)

UI:
- 헤더 "🔍 이 시세 비교 매물" + ccLabel chip ("미개봉/S급/A급/사용감 있는/하자 있는/비슷한 상태")
- 매물 6개 (limit 6) — 썸네일 (40×40) + 가격 + 판매상태 chip (판매중/예약중/판매완료) + 모델명 line-clamp-1
- 가격 차이: +X% (emerald, 현재 매물이 더 쌈) / −X% (rose, 더 비쌈) / 비슷 (회색, ±2% 이내)
- Footer: 색상 legend + ccLabel 안내 ("다른 상태는 별도 시세")

상태:
- loading / error / empty / 정상 4단계
- empty 시 카피 "${ccLabel} 비교 매물 누적 중 — 데이터 쌓이면 자동 표시"

자동 fetch (모달 open 시). lazy X — 모달 안 디폴트 노출이 사용자 의도 (안 펼치고도 시세 근거 직접 보임).

### 3. 위치 — 시세 그래프 카드 안

```
시세 그래프 카드 (우측)
├── 시세 그래프 · 시장 분석 헤더 (+ "최신 수집 기준" chip)
├── MarketHistoryChart (30일 추이)
├── MarketGraphTrustLine (신뢰도 1줄)
├── SkuListingFlowMini (회전/유입)
└── 🆕 ComparableListingsPanel (이 시세 산출 sample 6개)
```

## 영향

- 모든 매물 reveal 모달 — 시세 신뢰도 큰 boost
- band-aware USP 정면 (사용자가 시세 산출 sample 직접 확인 가능)
- 모바일/데스크탑 모두 시세 그래프 카드 안 자동 표시
- comparable-listings endpoint 는 admin-pool-browser / user-reveal-dashboard 에서도 재사용 가능 (후속)

## 미적용 영역

- 클릭 시 외부 link 이동 X — 사용자 모달 이탈 차단. 비교 정보만 표시.
- admin-pool-browser / user-reveal-dashboard 적용 X — 후속 wave 결정 (메모리 룰 `ui_changes_apply_to_all_card_screens` 충족 위해 별 wave 박을 가치 있음. 우선순위는 사용자 결정)

## 후속 (별 wave)

- **Wave 394.4.b**: admin-pool-browser + user-reveal-dashboard 에도 ComparableListingsPanel 적용 (3화면 일관성)
- **Wave 394.4.c**: 클릭 시 modal 안 sub-modal 또는 카드 expanded 상세 (현재 외부 link X로 끝)
- **Wave 394.5**: #23 초보/상세 모드 토글
- **Wave 394.B**: 옵션 1 fashion conditionFromText 점진 rollout

## 원칙

- 일반인 친화 단일 톤 (memory 룰 `project_core_principle_consumer_friendly`)
- USP 정면 (band-aware 시세 비교) — 카피 + UI 모두 강조
- 디폴트 노출 (펼침 토글 X — 일반인은 토글 누르기 부담)
