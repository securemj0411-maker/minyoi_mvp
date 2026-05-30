# Wave 803d — 상세보기 모달 위치 안 나옴 fix

## 사용자 보고

> "아니 상세페이지에는 왜 위치가 안나오는거임??"

## 진단

### 데이터 박혀있음
- `pack-open.ts:2235` 박은 코드:
  ```typescript
  directTradeLocation: marketplaceLocationCombinedWithRegion(
    rawMeta.raw_json,
    rawMeta.description_preview,
    rawMeta.daangn_region_name,
  ),
  ```
- `RevealCard.savedDetail.directTradeLocation` 박혀있음 (당근 region + 직거래 위치 통합)

### UI 활용 0 hits
- `pack-reveal-modal.tsx` 에서 `directTradeLocation` grep → **0 hits**
- "거래 가능 지역 확인 필요" placeholder (marketplace-safety.ts:406) 만 박힘 → 사용자 본 화면

→ **정보 박혀있는데 UI 박지 않은 채 placeholder 만 노출** (사용자 frustration)

## Fix

```tsx
const directTradeLocationLabel = isDaangn ? (card.savedDetail?.directTradeLocation ?? null) : null;
const purchaseRows = [
  { label: "상품가", value: krw(card.price), note: "현재 매입 기준" },
  ...(directTradeLocationLabel
    ? [{ label: "거래 가능 지역", value: directTradeLocationLabel, note: "당근 동네 인증 기준" }]
    : []),
  {
    label: "내가 낼 배송비",
    value: snapshot.shippingValueLabel,
    note: directTradeLocationLabel ? `${directTradeLocationLabel} 직거래` : snapshot.shippingNote,
  },
  { label: "결제 수수료", value: "0원", note: ... },
];
```

## 효과

| 매물 | Before | After |
|---|---|---|
| 당근 매물 + region 박힘 | "거래 가능 지역 확인 필요" placeholder | **별도 row "거래 가능 지역: 사당동" + 배송비 note 도 region** ✓ |
| 당근 매물 + region null | "거래 가능 지역 확인 필요" | "거래 가능 지역 확인 필요" (변화 X) |
| 번개/중나 매물 | 변화 X | 변화 X |

## 비파괴

- `bunjang/joongna` 매물 (!isDaangn) → 변화 X
- 당근 매물 + `directTradeLocation` null → 기존 placeholder 박힘
- 다른 row (상품가, 결제 수수료, 재판매 수수료, 안전버퍼 등) 변경 X
- 데이터 fetch / parse / DB schema 변경 X — 박혀있는 데이터 UI 박는 fix 만

## Trade-off

- ✅ 거의 없음
- ⚠️ UI 1 row 추가 → 모달 약간 길어짐 (당근 매물만)
- ✅ 사용자 mental model 일치 (카드 거리 + 모달 정확 동네)

## 향후 audit 필요

- 다른 곳도 `directTradeLocation` / region 정보 미박힘 검토 (admin-pool-browser, user-reveal-dashboard)
- "거래 가능 지역 확인 필요" placeholder 박힌 곳 다 박혔는지 확인

## 검증

배포 후 당근 매물 상세보기:
1. "거래 가능 지역" row 박힘 (label + region 동네 이름)
2. "내가 낼 배송비" note 가 "{동네} 직거래" 박힘
3. 카드 화면 `daangnDistanceLabel` (거리) + 모달 동네 (정확 지역) 다 보임
4. 번개/중나 매물 → 변화 X

## 복원 가이드

문제 발생 시 한 줄 revert:
```diff
- const directTradeLocationLabel = isDaangn ? (card.savedDetail?.directTradeLocation ?? null) : null;
+ const directTradeLocationLabel = null;
```

또는 row 자체 제거:
```diff
- ...(directTradeLocationLabel
-   ? [{ label: "거래 가능 지역", value: directTradeLocationLabel, note: "당근 동네 인증 기준" }]
-   : []),
```

## What Not To Do

- bunjang/joongna 에도 박지 X — `marketplaceLocationCombinedWithRegion` 의 region 박는 게 daangn 만 (다른 source 는 raw_json 기반 박혀서 정확도 낮음)
- region 박혀있지 않을 때 placeholder 제거 X — "거래 가능 지역 확인 필요" 가 사용자 안내 박힘 (당근이라도 region null 박힌 매물 대상)
- 별도 위치 박지 않고 배송비 note 만 박지 X — note 글자 작아서 사용자 못 보고 frustrate

## 관련 commits / PRs

- PR #49 — Wave 803d 상세보기 모달 위치 표시

## Related Waves

- Wave 758 — RevealCard.savedDetail 에 daangn 정보 박음 (당시 directTradeLocation 박았으나 UI 박지 X)
- Wave 797 — distanceKm 저장 (정렬용)
- Wave 803b — '당근만' filter 매물 누락 fix
- Wave 803c — per-source 시세 fallback fix
- **Wave 803d (now)** — 상세보기 모달 위치 표시 박음
