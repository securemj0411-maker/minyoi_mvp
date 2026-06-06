# Wave 1218 — 갤버즈3프로 시세 정밀: FE glued-token leak + 미개봉(비닐채) 분류 + "시세 134k가 맞다" 진단

날짜: 2026-06-07
관련: owner 발견(갤버즈3프로 화이트 시세 134,250 < 화면 비교매물 15만), Wave 1217 후속(POOL_BLOCK 밖 3건).
파일: src/lib/catalog.ts (tokenHit), src/lib/option-parser.ts (explicitNewSignal).

## 핵심 발견 (premise 정정 — 가장 중요)
owner 가정: "시세 134k는 오염, 화면 15만이 진짜 → 134k를 15만으로 수렴시켜라."
**측정 결과 이 가정은 틀림. 134k가 더 정확하다.**

측정 (daangn, earphone|galaxy_buds_3_pro, normal, pool-not-blocked):
- **sold(실거래) median = 120k** (전체 n=241 / 최근7일 n=120). 화이트만 봐도 120k(전체)/130k(7일).
- **active(호가) median = 140k**.
- 색상별 sold median: 화이트 120~130k ≈ 실버/그레이 120k → **색상 혼합은 주범 아님** (가설 기각).
- 화면 비교매물이 "전부 14~15.5만"으로 보이는 이유 = `trimComparableDisplayRows` 의 **middle-band [min(p25,med×0.9), max(p75,med×1.15)] = [120k,155k]** 가 저가 sold(60~115k)를 **표시에서 가림**. 시세는 그 저가를 포함해 sold-weighted → 134k.
- 시세 blend = sold 0.65 + active 0.35 (Wave 983 "팔린 게 시세"). → 134k 는 "실제로 ~120~130k에 팔리고, 호가는 140~150k" 를 정직하게 반영.

→ **결론: 시세를 150k로 올리는 것은 호가(top-of-ask)에 맞추는 것 = 차익 과대평가 = false-positive 추천 = 사용자 손해(§12b 위반).** 하면 안 됨.

owner 가 짚은 3건의 실제 시세 영향:
1. FE 오매칭: 최근7일 sold 120건 중 **1건**(75k). 게다가 저가라 제거하면 median이 *오히려 올라감* (미미).
2. 미개봉 오분류(35k): last_seen 05-26 → **시세 7일 window 밖** + disappeared → 현재 시세 영향 0. 게다가 "비닐채새상품 + 앱연결안됨 + 35k" = 가품 의심.
3. 박스/부품빠짐(earphone_missing_parts): 22건 median 120k ≈ 전체 130k → median 거의 안 움직임. essential(box+charger 둘다=parts_only)은 이미 POOL_BLOCK(Wave1217)으로 양쪽 제외됨.

## 그래도 고친 것 (분류 정확도 — 명확한 버그, 시세와 무관하게 올바름)

### Fix A — catalog `tokenHit`: "fe" glued-token leak (src/lib/catalog.ts:14288 부근)
- 버그: `normalize()` 가 한글-숫자만 공백 분리(숫자-영문 안 함) → "버즈3fe"→"버즈 3fe", "s23fe" glued. `tokenHit` 의 short-latin 경로는 `" fe "`(양옆 공백)를 요구 → glued "3fe/s23fe" 의 "fe"를 못 봄.
- 결과: (1) FE 매물이 mustNotContain "fe" 가진 non-FE SKU(버즈3프로/s20/s23~25 self/plus)에 **누수=시세 오염**, (2) mustContain "fe" 가진 FE SKU(갤탭 s9 fe 등)가 glued FE를 **못 잡음=recall 손실**.
- fix: `if (n === "fe") return /(?:^|[^a-z])fe(?![a-z])/.test(normalizedText);` — 숫자/공백 등 비영문 경계의 fe 매칭, life/safe/perfect/feature 내부 fe 는 제외(precision 보존).
- 측정 (scripts/_tmp_fe_verify.ts): 버즈3fe+본문Pro → before galaxy-buds-3-pro / after **null**. genuine 버즈3프로(glued/spaced) → 유지. s23fe → before galaxy-s23-256-self / after **galaxy-s23-fe**. s24fe → before null / after galaxy-s24-fe. latin fe-words guard 통과.
- DB 영향(현재 catalog 기준 재매칭 시 변경): genuine FE 누수 확인 — buds_3_pro 1, buds_3 5, s20 31(대부분 동일매물 중복, "S20FE화이트 정상공기기"), s23_plus 1, s24_256_self 2, s25_256_self 2 + FE-SKU recall 개선. 전부 진짜 FE (false regex 아님, spot-check 완료).

### Fix B — option-parser `explicitNewSignal`: "비닐채/비닐째/비닐 그대로" 미개봉 신호 (src/lib/option-parser.ts:1290 부근)
- 버그: "언박싱 새상품"(desc "비닐채새상품") → normal. 폐기된 bare "새상품"/"언박싱"(false positive 多)은 유지 안 하고, **봉인 강한 신호 "비닐채"만** 추가.
- fix: regex 에 `비닐\s*(?:채|째|그대로)|비닐포장\s*그대로` 추가. "비닐 케이스"(악세서리)는 채/째/그대로 아니라 미매칭 → FP 차단.
- 측정 (scripts/_tmp_unopened_verify.ts): suspect/비닐째/비닐 그대로 → unopened. "비닐 케이스+사용감"→worn, "새상품 같은"→normal, "실사용"→normal (FP guard intact).

