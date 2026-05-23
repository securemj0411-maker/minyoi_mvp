# launch-84 — 상세페이지 중복/boilerplate MVP cleanup

## 사용자 지시

> "MVP 니까 ... 크레딧 없으면 어떤 상품을 사야되는지도 모르게 다 차단 → 이게 구매 포인트라서 상세페이지가 엄청나게 세세하지 않아도 된다. 지금 상세페이지 중복이 너무 많거나 어중간한 boilerplate 정보나 차라리 빼는게 낫겟다 ... 한번 해볼래? 내가 로컬에서 봐보고 아니다 싶으면 rollback"

launch-82~83 의 audit 후 발견한 중복/boilerplate 정리. **rollback 쉽도록 컴포넌트 정의는 두고 호출/사용처만 제거**.

## 추가 fix — launch-84b (사용자 follow-up)

> "수요공급도 없으면 시세 안나오는거처럼? 회전률? 너 일부로 없앤거 같은데 평점만 나오게 해야되는거 아님?"

launch-84 에서 "팔리는 속도" tile 표본 부족 시 hide 했지만 **"수요·공급" (activity) tile 은 "데이터 부족" 박스로 그대로 표시되던 불일치**. 사용자 정정.

- `activity.value === "데이터 부족"` 일 때 tile 자체 hide (일관성).
- 2 tiles 모두 hide 되면 거래 안전 (셀러 평점) 만 단독 표시.
- grid layout 동적 — `grid-cols-${cellCount}` (1/2/3) 자동 적응.

## 적용한 5개 fix

### 1. `WhyTrustCollapse` 4 Q&A 호출 제거
```diff
- <WhyTrustCollapse card={card} />
```
- 4개 Q 모두 다른 섹션과 중복:
  - 셀러 신뢰 Q → UpperFoldFearReducers 거래 안전 타일
  - 가품 Q → CounterfeitChecklistPanel (100%)
  - 안전결제 Q → PlatformProfitCompare 안심결제 chip
  - 사기 신고 Q → 의사결정 무관 (일반 FAQ)
- 컴포넌트 정의 (`function WhyTrustCollapse`) 는 두고 호출만 제거.

### 2. `UpperFoldFearReducers` 💡 hint box 제거
```diff
- <div className="...bg-emerald-50">💡 {hint}</div>
```
- "비슷한 상태의 매물끼리만 비교한 결과예요" → ComparableListingsPanel 헤더 ("X급 매물끼리만") 와 중복
- "셀러가 낮게 등록한 것 같아요" → Profit 카드 +N% chip 으로 이미 명시
- 관련 변수 (`median`, `buyerCost`, `isBelowMedian`, `hint`) 도 제거.

### 3. `UpperFoldFearReducers` "팔리는 속도" 타일 표본 부족 시 hide
```diff
- tiles = [activity, speed]  // 항상 2개
+ tiles = [activity]
+ if (speedTileAvailable) tiles.push(speed)  // 표본 충분 시만
```
- 신발/의류 풀 80%+ 가 `speed.isFallback = true` → "거래 기록 표본 부족" boilerplate 만 표시되던 문제 차단.
- 표본 부족 매물에서는 activity + 거래 안전 2 tiles + safety 만 표시 (3-cols 자동 적응).

### 4. `DetailMarketGraphSection` "최신 수집 기준" chip 제거
```diff
  <h3>시세 그래프 · 시장 분석</h3>
- <span>최신 수집 기준</span>
```
- Profit 카드 eyebrow "{age} · 비교 N개" 와 중복 메타. h3 만 깔끔하게 유지.

### 5. `RecommendationReasonPanel` 모달 내부 축소
```diff
  <featureCards />
  <MarketBasisMini />
  <좋은 점 / 확인할 점 chips />
- <details>계산 기준 보기 → 비교군/비용/marketBasisPlainSentence</details>
- <footer chips>비슷한 매물 N건 · 최근 거래 N건 · N시간 전</footer>
```
- "계산 기준 보기" details → CostAssurancePanel 과 100% 중복 (Profit 카드 "수익 계산 근거 보기" 버튼이 같은 곳으로 scroll)
- footer chip → Profit 카드 eyebrow 와 중복
- 좋은 점 / 확인할 점 / featureCards 만 keep — 모달 진입 가치 있음.
- 관련 변수 (`market`, `marketSample`, `soldSample`, `condition`) 정리.

## 영향

### Before (사용자 한 매물 클릭 시 본 섹션 수)
13개:
1. 매물명
2. 쉽게 보기
3. PurchaseDecisionHeader
4. Profit 카드
5. DetailMarketGraphSection
6. ComparableListingsPanel
7. WhyCheapPanel
8. UpperFoldFearReducers (💡 + 3 tiles)
9. CounterfeitChecklistPanel
10. CostAssurancePanel
11. **WhyTrustCollapse (4 Q&A)** ← 제거
12. PlatformProfitCompare
13. SellHelperPanel (매수 후만)
14. RecommendationReasonPanel (모달 내부 축소)

### After (12개)
- WhyTrustCollapse 통째로 사라짐.
- UpperFoldFearReducers 더 짧음 (💡 제거, 표본 부족 시 tile 1개 줄어듦).
- DetailMarketGraphSection 헤더 chip 1개 사라짐.
- RecommendationReasonPanel 모달 내부 절반 사라짐.

## Rollback 절차 (필요 시)

각 fix 가 inline edit 이라 git 으로 한 번에 revert 가능:
```bash
git diff src/components/pack-reveal-modal.tsx  # 변경 확인
git checkout src/components/pack-reveal-modal.tsx  # 전체 rollback
```

부분 rollback 시 launch-84 주석 (`// Wave launch-84`) grep 으로 해당 위치 찾아서 원복:
- `WhyTrustCollapse` 호출 → line ~5852 복원
- `UpperFoldFearReducers` 💡 hint + speed tile → line ~2890, 2900~ 복원
- `DetailMarketGraphSection` chip → line ~5800 복원
- `RecommendationReasonPanel` 모달 → line ~3096~3133 복원

## 검증

- [x] TS 컴파일 통과 — `pack-reveal-modal.tsx` 에러 0
- [x] launch-84 주석 4 곳 표시 — 사용자 rollback 시 grep 용이
- [ ] 로컬 dev 서버에서 매물 클릭 → 12 섹션 표시 + 흐름 자연스러움 확인 (사용자)

## 관련 파일

- [src/components/pack-reveal-modal.tsx](../../src/components/pack-reveal-modal.tsx) — 5 fix 다 박힘
- launch-82, launch-83 — 이 wave 의 audit 근거
- Wave 393.6 (`SellerTrustPanel 제거`) — 이전 dedup 시점. 이 wave 가 그 후속.

Owner: caulee1227@gmail.com / 2026-05-23
