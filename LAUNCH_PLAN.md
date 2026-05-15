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
고정 숫자 하나로 모든 lane을 밀어붙이지 않는다. `80%` 같은 숫자는 컷오프가 아니라 **계기판**이다. 목표는 **정확성 우선 L1을 최대한 수렴시키고, 한계효용이 낮아지는 지점부터 AI L2/사람 검수로 넘기는 것**이다.

- **A급 closed-set lane**: 공식 스펙/단일 변형/명확한 모델명 기반. false positive 없이 더 올라갈 여지가 있으면 90%대까지도 결정론 보강 가능.
- **B급 structured lane**: 칩/용량/사이즈/커넥터처럼 명시 옵션이 반복적으로 나오는 lane. 동의어/표기 변형/공식 모델코드 보강은 계속 가능하되, RAM/SSD/통신상태 추정은 금지.
- **C급 open-vocabulary lane**: 자급제/구성품/상태/세대가 문맥에 흩어진 lane. 명시 token만 L1로 받고 silent carrier/bundle/full-set 추정은 AI L2 후보화.
- **D급 ambiguity lane**: 세대/구성품/본품 여부가 문맥 추정인 lane. 결정론 patch 최소화, AI L2/사람 검수 우선.

공통 stop rule:
- false positive 위험이 보이면 즉시 revert/보류.
- 표본이 충분한데 patch 1회 후 `needsReviewFalse` 또는 `comparableKeyComplete` 상승폭이 +3~5%p 이하로 둔화되거나, 다음 +1~2%p를 위해 의미 추정/대규모 예외룰이 필요하면 수렴으로 보고 stop.
- 의미 완화로 recall만 올리는 patch는 금지. 남은 recall은 AI L2가 담당.
- 단, 공식 스펙/명시 토큰/동의어/모델코드/확정 negative transfer처럼 정확성을 높이는 보강은 숫자와 무관하게 허용한다.

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
- `catalog.ts`/`option-parser.ts` 동시 편집 금지. 병렬 sub-agent는 read-only 분석과 patch 제안까지만. runtime 파일 patch는 main이 순차 적용한다.
- sub-agent 결과는 lane별 `class(A/B/C/D)`, before/after 기준, false-positive risk, AI L2 이관 조건을 포함해야 한다.

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

### 12a. 정확도 최종 게이트 = production (option-parser + catalog)
Mining lane_config의 정밀 reject는 **학습용**. production에 안 들어감. **정확도 최종 = catalog.ts (mustContain/mustNotContain) + option-parser.ts (parseListingOptions + unknown_X marking).** lane이 production에서 정확하려면 mining lane_config의 정밀 reject patterns이 catalog mustNotContain (또는 option-parser category-scoped reject)로 transfer되어야 함. 이게 핵심 정확도 향상 작업.

### 12b. 정확성 절대 우선 (Precision > Recall) — 가장 중요한 원칙
미뇨이의 핵심 가치 = **정확성**. 사용자에게 "이 매물은 확실히 X SKU"라고 추천하는 게 사업. 따라서:

