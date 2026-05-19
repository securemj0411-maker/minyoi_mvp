# Wave 256.1 (2026-05-20) — pid 405343339 condition_class=flawed path 색출 (진단)

## 발단

사용자 매물 검증 — pid 405343339 "아이폰 16프로 네츄럴티타늄 128G":
- description: "메인보드 손상이 있어서 저렴하게 판매합니다. 이외 부분, 기능에는 하자 일절 없습니다."
- 현재 DB: `condition_class=flawed`, `condition_notes=[]`, `condition_score=0.75`, `bunjang_label=null`

**의문**: `condition_notes=[]` 인데 `condition_class=flawed`?

`extractConditionClass([])` 는 "normal" 반환. `resolveConditionClass(null, "normal", false)` 도 "normal" 반환. 그런데 DB 는 "flawed".

→ 다른 경로에서 condition_class 박힘. 어디?

## 진단 — 색출 path

`grep -rn "condition_class.*=.*flawed\|conditionClass.*=.*flawed"` 결과:
- 단 1곳: `tick-pipeline.ts:2974` — `if (conditionClass === "flawed") continue;` (READ, write 아님)

→ direct write X. 그러나 `parsed.conditionClass = aiClass` (override) 경로 존재.

`grep -n "parsed.conditionClass\s*="`:
- `tick-pipeline.ts:1763`: `parsed.conditionClass = aiClass;`

**root path 색출** — `tick-pipeline.ts:1750-1764` Wave 141B condition AI override:
```typescript
const ambiguousCondition = parsed.conditionScore >= 0.55 && parsed.conditionScore <= 0.75;
const hasStrongSignal = parsed.conditionNotes.some((n) =>
  ["new_or_open_box", "display_defect", "screen_replaced", "faceid_issue",
   "water_damage", "parts_only", "low_battery_health"].includes(n));
const bunjangLabelMapped = bunjangLabelToConditionClass(detail.conditionLabel);
if (ambiguousCondition && !hasStrongSignal && bunjangLabelMapped === null) {
  const aiClass = await classifyConditionWithAi(Number(claim.pid), claim.name, detail.description).catch(() => null);
  if (aiClass) {
    parsed.conditionClass = aiClass;  // ← 여기서 flawed 박힘
  }
}
```

## pid 405343339 trace

| 조건 | 값 | 결과 |
|---|---|---|
| `conditionScore >= 0.55 && <= 0.75` | score=0.75 | ✓ ambiguousCondition |
| `!hasStrongSignal` | notes=[] | ✓ (no strong signal) |
| `bunjangLabelMapped === null` | label=null | ✓ |
| **3조건 충족** | | **AI 호출** |
| `classifyConditionWithAi(text)` | "메인보드 손상" 인식 | returns "flawed" |
| `parsed.conditionClass = "flawed"` | override | DB 저장 |

→ **시스템 정상 작동 confirmed**. AI 가 "메인보드 손상" 인식해서 flawed 박음.

## 만약 AI 호출 안 했다면 (counter-factual)

`conditionFromText` regex trace on description:
- `noRepairOrDefect` 정규식 (line 1316): `/하자.{0,20}(?:없|아닙|아님)/`
  - "하자 일절 없습니다" → "하자" + " 일절 " + "없" → `.{0,20}` matches " 일절 " (3 chars) → **MATCH**
  - → `noRepairOrDefect = true`
- `if (!noRepairOrDefect && /수리|교체|하자|고장|불량|파손|깨짐/.test(defectRiskText))` → false
- → `repair_or_defect_signal` **안 박힘**
- conditionNotes = [] → extractConditionClass = "normal"
- → **잘못 normal 분류**

만약 메인보드 손상 매물이 normal 으로 분류되면:
- 사용자에게 깨끗한 매물로 노출
- 시세 비교군에 포함 → 시세 왜곡
- 사용자 구매 후 손상 발견 → 손실

→ Wave 141B AI escalation 이 이 위험 차단함.

## 사용자 인식 차이 (별도 wave)

- 시스템: AI 가 메인보드 손상 인식 → flawed
- 사용자: description "하자 일절 없음" 만 읽음 → 시스템 오류 추정
- root: UI 가 AI reasoning 노출 X → 사용자 검증 불가

→ Wave 256 UI reasoning 노출 wave 후보 (사용자 "몰라 뭔말인지" → 보류).

## systemic 의문 — 다른 비슷 매물?

사용자 매물은 우연히 Wave 141B 의 zone 0.55~0.75 에 들어가서 잡혔음. 다른 매물 패턴:
- "배터리 교체 + 하자 없음" + score 0.80 → 기존 Wave 141B miss
- "침수 + 일체 없음" + score 0.85 → 기존 Wave 141B miss
- positive class (mint/clean) + "메인보드 손상" → 기존 Wave 141B miss

→ Wave 256 implementation (옵션 A~E) 이 systemic 잡음 (별도 log).

## 후속 (별도 wave)

1. Wave 256 implementation 후 — pid 405343339 re-parse 시 `ai_escalation_triggers: ["conflicting_signal"]` 박혀야 함 (옵션 A 발화)
2. 1주 측정 — 옵션 A~E 별 발화 분포
3. UI reasoning 노출 wave (사용자 misperception 차단)
