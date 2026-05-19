# Wave 244 (2026-05-19) — learning queue admin UI (`/admin/learning-queue`)

## 발단

Wave 238 commit 0c9c9d2 가 AI L2 shadow audit + learning queue 적재 인프라 박음. 사용자 명시:

> "shadow audit 결과는 learning_queue 에 자동 적재 됨 (frequency_count++ — AI reject 매물).
> ... Wave 238 Phase 3 learning queue admin UI 박기 (Wave 244). 24h shadow 측정과 병렬 진행."

24h shadow 측정은 별도 wave. 이번 wave 244 는 admin UI 만.

## 박은 거

### 1. DB migration (`wave244_learning_queue_admin_ui` + `wave244_learning_queue_view_security_invoker`)

- `mvp_catalog_pending_patches` 신설 (admin approve 큐 — agent 가 코드 직접 patch X)
  - PK `id`, FK `source_queue_id → mvp_catalog_learning_queue(id)`, `patch_type ENUM`, `patterns TEXT[]`, `status ENUM`, audit columns.
  - index `(status, created_at)` + `(sku_id)`
- `mvp_catalog_learning_queue.false_positive BOOLEAN DEFAULT false` 컬럼 추가
  - admin reject 시 자동 set → enqueueLearningSignal 이 다음부터 같은 (sku/matched_text) 큐 진입 차단.
  - partial index `WHERE false_positive=true` 박음 (skip 체크 빠르게).
- `v_mvp_learning_queue_admin` view 신설 (pending + non-false-positive 만 frequency 순)
- **RLS enable** — `mvp_catalog_learning_queue` (Wave 238 누락 fix; security advisor flag 해결) + `mvp_catalog_pending_patches`. 정책 부재 = default DENY for anon/authenticated. service_role bypass.
- view 들 `security_invoker = true` 박음 (`v_mvp_learning_queue_admin` + Wave 238 의 `v_mvp_catalog_learning_queue_summary`) — security_definer view advisor ERROR 해결.
- `touch_pending_patches_updated_at()` trigger.
- additive only. DROP 없음. PITR 미박힘 유지 정책 준수.

### 2. `src/lib/ai-l2-learning-queue.ts` 수정

- `checkFalsePositive(skuId, matchedText)` 헬퍼 추가.
  - 같은 row 가 `status='rejected'` 또는 `false_positive=true` 면 skip reason 반환.
  - fetch fail 시 conservative null (즉 enqueue 진행) — false negative 보다 false positive 가 admin 부담만 늘어남.
- `enqueueLearningSignal` 이 upsert 전 `checkFalsePositive` 호출 → skip 시 `{ enqueued:false, skipped:true, reason:'rejected_by_admin' | 'marked_false_positive' }` 반환.

### 3. API routes

- `GET /api/admin/learning-queue?freq=3&status=pending&page=1&pageSize=20&sku_id=...&category=...`
  - filter: `frequency_count >= freq` + `status` + `false_positive=false` (status=all 이면 표시)
  - 각 row 별 sample pids 5건 (mvp_raw_listings + mvp_listings join — name/price/url/thumbnail/last_seen)
  - sku_name 자동 join. category filter 는 candidate_pool join (후 filter).
- `POST /api/admin/learning-queue/[id]/approve`
  - body: `{ patchType: 'mustNotContain' | 'narrow_split' | 'other' }` (default `mustNotContain`)
  - 동작: pending_patches insert → queue status='approved' + reviewed_at + reviewed_by.
  - **catalog 자동 박힘 X** — agent 가 코드 직접 patch X. admin 이 git PR 또는 manual apply.
- `POST /api/admin/learning-queue/[id]/reject`
  - body: `{ reason?: string }`
  - 동작: status='rejected' + false_positive=true + reviewed_at + reviewed_by (note 포함).
  - 같은 (sku_id, matched_text) 다시 queue 진입 X.
- `GET /api/admin/learning-queue/stats`
  - coverage (today/7d/this month) — `v_mvp_ai_l2_coverage_daily`
  - cost (today/this month/last 30d) — `v_mvp_ai_l2_cost_daily`
  - call rate monthly — `v_mvp_ai_l2_coverage_monthly` (월별 ai_seen_pct line)
  - queue summary — pending/approved/rejected + false_positive 개수 + topSkus

모두 `isAdminUser` 인증.

### 4. UI page

- `src/app/admin/learning-queue/page.tsx` — server wrapper.
- `src/components/learning-queue-admin.tsx` — client component (interactive table + actions).

