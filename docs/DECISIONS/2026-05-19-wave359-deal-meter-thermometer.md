# 2026-05-19 Wave 359 — 득템 미터 (당근 Manner Meter 영감 체온식 종합 점수)

사용자 영감: 당근마켓 상세 페이지의 "36.8°C Manner Meter" — 셀러 신뢰지수를 체온으로 비유 + 밑줄 클릭 가능 라벨 + 클릭 시 설명 모달.

요청:
1. 매물 제목 전에 큰 metric 박기 (체온식)
2. 누가봐도 클릭 가능해 보이는 라벨
3. "근거 보기" 클릭 → 안전결제 등 정보 모달
4. 사이트 톤 + 위계 + 가시성

## 결정

### "득템 미터" — °C 종합 점수
미뇨이 핵심 = 차익. 그래서 차익 중심 종합 °C:

**계산식** (기준 36.5°C, 범위 35.0 ~ 39.5):
```
+ profitPct × 0.1 (cap 3.0) // 차익률 가장 강한 가중치
+ confidence >= 0.8 ? 0.4 : (>= 0.6 ? 0.2 : 0)
+ seller (4.8+ & 30+ 리뷰) ? 0.3 : (4.5+ ? 0.1 : 0)
+ sampleCount (시세 표본) ? 0.2/0.1 : 0
```

**라벨 + 색상** 위계:
| °C | 라벨 | 색 |
|---|---|---|
| 39.0+ | 핫 | rose |
| 38.0+ | 강추 | orange |
| 37.0+ | 좋음 | emerald |
| < 37.0 | 보통 | zinc |

### 디자인 (사이트 톤)
- 컨테이너: `rounded-2xl border border-[#e1dacd] bg-gradient-to-br from-[#fffdf9] to-[#f9f3e8]` (cream 시리즈)
- 큰 °C 숫자: text-4xl bold tabular-nums + 색은 라벨 톤
- 우측: thermometer SVG (h-8 w-8, 라벨 톤 색)
- 라벨 칩: 작은 rounded-full (rose/orange/emerald/zinc 한 톤)
- 클릭 라벨: "**득템 미터 — 근거 보기**" + ▾ 아이콘, underline-offset-2, hover 시 진해짐

### 클릭 → 인라인 expand (모달 안 모달 X)
4개 근거 번호 매김:
1. 차익: `예상 차익 +X원 (+X%)` + `매입가 X원 · 시세 X원`
2. 신뢰도: `AI 분석 신뢰도 X%` + `같은 매물 X건 비교 분석`
3. 셀러: `평점 X.X점 · 후기 X건` + 평가 코멘트
4. 안전결제: `번개장터 안전결제 — 셀러 의무 부담 (3.5%)` + `구매자(나)는 0원`

각 줄: 컬러 원형 번호 (emerald/sky/amber/rose) + 굵은 핵심 + 보조 회색 한 줄.

### 배치
`RevealCardItem` 안, **매물 제목 (`{card.name}`) 바로 위**.

## 변경 파일

`src/components/pack-reveal-modal.tsx`:
- `DealTemperature` type + `calculateDealTemperature(card)` helper (line ~203)
- `DealMeter({ card })` 컴포넌트 (line ~880, `RevealProductImage` 위)
- `RevealCardItem` 안 `<DealMeter card={card} />` 박음 (`{card.name}` 위)

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 메모 — 메트릭 신뢰성

`calculateDealTemperature`는 heuristic. 실제 ML training 안 함.
- 차익률 ↑ 매물이 °C ↑ 되도록 — 같은 매물에 일관성 있음
- 사용자 입장: 39°C 매물 보면 "와 핫!" 직관 작동
- 신뢰: 근거 펼침에서 raw 숫자도 보여줘서 over-claim 방지

가중치 튜닝은 향후 user 행동 데이터 (클릭률, 구매율) 보고 조정.
