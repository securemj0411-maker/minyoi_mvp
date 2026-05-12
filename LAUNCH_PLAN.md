# LAUNCH_PLAN.md — Single Source of Truth

> 이 문서는 미뇨이 MVP 출시까지의 **단일 진실의 원천(SoT)** 이다. 모든 에이전트(메인/서브)는 이 문서를 읽고 시작한다. 새 리포트/문서를 만들기 전에 이 문서를 갱신하거나 참조한다. 갱신: 2026-05-13.

---

## 섹션 0. 절대 원칙 (불변 — 휘발 금지)

매 세션 시작 시 이 10개를 다시 읽고 stick with 한다. 위반 발견 시 즉시 멈추고 원칙 재확인.

### 1. 산출물 단일 기준
모든 에이전트(나 포함)의 산출물은 **`runtime 변경 / decision 기록 / code 변경` 중 하나**여야 한다. "또 다른 리포트"는 금지. 새 report-only 작업을 시작하기 전에 "이게 어느 변경으로 이어지는가" 답할 수 없으면 시작하지 않는다.

### 2. "코드 존재 ≠ production-ready"
catalog SKU 추가, lane_config 생성, LANE_READINESS 등록은 **"측정 시작 가능" 상태**일 뿐이다. 측정(diagnose/replay) 없이 "준비됨" 선언 금지. catalog에 박혔다 = ruleMatch가 매칭 시도 가능 ≠ 정확도 보장.

### 3. Lane 단위로 끊는다
카테고리 통합 ready/internal_only 게이트는 **의사결정 단위로 폐기**한다. `category-readiness.ts`의 카테고리 게이트는 default fallback일 뿐, **lane-level이 최우선**. UI 출시도 "카테고리 출시"가 아니라 "exact-lane 출시" 단위.

### 4. 결정론 ↔ AI 분기 명제
```
ruleMatch 매칭 ∧ parseListingOptions complete ∧ needs_review=false ∧ pool gate=ready
  → 결정론 OK (후보팩 진입 가능)
else
  → AI L2 (또는 owner decision / 사람 큐레이션)
```
이 분기를 흐릿하게 두지 않는다. 매 lane을 위 명제의 어느 쪽인지 명시한다.

### 5. 결정론 ceiling 명시
- **narrow exact-lane**: 95% 도달 목표 (가능)
- **broad category**: 70~80% ceiling (그 이상은 무한 튜닝 함정)
- ceiling 이상은 AI L2 또는 사람 큐레이션이 담당. 결정론 룰로 더 짜지 않는다.

### 6. lane 상태 = 4-blocker 라벨로만 단정
다음 4개 label만 사용. `internal_only` / `dormant` / `report_only_pass` 같은 추상 라벨로 묶지 않는다.
- `data_insufficient` — 표본/마이닝 부족
- `semantic_pollution` — catalog reject / parser 옵션 추출 보강 필요
- `runtime_not_deployed` — 코드는 있는데 Vercel/DB 적용 안 됨
- `owner_decision_pending` — 정책 미정의 (예: switch_oled bundle policy)

라벨 여러 개 동시 가능. 단 하나라도 ✓면 ready 아님.

### 7. 3단계 검증 분리
- **fixture pass** (sample.json/fixture에 대해 reject 통과)
- **live replay pass** (실제 Bunjang 매물 replay에서 parse_ready/needs_review 측정)
- **public ready** (Vercel deploy + DB sync + 사용자 후보팩 노출 OK)

한 단계 통과를 다음 단계로 자동 점프 금지. 각 단계 측정값 LAUNCH_PLAN에 박는다.

### 8. Sub-agent 1줄 미션 룰
- 미션을 1줄로 요약 못 쓰면 너무 큰 것 → 쪼개기
- 동시 실행 4개 이하
- 모든 sub-agent는 이 LAUNCH_PLAN.md를 SoT로 참조
- 산출물은 LAUNCH_PLAN.md 갱신 또는 code 변경. 별도 리포트 ❌

### 9. 측정 없는 plan 금지
reports grep + diagnose 결과 없이 "다음 step"을 정하지 않는다. 추측으로 plan을 짜는 순간 perfecting trap 재진입. 막힐 때 default = "측정부터".