화면 구성:

- **상단 측정 카드 3개**:
  1. coverage % — 오늘 / 최근 7일 / 이번 달 (각 카드 ai_seen / total_ready)
  2. 월별 AI 호출 비율 line — catalog 학습되면 ↓ 되는 게 목표 (baseline 91.1% AI 안 봄 명시)
  3. 비용 USD — 오늘 / 이번 달 / 최근 30일 (AI_L2_DAILY_BUDGET_USD cap 명시)
- **큐 상태 summary** — pending / approved / rejected / false_positive 개수
- **필터** — freq (default 3), status (pending/approved/rejected/all)
- **큐 row 카드**:
  - sku_name (skuId fallback) + AI verdict badge + frequency_count + matched_text + confidence + age
  - suggested mustNotContain 키워드 (amber chip)
  - AI reason
  - sample 매물 5건 (썸네일 + 이름 + 가격 + last_seen) — 번개장터 직접 클릭
  - approve / reject 버튼 (pending 만). approve 는 confirm dialog ("catalog patch 큐에 적재 — 실제 박힘은 별도 git PR" 명시), reject 는 prompt (사유 입력).
- 페이지네이션.
- 디자인: `/admin/explore-monitor` Stat 카드 + `admin-classification-browser` row 패턴 따름.

## 비파괴 정책 (사용자 명시 준수)

| 정책 | 박힘 |
|---|---|
| catalog 자동 박힘 X | approve → pending_patches 큐만 적재. agent 가 코드 직접 patch 안 함. |
| reject 한 패턴 다시 큐 진입 X | false_positive=true + enqueueLearningSignal 의 `checkFalsePositive` skip. |
| 3 화면 적용 정책 (`feedback_ui_changes_apply_to_all_card_screens`) | 적용 X — 사용자 카드 화면 한정. admin UI 는 단일 위치 (memory 명시). |
| 일반인 친화 | admin UI 라 운영자 한정이지만, label 한국어 + tooltip 명시 + 사유 입력 prompt. |
| additive only | migration DROP 없음. ALTER ADD COLUMN + CREATE TABLE 만. |

## advisor 보강 (이번 wave 에서 같이 박음)

Wave 238 박을 때 `mvp_catalog_learning_queue` RLS disabled 누락 + view 가 SECURITY DEFINER 로 박힘 → supabase security advisor `critical` 알림. 이번 migration 으로 fix:

- learning_queue + pending_patches `ENABLE ROW LEVEL SECURITY` (정책 부재 → anon/authenticated default DENY, service_role bypass)
- `v_mvp_learning_queue_admin` + `v_mvp_catalog_learning_queue_summary` 둘 다 `security_invoker = true` 박음.

advisor 의 `rls_enabled_no_policy` INFO 는 의도된 상태 (admin only 라 service_role 이외 접근 차단).

## 24h shadow audit 측정 (별도 wave)

사용자 명시 — 24h 후 별도 보고 (이번 wave 와 별개):

- shadow audit 실제 noise rate (baseline 5.7% 유지?)
- false positive 비율 (수동 sample 100건 검증)
- 비용 추이 ($10/일 cap 이내?)
- Phase 2 (live 차단) 활성화 결정 시점

→ 측정 데이터 누적 후 별도 wave 에서 평가. 이번 wave 244 는 admin UI 만.

## 진입 경로

- `/admin/learning-queue` (admin email 한정)
- `/admin/explore-monitor`, `/admin/status` 와 자매 페이지.
- 좌측 nav 진입은 admin layout 에 별도 entry 박지 않음 (기존 pages 도 직접 URL 진입). 추후 admin nav 통합 시 같이.

## 다음 step

- 24h 후 shadow audit 측정 + Phase 2 (live 차단) 결정.
- `mvp_catalog_pending_patches` apply 워크플로우 — admin 이 approved row 보고 catalog.ts 패치 후 `applied_at` + `applied_commit_sha` 박는 별도 UI (Wave 245+).
- AI reason → 의미있는 키워드 추출 정교화 (현재는 빈도 top 5 단순 추출).

## 정책 참조

- `feedback_decision_log_required` — 박았음 (이 파일).
- `feedback_proceed_on_clear_wins` — bug/security fix 자율 진행 (RLS gap 같이 fix).
- `feedback_destructive_actions_require_explicit_confirm` — additive only 준수.
- `project_core_principle_consumer_friendly` — UI label 한국어 + 직관적.
- `feedback_log_findings_even_before_fix` — Wave 238 RLS gap 같이 박음.
