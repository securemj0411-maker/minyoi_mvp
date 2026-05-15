# Wave 122 — COMMON_PRODUCT_NOISE 모든 카테고리 spread + 사은품/이벤트 token + 대괄호 함정 fix

> 사용자 통찰: "다른 brand까지 빠짐없이 같은 패턴 차단"

## 1. COMMON_PRODUCT_NOISE 신규 const
- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)** 신규 const:
  - 케이지/촬영용 액세서리
  - 콜라보/네임보드/우치와/키링/테디베어
  - 단독 행사/개인결제창/결제창
  - 교신/교신원함

## 2. 모든 카테고리 NOISE에 spread
- 시간: 2026-05-15
- 변경: 9개 NOISE constants에 `...COMMON_PRODUCT_NOISE`:
  - PHONE_NOISE
  - TABLET_NOISE
  - HEADPHONE_NOISE
  - SPEAKER_NOISE
  - LAPTOP_NOISE
  - EARPHONE_NOISE_W94
  - SMARTWATCH_NOISE_W94
  - TABLET_NOISE_W94
  - SPEAKER_NOISE_W94
  - SMARTPHONE_BROAD_NOISE_W114D

## 3. Wave 122b — 사은품/이벤트 추가
- 시간: 2026-05-15
- 추가:
  - 사은품 증정 / 사은품증정 / 사은품 드림
  - 룰렛 이벤트 / 리뷰 이벤트 / 쿠폰 증정 / 마우스 증정
  - 포장스티커안뜯은
- ⚠️ 대괄호 token 함정 발견: "[풀박스]" 같은 catalog token이 normalize에서 대괄호 제거되어 → " 풀박스 "로 변환 → 정상 매물의 "풀박스" 명시까지 false positive reject. **대괄호 token 사용 금지** 정책 학습.

## 4. Wave 124 — 부품/스킨 noise + K-pop merch는 pipeline 처리
- 시간: 2026-05-15
- 추가 token:
  - 메탈스티커 / 메탈 스티커
  - 스킨 스티커 / 스킨스티커
  - 본체화면만 / 화면만
  - 조이스틱 핸들
  - 박스만 판매 / 박스 단독 / 박스 단품
- ⚠️ K-pop 굿즈 (포카/포토카드/특전/엔시티) 함정 발견:
  - catalog mustNotContain에 추가 시 ruleMatch null → categoryScopedNoise 도달 못 함 → pipeline.ts:467 merchOnlySignal regex 매칭 실패 → unknown 분류
  - **정답**: catalog에 추가 X, pipeline에서만 처리 (이미 merchOnlySignal 박혀있음)

## 5. 검증
- 139/139 test pass.
- 정상 매물의 "풀박스"/"케이스 포함" 영향 X 확인.

## 6. 거론 금지
- 대괄호 catalog token 절대 금지 (catalog mustNotContain).
- catalog mustNotContain에 추가 token은 pipeline categoryScopedNoise 도달 차단 위험 — 정밀 분류 필요한 token은 pipeline 처리.
