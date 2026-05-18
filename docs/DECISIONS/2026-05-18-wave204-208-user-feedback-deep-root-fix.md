# Wave 204-208 — 사용자 베타테스터 코멘트 5개 근본 원인 차단 (2026-05-18)

> 사용자 명령 (결정적): "152번 클루지처럼 덕지덕지 X — 근본 원인을 차단해라. 기존 로그 확인. 이미 해결된 게 많음."
>
> 사용자 통찰 (157번): "진짜 렌즈랑 다른거 아닌가?? 어떻게 저게 가능한거지?? 파싱이 왜 저따구로 동작하지?"

## 사용자 코멘트 8개 검토 결과

| # | 패턴 | 기존 wave 검증 | 액션 |
|---|---|---|---|
| 151 | mint 시세 부풀림 | **Wave 178 (condition fallback 위로 차단)** | ✅ 이미 해결 |
| 152 | 사기 (헬로우*비 개인결제창) | **Wave 177 (정확한 동일 패턴)** | ✅ 이미 차단 (invalidated 매물) |
| 153 | 에어팟 "왼쪽" 한쪽 매물 | earphone single-side 미적용 | 🔴 **Wave 207** |
| 154 | 번개 S급 시세 0원 | (별도 UI/backend bug) | ⏳ 별도 wave |
| 155 | "갤탭 구함" broad catalog | buying_post **narrow lane only**, broad 누락 | 🔴 **Wave 204** |
| 156 | contacted (긍정) | — | ✅ 정상 |
| 157 | "액션6 용 pov 렌즈" | Wave 192 **drone-only** catalog NOISE, 일반화 누락 | 🔴 **Wave 208** |
| 158 | 리퍼 미개봉 → flawed | `refurbished_or_repaired` 모두 FLAWED 매핑 | 🔴 **Wave 205** |
| 159 | 미개봉 + 97% → normal | **Wave 203 (직전 박음)** | ✅ cron tick 자동 |
| 160 | 떨어트림 많음 → worn | damage signal "떨어뜨려" 만, 변형 누락 | 🔴 **Wave 206** |

→ **사용자 명령대로**: 이미 해결된 거 (151/152/159) 박지 않음. 미해결 5개 근본 fix.

---

## Wave 204 — buy-intent 매물 broad catalog 일반 차단 (155)

**진단**:
- 매물 pid 397387660 "갤탭 s9 fe 플러스 구함" — broad SKU `galaxy-tab-s9-fe-plus` 매칭.
- option-parser.ts:1842/1857/1880 `buying_post` reject는 **narrow lane 3개** (`ipad_pro_11_m4_256_wifi`, `sony_wh1000xm4`, `iphone_15_pro_128gb_self`) 만 적용.
- catalog.ts mustNotContain "삽니다/매입/구합니다" 일부 SKU 만 박힘 (drift).
- "구함" 단독 키워드 누락.

**fix**:
- `conditionFromText` 함수에 title-only buy-intent detection 추가:
  ```ts
  if (/(?:구함|구합니다|구해요|구해봅니다|삽니다|매입|구매\s*합니다|구매합니다|\bwtb\b|사고\s*싶어요|사고싶어요)/i.test(titleNormalized)) {
    add("buying_post", -0.4);
  }
  ```
- `FLAWED_NOTES` + `POOL_BLOCK_NOTES` + `COMPARABLE_EXCLUDE_NOTES` 모두에 `buying_post` 추가
- title-only matching — description false positive 차단 (§12b 정확성 우선)

**효과**: 모든 SKU 자동 적용. 풀 진입 + 시세 sample 모두 차단.

**test**: `tests/wave204-buying-post-broad-catalog-block.test.ts` 14개 pass.

---

## Wave 205 — refurbished factory vs unofficial repair 분리 (158)

**진단**:
- 매물 pid 408779051 "DJI 오즈모 포켓3 리퍼 미개봉" → `flawed` 분류.
- 사용자 의문: "리퍼 ≠ 훼손". 공식 리퍼 = 박스 미개봉 + 1회 공식 수리 후 재판매 (정상 작동).
- 기존: `리퍼|리퍼폰|리퍼 교체|부분 수리|사설 수리|사설수리` 모두 `refurbished_or_repaired` (FLAWED) → flawed 매핑.
- 공식 리퍼 vs 사설/부분 수리 구분 없음.

