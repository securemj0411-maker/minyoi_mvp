# 2026-05-16 코멘트 batch — #92 market-source UI sync fix + #93 cadence 가중 정밀화 보류

사용자 admin 코멘트 (mvp_reveal_feedback) 4건 처리. #92 fix, #93 보류, #95/#96 후속.

## #92 — market-source UI 비교군 제외 list 동기화 (fix)

- 시간: 2026-05-16
- 발견: pid 406610698 (아이패드 프로11 M5 단품 미개봉) 의 비교군 list 에 pid 407812568 (M5 + 애플펜슬프로 + 스마트폴리오 세트, accessory_bundle 마킹) 매물이 표시됨. 사용자: "세트는 sample 로 비교군에 넣으면 안된다니까??"
- 진단:
  - parser 가 accessory_bundle 잘 박음 (`condition_notes = ["accessory_bundle"]`).
  - 시세 sample 에서는 제외됨 (`tick-pipeline.ts:2482` `if (conditionNotes.includes("accessory_bundle")) continue`).
  - **but 비교군 UI 에서는 제외 안 됨** — `src/app/api/listings/[pid]/market-source/route.ts:139` 에서 2개만 제외 (`new_or_open_box`, `low_battery_health`).
  - tick-pipeline 의 8가지 제외 list 와 불일치. 옛 코드 잔여 (Wave 91 시점).
- 변경:
  - `src/app/api/listings/[pid]/market-source/route.ts:135-148`: `COMPARABLE_EXCLUDE_NOTES` 상수 신설. 8가지 다 박음 (`new_or_open_box`, `low_battery_health`, `applecare_premium`, `accessory_bundle`, `full_set`, `multi_device_bundle`, `display_defect`, `screen_replaced`, `faceid_issue`, `parts_only`).
  - 코멘트에 사용자 코멘트 #92 + tick-pipeline 동기화 명시.
- 검증: `npm run test:core` 139/139 pass.
- 위험: 비교군 list 매물 수 감소 (사용자가 보는 디버깅 화면). 단 정확성 향상 = LAUNCH_PLAN 12b 정합.

## #93 — 시세 cadence 가중 정밀화 (보류)

- 시간: 2026-05-16
- 발견: pid 406614375 (에어팟 4세대) 코멘트. 사용자: "팔리는 회전주기 cadence 맞춰서 가중더 해야될듯. 안팔린 일수만 말했는데 팔린 매물 일수도 좀 고려해서 계산"
- 현재 로직 (이미 박힌 것):
  - 시간 decay (Wave 131, market-math.ts:31): `exp(-ageDays/10)`. 옛 매물 weight ↓ (10일=1.1x, 30일=0.15x).
  - sold/active 가중 (tick-pipeline.ts:2614-2634):
    - sold ≥ 8 + active ≥ 5 → 0.7 sold + 0.3 active
    - sold ≥ 5 + active ≥ 1 → 0.6/0.4
    - sold ≥ 1 + active → 0.5/0.5
    - sold = 0 + active → active × 0.92 (네고율)
  - madTrim outlier 제거.
- 미박힌 것 (사용자 의견):
  1. **SKU 별 cadence 차등 decay** — 회전 빠른 SKU 는 decay 더 빠르게, 느린 SKU 는 천천히. 현재 모든 SKU half-life 10일 hardcoded.
  2. **sold 매물의 "팔리기까지 일수" 가중** — sold 매물의 lifespan (`last_seen_at - first_seen_at`) 기반 weight 차등. 빨리 팔린 매물 = 시세 신뢰 ↑.
- 보류 이유:
  - 시세 알고리즘 변경 = LAUNCH_PLAN 12b "정확성 절대 우선" 위험. 잘못 박으면 모든 SKU 시세 부정확.
  - 작은 fix (sold lifespan weight) 도 검증 없이 박으면 시세 swing.
  - 측정/A-B 검증 필요.
- 후속 조건:
  - 베타 데이터 1~2주 누적 후 (2026-05-30 이후) — 사용자 telegram 피드백 데이터 기반 A/B 측정.
  - 카테고리별 cadence (회전 일수 분포) 측정 → SKU 별 dynamic half-life 후보 결정.
  - sold lifespan weight 도 시뮬 (기존 시세 vs 새 시세 spread 측정).
