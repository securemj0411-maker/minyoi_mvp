# 2026-05-14 Wave 30 — Smartphone AI L2 Phase 2 review-only

> Status: **review-only**. No DDL apply, no runtime on, no code apply in this wave.
> Wave 29 ended with smartphone deterministic hold + FK migration review-only. Wave 30 designs the four remaining Phase 2 prerequisites as documentation only, so that the next wave can flip on with all gates explicit.

## 0. Scope and non-negotiables

- 대상: `smartphone` narrow lane (iPhone Pro 자급제 family) `needs_review=true` row escrow 경로.
- 금지:
  - broad smartphone widening (LAUNCH_PLAN section 0 원칙 12b).
  - silent carrier 추정 (Wave 29 hold decision).
  - 실제 코드 apply / DDL apply / cron on.
  - smartphone 외 카테고리로 새는 것.
- 산출물: 본 decision log + `reports/wave30-smartphone-ai-l2-phase2-review-latest.md`. 코드 변경 0.

## 1. Item 1 — scoreStage smartphone narrow lane escrow exception path (review-only)

### Current behavior

[`tick-pipeline.ts:3339`](src/lib/tick-pipeline.ts:3339):

```ts
if (parsed?.needs_review === true) {
  needsReviewSkipped++;
  continue;
}
```

→ `parsed.needs_review=true` row는 모두 scoreStage에서 skip. AI 도달 0. `mvp_listings`/`mvp_listing_analysis`에 row 자체가 안 생김.

부수 효과: [`mvp_listing_ai_classifications.pid` FK → `mvp_listings(pid)`](docs/DECISIONS/2026-05-14-wave29-ai-l2-fk-migration-review.md) 때문에, 신규 `needs_review=true` row의 AI cache upsert는 어차피 FK fail.

### Proposed exception path (apply 금지)

문 위치는 동일 `scoreStage` 내, 위 skip block 직전. 의사 코드:

```ts
const escrowEnabled = process.env.AI_L2_ESCROW_NEEDS_REVIEW_ENABLED === "1";
const escrowCap = clampInt(process.env.AI_L2_ESCROW_NEEDS_REVIEW_CAP, 25, 0, 200);
let escrowAdmitted = 0;

// ... 기존 for-loop 내부:
if (parsed?.needs_review === true) {
  const eligible = escrowEnabled
    && escrowAdmitted < escrowCap
    && isSmartphoneNarrowEscrowCandidate(row, parsed, sku);
  if (!eligible) {
    needsReviewSkipped++;
    continue;
  }
  escrowAdmitted++;
  // fall through to PipelineRow build; ai_escrow_pending flag will be attached below.
}
```

`isSmartphoneNarrowEscrowCandidate` 게이트 (review-only 명세, 별도 helper):

| Check | Source | 이유 |
|---|---|---|
| `row.detail_status === "done"` | raw_listings | 상세 enrich 끝난 row만 |
| `row.listing_type === "normal"` | raw_listings | counterfeit/parts/buying/callout 등 제외 |
| `row.listing_state === "active"` | raw_listings | sold/disappeared/archived 제외 |
| `row.sku_id` non-null | raw_listings | catalog ruleMatch 통과 |
| `parsed.comparable_key` non-null | listing_parsed | parser가 키는 만든 상태 |
| `parsed.category === "smartphone"` | listing_parsed | smartphone 전용 |
| `parsed.comparable_key` startsWith `smartphone\|iphone\|` AND ends with `_pro_128gb_self` family | listing_parsed | iPhone Pro 자급제 narrow lane만 |
| `sku.laneKey` in 사전 정의 5 lane set | catalog | `iphone_12/13/14/15/16_pro_128gb_self` |
| `parsed.parse_confidence >= 0.55` (lowered from 0.65 for escrow only) | listing_parsed | confidence 너무 낮으면 escrow도 무의미 |

이외 row는 기존처럼 skip.

### scoreFlags 추가

escrow row의 `PipelineRow.scoreFlags`에 다음 flag 추가:

- `ai_escrow_pending` — Item 2의 pool-policy block flag (apply 금지)
- `option_needs_review` — 기존 parser-gap flag (이미 add됨)
- 기존 reason flag (`self_unlocked_ambiguity` 등)는 `aiEscrowKindForParserMetadata` ([pipeline.ts:1933](src/lib/pipeline.ts:1933))가 이미 결정.

### Pool 안전

