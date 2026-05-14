# Wave 93 — 오염도 audit → 3 narrow lane ready 승격

> Status: **applied (code).** parser 통과 매물의 실제 오염도 측정 2회 iteration → ready_promote 후보 3개 확정 → LANE_READINESS 등록. shoe/bag/bike 카테고리는 internal_only 유지.

CLAUDE.md 6 필드 포맷.

## 0.1 오염도 측정 원칙 정정

- 시간: 2026-05-15 07:30 KST
- 발견: owner 지적 — "parser pass = ready 아님". parser 통과한 매물 자체를 검사해서 진짜 SKU인지/가품/부품/사고차/도난 의심인지 확인 후 ready 결정해야. 이전 분석은 fetched 전체에 대한 오염이었고, 진짜 봐야 할 것은 **parser 통과 매물의 오염도**.
- 변경: `scripts/wave92-pollution-audit-on-parser-passed.ts` 신규.
  - 각 SKU primary query × page 0~1 → ruleMatch + parser → 통과 매물만 추출.
  - 가격 분포 (p25/median/p75) 측정 + outlier (median × 0.3 미만 / × 3 이상).
  - 정규식 패턴 매칭: fake_anxiety (정품/감정 anxiety) / parts_only / damage / bike_stolen / too_cheap.
  - SKU별 pollution_pct = (outlier ∪ suspicious) / parser_passed.
  - Verdict: ready_promote (≤5% + n≥10) / high_pollution (>15%) / low_volume (n<5) / needs_more_data.
- 검증: 1차 audit (catalog v1 + parser w92) 결과:
  - 자전거 7 high_pollution / 0 ready (specialized-allez 37.6%, marlin-5 60%, scultura 24.4% 등 — "알레"/"마린"이 옷/시계/피규어 매칭)
  - 신발 2 ready / 1 high_pollution
  - 가방 1 ready / 3 high_pollution
- 위험: 없음 (측정만).
- 다음: 발견된 오염 원인별 catalog 강화 iteration.

## 0.2 Catalog iteration (오염 원인 → 강화 → 재측정)

- 시간: 2026-05-15 08:00 KST
- 발견: pollution 원인 분류:
  1. **자전거**: 모델명만 mustContain → "마린/알레/스컬트라" 같은 단어가 옷/시계/피규어/낚시에 자주 등장 → cross-category 오염
  2. **자전거**: 부품/대차 매물 ("핸들바", "프레임셋", "도색만") 잘못 매칭
  3. **자전거**: 전기자전거 (e-BIG.NINE 등) 가격 대역 다름 → 시세 분산
  4. **가방**: 가품 anxiety 표현 ("감정 가능", "정가품 문의") 매물에 가품 다수
  5. **가방**: 액세서리 단품 ("넥타이핀 빈티지", "키링만") 매칭
- 변경: iteration 2회 (Python 자동 patch):
  - **bike**: mustContain에 카테고리 토큰 OR group 추가 (68개 token: 자전거/bike/road/mtb/사이클/시마노/sram/콤프/comp/카본/27인치 등). 부품 noise 강화 (핸들바/대차/튜닝용/휠만/타이어만). **전기자전거 reject** (e-bike/ebike/이바이크/전동).
  - **bag**: 가품 anxiety 강화 (감정 가능/감정 문의/정가품 문의/ST급/레플리카/복각). 액세서리 reject (넥타이핀/키링만/스트랩 단품/외관 부분만).
  - `src/lib/generated/catalog-{bike,bag}-wave91.ts` 재생성.
- 검증: pollution audit 재실행:
  - **자전거 high_pollution 7 → 1** (merida-scultura만 남음, 부품 매물 일부)
  - 자전거 ready 0 → 2 (Trek Emonda SL5 / Merida Big Nine)
  - 가방 ready 1 유지, high 3 → 2
  - 신발 ready 2 → 3 (Converse Chuck70 CdG 추가)
  - **총 ready_promote 3 → 6** ✅
- 위험: 카테고리 토큰 너무 broad하면 false negative. 단 OR group이라 ruleMatch precision 영향 작음.
- 다음: 남은 high_pollution (bag-mcm/bottega, bike-scultura, shoe-asics-gel-1130)은 결정론 한계 — 시세 outlier filter (market-math 차원) 또는 AI L2 영역으로 분리.

## 0.3 사업적 분석 → ready 승격 3개만 (보수적)