- 다음: 보류. 사용자 명시 후 진행.

## #95 — 비교군 UI condition_class 분리 (fix)

- 시간: 2026-05-16
- 발견: pid 406094154 (에어팟맥스 "사용감 많음") 의 비교군에 mint 매물 표시. 사용자: "대놓고 사용감 많고 다소 있다 라고 했는데 민트급이랑 비교하고 있네".
- 진단:
  - Wave 130 (다른 세션, 2026-05-16) condition_class 5단계 분리 (mint/clean/normal/worn/low_batt/flawed) 박힘.
  - mvp_market_price_daily PK = (date, comparable_key, condition_class) 분리됨. 시세 계산 ✅.
  - **but 비교군 UI 는 condition_class 분리 안 됨** — `market-source/route.ts` 가 같은 comparable_key 매물 모두 표시.
  - **추가 발견**: 옛 v43 매물 (wave 130 전 reparse) 은 mvp_listing_parsed.condition_class = NULL → market-worker 가 "all" condition_class 박음 (1559 row stuck).
- 변경:
  - **옛 v43 매물 21,144건 reparse** — 새 코드로 cc 박힘. 분포: clean 6231 / flawed 4657 / mint 3704 / normal 3228 / worn 2701 / low_batt 315.
  - **market-worker 호출** — 새 daily aggregate row 가 cc 별 분리 (mint 76, normal 148, clean 124, worn 62, low_batt 9). 옛 "all" row 1559 자연 turnover (다음 daily aggregate 들이 덮어씀).
  - `src/app/api/listings/[pid]/market-source/route.ts:127`: parsedRes2 select 에 `condition_class` 추가.
  - `src/app/api/listings/[pid]/market-source/route.ts:148~163`: excludeByPid 에 condition_class filter 추가 — 본 매물 cc != null && 비교 매물 cc !== 본 매물 cc → exclude.
  - 단 본 매물 cc null (옛 매물) → 필터 안 함 (호환).
- 검증:
  - `npm run test:core` 139/139 pass.
  - DB 측정: 새 row 5 condition_class 분리 ✅. 197 SKU 중 78 SKU 가 2+ class 분리 (sample 충분 시).
- 위험: 비교군 매물 수 감소 (같은 condition class 매물만). sample 부족 SKU 는 비교군 적게 보임 = 정직.

## #96 — 비교군 UI sold 매물 표시 (fix)

- 시간: 2026-05-16
- 발견: pid 407759980 (에어팟프로2) 비교군 list 에 모두 "판매중" 매물만 표시. 사용자: "거래가 그래프 다 찍었는데 비교매물 표시는 active 만? sold_confirmed 매물 비교군에 텍스트로라도 표시해야".
- 진단:
  - market-source/route.ts 가 raw fetch 시 sale_status / listing_state 정보 가져옴 ✅.
  - UI (market-source-debug.tsx:380~) 가 saleStatus 표시 코드 있음 ✅.
  - **but `MAX_COMPARABLES = 30`** — listing_parsed 에서 35개 pid 만 fetch → active 매물이 차지 → sold 자리 부족.
- 변경:
  - `src/app/api/listings/[pid]/market-source/route.ts:16`: MAX_COMPARABLES 30 → **80**.
  - listing_parsed limit `MAX_COMPARABLES + 5` → `MAX_COMPARABLES + 20` (100). sold/disappeared 도 fetch.
- 검증: `npm run test:core` 139/139 pass.
- 위험: API 호출 부하 약간 증가 (raw fetch row 30 → 80). UI 카드 더 많아짐 = 사용자 정보 풍부.

## 운영 원칙 재확인

사용자 명시: "보류나 이런거 다 로그에 적어야 한다". 보류 결정도 decision log 박는 게 정책. 까먹지 말 것.

- 다음 액션 없는 단순 보류도 박는다 (이유 + 후속 조건 명시).
- 다음 turn 또는 다음 세션이 같은 결정 다시 안 함.