`ai_escrow_pending`이 `POOL_BLOCK_FLAGS`에 포함되어 있으면 (Item 2), [`pool-policy.mjs:hasPoolBlockFlag`](src/lib/pool-policy.mjs)가 차단. AI가 pass해도 pool 진입 X.

### Default state

- `AI_L2_ESCROW_NEEDS_REVIEW_ENABLED` default = unset → `escrowEnabled = false` → 모든 `needs_review=true` row 기존처럼 skip. **runtime behavior 변화 0**.
- Wave 30에서 env 설정 변경 금지.

### Failure modes 점검

| 시나리오 | 결과 |
|---|---|
| flag off + escrow code 머지만 | 기존 skip 경로 동일. row count 0 |
| flag on + cap 0 | escrowAdmitted < 0 절대 false → skip |
| flag on + cap 25 + FK 안 옮긴 상태 | AI cache upsert FK fail → exception path 진입했지만 cache 저장 실패. Item 4 gate가 막아야 함 |
| flag on + cap 25 + FK 옮긴 상태 | escrow 25 row까지 AI 도달, scoreFlags에 ai_escrow_pending 부여, pool 차단 유지 |
| escrow row가 parser write-back으로 needs_review false 되면 | 다음 cron에서 정상 path로 통합. AI 결과는 cache hit |

### 변경 예상 라인 수 (apply 금지, 측정용)

- `tick-pipeline.ts`: 약 15~20줄 (scoreStage 내 분기 + helper import). **0줄 원칙 ceil 위반 — Item 4 gate에 명시.**
- 신규 helper file `src/lib/ai-l2-escrow-gate.ts`: 약 40줄 (isSmartphoneNarrowEscrowCandidate, clampInt 등).
- `pool-policy.mjs`: Item 2.
- 신규 env: `AI_L2_ESCROW_NEEDS_REVIEW_ENABLED`, `AI_L2_ESCROW_NEEDS_REVIEW_CAP`.

---

## 2. Item 2 — pool-policy `ai_escrow_pending` block flag (review-only)

### Current state

[`src/lib/pool-policy.mjs:3-21`](src/lib/pool-policy.mjs:3) `POOL_BLOCK_FLAGS` 리스트:

```
extreme_discount_review, market_stat_missing, option_parse_review, option_needs_review,
parser_unknown_option, self_unlocked_ambiguity, bundle_or_accessory_ambiguity,
generation_ambiguity, connectivity_ambiguity, ai_review_unavailable,
ai_second_opinion_hold, weak_description, risk_keyword_review, condition_review
```

→ `ai_escrow_pending` 없음. Item 1의 escrow row가 pool에 들어가는 것을 명시적으로 막는 flag 부재.

### Proposed addition (apply 금지)

`POOL_BLOCK_FLAGS`에 다음 3개 추가:

```js
"ai_escrow_pending",      // AI 검토 진행 중 — pool 차단 유지
"ai_escrow_held",         // AI가 hold/unknown 반환 — pool 차단
"ai_escrow_unavailable",  // AI 호출 실패/timeout — pool 차단
```

`ai_escrow_passed` 같은 "AI가 pass했음" flag는 **추가하지 않는다**. 의도된 설계 — AI pass만으로 pool 진입 가능한 경로를 만들지 않음 (Wave 29 원칙).

### poolSkipReason 변화

[`pool-policy.mjs:70-80`](src/lib/pool-policy.mjs:70) `poolSkipReason`은 이미 `POOL_BLOCK_FLAGS`를 generic 처리. 추가 row만으로 `blocked_ai_escrow_pending` reason이 자동 produce됨. **함수 자체 변경 0줄**.

### computePoolConfidence 영향

[`pool-policy.mjs:44-54`](src/lib/pool-policy.mjs:44) `computePoolConfidence`는 `_low_confidence` suffix flag와 `ai_normal`/`ai_review_unavailable`만 본다. `ai_escrow_*` flag는 confidence 점수에 영향 안 줌. 의도된 설계 — escrow는 confidence 변경이 아니라 hard block.

### 변경 예상 라인 수

- `pool-policy.mjs`: 3줄 추가 (list entry만).
- 신규 코드 0.

### 안전성 점검