- **Recall 손해 받아들임.** 결정론으로 70~90% 잡고 stop. 나머지는 AI L2로 보강. **결정론 룰 완화해서 recall 올리는 건 금지.**
- **명시 안 한 매물은 reject가 default.** "자급제 명시 안 함 = mining에서 carrier 부재 = self lane 흡수"는 **금지**. 명시되어야 lane 진입.
- **변형 흡수는 OK** (같은 의미 다른 표현: `"갤럭시z플립5"` vs `"갤럭시 z 플립 5"`). **의미 완화는 금지** (자급제 token 제거 같은).
- **추정 fallback 금지**: chip "m1" → "2020년형" 추정 같은 거. 같은 chip이 여러 연식에 걸쳐 있으면 unknown_generation 유지가 정직.
- **base/default 옵션 추정 금지** (Wave 106 #54 강조): "맥북에어 m3 13" 만 적힌 매물 = base 8GB/256GB 가정 X → unknown_ram/unknown_ssd 유지 → 풀 진입 X.
  - 예외: **"기본형/깡통/노옵션/베이스 모델/base model" 명시 매물만** default 매핑 OK (사용자가 base 의도 명시).
  - 옛 코드 (`defaultLaptopMemory` option-parser.ts:880) 이미 `baseSignal` regex 검증 후만 default 적용 — 정상.
  - 사유: 사용자가 "M3 16GB 256GB" 매물 (base 아님) 을 base 가정으로 분류하면 잘못된 시세 비교. recall 손해 받아들임.
- 70~90% 도달 후 추가 lift는 **AI L2 또는 사람 검수**가 담당. 결정론 튜닝 무한루프 진입 금지.
- 매 patch 후 "정확도 risk 있나?" 자문. risk 있으면 revert.

### 12c. Mining → Production transfer 원칙
마이닝은 더 긁는 것만으로 production 정확도를 올리지 않는다. `lane_config.json`의 정밀 패턴은 아래 4개로 분류한 뒤 production에 옮긴다.

| mining 패턴 유형 | production 목적지 | 예시 | 주의 |
|---|---|---|---|
| 확정 negative | `catalog.ts` `mustNotContain` | `케이스만`, `이어패드 단품`, `삽니다`, `고장` | 단어 하나가 아니라 단독/판매 문맥까지 포함 |
| 카테고리 문맥 negative | `pipeline.ts`/`option-parser.ts` category-scoped noise | accessory/pouch/cable/parts | 본품에 포함된 구성품 문맥은 살림 |
| 옵션 추출 누락 | `option-parser.ts` | AirPods Pro 3 = USB-C only, M1/M2/M3 chip key | 공식/명시 정보만. 추정 fallback 금지 |
| 애매한 문맥 | AI L2 trigger 또는 manual review | 자급제 추정, full-set/body-only 추정, 세대 추정 | 결정론으로 recall 올리지 않음 |

sub-agent는 patch 전에 반드시 이 표로 transfer destination을 명시한다.

### 13. MVP 출시 목표 (흔들지 말 것)
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

### 1.6a Lane-level production replay (15,607 samples × 50 lane, 2026-05-13 측정)
**측정 명령**: `npx tsx scripts/lane-replay-readiness.ts` (mining samples → ruleMatch + parseListingOptions)

**해석 주의**: earphone/smartwatch lane은 catalog SKU에 laneKey 미박 (카테고리 ready로 노출) → `laneMatchPct=0`이 정상. 진짜 봐야 할 것 = `skuMatchPct` (catalog 매칭율) + `unknownPartsPct` (parser 정밀도).

#### A등급 (skuMatch 80%+) — 7 lane
applewatch_ultra_2 (93.8%), sony_wh1000xm4 (94.7%), switch_oled (93.4%), airpods_pro_3 (95.3% — 단 unknown 82%!), airpods (80.6%), beats_studio_pro (81.6%)

#### B등급 (50~80%) — 9 lane
macbook_air_m2 (51%), macbook_air_m3 (52%), ipad_air_m2 (67%), ipad_air_m3 (68%), ipad_pro_11_m2 (60%), ipad_pro_13_m4 (51%), galaxy_tab_s10 (55%), ps5_slim (63%), bose_qc_ultra (56%)

#### C등급 (20~50%) — 11 lane
iphone_12~16_pro_128gb_self (27~48%), galaxy_s23~24 (32~40%), bose_qc45 (39%), ipad_mini_7 (34%), ipad_pro_13_m2 (35%), ipad_pro_11_m4 (43%), macbook_pro_14_m3 (33%)

#### D등급 (<20%) — 5 lane: 거의 죽은 lane (catalog mustContain too strict)
- **airpods_4_anc**: 319 samples 중 4건만 SKU match (1.3%)
- **galaxy_z_flip_5_256_self**: 568 중 2건 (0.4%)
- **lg_gram_17_2024**: 305 중 15건 (4.9%)
- **iphone_11_pro_128gb_self**: 41 중 5건 (12.2%) + data 부족
- **galaxy_s25_ultra_256_self**: 549 중 92건 (16.8%)

#### Unknown 약점
- **airpods_pro_3: 82% unknown_X** (parser 1순위 수술)
- macbook_air_m2/m3: 15% (v31 patch 후 측정 — 추가 보강 필요)
- ipad_air_m3: 13%, ipad_pro_13_m4: 10%

### 1.6b 우선순위 재정렬 (측정 기반)
| 순위 | 작업 | 효과 |
|---|---|---|
| 🔥 1 | D등급 4 lane catalog mustContain 완화 (airpods_4_anc, galaxy_z_flip_5, lg_gram_17, galaxy_s25_ultra) | D → C/B (4 lane 살림) |
| 🔥 2 | iphone/galaxy 자급제 carrier mustNotContain 완화 (C등급 11 lane) | C → B |
| 🔥 3 | airpods_pro_3 unknown_X parser 수술 | 82% → <10% |
| 4 | macbook unknown v32 추가 보강 | 15% → 5% |
| 5 | bose_qc45 vs bose_qc_ultra SKU 충돌 정리 | bose_qc45 39% → 70%+ |
| 6 | iphone_11_pro / macbook_air_m3 mining 보강 (data 부족) | sample 수 ↑ |

### 1.6c 최신 replay snapshot (2026-05-13, ceiling 정책 수정 직후)
**측정 명령**: `npx tsx scripts/lane-replay-readiness.ts`

해석 주의:
- `laneMatchPct=0`인 earphone/smartwatch 상당수는 SKU에 `laneKey`가 없고 카테고리 ready로 노출되는 구조라서, `skuMatchPct`와 `comparableKeyCompletePct`를 우선 본다.
- `needsReviewFalsePct=0`인 game-console 일부는 parser policy상 review gate를 유지하는 설계일 수 있어, 단독 실패 지표로 보지 않는다.

| 상태 | lane | 최신 수치 | 판단 |
|---|---|---|---|
| 결정론 L1 강함 | `airpods_4_anc` | sku 100 / complete 100 / needsReviewFalse 100 | A급 closed-set. stop 가능 |
| 결정론 L1 강함 | `airpods_pro_3` | sku 100 / complete 100 / needsReviewFalse 100 | 공식 USB-C only patch 성공. stop 가능 |
| 결정론 L1 강함 | `sony_wh1000xm4`, `sony_wh_ch520` | sku 98 / complete 98 | A급. accessory false-positive만 감시 |
| 결정론 L1 강함 | `beats_solo_4`, `beats_studio_pro` | sku 100 / complete 100 | 표본은 작지만 closed-set. 추가 마이닝보다 leak 감시 |
| 결정론 L1 준수 | `airpods_max_usbc` | sku 100 / complete 100 / needsReviewFalse 92.5 | A급. stop 가능 |
| 결정론 L1 준수 | `galaxy_buds_3_pro` | sku 87.5 / complete 87.5 | A급 하한 통과. parts/full-set leak 감시 |
| AI L2 후보 | `galaxy_z_flip_5_256_self` | sku 7.5 / complete 7.5 | 자급제 미명시 recall은 AI L2. 결정론 완화 금지 |
| patch 후보 | `bose_qc45` | sku 24.4 / complete 24.4 | QC Ultra/QC45/pouch 경계 분석 후 정밀 patch |
| patch/AI 경계 | `macbook_air_m2_13_256`, `macbook_air_m3_13_256`, `macbook_pro_14_m3_18_512` | complete 14.1 / 12.9 / 0 | 명시 chip/RAM/SSD/size만 deterministic, 구성/연식 추정은 AI L2 |
| data_insufficient | `lg_gram_17_2024`, `ipad_pro_13_m2_256_wifi`, `iphone_12/13/16_pro_128gb_self` 일부 | total 3~56 수준 | 더 patch하기 전 표본/마이닝 재검토 |
| broad는 AI L2 | `smartphone`, `laptop`, `speaker_audio_discovered`, `home_appliance_tech_discovered` | complete 8~10 / 10 / 3.8 / 0 | broad category 결정론 100% 금지. exact lane만 추출 |

다음 기준:
1. A급 closed-set은 추가 결정론 patch 금지. leak 발견 시 negative guard만 보강.
2. B/C급 structured lane은 sub-agent read-only 분석 후 main이 순차 patch.
3. 자급제/세대/구성품처럼 문맥 추정인 recall은 AI L2 후보로 남긴다.

### 1.6d Sub-agent ceiling triage 합산 (2026-05-13)

병렬 read-only 분석 결과, 세 그룹 모두 같은 결론이다: **파서가 아예 없는 게 아니라 broad SKU/exact lane 충돌, 표본 부족, 문맥 추정 영역이 결정론 ceiling을 누르고 있다.**

| 그룹 | 결정론으로 더 할 수 있는 것 | AI L2/보류로 넘길 것 | 다음 행동 |
|---|---|---|---|
| Tablet/iPad | broad `ipad-pro/air/mini`와 exact lane 충돌 해소. 명시 wrong chip/size/storage/cellular reject는 safe. | `케이스/필름/펜슬/키보드 포함` 같은 구성품 문맥. `만/단품/별도판매` 없으면 AI/review. | narrow 우선순위 설계 먼저. patch는 `ipad_air_m3`처럼 표본 작지만 target-in-multi 높은 lane 1개만 실험 |
| Laptop/MacBook | `macbook_air_m2_13_256`만 1회 catalog 충돌/명시옵션 patch 후보. exact lane이 broad `macbook-air/pro`와 충돌하지 않게 한다. | M3/Pro14/LG Gram은 표본 부족/오염 큼. 연식 추정, RAM 완화, LG Gram 세대 추정 금지. | M2 Air만 순차 patch 후보. M3/Pro14/LG Gram은 마이닝/AI L2 |
| Headphone/Speaker | Sony XM4/CH520, Beats, QC Ultra는 이미 89~100%라 stop. leak 감시만. | QC45는 broad/duplicate 충돌 + pouch/accessory 위험. Speaker broad는 exact model-code 외 promotion 금지. | QC45 duplicate 충돌은 분석만. broad speaker는 AI L2/사람 검수 |

#### 새 blocker 유형: broad-vs-narrow SKU collision
`ruleMatch()`는 후보가 2개 이상이면 `null`을 반환한다. Tablet/Laptop에서 broad SKU와 exact lane SKU가 동시에 매칭되어 actual target lane이 묻히는 케이스가 반복 확인됐다.

처리 원칙:
1. exact lane의 명시 옵션이 모두 보일 때만 exact lane 우선.
2. broad SKU는 exact lane의 명시 조합을 방해하지 않게 조정.
3. 우선순위 해소가 false positive를 늘리면 즉시 보류하고 AI L2로 넘김.
4. 이 문제는 `mustNotContain` 대량 추가보다 **SKU disambiguation 설계**가 먼저다.

#### 현재 실제 patch 후보
1. `macbook_air_m2_13_256`: catalog 충돌 해소 + 명시 상위옵션 reject. 목표 `complete/needsReviewFalse >= 70%`, FP spot-check 0.
2. iPad exact lane 1개: broad-vs-narrow disambiguation prototype. 단 구성품 포함 문구는 reject 금지, AI/review trigger.
3. QC45: duplicate SKU 충돌 분석 후 보류 가능성이 큼. "헤드폰/헤드셋/headphone" 문맥 없는 QC45는 AI L2.

#### 현재 AI L2 후보
- `galaxy_z_flip_5_256_self`: 자급제 미명시 recall.
- iPhone/Galaxy 자급제 broad recall.
- Apple Watch Series/SE 세대 문맥.
- MacBook Pro14/LG Gram 연식/구성 추정.
- Broad speaker/home appliance/desktop discovery.

### 1.6e 첫 exact-vs-broad disambiguation patch 결과 (2026-05-13)

**적용 범위**: `ruleMatch()`에서 broad SKU와 exact lane SKU가 같이 매칭될 때, `laptop`/`tablet`에 한해서 exact lane 후보가 정확히 1개면 그 lane을 선택한다.  
**의도적 제한**: headphone/speaker에는 적용하지 않는다. 초안에서 전체 lane category에 적용했을 때 `bose_qc45`가 24.4% → 100%로 튀어 pouch/accessory false-positive 위험이 커졌기 때문이다.

**측정 명령**: `npx tsx scripts/lane-replay-readiness.ts`

| lane | before | after | 판단 |
|---|---:|---:|---|
| `macbook_air_m2_13_256` | complete 14.1 / needsReviewFalse 14.1 | precision pass 후 complete 64.6 / needsReviewFalse 64.6 | B/C 경계. wrong storage/RAM/accessory/buy/trade를 제거해 recall보다 precision을 선택. 여기서 결정론 stop, 나머지는 AI L2/review |
| `macbook_air_m3_13_256` | complete 12.9 | complete 51.6 | 개선은 있으나 ceiling 미달. 표본/오염 확인 전 추가 완화 금지 |
| `macbook_pro_14_m3_18_512` | complete 0 | complete 4.4 | laneMatch는 오르지만 옵션 complete가 낮음. 결정론 추가 수술보다 AI L2/hold |
| `ipad_air_m3_11_256_wifi` | 낮은 exact lane match | complete 75.0 | stricter combined veto 후에도 유지 가능. 표본 작아 AI/review 병행 |
| `ipad_pro_13_m4_256_wifi` | 낮은 exact lane match | complete 60.7 | strict precision 기준에서는 구성품/셀룰러/description 오염이 많음. 바로 공개보다 AI/review |
| `ipad_mini_7_128_wifi` | 낮은 exact lane match / screen unknown | 128GB 명시 + 8.3in default 후 complete 51.5 | option-parser gap 일부 해결. storage/connectivity/bundle ambiguity는 AI L2/review |
| `bose_qc45` | complete 24.4 | complete 24.4 | 의도적으로 미변경. headphone broad/lane disambiguation은 unsafe |

다음 결정:
1. `macbook_air_m2_13_256`은 precision-only pass까지 완료. rejected row exact hit가 53→5로 내려갔으므로 결정론 patch를 stop한다.
2. iPad exact lane은 disambiguation은 유지하되, `케이스/펜슬/키보드 포함`과 cellular/Wi-Fi ambiguity는 AI/review trigger로 넘긴다.
3. MacBook Pro14/M3/LG Gram, QC45, 자급제 broad recall은 AI L2 후보로 넘긴다.
4. 같은 disambiguation을 전체 category로 넓히지 않는다. category별 false-positive profile이 다르다.

### 1.7 미해결 owner decision 항목
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

### 2.4 AI L2 cache FK는 runtime bridge 전에 재검토 필요
- `mvp_listing_ai_classifications.pid`는 현재 `mvp_listings(pid)`를 FK로 참조한다.
- `parsed.needs_review=true` row는 `scoreStage`에서 AI 호출 전에 skip되므로 `mvp_listings`에 없을 수 있다.
- 따라서 needs_review escrow를 켜기 전에 AI cache FK를 `mvp_raw_listings(pid)`로 옮기는 migration 또는 동등한 cache fix가 필요하다.
- 단 `mvp_raw_listings`는 범위가 넓어 cache 폭증 risk가 있으므로 `aiReviewTopN`, tiny cap, content_hash cache, retention/비용 리포트가 함께 필요하다.

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
`report:ai-l2-parser-gap-routing` 기준 needs_more_mining 5개:

| lane | total | 상태 | 다음 |
|---|---:|---|---|
| `beats_solo_4` | 15 | complete 100%, 표본만 부족 | 30~50건까지 보강 후 leak 감시 |
| `ipad_pro_13_m2_256_wifi` | 11 | complete 72.7%, 표본 부족 | 13/M2/256/Wi-Fi query 변형 보강 |
| `iphone_12_pro_128gb_self` | 3 | 자급제 표본 부족 | AI L2 후보 유지, 자급제 명시 query만 보강 |
| `iphone_13_pro_128gb_self` | 6 | 자급제 표본 부족 | AI L2 후보 유지, 자급제 명시 query만 보강 |
| `lg_gram_17_2024` | 5 | unknown option + 표본 부족 | 17인치/2024/그램 query 보강, 추정 fallback 금지 |

수술: mining acceptAll 정규식 완화가 아니라, **정확한 query 변형 추가 + read-only sample 보강**이 우선. 자급제/연식 추정은 AI L2로 넘긴다.

#### 3.3a needs_more_mining lane 재진단 (2026-05-13)

**산출물**: `reports/needs-more-mining-lanes-latest.md/json`  
**명령**: `npm run report:needs-more-mining-lanes`

| lane | class | 판단 | 다음 |
|---|---|---|---|
| `beats_solo_4` | closed_set_shallow | parse-ready 15건이지만 replay complete 100%. parser patch 금지. | 기존 non-AirPods live/search report에서 30~50건으로 backfill하거나 tiny no-write acquisition. leak 감시만 |
| `ipad_pro_13_m2_256_wifi` | structured_more_mining | replay complete 72.7%. M2/6세대 + 12.9/13 + 256 + Wi-Fi가 명시되어야 함. | `12.9 6세대 256 wifi`, `m2 256 와이파이` query 보강. cellular/구성품 ambiguity는 AI/review |
| `iphone_12_pro_128gb_self` | ai_l2_primary | 자급제 명시 parse-ready 3건뿐. silent carrier 상태는 결정론으로 추정 금지. | 명시 자급제/공기계/정상해지만 L1, 나머지는 AI L2 |
| `iphone_13_pro_128gb_self` | ai_l2_primary | iPhone 12 Pro와 동일. 표본 보강은 평가용이지 결정론 recall ceiling 해결책 아님. | 명시 자급제만 L1, 나머지는 AI L2 |
| `lg_gram_17_2024` | query_precision_problem | 현재 query가 LG 세탁기/가전과 wrong-size Gram을 대량 유입. parser patch 전에 query precision 문제. | `그램 17 노트북 2024`, `17인치 노트북 2024`, `16gb 512` 등 노트북 문맥 query로 재마이닝 |

결정: `needs_more_mining`을 하나로 묶지 않는다. Beats는 shallow-but-clean, iPad는 structured mining, iPhone 자급제는 AI L2 primary, LG Gram은 query precision problem으로 분리한다.

### 3.4 `needs_ai_l2` — 결정론 한계
- `report:ai-l2-parser-gap-routing` 최신 결과: needs_ai_l2 30 lane.
- 대표 사유:
  - `self_unlocked_ambiguity`: iPhone/Galaxy 자급제 미명시
  - `connectivity_ambiguity`: iPad/Galaxy Tab Wi-Fi/Cellular
  - `generation_ambiguity`: Apple Watch/Galaxy Watch 세대
  - `bundle_or_accessory_ambiguity`: speaker/home appliance/camera/desktop broad
  - `parser_unknown_option`: MacBook RAM/SSD/chip/screen, QC45, monitor/game_console broad
- 정책: 결정론 token을 약화해 recall을 올리지 않는다. AI L2는 escrow reviewer이며, 모델 identity를 rescue하지 않는다.

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
**AI L2 metadata bridge, DDL 없음** — 후보팩 behavior 변화 없이 AI가 판단에 필요한 parser context를 받게 한다.
- `PipelineRow` optional parser metadata 추가
- AI prompt에 `comparableKey`, `parseConfidence`, `parserUnknownParts`, `parserCriticalUnknown`, `parserNeedsReview` 포함
- 단 `needs_review=true` row를 아직 scoreStage에서 살리지 않는다.
- pool behavior 변화 0.

### 4.3 2순위 수술
- `report:ai-second-opinion-impact`에 parser-gap flag별 dry-run count 추가
- AI cache FK migration review-only 작성
  - `mvp_listing_ai_classifications(pid)` → `mvp_raw_listings(pid)` 검토
  - 폭증 risk / 기존 `mvp_listings` 의존 코드 영향 평가 포함

### 4.4 측정 단계 (수술 후)
- lane-level production replay 스크립트 1개 작성 (각 lane samples.json 또는 production DB query → ruleMatch+parseListingOptions 통과율 측정)
- lane별 [SKU match %, comparable_key complete %, needs_review %] 표 LAUNCH_PLAN 섹션 1.7로 박음
- AI L2 bridge는 `aiReviewRequested`, `aiApiCalls`, `aiCacheHits`, `aiFiltered`, `aiKeptLowConfidence`, candidate_pool ready count를 같이 본다.

### 4.5 AI L2 실험 (병렬 가능)
- Phase 1은 metadata-only.
- Phase 2는 FK/cache fix 승인 후 `needs_review` escrow tiny cap.
- Phase 3에서만 AI 결과의 parser write-back을 검토한다. AI pass 단독 public promotion은 금지.

#### 4.5a Parser-gap dry-run (2026-05-13)

**산출물**: `reports/ai-l2-parser-gap-dry-run-latest.md/json`  
**명령**: `npm run report:ai-l2-parser-gap-dry-run`

| Metric | Value |
|---|---:|
| parsed rows | 15,378 |
| parser-gap rows | 8,642 |
| needs_review rows | 7,881 |
| needs_review missing from listings | 6,136 |
| existing AI cache rows | 387 |
| parser-gap rows already cached | 96 |
| parser-gap cache hit | 1.1% |
| tiny cap dry-run calls | 100 |
| estimated tiny-cap cost | $0.0648 |

Top reasons:
- `option_needs_review`: 6,036
- `parser_critical_unknown`: 1,845
- `connectivity_ambiguity`: 751
- `parser_unknown_option`: 10

결정:
- broad AI L2 enable은 금지. parser-gap 모집단이 너무 커서 호출/캐시 write가 통제되지 않는다.
- 비용 자체는 tiny cap 기준 낮다. 병목은 비용보다 FK/cache와 public-pool hard block이다.
- 다음은 FK migration 승인 전까지 `tiny cap + no public release + pool block 유지` 형태의 escrow 설계만 진행한다.

#### 4.5b Tiny escrow candidate selector (2026-05-13)

**산출물**: `reports/ai-l2-tiny-escrow-candidates-latest.md/json`  
**명령**: `npm run report:ai-l2-tiny-escrow-candidates`

| Metric | Value |
|---|---:|
| needsReview parsed rows | 7,886 |
| raw done normal rows | 9,270 |
| eligible escrow rows | 1,553 |
| selected tiny-cap rows | 100 |

Eligible category mix:
- laptop: 770
- tablet: 306
- earphone: 217
- smartphone: 146
- smartwatch: 114

Eligible reason mix:
- `parser_critical_unknown`: 1,545
- `option_needs_review`: 8

결정:
- runtime으로 바로 진행하지 않는다. FK migration 승인이 blocker다.
- tiny-cap 후보는 “AI가 후보팩에 공개해도 된다고 판단”하는 용도가 아니라, missing option evidence를 찾아 parser/backfill로 되돌리는 escrow 용도다.
- Phase 1b 조건: FK raw migration + tiny cap + pool block 유지 + AI pass 단독 public release 금지.

### 4.6 Owner decisions 일괄
- 4개 항목 (위 3.5) → 너가 답 → 즉시 적용

---

## 섹션 5. 다음 단계 우선순위 (이 turn에 시작)

| 순위 | 작업 | 소요 | 담당 | 산출물 |
|---|---|---|---|---|
| 1 | AI L2 후보 목록 확정 | 30분 | main | `galaxy_z_flip_5`, iPhone/Galaxy 자급제, Apple Watch Series/SE, MacBook Pro14/LG Gram, QC45, tablet bundle/cellular |
| 2 | iPad exact lane mining contract 정리 | 30분 | main/sub-agent read-only | `ipad_pro_11_m4` positive set에 11인치 근거 요구 |
| 3 | AI L2 trigger v1 설계 | 45분 | main | 자급제/구성품/세대/옵션 unknown trigger + cache key |
| 4 | QC45 duplicate 충돌 추가 분석 | 20분 | main/sub-agent read-only | patch 금지 또는 AI L2 trigger 확정 |
| 5 | data-insufficient lane 마이닝 재시도 범위 결정 | 30분 | sub-agent read-only | `lg_gram_17`, iPad M2, iPhone 11/12/13/16 sample 보강 여부 |
| 6 | owner decisions 4개 정리 | 10분 | main | switch/home-appliance/game-console/reparse 정책 질문 묶음 |

---

## 섹션 4. 작업 로그 (시간순)

| 날짜 | 행동 | 결과 | 다음 |
|---|---|---|---|
| 2026-05-13 | LAUNCH_PLAN.md 작성 + 10대 원칙 박음 | SoT 수립 | Step 1 데이터 수집 |
| 2026-05-13 | wave 1~6 readiness 데이터 수집 + sub-agent 결과 spot check (8 lane false alarm 차단) | catalog 정합성 OK, production needs_review 16.4% baseline 측정, runtime_not_deployed blocker 폐기 | macbook patch + owner decisions |
| 2026-05-13 | option-parser v30→v31 patch: macbook chip→generation fallback (`m1`→`m1_gen`) | tsc clean, test 102/105 pass | lane-level production replay |
| 2026-05-13 | `scripts/lane-replay-readiness.ts` 작성 + 50 lane × 15,607 samples 측정 | D등급 5 lane 발견 (airpods_4_anc/galaxy_z_flip_5/lg_gram_17/iphone_11_pro/galaxy_s25 — skuMatch <20%). airpods_pro_3 unknown 82% 발견. 우선순위 재정렬 | D등급 lane catalog mustContain 완화 수술 |
| 2026-05-13 | parse_ready=true subset filter 추가 + 재측정 | 진짜 catalog 매칭 정밀도 측정. 동시에 D등급 일괄 patch 시도 (자급제 group 제거) → iphone 50% → 19% **하락**. broader SKU 충돌 확인. revert. | lane별 신중히 patch |
| 2026-05-13 | galaxy_z_flip_5 단일 lane patch (broader SKU 없는 lane이라 자급제 group 제거 안전 + 매물 변형 흡수) | **0% → 75%** (120 samples). 함정 발견: 일괄 patch 금지, lane별 broader SKU 충돌 확인 후 진행 | self vs broader 격리 정책 결정 + 다른 약점 lane |
| 2026-05-13 | 사용자 정책 확정: **정확성 절대 우선 (Precision > Recall)**. galaxy_z_flip_5 patch 정정 — 자급제 group 복원 (75% → 7.5%, 정확한 자급제 매물만). 나머지는 AI L2 영역. 원칙 12 추가. | **방향 확정**: 결정론 70~90% ceiling, AI L2로 broad fallback. recall 향상 위한 의미 완화 금지. 변형 흡수만 OK. | parser/catalog 정확성 patch (deterministic info 추가) |
| 2026-05-13 | airpods_pro_3 parser patch: `defaultAirpodsConnector`에 airpods_pro_3 → "usbc" 추가 (Apple 공식 USB-C only) | **4% → 100% complete**. unknown_connector 96% → 0%. 1 lane 완벽 정확. | catalog mustContain 변형 흡수 |
| 2026-05-13 | airpods_4_anc patch: catalog mustContain[1]에 "에어팟4/airpods4" 변형 추가 + broader `airpods-4` SKU에 mustNotContain "anc" 추가 (lane vs broader 격리) | **0.8% → 100% complete**. broader airpods 80→83.6% 동시 향상. 2 lane 완벽 정확. 전체 평균 complete 38.8% → 43.4% | 다음 약점 lane (lg_gram_17, bose_qc45, macbook m2/m3 등) |
| 2026-05-13 | 결정론 ceiling 정책 수정 + tablet/laptop/headphone 병렬 read-only triage | 고정 80/95% 목표 폐기. lane class별 ceiling, marginal gain stop, broad-vs-narrow SKU collision blocker 추가. A급 closed-set은 stop, `macbook_air_m2`와 iPad 1개만 순차 patch 후보. | `macbook_air_m2_13_256` exact-vs-broad 충돌 1회 patch |
| 2026-05-13 | `ruleMatch()` exact-vs-broad disambiguation을 laptop/tablet에만 적용 | `macbook_air_m2_13_256` complete 14.1→72.2, `ipad_pro_13_m4_256_wifi` complete 94.6. headphone 적용은 QC45 false-positive 위험으로 제외. | M2 Air/iPad FP spot-check 후 AI L2 후보 정리 |
| 2026-05-13 | M2 Air/iPad FP spot-check 반영: laptop/tablet lane은 title hit 후 combined mustNot veto, M2 Air는 8GB/기본형 명시 요구, iPad mini 7은 128GB 명시 + 8.3in default | M2 Air rejected exact hit 53→5, complete 64.6. iPad mini 7 complete 51.5. 정확성 우선으로 recall 하락 수용. | 결정론 stop, AI L2 trigger 설계로 이동 |
| 2026-05-13 | AI L2 parser-gap routing report 추가 + 정책 flag vocabulary 확장 | `reports/ai-l2-parser-gap-routing-latest.md`: deterministic_ready_stop 7, precision_stop 5, needs_ai_l2 30, owner/manual 3, mining 5. 정책에는 self/unlocked, bundle/accessory, generation, connectivity, parser unknown flag를 추가. 해당 flag는 pool-policy blocklist에도 추가해 AI가 꺼져도 공개되지 않게 함. | 실제 runtime bridge는 별도 수술. 현재 `needs_review` row는 scoreStage에서 AI 전 skip되며 pool-policy도 차단하므로 report-only로 유지 |
| 2026-05-13 | AI L2 runtime bridge 설계 작성 | `reports/ai-l2-runtime-bridge-design-latest.md` 추가. 중요한 발견: `mvp_listing_ai_classifications`가 `mvp_listings(pid)`를 FK로 참조해서 신규 `needs_review` row는 AI cache가 실패할 수 있음. 추천은 FK를 `mvp_raw_listings(pid)`로 바꾸는 migration 후 escrow inclusion. | 다음은 DDL 없이 `PipelineRow` parser metadata + AI prompt 확장부터. `needs_review` rescue runtime은 FK/캐시 설계 승인 전 보류 |
| 2026-05-14 | overnight phase 1: 5 lane needs_more_mining 진단 | beats_solo_4→(a)가격상한완화+Jennie query, lg_gram_17_2024→(a)acceptAll패턴수정, ipad_pro_13_m2/iphone12/13→(b)AI L2 후보. 산출물: OVERNIGHT_PHASE1_MINING_DIAGNOSIS.md | beats_solo_4 price ceiling 280k→400k 실제 적용 (MJ 승인 후) |
| 2026-05-14 | overnight phase 2: 50 lane replay 측정 + board | A급 10 lane (100%→87.5%), B급 14, C급 8, D급 18. GPT 라우팅 30개 중 27개 일치, bose_qc_ultra/galaxy_buds_3_pro A급 상향. macbook_pro_14 unknown 95.6% 긴급 진단. 산출물: OVERNIGHT_PHASE2_LANE_BOARD.md + reports/lane-replay-overnight-20260514.json | AI L2 cost 시뮬 (Phase 3) |
| 2026-05-14 | overnight phase 3: AI L2 cost 시뮬레이션 | aiReviewTopN=1000 Haiku: 월 $0.13 (70% 캐시). aiReviewTopN=5000 Haiku: $0.63. Sonnet 10% escalation 포함 시 최대 $0.88. 팩 1팩($1.09) 대비 AI 비용 0.018%. 산출물: OVERNIGHT_PHASE3_AI_L2_COST.md | SESSION_HANDOFF 작성 (Phase 4) |

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

기존 shouldAiReview() 기본 trigger flag:
- extreme_discount_review (priceGap ≥ 0.75)
- deep_discount_review (priceGap ≥ 0.55)
- suspicious_model_review
- multi_model_review
- short_title
- weak_normal_signal
- commercial_review

parser-gap 확장 vocabulary:
- option_parse_review
- option_needs_review
- parser_unknown_option
- market_stat_missing / market_confidence_low
- self_unlocked_ambiguity
- bundle_or_accessory_ambiguity
- generation_ambiguity
- connectivity_ambiguity

env `AI_L2_POLICY_ENABLED=1`일 때 `decideAiL2Review()` (정책 v1) 활성. **현재 OFF.**

주의: 현재 tick `scoreStage`는 `parsed.needs_review=true` row를 AI 호출 전에 skip한다. 따라서 위 parser-gap vocabulary는 정책/리포트 준비 단계이며, 실제 후보팩 rescue를 하려면 다음 수술에서
1) AI L2 대상 row를 제한적으로 scoreStage까지 올리고,
2) AI pass가 아닌 경우 pool 진입을 계속 차단하며,
3) `option_needs_review`/`needs_review`를 AI가 무조건 통과시키지 못하게 hard hold 기본값을 유지해야 한다.
