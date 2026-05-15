# Wave 124 — mass reparse v42 runtime execution

> 코드 변경 없음. Wave 117~123 시리즈에서 박힌 PARSER_VERSION v42 + parts_only + display_defect 보강 + reparse-listings cron-auth 등 모두 이미 commit됨 (HEAD 46587f5 Wave 123). 이번 wave 는 **DB 운영 액션** (옛 매물 mass reparse) + 측정 결과 박는 용도.

## 1. 배경

- 컨텍스트 시작 시 `mvp_listing_parsed.parser_version` 분포: v35 7,217 / v41 6,464 / v40 5,109 / v32 498 / 잡것 311. **v42 0건.**
- dev server 가 v42 코드 사용 중인데 (HEAD 46587f5), DB에 v42 매물 0건 = 옛 매물 정리 안 됨.
- needs_review 49.1% (9,628 / 19,599) — 절반 가까이.
- score_dirty 트리거는 score 재계산만 — parser 재실행 X. 별도 매커니즘 필요.

## 2. 운영 액션

- 시간: 2026-05-15
- 액션: `/api/debug/reparse-listings?legacy=1&limit=1000` 25회 호출 (CLI loop, cron-auth Bearer).
- 처리량: 1000건 / 12초. 19개 batch 후 옛 매물 0건 (정상 종료).
- 결과:
  | parser_version | 시작 | 끝 |
  |---|---|---|
  | option-parser-v42 | 0 | **19,304** |
  | wave92-fashion-mobility-v1 | 202 | 263 (별 parser, 의도 stuck) |
  | option-parser-v35 | 7,217 | 29 (skipped/pending) |
  | option-parser-v41 | 6,464 | 12 (skipped/pending) |
  | option-parser-v40 | 5,109 | 5 (skipped/pending) |
  | option-parser-v32 | 498 | 2 (skipped/pending) |
  | 기타 v31/v33/v34/v38/v39 | 109 | 0 |

## 3. 효과 측정

- 시간: 2026-05-15
- 전체 needs_review: **49.1% → 20.1%** (-29%p, -5,748건).
- 카테고리별 (v42 매물만):
  | category | total | needs_review | pct |
  |---|---|---|---|
  | smartphone | 4,293 | 404 | 9.4% |
  | earphone | 3,897 | 723 | 18.6% |
  | tablet | 3,714 | 742 | 20.0% |
  | smartwatch | 2,449 | 150 | 6.1% |
  | laptop | 2,051 | 694 | **33.8%** |
  | game_console | 302 | 0 | 0.0% |
  | other | 1,558 | 126 | 8.1% |
  | unmatched (sku_id null) | 1,041 | 1,041 | 100.0% |
- condition_notes 신규 마킹:
  - parts_only **70건** (신설, 풀 차단 + 시세 sample 제외)
  - display_defect 97 → **881건** (regex 보강 9x, "액정 깨짐|화면 깨짐|노액|디스플레이 깨짐|파손|나감" 추가 효과)
  - screen_replaced 228건 유지

## 4. 정리 안 된 295건 (의도)

- 시간: 2026-05-15
- 잔존:
  - `wave92-fashion-mobility-v1` 263건 — fashion (가방/신발/자전거) 별도 parser. option-parser 로 reparse 시 wrong (semantic 다름). 건들지 않음.
  - `option-parser v32~v41` (detail_status=skipped/pending) 32건 — score 계산에서도 빠지는 매물. reparse 의의 적음.

## 5. tests fix

- 시간: 2026-05-15
- 발견: `tests/core-rules.test.ts:1184/1191` iPad Mini 5/A17 expected `comparableKey` 가 chip 누락 형태 (옛 가정). Wave 117d/118 이후 `parseTabletGenerationChip` 의 iPad Mini chip 매핑 (`mini 5 → a12`, `mini 7 → a17_pro`) 추가됐는데 test fail 1건 잔존.
- 변경: 두 expected 에 chip token 추가:
  - `'ipad|ipad_mini|5_gen|a12|7_9in|64gb|wifi'`
  - `'ipad|ipad_mini|7_gen|a17_pro|8_3in|256gb|wifi'`
- 검증: `npm run test:core` 138 → 139 pass.

## 6. 미해결 (다음 wave)

- **자동 reparse cron** — future parser 변경 (v42 → v43+) 시 자동 정리. cron-auth 이미 박힘 (Wave 117 시리즈). QStash schedule 만 등록하면 OK.
- **리셀 업자 친화 lane 신설** — 깨진/하자/부품용 매물 별도 lane. Production 30일 smartphone 깨진/하자 ~310건/월, 정상가 대비 50% 가격. 별 wave에서 lane 구조 + 별도 builder 신설.

## 7. 위험

- **fashion (wave92) 매물 263건** — fashion parser 가 v2/v3 등으로 업그레이드되면 별도 reparse 필요. 현재 매커니즘에 없음. 별 wave.
- **mass reparse 가 sku_id 없던 raw 666건의 sku_id 회복** — score 계산에서도 sku_id 영향 받음. 다음 tick 후 score 재계산 시 차이 발생 가능 (긍정: 비교군 정확. 부정: 옛 score 와 다름).

## 8. 추천 페이지 평균 차익 chip + 개별 매물 회전 chip 정밀화

- 시간: 2026-05-15
- 발견: 외부 의견 수용 — "회전 기간 UI 전면화 + 백테스트 데이터 = 자본 묶임 두려움 해체. 신규 사용자 친화도 향상". 리셀 lane 신설 보류 (전업 리셀러 Phase 2).
- 1차 시도 (revert): 추천 페이지에 회전 chip (그룹 평균 medianHoursToSold) 추가 시도. 측정 결과 sample 작음 (band 별 5~8 SKU, ~2시간 비현실적) → 사용자 피드백 "버려" → revert. 그룹 평균은 representative X.
- 최종 변경:
  - `src/app/api/packs/preview-inventory/route.ts`:
    - matchingPool 추출 → `medianProfitWon` 계산 (mvp_candidate_pool.expected_profit_min median)
    - response 에 1 필드 추가
  - `src/components/recommendation-workspace.tsx`:
    - `PreviewInventoryResp` `medianProfitWon` 추가
    - "자세한 정보 ▼" 안 평균 차익 chip
    - **prominent 위치**: "추천 상품 수" 박스 헤더 아래 chip 박스 — 클릭 안 해도 보임
  - `src/components/pack-reveal-modal.tsx:208-216` (사용자 피드백 — "빠름/늦음 추상이 아니라 평균 일수"):
    - 옛: `"회전 빠름 (3일내)"` / `"회전 늦음"` (추상 톤)
    - 새: 24h 미만 → `"X시간 회전"`, 24h 이상 → `"평균 X.X일 회전"` (실제 일수)
    - tone: 72h 이하 good / 336h 이상 warn / 그 사이 info
- 검증:
  - `curl /api/packs/preview-inventory?band=2&priceMax=500000` → `medianProfitWon:55785` 확인.
  - UI: 차익 1만원+ → "X만원". 데이터 부족 → fallback.
- 위험:
  - 평균 차익은 mvp_candidate_pool.expected_profit_min 기반 (시세 추정). 실제 매입가 협상에 따라 다름.
  - 개별 매물 chip 의 medianHoursToSold 도 clock_basis = first_seen_to_sold_detected. "사용자 매입 후 재판매까지" 와 다른 proxy. 단 매물별 데이터 (그룹 평균 X) 라 정직함.