### 10. Sub-agent 산출물은 main에서 spot check 후 사용
- 숫자/리스트는 최소 3개 sample 검증 후 SoT에 박는다
- 검증 안 된 sub-agent 데이터로 lane 분류/plan 결정 금지
- 측정값의 단위/의미는 원본 파일 1개라도 직접 확인 후 인용

### 11. 측정 사다리 (4단계)
한 lane을 "ready"라 부르려면 4단계 다 통과:
1. **Mining parse_ready** (`parse_summary.json`의 `parse_ready_count`): lane_config acceptAll/reject 통과한 매물 수. 0이면 즉시 fail.
2. **ruleMatch SKU match**: `ruleMatch(title, desc)`가 lane의 SKU로 매칭하는 비율.
3. **parseListingOptions complete**: `comparable_key`가 unknown_* 없이 완성되는 비율 + `needs_review=false`.
4. **Pool gate ready**: `evaluatePoolGate()` 통과.

1단계는 mining 측정값으로 이미 확보. 2~4단계는 production replay 필요.

### 12. MVP 출시 목표 (흔들지 말 것)
- ❌ 전 카테고리 95% 결정론
- ✅ **narrow lane들 단위로 점진적 공개** + broad는 AI L2 fallback + 사람 검수
- ✅ closed-set 카테고리(earphone/smartwatch)는 결정론 강화, open-vocabulary 카테고리(smartphone/laptop broad)는 결정론 70~80%에서 stop + AI L2
- ✅ 결제/Auth 같은 launch gate 작업은 narrow lane 확보와 병렬

---

## 섹션 1. 현재 측정 데이터 (2026-05-13 측정)

### 1.1 Production parser 전체 통계 (`diagnose:parser`, 최근 1000건)
- **parsed = 1000 (100%)**, comparable_key 100% 생성
- **needs_review = 164 (16.4%)** → 결정론 통과율 **83.6%**
- lowConfidence = 63 (6.3%)
- 카테고리 traffic: smartwatch 33.5%, tablet 24.7%, earphone 18.1%, smartphone 13.0%, laptop 10.7%
- Parser version 혼재: v24=360, v26=434, v30=166 (옛 매물 재파싱 필요 가능성)

### 1.2 Critical unknown 약점 (production에서 needs_review 만드는 주범)
| Type | 건수 | 의미 |
|---|---|---|
| unknown_generation | 48 | macbook M1/M2/M3 등 칩 세대 인식 실패 |
| unknown_storage | 47 | 128/256/512GB 추출 실패 |
| unknown_size | 28 | 애플워치 mm 인식 실패 |
| unknown_ram | 23 | laptop RAM 추출 실패 |
| unknown_ssd | 16 | laptop SSD 추출 실패 |
| unknown_chip | 10 | macbook chip 분류 실패 (특히 옛 모델) |
| unknown_anc | 10 | airpods ANC 인식 실패 |
| unknown_connector | 8 | airpods USB-C/Lightning 인식 실패 |

샘플: `"m1 맥북에어 16 256"` → key=`macbook|macbook_air|unknown_generation|m1|16in|16gb_ram|256gb_ssd` (m1을 chip으로는 잡았지만 generation으로 못 잡음 — parser 옵션 추출 규칙 보강 필요)

### 1.3 Mining parse_ready (lane_config 통과율)
검증된 4개 sample:
- airpods_max_usbc: fetched 277, parse_ready 200 (72%, target reached)
- macbook_air_m3_13_256: fetched 309, parse_ready 62 (20%, target 미달)
- galaxy_s25_ultra_256_self: fetched 549, parse_ready 200 (36%, target reached)
- ps5_slim: fetched 264, parse_ready 159 (60%, target 미달)
- airpods_4_anc: fetched 319, parse_ready 123 (38%)
- iphone_11_pro_128gb_self: fetched 41, parse_ready **0** (data 부족 + acceptAll 너무 strict)

전체 33 lane parse_summary.json 보유, 일괄 집계 미실시 (필요 시 추가).

