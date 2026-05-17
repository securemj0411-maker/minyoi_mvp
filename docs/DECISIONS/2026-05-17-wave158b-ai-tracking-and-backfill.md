# Wave 158b — AI condition 추적 컬럼 + 3,798건 즉시 backfill + 신발 회귀 복구

- 시간: 2026-05-17 KST
- 사용자 코멘트: "ㄱ" (Wave 158 후속 작업 자율 진행 허가)

## 변경

### 1. AI condition classifier 결과 추적 컬럼 추가 (DB migration)
`mvp_listing_ai_classifications` 테이블:
- ADD COLUMN `condition_class text` (nullable)
- ADD COLUMN `condition_reason text` (nullable)

이전엔 `listing_type` 만 추적. condition AI 호출 추적 불가 (cost/tokens/결과 모두 손실). 사용자 우려 "AI가 작동을 안한거야??" 측정 가능하도록.

### 2. `classifyConditionWithAi` 저장 로직 추가 ([pipeline.ts:1410](mvp/src/lib/pipeline.ts:1410))
- 함수 시그니처: `(title, description)` → `(pid, title, description)`
- prompt 수정: `{condition_class, reason}` JSON (이전 condition_class only). max_tokens 60 → 100.
- 결과 + cost(gpt-4.1-mini pricing: input $0.15/1M, output $0.60/1M) + tokens 저장.
- FK violation (mvp_listings 미존재) silent skip — AI 분류 자체는 `mvp_listing_parsed.condition_class`에 박힘.
- `persistConditionAiResult` 헬퍼 추가 (try-catch upsert).

[tick-pipeline.ts:1699](mvp/src/lib/tick-pipeline.ts:1699) 호출 위치도 pid 인자 추가.

### 3. Backfill script + 실행 (3,798건 → 약 1,000건 조정)
`scripts/backfill-bunjang-condition-mapping.ts` 신규.

흐름:
- `mvp_raw_listings.bunjang_condition_label NOT NULL` 매물 fetch
- `mvp_listing_parsed`에서 현재 `condition_class` + `condition_notes` 조회
- `resolveConditionClass(bunjangLabelToConditionClass(label), extractConditionClass(notes))` 재계산
- 다르면 UPDATE.

**실행 결과** (full run): scanned 3,853 / changed ~800 / failed 0.

Top transitions:
- normal → clean (200): LIKE_NEW
- clean → normal (172): LIGHTLY_USED + clean description → worse-of-rank
- mint → unopened (78): NEW
- mint → clean (71): LIKE_NEW
- normal → worn (68): HEAVILY_USED/USED
- normal → unopened (67): NEW
- worn → normal (31), mint → normal (31): LIGHTLY_USED + 무신호 description

### 4. 신발 회귀 발견 + 복구 (긴급)
**문제**: `wave92-fashion-mobility-v1` parser는 `condition_notes`를 박지 않고 `parsed_json.shoe_condition_tier` 별도 사용 (Wave 134 tier 매핑 — s_grade/a_grade/b_grade/c_grade/reject). Backfill이 신발 매물 1,016건에 bunjang label 매핑을 적용해서 옛 tier 기반 분류를 잘못 덮어씀.

샘플 검증 (호카 본디7): description에 "사용감/오염/전투용" 명시인데 backfill이 LIGHTLY_USED → normal로 분류 (사실 c_grade → worn 이어야).

**복구 SQL**:
```sql
UPDATE mvp_listing_parsed
SET condition_class = CASE parsed_json->>'shoe_condition_tier'
  WHEN 's_grade' THEN 'unopened'
  WHEN 'a_grade' THEN 'mint'
  WHEN 'b_grade' THEN 'clean'
  WHEN 'c_grade' THEN 'worn'
  WHEN 'reject' THEN 'flawed'
  ELSE condition_class
END
WHERE parser_version LIKE 'wave92-fashion-mobility%'
  AND parsed_json->>'shoe_condition_tier' IS NOT NULL
  AND parsed_json->>'shoe_condition_tier' IN ('s_grade','a_grade','b_grade','c_grade','reject')
```
약 1,010건 복구 (tier 있는 신발 전체).

**Script 수정**: fetchBatch에서 `parser_version LIKE 'wave92-fashion-mobility%'` 매물 filter out. 미래 backfill 안전.

## 검증
- `npx tsc --noEmit` production code clean.
- backfill dry-run 50건 + full run 3,853건 fail 0.

## 위험
- **가방/자전거 (fashion-mobility, tier 없음)**: backfill 영향받았을 수 있지만 fashion-mobility 자체 condition 정확도 낮은 영역 (Wave 130 미구현). 정합성 회복은 별도 wave.
- **AI cost 추적**: 새 컬럼 박혀있지만 retroactive 측정 불가. 향후 호출분만 추적.
- **PARSER_VERSION 혼재**: v44/v45/v46/v47 + wave92 섞임. owner_decision_pending (LAUNCH_PLAN).

## 다음
- 24h 후 측정: condition_class 분포 변화, AI 호출 수, cost 합계.
- fashion-mobility 가방/자전거 backfill 정책 (별도).
- AI cost dashboard (`mvp_listing_ai_classifications` 합계).