- 시간: 2026-05-15 08:30 KST
- 발견: 6개 ready_promote 후보 중 사업 안전성 분석:
  - **즉시 안전 (결정론 충분)**: 살로몬 XT-6 / Trek Emonda SL5 / Merida Big Nine
  - **조건부**: 아디다스 가젤 (색상 변형 미분리), 컨버스 척70 CdG (표본 부족 + 가품 risk)
  - **보류**: LV 지피월릿 (가품 위험 ↑↑↑, AI L2 필수 영역 — description 풍부해서 datecode/시리얼 분석 가능하지만 결정론 단독으론 사용자 보호 부족)
- 변경:
  - `src/lib/generated/catalog-shoe-wave91.ts`: shoe-salomon-xt-6-black `laneKey: "shoe_salomon_xt6_black"` (기존 generic → unique)
  - `src/lib/generated/catalog-bike-wave91.ts`: emonda-sl5 `laneKey: "bike_trek_emonda_sl5"`, bignine `laneKey: "bike_merida_bignine"` (기존 generic → unique)
  - `src/lib/category-readiness.ts` `LANE_READINESS` 3개 ready 등록:
    - `shoe_salomon_xt6_black`
    - `bike_trek_emonda_sl5`
    - `bike_merida_bignine`
  - shoe/bag/bike 카테고리는 **internal_only 유지** (broad coverage 부족). 단 위 3 narrow lane은 LANE_READINESS override로 사용자 노출.
  - `docs/USER_GUIDES/bike-purchase-checklist.md` 신규 — 프레임 사이즈/사고 이력/도난 확인/주행거리 가이드.
- 검증:
  - typecheck clean, test 139/139 pass
  - Lane 3개 모두 결정론 0~2.6% pollution, 표본 n=15~39.
- 위험:
  - 자전거 UI에서 "프레임 사이즈" + "사고 여부" 가이드 노출 필수. 안 박으면 사용자 잘못된 사이즈 자전거 구매 위험. → bike-purchase-checklist.md 박음.
  - 가품 가방 (LV 지피월릿)은 internal_only 유지 — 향후 AI L2 enable 후 ready 검토.
- 다음:
  - Vercel 자동 배포 → 다음 tick부터 3 lane 사용자 풀 진입 시작.
  - 1주 후 실제 사용자 클릭/피드백 + raw 누적 측정.
  - 추가 lane (가젤 / 척70 / LV 지피월릿) wave94 검토.

## 1. Ready 승격 SKU 사업적 평가

| SKU | 표본 | 오염도 | 시세 (median) | 차익 가능성 | 일반인 친화 | UI 가이드 필요 |
|---|---:|---:|---:|---|---|---|
| Salomon XT-6 Black | 31 | 0% | ₩156k | 중 | ⭐⭐ | 사이즈 |
| Trek Emonda SL5 | 39 | 2.6% | ₩1.71M | **↑↑** | ⭐⭐ | 프레임/사고 |
| Merida Big Nine | 15 | 0% | ₩750k | **↑↑↑** | ⭐⭐⭐ | 프레임/사고 |

→ 자전거 2개 + 신발 1개 = 일반인 친화 ↑ 진입.

## 2. 결정론 한계 명시 (AI L2 영역)

| SKU | 한계 원인 | AI L2 가치 |
|---|---|---|
| LV 지피월릿 | 가품 위험 (모노그램 코드/datecode 분석 필요) | **높음** — description 풍부 |
| bag-mcm-visetos | 일반/한정판 시세 분산 (스와로브스키 한정 ₩900k vs 빈티지 ₩50k) | 중 |
| bag-bottega-cassette | 표본 n=5 부족 | 시간 — 자연 누적 |
| bike-scultura | 가격 outlier (₩6,066 셀러 의도) | 시세 outlier filter (market-math) |
| shoe-asics-gel-1130 | 한정판 색 + 사이즈 시세 분산 | 결정론 한계 — sub-axis 더 추가하면 catalog 폭주 |

→ wave 94 후보: 시세 outlier filter (시스템 차원) + AI L2 enable phase 1b (LAUNCH_PLAN §4.5).

## 3. 거론 금지

- 닌텐도 Switch OLED — owner 명시 보류.
- 카메라 ready 재검토 — Wave 87 자연 대기.
- shoe/bag/bike 카테고리 자체 ready 승격 — 표본 부족 / AI L2 미적용 / 가품 risk로 보류.
