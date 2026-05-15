# Wave 117 — display_defect 보강 + parts_only 신설 + mass reparse v42

## 1. display_defect regex 보강

- 시간: 2026-05-15
- 발견: 사용자 요청 "리셀 업자 친화 매물 발굴" 차원 진단. 30일 smartphone 매물 중 description "액정 깨짐|화면 깨짐|노액|디스플레이 깨짐" 키워드 매칭 ~210건 발견. 기존 display_defect regex (`잔상|번인|burn in|녹조|흑점|멍|터치 불량`) 가 "깨짐|파손" 키워드 미포함 → 풀 차단 안 됨.
- 변경: `src/lib/option-parser.ts:983` regex 확장 — `액정 깨짐|화면 깨짐|디스플레이 깨짐|액정 파손|화면 파손|디스플레이 파손|노액|액정 나감|화면 나감` 추가.
- 검증:
  - mass reparse 후 `display_defect` 마킹: **97 → 881건** (9x 증가).
  - `npm run test:core` 139/139 pass.
- 위험: false positive — "잔상 없음" 같은 부정 표현은 line 982 noDisplayDefect 가드로 이미 처리. 신규 추가 키워드도 직접 손상 표현이라 안전.

## 2. parts_only condition_note 신설

- 시간: 2026-05-15
- 발견: parser 가 `부품용|파트만|리퍼 부품` 등 키워드는 narrow lane reject (mining 평가용)로만 사용. condition_notes 에 박지 않아 풀 차단 정책 (POOL_BLOCK_NOTES) 안 걸림.
- 변경:
  - `src/lib/option-parser.ts:986` 새 줄 — `parts_only` condition_note 추가. regex: `부품용|파트만|리퍼 부품|단자만|힌지 부품|수리용|셀러용|업자용|보상판매용`.
  - `src/lib/candidate-pool-builder.ts:120` POOL_BLOCK_NOTES에 `parts_only` 추가.
  - `src/lib/tick-pipeline.ts:2490` 시세 sample exclude에 `parts_only` 추가.
- 검증: mass reparse 후 `parts_only` 마킹 **70건**. 모두 풀 차단 + 시세 sample 제외.
- 위험: 리셀 업자가 부품용 매물을 일부러 사고 싶은 경우 풀에서 안 보임. **별도 lane (리셀 업자 친화)** 신설 시 별도 builder 가 다시 흡수 — POOL_BLOCK_NOTES 코멘트에 명시.

## 3. PARSER_VERSION v41 → v42

- 시간: 2026-05-15
- 변경: `src/lib/option-parser.ts:40` `option-parser-v41` → `option-parser-v42`.
- 사유: regex 보강 + parts_only 추가 → 결과 schema 변경. mass reparse 트리거 위해 버전 bump.

## 4. Reparse endpoint cron-auth 옵션 + legacy filter

- 시간: 2026-05-15
- 발견: `score_dirty=true` 마킹은 score 만 재계산, parser 재실행 X. 옛 v24~v41 매물 19,599건 정리 매커니즘 부재 (wave63 스크립트는 dry-run 위주).
- 변경:
  - `src/app/api/debug/reparse-listings/route.ts` `loadLegacyRows()` 신설 — `parser_version != CURRENT` 매물만 batch fetch (parser_version asc, pid asc).
  - `?legacy=1` query 활성 시 loadLegacyRows 사용.
  - `handleReparse()` 진입에 `checkCronAuth(req)` 가드 추가 — admin 외 cron-auth (Bearer CRON_SECRET) 도 허용 (CLI 자동화용). reparse 는 destructive 아님 (parsed_json 재생성, raw 안 건드림) 라 안전.
- 검증:
  - shell loop으로 `?legacy=1&limit=1000` 25회 호출 (`for i in {1..25}; do curl ...; done`). 19개 batch 진행 후 옛 매물 0개 (정상 종료).
  - 1000건/12초. 19,000건 / ~4분.
  - 호출 1회 결과 예: `{total:998, needsReview:299, skuRecovered:666, parserVersion:"option-parser-v42"}`.

## 5. Mass reparse 효과 측정

- 시간: 2026-05-15
- 결과: **needs_review 49.1% → 20.1%** (-29%p, 절대값 -5,748건).
- 카테고리별:
  | category | total | needs_review | pct |
  |---|---|---|---|
  | smartphone | 4,293 | 404 | 9.4% |
  | earphone | 3,897 | 723 | 18.6% |
  | tablet | 3,714 | 742 | 20.0% |
  | smartwatch | 2,449 | 150 | 6.1% |
  | laptop | 2,051 | 694 | 33.8% |
  | game_console | 302 | 0 | 0.0% |
  | other | 1,558 | 126 | 8.1% |
  | unmatched (sku_id null) | 1,041 | 1,041 | 100.0% |

## 6. 정리 안 된 295건 (의도)

- 시간: 2026-05-15
- 잔존 분포:
  - `wave92-fashion-mobility-v1`: 263건 — fashion (가방/신발/자전거) 별도 parser. option-parser 로 reparse 시 wrong (semantic 다름). **건들지 않음.**
  - `option-parser-v32~v41` (detail_status=skipped/pending): 32건 — score 계산에서도 빠지는 매물. reparse 의의 적음.
- 위험: 미래에 fashion lane 별도 reparse 매커니즘 필요할 수 있음. 별 wave.

## 7. 미해결 (다음 wave)

- **자동 reparse cron** — future parser 변경 (v42 → v43+) 시 자동 정리. cron-auth 추가됐으니 QStash schedule 만 등록하면 OK.
- **리셀 업자 친화 lane 신설** — 깨진/하자/부품용 매물 별도 lane. Production 30일 smartphone 깨진/하자 ~310건/월, 정상가 대비 50% 가격. 별 wave에서 lane 구조 + builder 신설.

## 8. iPad Mini test fix

- 시간: 2026-05-15
- 발견: `tests/core-rules.test.ts:1184/1191` iPad Mini 5/A17 expected `comparableKey` 가 chip 누락 형태 (옛 가정). 이전 세션에서 `parseTabletGenerationChip` 가 iPad Mini chip 매핑 (`mini 5 → a12`, `mini 7 → a17_pro`) 추가 후 test 안 돌림.
- 변경: 두 expected 에 chip token 추가:
  - `'ipad|ipad_mini|5_gen|a12|7_9in|64gb|wifi'`
  - `'ipad|ipad_mini|7_gen|a17_pro|8_3in|256gb|wifi'`
- 검증: `npm run test:core` 139/139 pass.
