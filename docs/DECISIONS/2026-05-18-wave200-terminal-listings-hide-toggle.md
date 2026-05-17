# Wave 200 — terminal 매물 (sold/disappeared) 기본 hide + 표시 강조

## 사용자 보고

> "/me에서 보여줄때 삭제된상품인지 팔린상품인지 검증 안하냐?? 왜 삭제된 상품을 버젓히 보여주는거임?"
> "내가 말했지 삭제나 판매나 숨겨짐이면 표시하라고"

이전 Wave 에서 `listing_state` chip ("판매완료"/"매물 사라짐") 박혀있었지만 카드 자체는 list 에 그대로 표시 → 사용자 혼동.

## 박은 것

### `user-reveal-dashboard.tsx`

#### 1. 새 state `hideTerminal` (기본 true)
```ts
const [hideTerminal, setHideTerminal] = useState(true);
```

#### 2. terminal 매물 hide 필터
```ts
items.filter((item) => {
  if (!hideTerminal) return true;
  const tone = listingStateLabel(item.listingState).tone;
  return !(tone === "sold" || tone === "gone");
})
```

#### 3. terminal 카운트 banner + toggle
list 상단에 banner — terminal 매물 있을 때만 표시:
```
⚠️ 판매완료/사라진 매물 N건 발견 — 시세/차익 정보가 stale.   [보기 (N)] [숨기기]
```

`[보기]` 클릭 시 amber 버튼 — terminal 매물도 표시 (toggle).

#### 4. terminal 카드 표시 시 강조 (toggle 풀었을 때)

**이미 박혀있던 dim** + 추가:
- **매입 / 시세 strike-through** (line-through + zinc-400):
  - 정보가 stale 임을 시각적으로 명시
- **차익 chip strike-through + 회색**:
  - 매물 사라짐 / 판매완료 → 차익 무의미
- **+N% chip strike-through + 회색**

### 효과

- 기본: 살아있는 매물만 표시 (사용자 mental model 정상)
- toggle: terminal 매물 표시 시 strike-through + dim 으로 "이거 stale 정보" 명확
- 사용자 "왜 버젓이 보여주냐" 불만 해소

## 비파괴 검토

- 데이터 변경 0 (UI 필터 + 시각화만)
- API / DB 영향 0
- chip 우선순위 / verdict 표시 그대로

## Test

`npm run test:core`: **438/438 pass**.

## 추가 보고 — 시세 출처 검증 (사용자 의문)

> "애플워치 SE3 40mm 미개봉 새제품 ... 시세 300,000원 ... 이거 다나와시세 맞음? 미개봉/새상품이면 다나와시세인데"

확인 결과:

### `mvp_reference_prices` 에 박힌 anchor
```
applewatch|applewatch_se3|40mm|gps  →  effective_price: 369,000원
applewatch|applewatch_se3|44mm|gps  →  effective_price: 409,000원
```

### `mvp_market_price_daily` 에 박힌 시세 (오늘 unopened)
```
blended_median: 300,000원
active_median:  300,000원
sold_median:    300,000원
sample:         sold 12 + active 16
confidence:     medium
```

→ **매물 카드의 시세 300,000원 = 번개 sold/active median** (다나와 anchor 369,000원 사용 X).

### 라벨 vs 데이터 mismatch
- 매물 카드의 시세 출처 라벨: "📍 다나와 새 가격 기준 (이 매물 미개봉)"
- 실제 데이터: 번개 sold/active median (300,000원)
- 다나와 reference (369,000원) 박혀있지만 시세 산출에 **사용 안 됨**

→ Wave 130 박을 때 condition 별 시세 박았지만, **mvp_reference_prices anchor 활용 흐름이 박혀있지 않거나 깨져있음**. 별도 wave 필요.

이번 wave에서는 fix 안 박음 — 시세 산출 로직 (`pack-open.ts` 의 `loadMarketBasis`) 큰 변경 필요. 사용자 confirm 받고 별도 진행.

## Linked

- `2026-05-17-user-reveal-price-display.md`
- `2026-05-17-dashboard-1page-unification.md`
- Wave 130 (condition 별 시세 분리)