| 시나리오 | 결과 |
|---|---|
| escrow 코드 미적용, flag만 add | 누구도 `ai_escrow_pending` flag를 부여 안 함 → pool 동작 동일 |
| escrow 코드 적용, flag add 안 함 | escrow row가 pool 진입 가능 위험 — **블로커**. Item 4 gate가 두 변경 동시 적용 보장해야 |
| escrow row + flag 둘 다 적용 | 정상 차단. invalidate 없이 단지 pool 진입 X |
| 기존 `option_needs_review` 만으로도 차단되는가 | 예. 그러나 `ai_escrow_pending`는 의도 명시용 — "escrow 중이라 차단"인지 "parser 약점이라 차단"인지 분리 |

---

## 3. Item 3 — AI cache retention prune dry-run (review-only)

### Why needed

FK migration이 `mvp_listings(pid)` → `mvp_raw_listings(pid)`로 옮기면 cache 대상 pid 풀이 9,185 → 35,953으로 확장. 신규 escrow row가 매번 cache 누적될 수 있고, `content_hash`가 매물 텍스트 변경 시마다 새 row 생성하므로 cache table은 단조 증가.

Wave 29 doc은 14일 retention 언급. Wave 30에서 정확한 prune predicate와 dry-run 시뮬레이션 설계.

### Proposed SQL function (apply 금지)

```sql
create or replace function public.prune_mvp_listing_ai_classifications(
  p_days integer default 14,
  p_batch_limit integer default 5000,
  p_dry_run boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - make_interval(days => greatest(1, p_days));
  v_count bigint;
begin
  if p_dry_run then
    select count(*) into v_count
    from public.mvp_listing_ai_classifications c
    where c.classified_at < v_cutoff
      and not exists (
        select 1
        from public.mvp_raw_listings r
        join public.mvp_listing_parsed p on p.pid = r.pid
        where r.pid = c.pid
          and r.detail_status = 'done'
          and r.listing_state = 'active'
          and p.content_hash = c.content_hash
      );
    return v_count;
  end if;

  with target as (
    select c.pid, c.content_hash
    from public.mvp_listing_ai_classifications c
    where c.classified_at < v_cutoff
      and not exists (
        select 1
        from public.mvp_raw_listings r
        join public.mvp_listing_parsed p on p.pid = r.pid
        where r.pid = c.pid
          and r.detail_status = 'done'
          and r.listing_state = 'active'
          and p.content_hash = c.content_hash
      )
    order by classified_at
    limit greatest(1, p_batch_limit)
  )
  delete from public.mvp_listing_ai_classifications c
  using target t
  where c.pid = t.pid and c.content_hash = t.content_hash;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
```

### Prune predicate 의미

| 조건 | 의미 |
|---|---|
| `classified_at < now() - 14d` | 14일 이상 묵은 cache row만 대상 |
| `not exists active raw + 동일 content_hash` | 현재 활성 매물의 hash가 아니면 cache 무용 → 삭제 |

→ 활성 매물의 hash와 일치하는 cache는 14일 지나도 보존. 단조 폭증 방지 + 활성 분류 cache hit 보장.

### Dry-run 시뮬레이션 (review-only, supabase MCP execute_sql 가능)

현 cache state (Wave 29 시점):
- `mvp_listing_ai_classifications` total: 529 rows
- 분포: 대부분 최근 1주일 이내 (Phase 1 dry-run 1회 적재)

dry-run 호출 예시 (apply 금지, supabase SQL editor 또는 execute_sql):
```sql
-- Wave 30 시점에는 함수 자체가 DB에 없음. 본 SQL은 review-only.
-- apply 후에:
select public.prune_mvp_listing_ai_classifications(14, 5000, true) as eligible_count;
```

현 시점 dry-run 예상치:
- cache 다 1주일 이내 → 14d cutoff 미달 → eligible_count = 0
- Phase 2 enable + 30일 운영 후 expected eligible: 100~300 row/day (가설)

### Housekeeper integration

apply 시 [`src/lib/compliance-retention.ts`](src/lib/compliance-retention.ts) 패턴 그대로 — 별도 helper `runAiCacheRetention()` + 별도 cron route 또는 기존 `compliance-retention` cron에 호출 추가. **본 wave에서 apply 0**.

### 변경 예상 라인 수

- 신규 SQL function 1개 (schema.sql 또는 별도 migration)
- 신규 helper `src/lib/compliance-retention.ts` 또는 `src/lib/ai-cache-retention.ts`: 약 30줄
- cron 등록: 별도 wave

---

## 4. Item 4 — FK migration apply gate 5-check checklist (review-only)

