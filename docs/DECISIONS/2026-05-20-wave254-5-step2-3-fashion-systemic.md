# Wave 254.5 step 2+3 (2026-05-20) — fashion 3 카테고리 일괄 conditionFromTextFashion

## 발단

사용자 정정 (root fix systemic 확장):

**사용자 직접 SQL 검증 결과** (production 측정):
- shoe v7 1,575 매물 → condition_notes 채워짐 **0%**
- bag 1,705 매물 → **0%**
- clothing 4,437 매물 → **0%**
- fashion 17,646건 전체 = **0%**
- 비교: earphone 80.9% / tablet 84.1% / smartphone 86.4%

**suspicious_high_grade (mint/clean/unopened 분류 + condition_notes 빈 배열)**:
- shoe: 4,714건 (40.9%)
- bag: 791건 (46.4%)
- clothing: 2,686건 (60.5%)
- **누적 8,191건 사용자에게 잘못 추천 가능**

사용자 결정 정정:
- **점진 rollout (step 1 → 2 → 3) 폐기** — root fix 의도 X
- **fashion 3 카테고리 일괄 systemic 적용** = 진짜 root fix
- 1타 N피 (fashion 전체 condition 분석 활성화 + fashion-specific signal 동시)
- whack-a-mole 종료

## 변경 (additive, 비파괴)

### 1. `src/lib/option-parser.ts` — `conditionFromTextFashion` 확장

shoe-specific (Wave 254.5 step 1 유지) + bag-specific (step 2) + clothing-specific (step 3) 동시 활성화.

**bag-specific signals** (사용자 list + 1타 2피 보강):
- `bag_lining_damage` (-0.25) — 내피 끈적 / 녹음 / 안감 벗겨 + negation. FLAWED piggy-back.
- `bag_leather_damage` (-0.2) — 가죽 까짐 / 벗겨 / 갈라 / 크랙 + negation. FLAWED piggy-back.
- `bag_handle_worn` (-0.15) — 손잡이 / 핸들 / 스트랩 마모/끊어짐.
- `bag_corner_worn` (-0.1) — 모서리 / 코너 / 네귀퉁이 닳음.
- `bag_paint_peeling` (-0.12) — 페인팅 / 도장 벗겨짐 (명품 모서리 일반).
- `bag_mold` (-0.3) — 곰팡이 (LV/Chanel 빈티지 흔함). FLAWED piggy-back.

**clothing-specific signals** (사용자 list + 1타 2피 보강):
- `clothing_pilling` (-0.1) — 보풀 + negation.
- `clothing_fading` (-0.15) — 색바램 / 변색 / 탈색 + negation.
- `clothing_stretched` (-0.12) — 늘어남 / 처짐.
- `clothing_seam_damage` (-0.15) — 봉제 / 솔기 / 박음질 풀림. FLAWED piggy-back.
- `clothing_slit_damage` (-0.12) — 트임 손상 (디자인 의도 negation: "사이드 트임" / "트임 디자인").
- `clothing_print_cracked` (-0.1) — 인쇄 / 프린팅 / 로고 갈라짐.
- `clothing_stain` (-0.12) — 얼룩 심함 + negation.

### 2. `src/lib/parsers/wave92-fashion-mobility.ts`

- 새 constants:
  - `PARSER_VERSION_W92_BAG_V8 = "wave92-bag-v8"`
  - `PARSER_VERSION_W216_CLOTHING_V8 = "wave216-clothing-v8"`
- **bag 분기** — `conditionFromTextFashion(text, "bag")` 호출 + worst-of merge + needsReview 보강
- **clothing 분기** — `conditionFromTextFashion(text, "clothing")` 호출 + worst-of merge + needsReview 보강
- shoe (step 1) 유지
- bike 만 v7 유지 (자전거 specific signal 별도 wave)
- `parserVersion` 반환:
  - shoe → `wave92-shoe-v8`
  - bag → `wave92-bag-v8`
  - clothing → `wave216-clothing-v8`
  - bike → `wave92-fashion-mobility-v7` (unchanged)