**fix**:
- 정규식 분리:
  ```ts
  const isUnofficialOrPartialRepair = /(?:사설|부분|일부|자가)\s*수리|사설수리|부분수리|일부수리|자가수리/.test(lower);
  const isFactoryRefurbished = !notRefurbished && !isUnofficialOrPartialRepair
    && /리퍼\s*(?:폰|제품|미개봉|박스|교체)?|리퍼폰/.test(lower);
  if (isUnofficialOrPartialRepair) {
    add("refurbished_or_repaired", -0.15); // FLAWED 유지
  } else if (isFactoryRefurbished) {
    add("refurbished_factory", -0.03); // 신규 — FLAWED X
  }
  ```
- 새 note `refurbished_factory` 는 FLAWED_NOTES 에 추가하지 않음 → 정상 시세 sample.

**효과**:
- "DJI 오즈모 포켓3 리퍼 미개봉" → notes `[refurbished_factory, new_or_open_box]` → **unopened** 분류 (FLAWED X)
- "사설 수리" / "부분 수리" / "자가 수리" → 기존 flawed 유지 (실제 훼손 흔적)

**test**: `tests/wave205-refurbished-factory-vs-repair-split.test.ts` 13개 pass.

---

## Wave 206 — damage signal 변형 보강 (160)

**진단**:
- 매물 pid 399177378 "본체가 안닫히고 떨어트림 많음" → `worn` 분류 (cosmetic_wear).
- 기존 line 1263 패턴 `떨어뜨려 깨/금/손상/파손|떨어진 적|낙상|충격 받|박살|도장 까짐`.
- 누락: "떨어트림" (변형), "본체 안 닫힘" (closure 불량 — 명백한 flawed signal).

**fix**:
```ts
const closureNegation = /(?:잘\s*닫|문제\s*없이\s*닫|정상\s*(?:으로\s*)?닫|닫(?:힘|함)\s*(?:정상|이상\s*없))/.test(lower);
const closureDefect = !closureNegation && /(?:본체|뚜껑|덮개|커버|케이스).{0,8}(?:안\s*닫|안닫|닫히지\s*(?:않|안)|닫힘\s*불량|안\s*잠|안잠)/.test(lower);
const dropImpactVariants = /떨어(?:뜨|트)림|떨어트(?:려|린)|툭\s*떨어|자주\s*떨어/.test(lower);
if (/* 기존 패턴 */ || closureDefect || dropImpactVariants) {
  add("repair_or_defect_signal", -0.2);
}
```

**효과**: 매물 → `repair_or_defect_signal` 박힘 → FLAWED → **flawed** 분류 (worn 정정).

**test**: `tests/wave206-damage-signal-variant-boost.test.ts` 8개 pass.

---

## Wave 207 — earphone single-side 매물 차단 (153)

**진단**:
- 매물 pid 343583659 "에어팟프로2세대 C타입 왼쪽, A-급" → AirPods Pro 2 본체 SKU 매칭.
- 무선 이어폰류 한쪽만 매물 = 단품 = 정상 거래 X (페어 단위 시세 부풀림).

**fix**:
```ts
if (category === "earphone") {
  const singleSidePattern = /(?:^|[\s\[(/,])(?:왼쪽(?:만)?|오른쪽(?:만)?|좌측(?:만)?|우측(?:만)?|왼유닛|오른유닛|left\s*only|right\s*only|l\s*유닛|r\s*유닛|한\s*쪽만|한쪽만)(?:[\s\])\/,]|$)/i;
  if (singleSidePattern.test(titleNormalized)) {
    add("single_side_only", -0.4);
  }
}
```
- earphone 카테고리 한정 (다른 카테고리 "왼쪽 단추" 같은 정상 표현 false positive 차단)
- title-only matching (description "왼쪽 이어폰 잘 됨" 정상 표현 차단)
- `single_side_only` note → FLAWED + POOL_BLOCK

**효과**: 사용자 매물 → `single_side_only` 박힘 → flawed → 풀 진입 + 시세 sample 모두 차단.