Wave 29 doc은 4개 check를 명시했음. Tiny escrow runtime plan + 본 wave 설계로 1개 추가 → 정식 5조건.

### The 5 checks

| # | Check | What pass means | Current state |
|---|---|---|---|
| 1 | **AI cache row count baseline 안정** | 24시간 cache row 증가량 < 50/day, 누수 없음. baseline 측정 완료 후 변동 ±10% 이내 | **미충족** — baseline 측정 X. Phase 1 dry-run 1회 적재로 529 row, 일별 증가량 모름 |
| 2 | **Retention prune script + 1일 dry-run** | Item 3 SQL function apply + dry-run으로 eligible count 측정, expected 0 (현 시점) | **review-only 완료, apply 미** — 본 wave Item 3 |
| 3 | **scoreStage 예외 path code review-only 문서** | Item 1 설계 통과 + escrow gate predicate 명세 + 변경 예상 라인 수 측정 | **review-only 완료** — 본 wave Item 1 |
| 4 | **pool-policy `ai_escrow_pending` flag 명시** | Item 2 설계 통과 + POOL_BLOCK_FLAGS 추가 위치 명세 | **review-only 완료** — 본 wave Item 2 |
| 5 | **Tiny escrow feature flag default-off + env 명세** | `AI_L2_ESCROW_NEEDS_REVIEW_ENABLED` default unset, `_CAP` default 25, 두 env 모두 LAUNCH_PLAN/AGENTS.md에 documented | **review-only 완료** — 본 wave Item 1 안에 명세. AGENTS.md 명시 별도 |

### Score: 1 review-only / 4 미충족 → 0 production-ready

**현 시점에서는 0개가 production-ready로 충족.** Wave 30 결과: 5개 중 4개가 review-only로 정리됨, 1개 (cache baseline)는 추가 측정 wave 필요.

### Next steps (이 wave 마감 후)

1. **다음 wave (cache baseline)**: 24~48시간 모니터링으로 cache row count 추이 측정. apply 0.
2. **그 다음 wave (Phase 2 actual apply)**: 5조건 충족 후 FK migration + 위 4개 항목 코드/SQL 적용을 atomic하게.
3. **법률의견서**: 본 wave 별개. compliance side.

### Apply 직전 남은 blocker (사용자 보고용 정확 문구)

1. AI cache row count baseline 24h 모니터링 미실시 (check 1)
2. retention SQL function DB apply 안 됨 (check 2 — review-only, apply 미)
3. scoreStage escrow exception 실제 코드 머지 안 됨 (check 3 — review-only)
4. pool-policy.mjs ai_escrow_pending 등 flag 실제 add 안 됨 (check 4 — review-only)
5. env var 문서화 미적용 (check 5 — 본 wave decision log만)

---

## 5. 종합 결과

### What this wave actually changed

- Code: **0줄**.
- DDL: **0**.
- Runtime config: **0** (cron, env, vercel.json 등).
- 신규 파일: 본 decision log + `reports/wave30-smartphone-ai-l2-phase2-review-latest.md`.

### Phase 2 entry conditions

- 5개 정식화 완료 (Wave 29 4개 + 본 wave 1개 추가).
- 충족: **0/5 production-ready**, **4/5 review-only 완료**, **1/5 추가 측정 필요**.

### Smartphone narrow lane status

- deterministic hold 유지 (Wave 29 결정).
- broad widening 금지 유지.
- silent carrier 추정 금지 유지.
- Phase 1 (parser metadata bridge): 이미 코드에 있음 ([pipeline.ts:1274-1281](src/lib/pipeline.ts:1274)).
- Phase 2 (escrow inclusion): **review-only 설계까지만**. apply 별도 wave.

### 다음 wave 1개 (권고)

**Wave 31 — AI cache row count baseline 측정**:
- 24~48시간 사이 `mvp_listing_ai_classifications` row count 추이 측정
- apply 0, DDL 0, 측정만
- 결과로 Item 4 check 1 충족 여부 결정
- 충족 시 다음 wave (Phase 2 actual apply) 진입 가능

### 변경 정리 — 무엇도 건드리지 않음

- `tick-pipeline.ts`: 0줄
- `pool-policy.mjs`: 0줄
- `pipeline.ts`: 0줄
- `option-parser.ts`: 0줄
- `catalog.ts`: 0줄
- `schema.sql`: 0줄
- DB: 0 migration
- env: 0 추가
- cron: 0 신규

본 wave는 글만 박았다.
