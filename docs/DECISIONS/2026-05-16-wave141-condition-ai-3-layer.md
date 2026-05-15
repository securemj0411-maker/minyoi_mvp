# Wave 141 — condition_class 3-layer 학습 (정규식 보강 + AI L2 prompt 확장 + 모호 매물 AI)

> 사용자 핵심 통찰: "정규식만으론 못함. ai와 인간의 대조가 아니라 비유. 인간인 내가 봐야 하자 있는지 보는데"

## 1. 시간 + 동기
- 2026-05-16 (Wave 140 polished 후속)
- 사용자: "pool description에서 모두 너가 조사해서 폭넓게 학습. 정규식으로 안되는 부분 많이 있을거고 AI를 효율적으로 쓰기 위함"

## 2. sample 100+건 학습 결과

### 정규식 fail 케이스 (AI 필수)
- "강아지가 깨물어서 깨졌지만 정상작동" → clean (잘못, **flawed**)
- "앞유리 조금 금갔는데 방수기능 됩니다" → clean (**flawed**)
- "화면 흰 영역 + 터치는 문제 없음" → clean (**flawed**)
- "찍힘, 눌림 있음 + 예민하지 않은 분께 추천" → clean (**worn**)
- 셀러 어휘 인플레: "리퍼급SSS", "특S급" (실제 상태 다양)

### 정규식 보강 가능 패턴
- "흰점/흰 영역/데드픽셀/황변" → display_defect
- "강아지 깨물/떨어뜨려/낙상/도장 까짐" → repair_or_defect_signal
- "사이클 N회" 추출 → ≤50이면 mint, >500이면 worn 보강
- "정상 작동 + 유리 깨짐" 동시 → flawed override
- "예민하지 않은 분/케이스 끼면 안 보임" → worn 우회 표현

## 3. 3-layer 구현 (trade-off 없음, 비용 효율)

### Layer A — 정규식 보강 (`src/lib/option-parser.ts`, 비용 0)
- conditionFromText에 5 새 패턴 추가:
  1. display_defect 강화 (흰점/흰영역/데드픽셀/황변, negation 처리)
  2. repair_or_defect_signal 강화 (강아지 깨물/떨어뜨려/낙상/도장 까짐)
  3. mint signal 강화 (사이클 N회 추출 + ≤50 강한 신호)
  4. flawed override (정상 작동 주장 + visible damage 동시 매칭)
  5. worn 우회 표현 (예민하지 않은 분/케이스 끼면 안 보임)
- 전체 매물에 적용. 비용 0.

### Layer B — 모호 매물 AI classifier (`src/lib/pipeline.ts` + `tick-pipeline.ts`, 비용 ~$9/월)
- `classifyConditionWithAi(title, description)` 신규 함수
  - gpt-4.1-mini, 출력 60 토큰 max
  - condition_class 6-class만 반환 (mint/clean/normal/worn/low_batt/flawed)
  - prompt에 셀러 어휘 인플레 무시 / flawed override 정책 명시
- detail-worker 호출 조건 (정규식 fail 매물만):
  - condition_score 0.55~0.75 (애매 영역)
  - AND condition_notes에 명확 신호 없음 (mint/flawed 직접 신호)
  - AND bunjang detail conditionLabel 없음
- 비용 계산:
  - detail 처리 매물 5K/일 × 30% 모호 = 1.5K/일 AI 호출
  - input ~400 + output ~30 토큰 × gpt-4.1-mini 단가 = $0.31/일 ≈ **$9/월**

### Layer C — AI L2 prompt에 condition task 추가 (`src/lib/pipeline.ts`, 비용 0)
- classifyWithAi의 system prompt + user content에 condition_class field 추가
- AiClassification type에 conditionClass/conditionReason 추가
- parseAiClassification에 condition 파싱 로직
- 이미 호출 중인 의심 매물 290건/일에 task 한 줄 추가 (호출 횟수 X)
- 비용 변화 0

## 4. 검증
- 177/177 test pass
- tsc clean
- 3 layer가 서로 다른 매물에 적용 → 중복 호출 없음:
  - A: 모든 매물 (정규식 강화)
  - B: A가 못 잡은 모호 매물만
  - C: 의심 매물 (이미 AI 호출 중)

## 5. retention 효과 (가설)
- condition 분류 정확도 ↑ → Wave 130 condition별 시세 분리 효과 정확
- 시세 매칭 정확 → 사용자 차익 신뢰 ↑
- 셀러 어휘 인플레 우회 ("리퍼급SSS"가 실제 worn) → 정직한 분류

## 6. 위험
### 6a. AI 호출 latency
- detail-worker tick budget 시간 내 처리 — 1.5K 매물 × ~500ms AI = 12.5분
- concurrency 10 시 1.25분 → tick budget 내 OK
- timeout 5초 + catch null로 안전 (실패해도 정규식 결과 유지)

### 6b. condition_notes는 정규식 결과만
- AI가 conditionClass만 override (notes는 정규식 그대로)
- 시세 산정 시 condition_class 사용 → AI 결과 자동 반영
- accessory_bundle/multi_device_bundle 등 시세 sample 차단은 notes 기반 → 영향 X

### 6c. backfill 안 함
- 옛 매물 (~21K) 정규식 새 패턴 미반영
- detail-worker re-fetch 시 자연 재처리 (며칠 내)
- 강제 backfill은 API 비용 큼 (1.5K × 3중복 = 4.5K AI 호출 = $1)

## 7. 다음
- 24h 후 AI 호출 수 + 비용 + condition_class 분포 측정
- 효과 측정 후 ambiguous threshold 조정 가능 (0.55~0.75 외)

## 8. 거론 금지
- A backfill (자연 누적 우선)
- B 전체 매물 AI (정규식 통과한 거 또 검토 = 낭비)