### 3. `src/lib/tick-pipeline.ts`

`LATEST_PARSER_VERSION_BY_CATEGORY`:
- clothing: `wave216-clothing-v7` → `wave216-clothing-v8`
- shoe: `wave92-shoe-v8` (Wave 254.5 step 1)
- bag: `wave92-fashion-mobility-v7` → `wave92-bag-v8`
- bike: `wave92-fashion-mobility-v7` (unchanged)

### 4. `tests/wave254-5-fashion-condition.test.ts` 확장

- **36 tests total** (20 shoe + 7 bag + 9 clothing) — 모두 pass
- bag specific: 내피 끈적 / 가죽 까짐 / 손잡이 마모 / 코너 닳음 / 페인팅 벗겨짐 / 곰팡이 / integration
- clothing specific: 보풀 + negation / 색바램 / 늘어남 / 봉제 풀림 / 디자인 트임 negation / 인쇄 갈라짐 / 얼룩 negation / integration
- `test:core` 회귀: **640 pass / 11 fail** (모두 pre-existing /me UI tests — 0 regression).

## 효과 (예상)

### 자연 reparse 영향 범위 (deploy 후)

| category | total | current LATEST | rematch 대상 |
|---|---|---|---|
| shoe | 11,481 (v3/v4/v7/v2) | wave92-shoe-v8 | 11,481 |
| bag | 1,705 (v7) + 기타 | wave92-bag-v8 | ~1,705 |
| clothing | 4,437 (v3/v7) + 기타 | wave216-clothing-v8 | ~4,437 |
| **누적** | **17,623** | | **17,623** |

### 사용자 매물 영향

- **pid 408858108 가젤 볼드** (Wave 254.5 step 1 case) — shoe 분기 + repair_or_defect_signal → flawed.
- **bag 791건** suspicious_high_grade (mint/clean/unopened + notes []) — fix 후 정확 분류.
- **clothing 2,686건** suspicious_high_grade — fix 후 정확 분류.

### Wave 203~209 정책 자동 적용 (모든 fashion 카테고리):
- `cosmetic_wear` negation ("사용감 적음" → 정상 유지)
- `repair_or_defect_signal` negation ("하자 없음" → 정상 유지)
- `objective_clean_signal` override (Wave 209 — 셀러 자연어 vs 객관 측정 정책)
- `buying_post` (구함/삽니다 매물 차단)
- `accessory_compatible_for_other_product` ("X용 액세서리" 잘못된 SKU 매칭 차단)
- `parts_only` (부품용 매물 차단)

## 자율 진행 정책 준수

✅ **새 code root fix** — fashion 3 카테고리 일괄 = systemic 1타 N피
✅ **점진 rollout 폐기** — 사용자 정정 즉시 반영
❌ **destructive UPDATE 안 함** — manual rematch trigger 안 함
❌ **DB DELETE / DROP 안 함**
✅ **decision log 즉시 박기**

## 미완 후속 (사용자 결정 대기)

1. **production deploy 확인** — Vercel build 진행 중 (commit push 후 ~5-10분)
2. **v8 첫 record 발현 측정** — shoe + bag + clothing 모두
3. **manual rematch trigger 결정** (Wave 252.B 식):
   - score_dirty=true 매물만 자연 reparse → 일부 매물 (특히 score_dirty=false pid 408858108) 영향 X
   - 사용자 명시 승인 시: triggerRematchForParserVersions(['wave92-fashion-mobility-v3', 'v4', 'v7', 'v2', 'wave216-clothing-v3', 'v4', 'v7'])
   - 17,623건 모두 score_dirty=true 박혀 cron 자동 reparse 보장
4. **production cron 작동 검증** — Wave 254.4 정정 (cron 정상, date confusion이었음) 확인
5. **bike 카테고리 별도 wave** — 자전거 specific signals (사고 이력 / 크랙 / 부품 단품 / 도색 마감) 추가 시