**test**: `tests/wave207-earphone-single-side-block.test.ts` 10개 pass.

---

## Wave 208 — "X용 + 액세서리" 호환 매물 일반 차단 (157)

**진단**:
- 매물 pid 398121430 "DJI 오즈모 액션6 용 pov 렌즈" → Action 6 본체 SKU 매칭.
- 기존: catalog.ts `DRONE_FILTER_ACCESSORY_NOISE` drone-only. camera/tablet/laptop 누락.
- "X용 + 액세서리 부속어" 일반 패턴 미적용.

**fix**:
```ts
const accessoryCompatibilityPattern = /[가-힣A-Za-z0-9]+\s*용\s*(?:pov\s*)?(?:렌즈|필터|마운트|어댑터|거치대|충전기|배터리|케이블|보호\s*필름|보호필름|폴리오|스타일러스|손목\s*밴드|와이파이\s*동글|동글|그립|마이크|sd\s*카드|메모리\s*카드|스트랩\s*어댑터|케이스|커버|파우치|크래들|스탠드|홀더|클립|독|도크)/i;
if (accessoryCompatibilityPattern.test(titleNormalized)) {
  add("accessory_compatible_for_other_product", -0.4);
}
```
- title-only (description "본품 + 케이스 포함" 같은 정상 매물 false positive 차단)
- 단어 + "용" + 액세서리 부속어 결합 매칭 (정확한 호환 표현)
- 모든 카테고리 자동 적용

**효과**: drone 외 camera/tablet/laptop/smartwatch 등 모든 카테고리에서 호환 액세서리 매물 차단.

**test**: `tests/wave208-accessory-compatibility-block.test.ts` 10개 pass.

---

## PARSER_VERSION bump

`v50 → v53` (Wave 204/205/208 누적). cron tick 다음 사이클에서 잘못 박힌 매물 모두 자동 재처리:
- buying_post 누락 broad catalog 매물 → pool 차단
- 리퍼 매물 → unopened/clean 정확 분류
- 안 닫힘/떨어트림 매물 → flawed 정확 분류
- earphone 한쪽 매물 → flawed 차단
- 호환 액세서리 매물 → flawed 차단

## 일반성 검증

| 패턴 | 적용 범위 |
|---|---|
| Wave 204 buying_post | 모든 카테고리 / 모든 SKU |
| Wave 205 refurbished_factory | 모든 카테고리 (smartphone/drone 등) |
| Wave 206 damage variants | 모든 카테고리 |
| Wave 207 single_side_only | earphone 카테고리 (의도) |
| Wave 208 accessory_compatible | 모든 카테고리 |

→ 5 fix 모두 일반 로직. 한 매물 / 한 SKU 클루지 X.

## 검증

- `npm run test:core`: **535/535 pass** (0 fail). 신규 test 55개 추가.
- typecheck: option-parser.ts / condition-policy.ts 0 error (pre-existing wave148/151 type drift 무관).
- 5 wave 새 note 모두 FLAWED_NOTES + POOL_BLOCK_NOTES 일관성 (drift guard 통과).

## 사용자 결정 적용

- ✅ 클루지 박지 않음 (5 fix 모두 근본 원인 일반화)
- ✅ 기존 wave 확인 (이미 해결된 151/152/159 박지 않음)
- ✅ 모든 카테고리/SKU 자동 적용 (한 매물 fix 아님)
- ✅ decision log 박음 (이 파일)

## 미해결 (별도 wave)

- **154 (번개 S급 시세 0원)**: backend/UI bug. me 페이지 band-level median fallback. 별도 wave 검토.
- **151 (mint 시세 차이)**: 이미 Wave 178 fallback 차단. 사용자 매물은 mint 정상 분류 — UX 의문 (UI에 시세 grouping 명시 안 됨)일 가능성.

## Linked

- Wave 130 (condition별 시세 분리)
- Wave 140 (Bunjang metadata override)
- Wave 148 (광고 패턴 기본)
- Wave 156-170 (광고/가품 15 wave)
- Wave 177 (사기 결제 차단)
- Wave 178 (condition fallback)
- Wave 192 (액세서리 오염 drone-only)
- Wave 202 (iPad parser)
- Wave 203 (셀러 거짓 미개봉)
