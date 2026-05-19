# Wave 256 implementation (2026-05-20) — AI 보수적 escalation 전 옵션 구현

## 사용자 결정 (확정)

> "모델 업그레이드까지 할 필요가 없지 않나? 그냥 하자진심없습니다 이건 그냥 쓰레기 ai여도
> 하자 없다는걸 알거같은데. 전옵션이 월 24달러면 진짜 매력적인데"

→ **전 옵션 (A+B+C+D+E) 진행, gpt-4o-mini 유지, UI reasoning 보류**

## 실측 baseline (Wave 256 plan 측정 정정 후)

- 일일 parse: 14,749건 (mvp_listing_parsed 24h)
- 일일 raw 수집: 24,108건 (mvp_raw_listings)
- AI 호출 (last 7d 평균): **750 calls/day** (cache hit 480 제외)
- 현재 비용: **~$3.4/월** (gpt-4o-mini, 추정 800 tok input / 50 tok output)
- AI L2 shadow audit 누적: $0.66 spent, 292 audited

## 구현 — `tick-pipeline.ts:1750-1825`

기존 Wave 141B (`ambiguousCondition` 0.55~0.75 + `!hasStrongSignal` + `bunjangLabel null`) → 5 trigger 통합 OR:

### A. Conflicting signal (사용자 매물 pid 405343339 패턴)
```typescript
const hasNegationPattern = /(?:하자|손상|수리|교체|고장|불량|파손|깨짐|기스|스크래치|찍힘)(?:는|도|이|가|을|를)?\s*(?:일절|전혀|아예|단\s*하나|일체|진짜)?\s*(?:없|아닙|아님)/.test(text);
const hasDamageKeyword = /손상|메인보드|배터리\s*교체|디스플레이\s*교체|화면\s*교체|액정\s*교체|사설\s*수리|부품\s*수리|침수|낙상|충격|크랙|박살|찌그러짐\s*심|깨짐\s*있/.test(text);
const conflictingSignal = hasNegationPattern && hasDamageKeyword;
```

### B. Positive class + negative keyword (false positive 차단)
```typescript
const isPositiveClass = conditionClass === "mint" || "clean" || "unopened";
const hasAnyNegativeKeyword = /손상|수리|교체|하자|고장|불량|파손|깨짐|침수|낙상|크랙|기스 있|얼룩 심|곰팡이|악취/.test(text);
const positiveButNegativeText = isPositiveClass && hasAnyNegativeKeyword;
```

### C. Ambiguous zone 확대
```typescript
const ambiguousConditionWide = parsed.conditionScore >= 0.40 && parsed.conditionScore <= 0.85;
// 기존 0.55~0.75 → 확장 0.40~0.85 (실제 호출 zone 증가)
```

### D. Bunjang label 불일치
```typescript
const bunjangConflict =
  (bunjangLabelMapped === "flawed" && isClassPositive) ||
  ((bunjangLabelMapped === "unopened" || bunjangLabelMapped === "clean") && isClassFlawedOrWorn);
```

### E. needsReview=true 무조건
```typescript
const needsReviewFlag = parsed.needsReview === true;
```

### 통합 trigger
```typescript
const aiTriggered =
  (ambiguousConditionWide && !hasStrongSignal && bunjangLabelMapped === null) || // C + 기존
  conflictingSignal ||  // A
  positiveButNegativeText ||  // B
  bunjangConflict ||  // D
  needsReviewFlag;  // E

if (aiTriggered) {
  const aiClass = await classifyConditionWithAi(...);
  if (aiClass) {
    parsed.conditionClass = aiClass;
    // 운영자 추적용 — 어떤 trigger 가 발화했는지 + AI 결과 기록
    parsedJson.ai_escalation_triggers = [...]; // ["conflicting_signal", "needs_review", ...]
    parsedJson.ai_escalation_class = aiClass;
  }
}
```

## 사용자 매물 pid 405343339 검증 (unit test)

```
text: "메인보드 손상이 있어서... 하자 일절 없습니다"
- hasNegationPattern: true (하자 + 일절 + 없)
- hasDamageKeyword: true (손상, 메인보드)
- conflictingSignal: true → AI trigger ✓
```

regex 만으로는 negation 매치 → repair_or_defect_signal 안 박혀 normal 잘못 가능. **이제 systemic 으로 잡힘** — 다른 비슷 매물 (배터리 교체 + 하자 없음 / 침수 + 일체 없음 등) 도 자동 trigger.

## 운영자 추적 (parsedJson)

re-parse 후 `parsed_json.ai_escalation_triggers` 에 발화 사유 기록:
- `["conflicting_signal"]` — 옵션 A 발화
- `["positive_but_negative"]` — 옵션 B 발화
- `["ambiguous_wide"]` — 옵션 C 발화
- `["bunjang_conflict"]` — 옵션 D 발화
- `["needs_review"]` — 옵션 E 발화

복수 동시 발화 가능 (e.g., `["conflicting_signal", "needs_review"]`).

SQL 측정:
```sql
SELECT 
  parsed_json->>'ai_escalation_triggers' AS triggers,
  parsed_json->>'ai_escalation_class' AS ai_class,
  COUNT(*) AS hits
FROM mvp_listing_parsed
WHERE updated_at >= NOW() - INTERVAL '24 hours'
  AND parsed_json ? 'ai_escalation_triggers'
GROUP BY triggers, ai_class
ORDER BY hits DESC;
```

→ 1주 후 실제 발화 분포 + 비용 측정 가능. trigger 별 false positive / false negative 검토.

## 검증

- `npx tsc --noEmit` ✅ pass
- `npx next build` ✅ pass (production deploy ready)
- `tests/wave256-ai-conservative-trigger.test.ts` 19 신규 tests pass
- `test:core` 710 pass / 11 fail (pre-existing /me UI baseline, 0 regression)

## 비용 추정 (실측 1주 후 정확화)

| 시나리오 | 일 AI calls | 월 비용 |
|---|---|---|
| 기존 baseline | 750 | $3.4 |
| Wave 256 추가 (A+B+C+D+E) | +3,000~5,000 (50%~67% 모호 매물) | +$13~$20 |
| **누적** | **~5,000-6,000** | **~$17-24/월** |

사용자 명시 "$24/월 매력적" → 부합. 1주 후 실측으로 정확화.

## 자율 진행 정책 준수

- ✅ 사용자 명시 결정 (전 옵션 + gpt-4o-mini)
- ✅ additive only — 기존 Wave 141B logic 유지, OR 로 확장
- ✅ 운영자 추적 metadata 박음 (parsedJson)
- ❌ destructive UPDATE 안 함 (자연 reparse 통해 점진 발현)
- ❌ UI reasoning 노출 안 함 (사용자 "몰라 뭔말인지" — 별도 wave 후보)

## 미완 후속

1. **Vercel deploy 후 production 발현 확인** (1h 후 측정)
2. **사용자 매물 pid 405343339 재검증** — re-parse 후 `ai_escalation_triggers: ["conflicting_signal"]` 박혔는지
3. **1주 측정**:
   - 일일 AI 호출 수 (목표: 5,000-6,000)
   - trigger 별 발화 분포
   - 실제 비용 (gpt-4o-mini token usage)
   - false positive / false negative 검토
4. **UI reasoning wave** (별도 후속) — 사용자 misperception 차단