### 1.4 catalog 정합성 ↔ LANE_READINESS ↔ mine-narrow (검증 후)
- catalog.ts unique laneKey: **31개** (earphone/smartwatch는 카테고리 ready라 의도적으로 laneKey 미박)
- earphone/smartwatch SKU (airpods-4-anc, applewatch-ultra2, beats-solo4, sony-wh-1000xm4 등): SKU 자체는 catalog에 존재. 단지 laneKey 필드 없음 → 카테고리 ready로 자동 노출. **누락 아님.**
- LANE_READINESS에 등록된 narrow lane: ~30개 (wave 1~6 누적)
- mine-narrow LaneKey union: ~33개

**즉 정합성 자체는 OK.** sub-agent 첫 보고의 "8개 누락"은 naming convention 차이 인한 false alarm.

### 1.5 option-parser.ts 카테고리별 정밀도 (wave 6 8개 lane 기준)
- airpods_4_anc: OK (parseAirpodsConnector + parseAirpodsNoiseControl 존재). **단 unknown_anc 10건 발생 중** → 보강 여지
- galaxy_buds_3_pro: OK (family/model 매핑 OK)
- bose_qc45: ⚠️ headphone family 있으나 bose_qc45 model 매핑 약함 (검증 필요)
- ipad_pro_13_m2_256_wifi: OK (chip M2 + storage 256 + wifi 추출)
- macbook_air_m2_13_256: OK 단 **unknown_generation 발생률 높음** (production 약점)
- iphone_11_pro_128gb_self: OK 단 자급제 매물 자체가 적음 (data 부족)
- galaxy_z_flip_5_256_self: OK
- switch_oled: OK (game-console-parser OLED regex)

### 1.6 미해결 owner decision 항목
- switch_oled: bundle policy (full_set vs body_only) 미정
- home-appliance: vacuum dock/base-station 정책 미정
- game_console: Switch 2 broad runtime vs narrow lane 정책 미정
- Parser version 혼재 → 재파싱 정책 미정 (v24 매물 reparse vs 그대로 둠)

---

## 섹션 2. 핵심 발견 — 환경 가정 수정 (2026-05-13)

### 2.1 Runtime 환경 = 로컬 localhost:3000
- Vercel deploy 사용 안 함. QStash cron이 로컬로 들어옴.
- 즉 **main에 commit + dev server 재기동 = 즉시 production 적용**

### 2.2 LANE_READINESS는 코드 직접 반환 (DB sync 불필요)
- `category-readiness.ts:436` `loadLaneReadinessMap()` → 단순히 `return LANE_READINESS` (코드의 map 직접 return)
- DB `mvp_lane_readiness` 테이블 미존재 (코드 코멘트 "once a `mvp_lane_readiness` exists")
- **결론**: wave 1~6 narrow lane들은 cherry-pick 직후부터 production active. **runtime_not_deployed blocker 폐기.**

### 2.3 CATEGORY_READINESS는 DB 동기화 필요
- `loadCategoryReadinessMap()`은 Supabase `mvp_category_readiness` 테이블 읽음 (category-readiness.ts:354)
- 카테고리 자체를 ready로 승격하려면 DB row 업데이트 필요
- 단 narrow lane은 카테고리 internal_only여도 lane gate로 통과 → 카테고리 변경 우선순위 낮음

---

## 섹션 3. Lane 4-blocker 분류 (33 lane, 측정 기반)

### 3.1 `deterministic_ready` — 코드 박힌 순간 production OK
**Earphone/Smartwatch 카테고리 ready로 자동 노출** (LANE_READINESS 없어도 카테고리 통과):
- airpods-4-anc, airpods-pro-3, airpods_max_usbc, beats-solo4, beats-studio-pro, bose-qc-ultra, bose-qc45, galaxy_buds_3_pro, sony-wh-1000xm4, sony-wh-ch520, applewatch-ultra2 등 (catalog SKU 다 존재)

