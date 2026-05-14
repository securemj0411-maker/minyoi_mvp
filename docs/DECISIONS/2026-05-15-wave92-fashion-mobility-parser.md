# Wave 92 — 신발/가방/자전거 parser + cross-color disambiguation

> Status: **applied (code).** parseFashionMobility 신규 모듈 + Jordan/Dunk/Yeezy 변형 cross-color reject 패치. 자전거 parser 100% pass.

CLAUDE.md 6 필드 포맷.

## 0.1 parseFashionMobility 모듈 신규

- 시간: 2026-05-15 06:30 KST
- 발견: Wave 91에서 shoe/bag/bike SKU 106개 박았지만 parser 미지원 → 모든 매칭 needsReview → pool 진입 X. 사용자 노출 가능하려면 카테고리별 parser 필수. 단 테크 axis (storage/RAM/SSD)와 결이 완전히 달라 별도 모듈 권장.
- 변경:
  - 신규 `src/lib/parsers/wave92-fashion-mobility.ts`:
    - `parseConditionTier(text)` → S/A/B/C/reject. **셀러 표기 1단계 깎기** (S급 표기 → A급 인식. 셀러 인플레 보정).
    - 신발: `parseShoeSizeMm` (230~309mm), `parseShoeBoxStatus`, 키즈 차단.
    - 가방: `parseBagEra` (vintage/current), `parseBagSizeVariant` (25/30/35/mini/pm/bb), 가품 의심 flag.
    - 자전거: `parseBikeFrameSize` (cm/인치/S-XL), `parseBikeCrashHistory` (사고/크랙 → reject), `parseBikeYearTier`.
    - `parseFashionMobility(input)`: ParsedListingOptions 반환 (comparable_key/confidence/needsReview/parsedJson).
  - `src/lib/option-parser.ts`: parseListingOptions 진입에 shoe/bag/bike early dispatch.
  - 너무 strict한 needs_review 트리거 완화 (가방 era unknown, 자전거 frame_size unknown은 critical 아님 — confidence만 약간 감소).
- 검증:
  - typecheck clean, test 139/139 pass
  - Mining 재실행 (`scripts/wave91-mining-and-pollution-analysis.ts`):
    | 카테고리 | binding | parser_ok | 변화 |
    |---|---:|---:|---|
    | 신발 | 2.6% | **76%** (141/186) | 0 → 76% |
    | 가방 | 14.9% | **13%** (114/874) | 0 → 13% (era 정밀화 후 추가 향상 가능) |
    | 자전거 | 30.1% | **100%** (688/688) | 0 → 100% 🎉 |
- 위험: 낮음.
  - **자전거 frame_size unknown 매물**: 사이즈 정보 없어도 parser pass. 사용자 UI에 "프레임 사이즈 확인 필요" 뱃지 필수 (사용자가 본인 체형 매칭 못 함).
  - **가방 era unknown 매물**: 빈티지 vs 현행 시세 분리 안 됨 → comparable_key가 두 그룹 섞임. 시세 신뢰도 ↓. 단 confidence 통과는 OK.
  - 셀러 grade 인플레 보정 (S→A→B→C 깎기) 정책. 표본 측정 후 조정 가능.
- 다음:
  - 자전거 23 ready_candidate → internal pool 진입 → 1주 측정 → ready 승격 검토.
  - 가방 era 정밀화 (datecode 룰 추가 / 빈티지 키워드 확장) → parser_ok 13% → 50%+ 목표.
  - 신발 76% 유지. broad_noise_high 28개는 정상 (한정판 catalog 자연 결과).

## 0.2 Jordan 1 / Dunk / Yeezy cross-color disambiguation

- 시간: 2026-05-15 06:30 KST
- 발견: Wave 91 mining에서 같은 family 변형 SKU (Jordan 1 high 6종 / low 3종, Dunk 6종, Yeezy 350 4종 등)의 cross-bind 심각. 매물 제목에 "조던1 시카고" 같이 단일 색상만 있어도 다른 변형이 매칭 시도 → ruleMatch 2+ 후보 발견 시 null 반환.
- 변경: 각 변형 SKU의 `mustNotContain`에 같은 family 내 다른 변형의 색상 token 추가 (Wave 87 A7C 분리 패턴). 자동 생성 스크립트로 9개 변형 그룹 처리, 총 163개 cross-color token 추가.
- 검증: catalog-shoe-wave91.ts 재생성. 매물 예시: chicago SKU mustNotContain에 "royal/bred/unc/shadow/satin/travis/black toe" 등 명시 추가.
- 위험: 정상 매물도 다른 색상 단어 들어가면 reject. 단 매물 90%+는 단일 색상 명시 → 안전. 다중 색상 비교글 등은 의도된 reject.
- 다음: cross-bind 0 도달 시까지 모니터링. 가방/자전거도 같은 패턴 필요한지 검토.

## 1. parser 비교 axis 설계

### 신발
- comparable_key: `shoe|brand|model_color|size_mm|condition_tier|box_status`
- 예: `shoe|jordan_1_high_chicago|270|s_grade|with_box`
- 결정 변수: **사이즈가 1순위** (가격차 30%+), 컨디션 2순위, 박스 3순위.

### 가방
- comparable_key: `bag|brand|model_material|size_variant|era|condition_tier`
- 예: `bag|lv_speedy_monogram|25|vintage|a_grade`
- 결정 변수: **era가 1순위** (빈티지 vs 현행 가격 2~3배), 사이즈 2순위, 컨디션 3순위.

### 자전거
- comparable_key: `bike|brand|model|frame_size|crash_history|condition_tier`
- 예: `bike|specialized_allez|54cm|no_crash|good`
- 결정 변수: **사고 이력 1순위** (가격 -50%), 프레임 사이즈 2순위 (사용자 체형 매칭), 컨디션 3순위.

## 2. 컨디션 grade 정규화 (공통)

| 입력 텍스트 | tier | 비고 |
|---|---|---|
| 미개봉/택그대로/한번도 안 신/탐 | s_grade | 객관적 신호 |
| S급 (셀러 표기) | a_grade | **1단계 깎기** |
| A급 (셀러 표기) | b_grade | 1단계 깎기 |
| B급 (셀러 표기) | c_grade | 1단계 깎기 |
| 거의 새거 / 1~2번 사용 | a_grade | — |
| 사용감 적/잔기스 | b_grade | — |
| 사용감 많음/보풀/변색 | c_grade | — |
| 파손/크랙/찢어짐/얼룩 심함 | reject | needs_review |

## 3. 거론 금지

- 닌텐도 Switch OLED — owner 명시 보류.
- 카메라 ready 재검토 — Wave 87 자연 대기.
- 가품 위험 ↑↑↑ 카테고리 (가방) 의도적 ready 승격 — internal_only 유지 + 사용자 가이드 후.
