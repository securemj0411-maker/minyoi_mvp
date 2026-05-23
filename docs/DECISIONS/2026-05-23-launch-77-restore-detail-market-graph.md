# launch-77 — 상세페이지 시세 그래프 복원 (Wave 510 revert)

## 사용자 정정
> "근데 우리 기존에는 그래프도 상세페이지에서 보여줬는데 지금은 어디간거임???"

## 배경
- **Wave 510 (5/21)** — `Hide detail market graph for MVP` 커밋(`7b650c5`)에서 상세 숫자 모드의
  `시세 그래프 · 시장 분석` 블록(`MarketHistoryChart` + `MarketGraphTrustLine` + `SkuListingFlowMini`)을 제거.
- 당시 이유: "MVP 신뢰도 우려 / SKU별 데이터 준비도가 충분히 맞아야 한다 / 설명 책임 큼."
- 보류 사항으로 "SKU/카테고리별 그래프 준비도 기준 정한 뒤 재노출 결정" 적어둠.

## 재결정
- **쉬운모드 `trend` step에서는 이미 같은 `MarketHistoryChart`를 표시 중** (line 4755).
  → 쉬운모드엔 그래프, 상세엔 그래프 X 인 게 **위계 불일치**.
- `MarketHistoryChart` 자체에 **표본 부족 가드** 존재
  (`src/components/market-history-chart.tsx` line 191:
  `"표본 부족 (가격 데이터 없음)"` blob → return null/메시지 cell).
  → 데이터 부족 SKU에는 자동으로 그래프 안 뜸 → Wave 510 우려 자체 해소.
- 외부인 #5/#7 강조(미모리) — 평가/판단 중심 정보가 윗단, raw 매물 수는 sub. 그래프는 평가 보조.

## 구현
`src/components/pack-reveal-modal.tsx` line 5651–5677:
- `</div>` (수익 계산 근거 보기 버튼 닫는 div) 와 `<ComparableListingsPanel>` 사이에 복원.
- Wave 510 diff와 동일한 markup (h3 "시세 그래프 · 시장 분석" + "최신 수집 기준" 칩 + 그래프 + trust line + mini flow).

## 영향
- 상세 모드(detailed) — 시세 그래프 + 신뢰선 + 30일 분포 다시 표시.
- 데이터 없는 SKU — MarketHistoryChart 가드가 "표본 부족 (가격 데이터 없음)" 메시지 cell 띄움 → 시각 신뢰 깨지 X.
- 쉬운모드(beginner guide) — 변동 없음 (이미 같은 그래프 사용 중이었음).

## 검증
1. 데이터 충분한 SKU 클릭 → 상세 그래프 + 회전 분포 표시 ✓
2. 표본 0개 SKU 클릭 → "표본 부족" 메시지 + 다른 panel 정상 ✓
3. 쉬운모드 → trend step에 그래프 그대로 ✓

Owner: caulee1227@gmail.com / 2026-05-23
