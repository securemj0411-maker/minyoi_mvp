# Wave 256 (2026-05-20) — AI 보수적 escalation 전면 재검토 (사용자 정책 변경)

## 발단

사용자 매물 검증 — pid 405343339 "아이폰 16프로 네츄럴티타늄 128G":
- description: "메인보드 손상이 있어서 저렴하게 판매합니다.\n이외 부분, 기능에는 하자 일절 없습니다."
- 시스템 결과: condition_class=`flawed`, condition_notes=`[]`, condition_score=0.75
- 사용자 인식: "하자 일절 없음" 명시인데 훼손 처리 → 시스템 오류라 추정

사용자 핵심 요청 (literal):
> "AI를 우리 최대한 아끼는 비용말고 최대한 보수적으로? 우리가 정한거보다 보수적으로 AI를 많이 호출해야될거같은데? 그니까 보수적이란 말은 적게 쓰자는말이 아니라 오히려 겁쟁이 모드로 혹시 이거 틀릴수잇어 이런 느낌으로. 이건 전면적 재검토가 필요할거같은데"

## 진단 결과 — 이 매물은 정상 처리 (AI 정확 작동)

`tick-pipeline.ts:1750-1764` Wave 141B AI escalation logic:

```typescript
const ambiguousCondition = parsed.conditionScore >= 0.55 && parsed.conditionScore <= 0.75;
const hasStrongSignal = parsed.conditionNotes.some(n => 
  ["new_or_open_box", "display_defect", ...].includes(n));
const bunjangLabelMapped = bunjangLabelToConditionClass(detail.conditionLabel);
if (ambiguousCondition && !hasStrongSignal && bunjangLabelMapped === null) {
  const aiClass = await classifyConditionWithAi(...);
  if (aiClass) parsed.conditionClass = aiClass; // ← 여기서 flawed 박힘
}
```

pid 405343339 trace:
- conditionScore=0.75 → `ambiguousCondition` ✓
- conditionNotes=[] → `hasStrongSignal` false
- bunjangLabel=null → `bunjangLabelMapped` null
- → **3조건 충족 → AI 호출 → AI 가 "메인보드 손상" 잡음 → flawed**

만약 regex 만 의존했다면 — `noRepairOrDefect` 의 negation regex `/하자.{0,20}없/` 이 "하자 일절 없습니다" 매치 → `repair_or_defect_signal` 안 박힘 → **normal 잘못 분류 가능했음** (사용자 실제 우려 정확). 현재 AI escalation 가 이 케이스 잡아냄.

## 사용자 UI 인식 차이 (별도 wave 후보)

- 시스템: AI 가 "메인보드 손상" 인식 → flawed
- 사용자: description "하자 일절 없음" 만 봤음 → 시스템 오류 추정
- root: AI 판정 reasoning UI 노출 X → 사용자 검증 불가

## 현재 AI escalation 정책 inventory

### 1. Wave 141B condition AI override (tick-pipeline.ts:1750)
- trigger: `0.55 ≤ score ≤ 0.75` + `!hasStrongSignal` + `bunjangLabel null`
- 비용: ~$9/월 (측정 시점)
- 효과: 이번 매물 처럼 모호 zone 잘 잡음

### 2. AI L2 review (ai-l2-policy.ts)
- trigger: priceGap ≥ 0.55 / suspicious_model_review / extreme_discount / weak_normal / open-set category
- 환경 게이트: `AI_L2_POLICY_ENABLED=1`
- 비용: aiL2ShadowAudit 측정 — 매 tick 1-2 aiApiCalls
- 효과: 시세 비교 단계 AI 검토

### 3. AI L2 shadow audit (ai-l2-shadow-audit.ts Wave 238)
- 현재: audited=0 매 tick (candidates=0)
- 효과: 미발화

## 사용자 요청 정책 변경 — **"겁쟁이 모드" 확장 plan**

### 확장 trigger 후보 (Wave 256 implementation)

**A. Conflicting signal detection (이번 매물 패턴)**
- description 안에 negation + 강한 damage keyword 동시 등장:
  - "하자 일절 없" + "손상" (이번 매물)
  - "깨끗" + "수리" / "교체"
  - "정상" + "고장" / "불량"
- regex 만으론 결정 어려움 → AI 호출
- impact: 신규 trigger, 추정 매물 ~5%

**B. Positive 분류 + negative keyword 존재 (false positive 차단)**
- 현재 conditionClass = mint/clean/unopened 분류
- BUT description 에 "손상" / "수리" / "교체" / "하자" / "고장" 1회 이상 등장
- regex 가 negation 잡았어도 안전 확인용 AI
- impact: positive 분류 ~10-15% 검증

**C. broad ambiguous zone 확대**
- 현재: 0.55 ≤ score ≤ 0.75 (~30% 매물)
- 확장: 0.40 ≤ score ≤ 0.85 (~50% 매물)
- impact: AI 호출 2배 (~$18/월)

**D. bunjang label 불일치 검증**
- bunjang DAMAGED + description "깨끗" / "정상" 표현
- bunjang NEW + description "사용감 있" / "기스" 표현
- 양쪽 source 불일치 → AI 강제
- impact: ~3% 매물

**E. needsReview=true 무조건 AI**
- 현재: 일부 needsReview case 가 AI skip
- 변경: needsReview=true 시 항상 AI
- impact: ~2-3% 추가

### 비용 추정

| 시나리오 | 월 비용 | 일 비용 |
|---|---|---|
| 현재 (Wave 141B) | ~$9 | $0.30 |
| A+B 추가 | ~$15 | $0.50 |
| A+B+C 추가 | ~$25 | $0.83 |
| A+B+C+D+E 추가 | ~$32 | $1.07 |

사용자 명시 "비용 아끼지 말고" → 전 trigger 확장 OK 가능.

### UI 투명성 (사용자 인식 차이 해결, 별도 wave 후보)

reveal modal / pool browser 에 AI reasoning 노출:
- "AI 판정: 메인보드 손상 detected → 훼손 처리"
- "신뢰도: 95%"
- 사용자가 직접 검증 가능 → 이번 같은 misperception 차단

## 자율 진행 정책 — **자율 X (사용자 결정 영역)**

사용자 명시: "전면적 재검토 필요". 즉시 fix 요청 X.

내가 자율 진행 할 수 있는 것:
- ✅ 진단 + plan 보고 (이 문서)
- ✅ test fixture 추가 (대기)
- ❌ AI trigger 확장 — 사용자 결정 필요 (비용 + 정책 변경)
- ❌ UI reasoning 노출 — 사용자 결정 (별도 wave)

## 미완 — 사용자 결정 대기

1. **AI trigger 확장 — 어느 옵션 선택?**
   - A only (conflicting signal)
   - A+B (positive + negative keyword)
   - A+B+C (ambiguous zone 확대 +$25/월)
   - A+B+C+D+E (full 전면, +$32/월)
2. **UI AI reasoning 노출** — 별도 wave 후보
3. **AI prompt 강화** — 현재 prompt review 후 결정
4. **production 측정 baseline** — 변경 전 1주 sample 측정 vs 변경 후 비교 (사용자 결정 후)