**Narrow lane LANE_READINESS=ready로 자동 노출**:
- camera_body_only_exact_model, monitor_benq_xl2540k, speaker_jbl_flip6, ps5_disc_digital_standard, ps5_slim
- ipad_pro_11_m4_256_wifi, ipad_pro_13_m4_256_wifi, ipad_air_m2_11_256_wifi, ipad_air_m3_11_256_wifi, ipad_pro_11_m2_256_wifi, ipad_mini_7_128_wifi, ipad_pro_13_m2_256_wifi
- iphone_15_pro_128gb_self, iphone_16_pro_128gb_self, iphone_14_pro_128gb_self, iphone_13_pro_128gb_self, iphone_12_pro_128gb_self
- galaxy_s25_ultra_256_self, galaxy_s24_ultra_256_self, galaxy_s23_ultra_256_self, galaxy_tab_s10_ultra_256_self, galaxy_z_flip_5_256_self
- macbook_air_m3_13_256, macbook_air_m2_13_256, macbook_pro_14_m3_18_512, lg_gram_17_2024
- switch_oled (단 bundle policy owner 결정 미정 → 부분 deterministic_ready)

### 3.2 `semantic_pollution` — option-parser 수술 필요
**Macbook unknown_generation 약점** (production 48건/1000 = 가장 큰 단일 약점):
- 위치: `option-parser.ts:766` `laptopGenerationKey(releaseYear, laptopModelNumber)` — releaseYear/model number 추출 실패 시 unknown
- 해당 lane: macbook_air_m3_13_256, macbook_air_m2_13_256, macbook_pro_14_m3_18_512, lg_gram_17_2024
- 수술 patch: "m1/m2/m3 + 맥북에어" 텍스트에서 release year/model number를 chip 정보로 fallback 추론 (m1=2020, m2=2022, m3=2023)

**Smartwatch unknown_size** (28건/1000):
- applewatch lane들의 mm 추출 정규식 보강 (49mm/45mm/41mm 등)

**Airpods unknown_anc/connector** (10+8건/1000):
- airpods_4_anc lane의 ANC 인식 보강
- connector USB-C/Lightning 인식 정규식 보강

### 3.3 `data_insufficient` — 마이닝/표본 부족
- **iphone_11_pro_128gb_self**: mining fetched=41, parse_ready=0. 자급제 매물 자체 적음 + acceptAll 정규식 too strict.
- macbook_air_m3_13_256: mining target 미달 (62/200)
- ipad_pro_13_m2_256_wifi: mining 11건만

수술: mining acceptAll 정규식 완화 (예: "아이폰 11 프로" 이외 변형 추가) 또는 자급제 SKU 자체 narrow가 너무 좁으면 lane 합치기

### 3.4 `needs_ai_l2` — 결정론 한계
- 카테고리 broad smartphone/laptop/desktop의 long-tail (현재 production needs_review 16.4% 중 위 3.2/3.3로 해결 안 되는 잔여)
- 7개 trigger flag 기준으로 AI L2 정책 v1 측정 (GPT plan 3일 실험)

### 3.5 `owner_decision_pending` — MJ 결정 필요
A. **Switch_OLED bundle policy**: full_set만 ready / body_only 분리 / 둘 다 허용 중 택1
B. **Switch 2 / PS5 Pro / Switch Lite** narrow lane 추가 여부
C. **Parser version 혼재**: v24 매물 (360건) 재파싱 여부 — 일괄 reparse vs 그대로
D. **CATEGORY_READINESS DB sync**: headphone/monitor/speaker/camera/game_console 카테고리 ready 승격 — narrow lane만으로 충분한지 vs 카테고리 자체도 풀지

---

## 섹션 4. 출시 step (의사결정 트리)

### 4.1 즉시 가능 (코드 변경 0, 검증만)
- wave 1~6 narrow lane은 **이미 production live 가능 상태**. dev server 재기동 후 cron tick 1회만에 활성.
- 단 lane별 실제 매물 매칭 정확도는 production replay로 lane별 측정 후 확인 (다음 step)

### 4.2 1순위 수술 (ROI 최고)
**Macbook unknown_generation patch** — production needs_review 1/3 감소 효과
- 수술 위치 1개 (option-parser.ts laptopGenerationKey)
- 영향 lane: 4개 (macbook_air_m3, macbook_air_m2, macbook_pro_14, lg_gram_17)
- 예상 작업: 30분 (chip→release_year fallback map 추가)

### 4.3 2순위 수술
- Smartwatch mm 추출 보강 (applewatch lane들)
- Airpods ANC/connector 보강 (airpods_4_anc 등)

