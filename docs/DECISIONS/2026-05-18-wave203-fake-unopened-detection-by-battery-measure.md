# Wave 203 — 셀러 거짓 "미개봉" 자연어 + 배터리 measure 모순 감지

## 사용자 통찰 (decisive)

> "아니 ㅋㅋ 상식적으로 미개봉인데 어떻게 97%인데?? 너가 잘못본거 아니야...??"
> "메타데이터 신뢰도 낮은건 OK, 배터리 효율이나 사이클수가 압도적으로 새거면 달라야하지 않을까??"

→ **진짜 미개봉 = 박스 안 뜯음 = 한 번도 안 켜 = 배터리 % measure 불가능**.

셀러가 "미개봉" + "배터리 97%" 둘 다 박은 매물 = **거짓 미개봉** (모순). 자연어 false positive — 차단해야.

## 진단

매물 pid 408845367:
- description: "**미개봉** 애플워치 SE2 ... **배터리 성능 97%** ... 풀박스"
- parser: `condition_notes: ["new_or_open_box", "full_set"]` ← "미개봉" 자연어 박힘
- `condition_class = "normal"` ← 잘못 박힘 (metadata "사용감 적음" + 자연어 worse-of)

근본 원인:
1. parser 가 description "미개봉" 만 보고 `new_or_open_box` 박음 (객관적 모순 무시)
2. 95~99% 배터리는 `battery_perfect` (100% 만) 신호 미박힘 — 객관적 clean 증거 누락
3. metadata "사용감 적음" (normal) + 자연어 unopened → worse-of policy 로 normal 박힘

## fix (3가지)

### 1. `hasMeasuredUsage` 가드 추가
```ts
const hasMeasuredUsage = (batteryHealth != null && batteryHealth > 0)
  || (cycles != null && cycles > 0);
const explicitNewSignal = !newSignalNegativePattern
  && !hasMeasuredUsage  // ← 신규: 객관적 measure 명시 → 자연어 새상품 신호 무시
  && /미개봉|.../.test(lower);
```

**효과**: 셀러 "미개봉" 자연어 박았어도 배터리 % 또는 사이클 명시되면 → `new_or_open_box` 박지 않음.

### 2. `battery_high_health` 신호 추가 (95~99%)
```ts
if (batteryHealth >= 95 && batteryHealth < 100) {
  add("battery_high_health", 0.05);
}
```

`CLEAN_NOTES` 에 추가 → 객관적 clean 등급 신호.

### 3. `PARSER_VERSION` bump v49 → v50
cron tick 다음 사이클에 잘못 박힌 매물 자동 재처리.

## 효과 (사용자 본 매물에 적용)

```
이전 (Wave 202 이전):
  condition_notes: ["new_or_open_box", "full_set"]
  condition_class: "normal" (metadata worse-of)

Wave 203 후:
  conditionNotes: ["full_set", "battery_high_health"]  ← unopened 자연어 차단 + 객관적 신호 박힘
  condition_class: "clean" ← 객관적 데이터 기반 정확 분류
```

## Regression Test (`tests/wave203-fake-unopened-detection.test.ts`) 8개

- ✅ "배터리 97% + 미개봉" → unopened 차단 + clean (사용자 매물)
- ✅ "배터리 98% + 미개봉" → 동일
- ✅ "미개봉 + 배터리 measure 없음" → unopened 박힘 (진짜 미개봉)
- ✅ "배터리 95~99%" → battery_high_health 박힘
- ✅ "배터리 100%" → battery_perfect (별도 신호)
- ✅ "배터리 90%" → battery_high_health 박지 않음 (임계 아래)
- ✅ "미개봉 + 배터리 X" → unopened 유지 (회귀)

## 비파괴

- parser 함수 로직 변경 — 기존 진짜 미개봉 매물 (배터리 명시 X) 영향 0
- 거짓 미개봉 (배터리 measure 있음) 매물 자연어 신호만 차단
- `battery_high_health` 신호 신규 — CLEAN_NOTES 에 추가, 기존 신호 영향 X
- PARSER_VERSION bump → cron 자동 재처리

## 시세 영향

- 거짓 unopened 박힌 매물 → clean 분류 변경
- mvp_market_price_daily 의 unopened condition sample 정확해짐
- Wave 201 (다나와 reference_price anchor) 도 진짜 unopened 만 사용 → 시세 정확

## Test

`npm run test:core`: **477/477 pass** (0 fail).

## Linked

- Wave 130 (condition별 시세 분리)
- Wave 140 (Bunjang metadata override)
- Wave 178 (unopened vs mint 분리)
- Wave 202 (iPad parser fix)
- Wave 201 (unopened reference_price anchor)