## 검증
- `npx tsc --noEmit`: 변경 2파일 에러 0.
- catalog/parser/condition/earphone 테스트: 내 변경 전후 실패 동일(18, 전부 pre-existing fashion/LEGO/game-title). **새 regression 0.**

## 위험 / 보류
- **시세 sold window=168h(7일) + seller-dedup → sold_n 매우 작음(4~)** = 시세 변동성 큼. 근본은 표본. (formula 건드리지 않음 — Wave 798c.)
- **daangn 시세 stale: market_daily 최신 05-31** (raw 는 06-06 fresh, 최근7일 809건). market-worker(또는 reference-price-refresh) 로컬 cron 미발화 추정. 시세 표시값(134,250)은 05-29/30 frozen. **reparse 해도 worker 안 돌면 표시 안 바뀜.**
- Fix A/B 의 **DB 반영(reparse)은 아직 미적용** (코드만). 적용하려면 영향 listing upsert + score_dirty + market-worker 재실행 필요. broad(Galaxy 폰 다수) 라 owner 확인 후 적용 예정.
- 박스빠짐 시세 제외 / 150k 수렴 = **정책+정확도 위험 → owner 결정 대기** (위 핵심 발견 근거로 비권장).

## owner 결정 (2026-06-07)
- Q1 reparse 적용? → **지금 적용**. Q2 시세 방향? → **134k 유지** (인플레/박스빠짐 제외 안 함).

## 적용 결과 (2026-06-07)
### catalog Fix C 추가 — galaxy-buds-3 (일반) mustNotContain "fe"
- 발견: 버즈3FE 가 buds-3 (일반)에도 누수 (buds-3 일반은 "fe" 차단어 없었음 — buds-3-pro 만 있었음).
- fix: catalog.ts galaxy-buds-3 mustNotContain 에 "fe" 추가. 검증: "버즈3FE"→null, "버즈3 그레이"→buds-3 유지, "버즈3 라이프스타일"→buds-3 유지.

### FE 오염 targeted reparse (적용 완료)
- 범위: **main-product 가 FE 인 6개 non-FE pool ∩ glued-fe = 42건만** (verified). bundle/negation pool 제외:
  "S25+버즈2FE", "S9…S9fe 아닙니다", "Z폴드7+버즈3FE", "탭 7FE 키보드", "Z플립7FE" → genuine non-FE/accessory 라 **제외** (오탐 방지).
- 안전 gate: new 결과가 FE-SKU 또는 null 일 때만 write (다른 non-FE 로 drift 방지).
- 결과: **42건 전부 적용** — upsert 5 (s23fe→galaxy_s23_fe, s24fe→galaxy_s24_fe×2, s25fe→galaxy_s25_fe×2), reject→null 37 (S20FE 31 / 버즈3FE 5 / 버즈3fe 1=owner suspect).
- 검증: suspect 9004123894187 → comparable_key=null, needs_review=true ✓. buds_3_pro glued-fe 잔여 **0** ✓.
- 시세 영향: buds_3_pro sold 120건 중 FE 1건(75k, 저가) 제거 → median 미미하게 *상승* (134k 유지 방향, 오염만 제거).
- script: scripts/apply-wave1218-fe-pollution-reparse.ts (review/--apply, 안전 gate 포함).
- ⚠️ drift 주의: 처음엔 DB(stale) vs 현재코드 전체 비교 시도 → golf/clothing/tab 등 무관 drift 1258건 + tab_s9fe→null(s9 glued, 내 fe fix 아님) 섞임 발견. → main-product-FE 6 pool 로 좁혀 격리.

### 미개봉(비닐) — 코드만 유지, 광역 reparse 보류
- 코드 fix 적용(향후 파싱). **기존행 광역 reparse 보류**: 비닐-sealed normal/clean/worn = **98건**(여러 SKU) → normal→unopened 로 condition bucket 광역 이동 = 타 SKU 시세 변동 위험 (owner "시세 유지" 와 충돌). 필요 시 condition_class-only(드리프트 0) 별도 pass.
- owner suspect 9001420550392 (35k "비닐채새상품"+"앱 연결안되요") = **가품 의심**. unopened 로 올리는 건 의미상 오히려 틀림(가품을 프리미엄 클래스로). 진짜 이슈는 condition 이 아니라 fake 탐지(별도). out-of-window+disappeared 라 현재 시세 영향 0.

## 검증 (최종)
- tsc 변경 3파일(catalog tokenHit+buds3 fe, option-parser 비닐) 에러 0.
- catalog/parser/condition/earphone 테스트: 18 실패 = HEAD 와 동일(전부 pre-existing). **새 regression 0.**

## 남은 권고 (owner 판단)
1. 박스빠짐 시세 제외: 비권장(시세 인플레=차익 과대평가). 유지.
2. 진짜 레버: (a) 화면 비교매물도 저가 sold 포함해 시세와 정합 / (b) 호가 vs 실거래 라벨 분리 / (c) **daangn market-worker cron 복구**(05-31 frozen — stale 가 owner 가 본 134k 가 일주일 전 값인 진짜 이유 중 하나).
3. 비닐 광역 reparse 원하면 condition_class-only pass (98건, 드리프트 0).
