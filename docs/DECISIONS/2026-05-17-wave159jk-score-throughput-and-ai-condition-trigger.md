# Wave 159j/k — scoreStage 처리량 향상 + AI condition 호출 인프라

- 시간: 2026-05-17 KST

## 발견 (자율 사이클 측정)

### 1. score_dirty backlog 처리 매우 느림 (Wave 159j)
- 119,474건 backlog
- 10분에 67건 처리 → 13시간 추정
- 원인: `PIPELINE_TICK_SCORE_LIMIT` default 150 (1 tick에 150건)

### 2. AI condition 호출 0건 (Wave 158 인프라 사실상 미작동) (Wave 159k)
- mvp_listing_ai_classifications.condition_class 누적 호출 수: **0건**
- listing_type 호출 누적: 1,748건 (정상 작동)
- AI condition trigger 대상 매물: **11,243건** (ambiguous + no label + no strong signal)
- 원인: condition AI는 detail-worker에서만 호출. detail-worker는 새 detail-fetch 매물만 처리.
  기존 매물 (Wave 158 코드 박은 후 detail re-fetch 안 한 매물) AI 영구 미호출.

## 변경

### Wave 159j: scoreStage limit 150 → 800
[pipeline-config.ts:284](mvp/src/lib/pipeline-config.ts:284):
```typescript
tickScoreLimit: envInt("PIPELINE_TICK_SCORE_LIMIT", 800, 10, 2000),
```
매물당 ~12ms 가정 → 800건/9.6초 (budget 10초 안). 119K backlog 13h → ~2.5h.

### Wave 159k: score-stage condition AI 호출 추가 (env enable)
[pipeline-config.ts](mvp/src/lib/pipeline-config.ts):
- `scoreAiConditionDailyLimit` config 추가. env `PIPELINE_SCORE_AI_CONDITION_DAILY_LIMIT`.
- **default 0 = 비활성** (cost 결정은 운영자가 env 박음).

[tick-pipeline.ts:3892](mvp/src/lib/tick-pipeline.ts:3892):
```typescript
let conditionAiCallsLeft = 0;
if (config.scoreAiConditionDailyLimit > 0) {
  // mvp_listing_ai_classifications에서 오늘 condition AI 호출 수 query
  conditionAiCallsLeft = Math.max(0, config.scoreAiConditionDailyLimit - todayCount);
}
```

row 처리 loop:
```typescript
if (conditionAiCallsLeft > 0 && parsed.condition_score in [0.55, 0.75] && row.description_preview) {
  const aiClass = await classifyConditionWithAi(pid, name, description_preview);
  if (aiClass) {
    parsed.condition_class = aiClass;
    conditionAiCallsLeft -= 1;
  }
}
```

운영자 enable:
```bash
export PIPELINE_SCORE_AI_CONDITION_DAILY_LIMIT=500
# 500/day = $0.10/day = $3/month (매물당 ~$0.0002)
```

## 검증
- typecheck production clean.

## 위험
- production env에 `PIPELINE_TICK_SCORE_LIMIT` 박혀있으면 default 변경 무시.
- Wave 159k 코드는 박혔지만 default 비활성. 운영자가 enable 안 하면 여전히 0 호출.
- score-stage AI 호출 시 budget 초과 가능 (매물당 ~500ms latency 추가). enable 시 limit 작게 시작 권장.

## 다음
- 운영자 env `PIPELINE_SCORE_AI_CONDITION_DAILY_LIMIT=500` 설정 후 측정.
- score_dirty backlog 1-2시간 후 측정 (정정 효과).
- iPhone 14 (pid 408329098) 같은 sku_median 정정 매물 측정.
