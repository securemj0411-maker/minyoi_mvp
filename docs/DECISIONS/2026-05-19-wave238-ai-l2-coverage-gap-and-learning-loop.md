# Wave 238 (2026-05-19) — AI L2 coverage gap + learning loop (Option A + 학습 통합)

## 발단

사용자: "fashion 진짜 완벽한지?" → Wave 237/238a (fashion audit) 진행 중 발견된 근본 architecture 결함.

Wave 238a/239/240/241/242/243 = catalog-level mismatch fix (regex/keyword patch). 단발성 fix 인 점은 인식. 사용자 명시: **regex patch 금지, AI 가 catch 하게**.

## Baseline 발견 (production sweep 2026-05-19)

`mvp_candidate_pool` ready 매물 중 AI L2 review 본 비율 — **8.9%**. **91.1% AI 안 봄**.

| Category | total_ready | ai_seen | ai_seen_pct |
|---|---|---|---|
| clothing | 142 | 8 | 5.6% |
| earphone | 70 | 5 | 7.1% |
| smartwatch | 57 | 3 | 5.3% |
| tablet | 38 | 6 | 15.8% |
| smartphone | 32 | 4 | 12.5% |
| shoe | 26 | 8 | 30.8% |
| bag | 25 | 1 | 4.0% |
| drone | 7 | 0 | 0.0% |
| speaker | 7 | 0 | 0.0% |
| home_appliance | 7 | 2 | 28.6% |
| laptop | 2 | 0 | 0.0% |

→ **fashion 3 카테고리 (clothing/shoe/bag)** = 193 매물 중 17 (8.8%) AI 본. **91.2% AI 안 봄**.
→ catalog regex 가 1차 분류 → AI L2 는 score top-N + flag 매물만 → ready 진입 매물 91% 는 AI 검증 우회.

## 진단

이전 agent (a5159aa12767a5e1e) 분석:

1. **AI L2 misalignment**: `applyAiReview()` (pipeline.ts:1623) 가 score 기준 top-N + AiL2Flag set 매물만 호출 → catalog 가 "확신" 분류한 매물 (regex pass) 은 AI 우회. 이 매물들이 fashion mismatch 의 근본 source.
2. **Catalog 가 source-of-truth 인데 catalog 가 틀리면 AI 가 catch 못 함**: iPad/tech 카테고리는 catalog 가 95%+ 정확 (model code 명확) → AI 안 봐도 OK. fashion 은 brand/model/variant 가 ambiguous (Acne 부티 / MM67 / 콜라보) → catalog patch loop 불가피.
3. **Patch loop 의 비용**: 매주 sample sweep → mismatch 발견 → regex 추가 → 새 변종 발견. 사용자 불만 (wave238a "완벽 X").

## 사용자 결정 (architecture)

**iPad/tech 패턴 = catalog source-of-truth (영구) + AI = 학습 catalyst (단기)**.
시간 지나면 AI 호출 비율 감소. fashion 도 tech 처럼 catalog 가 95%+ 자동 분류 도달 목표.

## Plan (Option A + 학습 loop)

### 1. Option A — `candidate-pool-builder.ts` ready promotion gate AI shadow audit

ready transition 직전 catalog 가 "확신" 분류한 매물 (`scoreFlags` 가 AiL2Flag set 매치 X 라서 `applyAiReview` 통과한 매물) 에 대해:
- `classifyWithCache` 호출 (AI L2 review)
- AI verdict:
  - `pass` → ready 진입 허용 (정상)
  - `hold` (low confidence) → `ai_audit_status='internal_only'` 마킹, ready 진입 X (사용자 노출 X, admin 확인 큐)
  - `reject` (high confidence) → `ai_audit_status='invalidated'`, invalidation 처리

**Phase 1 = shadow audit only**. Pool 차단 영향 0 — `ai_audit_status` 컬럼만 박고 status='ready' 는 그대로 유지. 운영자 review 후 차단 정책 활성화 (Phase 2, 별도 wave).

### 2. Learning loop — `mvp_catalog_learning_queue` 테이블 신설

AI verdict `reject`/`hold` 매물 → 학습 큐 적재:

```sql
CREATE TABLE mvp_catalog_learning_queue (
  id BIGSERIAL PRIMARY KEY,
  sku_id TEXT NOT NULL,
  pid BIGINT NOT NULL,
  ai_classification TEXT NOT NULL,
  ai_confidence NUMERIC,
  ai_reason TEXT,
  suggested_mustNotContain TEXT[],
  matched_text TEXT,
  frequency_count INT DEFAULT 1,
  status TEXT DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

AI `reason` 분석 → 간단 keyword extraction → suggested_mustNotContain 후보 박음. 같은 패턴 발견 → `frequency_count++`.

Admin review (Phase 1 = SQL query):
```sql
SELECT sku_id, matched_text, frequency_count, ai_reason
FROM mvp_catalog_learning_queue
WHERE status='pending' AND frequency_count >= 5
ORDER BY frequency_count DESC;
```

매주 사용자 review → approve → catalog.ts patch.

### 3. 측정 지표

- Daily AI L2 호출 비율 view (`v_mvp_ai_l2_coverage_daily`)
- baseline: 91.1% AI 안 봄
- 목표: 3개월 50% / 6개월 10%
- 안 줄면 architecture 결함 → telegram 알림

### 4. 비용 cap

- `AI_L2_DAILY_BUDGET_USD` env ($10/일 default, 초과 시 disable)
- cache hit rate 측정 (content_hash 기준)
- 비용 초과 → 자동 disable + telegram 알림 (`reportCriticalIncident` 기존 인프라)

## 사업 모델 정합성

- 매물 수 증가해도 AI 비용 안 증가 (cap + catalog 학습 로 호출 비율 감소)
- fashion 도 tech 처럼 catalog 가 95%+ 자동 분류 도달 목표

## 정책 준수

- **regex patch 금지** (사용자 명시) — AI 가 catch 하게. 기존 catalog 패턴은 fallback 유지.
- **decision log 필수** (memory feedback_decision_log_required)
- **비파괴** — shadow audit 단계만, pool 차단 영향 X (Phase 1)
- **PITR 미박힘** (memory destructive_actions) → DDL additive only
- **사용자 정책** narrow=fallback, broad=차단 (Wave 236d Goldilocks) — Option A 가 broad SKU 매물에 AI L2 적용해 narrow 시세 fallback 의도와 정합

## 실행 단계

1. (이 commit) decision log
2. DB migration (Supabase MCP) — `mvp_catalog_learning_queue` + `mvp_candidate_pool.ai_audit_status` (additive)
3. 코드 구현
   - `src/lib/candidate-pool-builder.ts` — ready gate AI shadow audit hook
   - `src/lib/ai-l2-learning-queue.ts` (신규) — 학습 큐 적재 함수
   - 비용 cap env wire
4. 측정 SQL view + telegram 알림 hook
5. commit + push 각 단계

## 미완 / 보류

- Phase 2 (실제 pool 차단 활성화) — Phase 1 24h shadow audit 측정 후 별도 wave
- learning queue admin UI — Phase 2 (현재는 SQL query 로 시작)
- Anthropic Haiku 4.5 swap 비교 — 별도 wave
- catalog auto-patch (큐 frequency>=N 이면 자동 적용) — Phase 3