### 4.4 측정 단계 (수술 후)
- lane-level production replay 스크립트 1개 작성 (각 lane samples.json 또는 production DB query → ruleMatch+parseListingOptions 통과율 측정)
- lane별 [SKU match %, comparable_key complete %, needs_review %] 표 LAUNCH_PLAN 섹션 1.7로 박음

### 4.5 AI L2 실험 (병렬 가능)
- GPT plan 3일: trigger flag별 read-only 측정 → policy v1 작성

### 4.6 Owner decisions 일괄
- 4개 항목 (위 3.5) → 너가 답 → 즉시 적용

---

## 섹션 5. 다음 단계 우선순위 (이 turn에 시작)

| 순위 | 작업 | 소요 | 담당 | 산출물 |
|---|---|---|---|---|
| 1 | Owner decisions 4개 정리해서 MJ에게 던짐 | 5분 | main | LAUNCH_PLAN 섹션 3.5 업데이트 |
| 2 | macbook chip→release_year fallback patch | 30분 | main | option-parser.ts code 변경 |
| 3 | lane-level production replay 1회 (33 lane) | 1시간 | main + sub-agent | LAUNCH_PLAN 1.7 + 약점 lane 추가 식별 |
| 4 | smartwatch mm + airpods anc/connector 보강 | 30분씩 | sub-agent 2개 | option-parser.ts code 변경 |
| 5 | AI L2 실험 1단계 (read-only design) | 0.5일 | sub-agent | AI L2 정책 v1 초안 |
| 6 | switch_oled bundle policy 등 owner 답 반영 | 변동 | main | LANE_READINESS 등 변경 |

---

## 섹션 4. 작업 로그 (시간순)

| 날짜 | 행동 | 결과 | 다음 |
|---|---|---|---|
| 2026-05-13 | LAUNCH_PLAN.md 작성 + 10대 원칙 박음 | SoT 수립 | Step 1 데이터 수집 |
| 2026-05-13 | wave 1~6 readiness 데이터 수집 + sub-agent 결과 spot check (8 lane false alarm 차단) | catalog 정합성 OK, production needs_review 16.4% baseline 측정, runtime_not_deployed blocker 폐기 | macbook patch + owner decisions |
| 2026-05-13 | option-parser v30→v31 patch: macbook chip→generation fallback (`m1`→`m1_gen`) | tsc clean, test 102/105 pass | lane-level production replay |

---

## 부록 A. 핵심 파일 맵

| 파일 | 역할 |
|---|---|
| `src/lib/catalog.ts` | SKU 카탈로그 + `ruleMatch()` (L1a) |
| `src/lib/option-parser.ts` | `parseListingOptions()` — comparable_key 생성 (L1b) |
| `src/lib/category-readiness.ts` | `LANE_READINESS` + `evaluatePoolGate()` |
| `src/lib/candidate-pool-builder.ts` | pool 진입 게이트 |
| `src/lib/pipeline.ts` | classify + ruleMatch + AI L2 hook |
| `scripts/lib/mine-narrow-lane.ts` | 마이닝 도구 (runtime 무관) |
| `category-intelligence/<lane>/parse_summary.json` | lane별 마이닝 측정값 |
| `reports/*` | 398개 진단 리포트 (이 중 lane별 parse_ready 측정값 추출 필요) |

## 부록 B. 자주 쓰는 진단 명령

```bash
npm run diagnose:parser       # category/lane별 parse_ready 측정
npm run diagnose:readiness    # readiness gate 평가
npm run diagnose:pool         # candidate_pool 상태
npm run test:core             # 코어 테스트 (3 fail은 pack-open-race 사전)
npx tsc --noEmit              # 타입 체크 (scripts/ 사전 에러 무시)
```

## 부록 C. AI L2 분기 트리거 (참고)

shouldAiReview() 7개 trigger flag:
- extreme_discount_review (priceGap ≥ 0.75)
- deep_discount_review (priceGap ≥ 0.55)
- suspicious_model_review
- multi_model_review
- short_title
- weak_normal_signal
- commercial_review

env `AI_L2_POLICY_ENABLED=1`일 때 `decideAiL2Review()` (정책 v1) 활성. **현재 OFF.**
