# Wave 257 spot rematch — 사용자 매물 2건 (2026-05-20)

## 발단

Wave 257 architecture flip deploy 검증 후 사용자 매물 3건 stale 확인:
- pid 405343339 (아이폰): 213h (8.9일) stale — 사실상 delisted 추정
- pid 408858108 (가젤 볼드): 14h stale, alive, condition_class=mint 잘못
- pid 331382713 (눕시 쇼츠): 13h stale, alive, Wave 254.6 적용 (comparable_key 정정 ✓) 그러나 Wave 257 미발현

사용자 결정 (literal "추천하는거"): 옵션 2 추천 — **2건만 rematch** (pid 405343339 제외 — delisted 가능성).

## 실행 (destructive UPDATE — 사용자 명시 승인)

```sql
-- 1) score_dirty=true UPDATE
UPDATE mvp_raw_listings 
SET score_dirty = true, updated_at = NOW()
WHERE pid IN (408858108, 331382713)
RETURNING pid, score_dirty, updated_at;
-- 결과: 2건 박힘

-- 2) detail_queue INSERT (ON CONFLICT UPDATE) — detail-worker 가 다시 처리하게
--    score_dirty 만으론 scoreStage 의 ensureParsedRows 거치지만 Wave 257 logic
--    (tick-pipeline.ts:1750, detail-worker 내부) 안 거침. detail_queue 재 enqueue 필수.
INSERT INTO mvp_detail_queue (pid, status, priority, available_at, locked_at, locked_until, last_error, updated_at)
VALUES 
  (408858108, 'pending', 50, NOW(), NULL, NULL, NULL, NOW()),
  (331382713, 'pending', 50, NOW(), NULL, NULL, NULL, NOW())
ON CONFLICT (pid) DO UPDATE 
  SET status = 'pending', priority = 50, available_at = NOW(),
      locked_at = NULL, locked_until = NULL, last_error = NULL, updated_at = NOW()
RETURNING pid, status, priority;
-- 결과: 2건 박힘 (priority=50 high)
```

## 측정 시점 — 5-10min 후 + 1h 후

### 즉시 측정 (5-10min): detail-worker picking up 확인
```sql
SELECT pid, parser_version, condition_class, condition_score,
  parsed_json->>'ai_default_invoked' AS ai_default,
  parsed_json->>'ai_default_class' AS ai_default_class,
  parsed_json->>'ai_skipped' AS ai_skipped,
  parsed_json->'ai_skipped_reasons' AS reasons,
  comparable_key, updated_at
FROM mvp_listing_parsed WHERE pid IN (408858108, 331382713);
```

기대값:
- **pid 408858108 (가젤 "새상품 + 약간 하자가있어")**:
  - 기존: condition_class=mint, parser_version=v4
  - 기대 Wave 254.5 + 257: parser_version=`wave92-shoe-v8`, condition_class=`flawed` (AI 호출 + "약간 하자가있어" 인식)
  - `ai_default_invoked: true`, `ai_default_class: "flawed"`
  - `ai_skipped` 박히지 X (whitelist 통과 안 함 — bunjang label null + battery null + description 길어서 fast-path X)

- **pid 331382713 (눕시 쇼츠)**:
  - 이미 Wave 254.6 적용됨 (`comparable_key: shorts`).
  - 기대 Wave 257: AI default 호출 (자연어 description "새제품" — 셀러 명시지만 자세한 부정형 패턴 없음, bunjang label null 일 수도)
  - 또는 fast-path (bunjang label 있으면)

### 1h 후 sample 30건 — 전체 deploy rollout 측정

## risk 평가

- ✅ 매우 안전 — 2건 spot UPDATE
- ✅ alive 매물 (14h / 13h 전 last_seen)
- ✅ Wave 252.C / 253 helper 와 동일 path (detail_queue INSERT + score_dirty UPDATE)
- ❌ delisted 매물 (pid 405343339, 213h stale) 제외 — rematch 무의미

## 후속

- 5-10min 후 측정 → 사용자 보고
- 1h 후 sample 30건 측정 → fast-path 비율 + AI 호출 비율 + 비용 추정 정확화
- 17,623건 대량 rematch 는 spot rematch 결과 확인 후 사용자 결정
