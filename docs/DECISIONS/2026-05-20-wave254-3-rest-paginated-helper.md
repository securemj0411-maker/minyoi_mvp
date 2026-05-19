# Wave 254.3 — restFetchPaginated shared helper + Wave 252.B silent miss baseline

## 결론 요약 (3 lines)

1. **systemic cap miss fix** — `mvp/src/lib/rest-paginated.ts` 신설 (PATCH/GET/POST 1000-row cap 자동 chunk + offset pagination + Wave 253 Prefer/on_conflict 통합). 기존 3 helper (`loadParsedRowsByComparableKeys` / `triggerRematchForListings` PATCH chunk / `fetchPidsBySkuIds` / `enqueueDetailQueue` / `triggerRematchForParserVersions` page-loop) 모두 shared helper 로 refactor.
2. **Wave 252.B silent miss 측정**: clothing v3 매물 **2,183건 / v7 2,107건 / v4 124건** (사용자 매물 영향: candidate=0건). v3 listings 의 **2,183 모두 score_dirty=true 박혀있으나 parser_version 은 stuck**.
3. **retry helper 신설** — `retryStaleParserVersions` (max 3 + exponential backoff hint). Wave 252.B 같은 silent miss 자동 재시도용.

## 사용자 명시 plan 준수

| 항목 | 상태 |
|------|------|
| restFetchPaginated 신설 (`src/lib/rest-paginated.ts`) | done |
| PATCH/GET/POST 모두 cover | done (restFetchAll / patchAllByPids / insertIgnoreRows) |
| 1000-row cap 자동 chunk + offset pagination | done (POSTGREST_DEFAULT_PAGE=1000, REST_IN_CLAUSE_PID_CHUNK=1000) |
| retry on transient (restFetch 재사용) | done (existing restFetch backoff inherited) |
| Wave 253 fix 통합 (Prefer + on_conflict) | done (insertIgnoreRows API) |
| 기존 helper refactor (3곳) | done — 5곳 refactor (loadParsedRowsByComparableKeys + fetchPidsBySkuIds + enqueueDetailQueue + triggerRematchForListings PATCH + triggerRematchForParserVersions page-loop) |
| test:core 회귀 검증 | done (615 tests / 604 pass / 11 fail = baseline 11 fails 동일, 차이 0) |
| additive — DB UPDATE X | done (fetch logic refactor only) |
| Wave 252.B silent miss baseline | done (위 결과) |
| retry logic 확장 | done (retryStaleParserVersions + 2 tests) |

## 영역 1 cap miss — 변경 detail

### Before
- `tick-pipeline.ts:2049 loadParsedRowsByComparableKeys`: `limit=${Math.max(limit, chunk.length * 100)}` → PostgREST server-side default 1000 row cap 로 silent truncation. 12,736 stale chain root cause.
- `rematch-helpers.ts:213/288 triggerRematchForSkus/Listings`: PATCH chunk 5000 (URL 길이 한계 부근). `fetchPidsBySkuIds` / `enqueueDetailQueue` 내부 page-loop 중복.
- 페이지네이션 / chunk / Prefer 패턴 5곳 흩어짐.

### After
- `rest-paginated.ts`:
  - `POSTGREST_DEFAULT_PAGE = 1000` (cap 상수화).
  - `restFetchAll<T>(url, opts)` — offset pagination + `order=pid.asc` 자동 + `limit/offset` 자동 strip + `maxRows` 안전 cap.
  - `patchAllByPids(table, pids, opts)` — `chunkSize` 자동 1000 clamp + URL 길이 안전.
  - `insertIgnoreRows(table, rows, opts)` — `Prefer: resolution=ignore-duplicates` + `on_conflict` URL param 통합 (Wave 253 fix A 강제 가드).
- `tick-pipeline.ts:2049`: `restFetchAll` 사용 — cap 1000 silent miss fix.
- `rematch-helpers.ts:enqueueDetailQueue`: `insertIgnoreRows` 사용 — Prefer/on_conflict 통합.
- `rematch-helpers.ts:fetchPidsBySkuIds`: `restFetchAll` 사용 — inline page-loop 제거.
- `rematch-helpers.ts:triggerRematchForListings`: `patchAllByPids` 사용 — chunk URL 안전.
- `rematch-helpers.ts:triggerRematchForParserVersions`: `restFetchAll` 사용 — Wave 252.B step 1 의 inline page-loop refactor.

## Wave 252.B silent miss baseline (2026-05-20 측정)

### SQL (재현 가능)
```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE lp.parser_version = 'wave216-clothing-v7') AS v7_done,
  COUNT(*) FILTER (WHERE lp.parser_version = 'wave216-clothing-v3') AS v3_silent_miss
FROM mvp_listing_parsed lp
JOIN mvp_raw_listings r ON r.pid = lp.pid
WHERE r.score_dirty = true
  AND r.listing_state = 'active'
  AND lp.parser_version IN ('wave216-clothing-v3', 'wave216-clothing-v7');
```

### 결과
| Metric | Value |
|--------|-------|
| total (clothing v3+v7 score_dirty) | **2,171** |
| v7 done | 38 (1.75%) |
| v3 silent miss | **2,133 (98.25%)** |

### parser_version 전체 분포
| parser_version | total | score_dirty | active |
|----------------|-------|-------------|--------|
| wave216-clothing-v3 | 2,183 | 2,183 | 2,116 |
| wave216-clothing-v7 | 2,107 | 47 | 2,099 |
| wave216-clothing-v4 | 124 | 3 | 124 |

### sample 10건 (사용자 매물 영향 확인)
| pid | sku_id | comparable_key | price | detail_status |
|-----|--------|----------------|-------|---------------|
| 403034737 | clothing-tnf-nuptse-1996 | tnf_nuptse_1996/c_grade | 50,000 | pending |
| 245433370 | clothing-tnf-supreme-collab | tnf_supreme_collab/a_grade | 380,000 | pending |
| 334866541 | null (broad) | adidas_trefoil/c_grade | 2,766,000 | pending |
| 395956260 | clothing-tnf-supreme-collab | tnf_supreme_collab/c_grade | 845,000 | pending |
| 310186151 | clothing-tnf-supreme-collab | tnf_supreme_collab/a_grade | 560,000 | pending |
| 308326233 | clothing-tnf-supreme-collab | tnf_supreme_collab/b_grade | 820,000 | pending |
| 407621833 | null (broad) | adidas_trefoil/c_grade | 1,596,000 | pending |
| 407751816 | null (broad) | tnf_mountain_jacket/unknown | 200,000 | skipped |
| 395756721 | clothing-tnf-supreme-collab | tnf_supreme_collab/unknown | 450,000 | pending |
| 392901390 | null (broad) | adidas_trefoil/a_grade | 2,022,000 | pending |

**핵심 관찰**: detail_status='pending' 으로 박혀있으나 parser_version 은 여전히 v3. Wave 252.B step 1 trigger 후 detail-worker 재실행이 안 됨 — Wave 254 진단의 "queue starved" 가설과 일치. **사용자 매물 candidate=0건 → freemium pool 영향 무**.

### Wave 254.4 결정 기반 (사용자 결정 필요)
- Wave 252.B silent miss 2,133건은 **사용자 매물 reveal 영향 없음** (candidate=0).
- 그러나 **시세 산정 base 매물 수 감소** (98.25% 가 v3 stale comparable_key).
- 옵션:
  - 옵션 A: 보류 — 자연 reparse 추이 1h 모니터 후 결정 (사용자 명시 step 9 분기).
  - 옵션 B: `retryStaleParserVersions` 활용 — explicit re-trigger (additive).
  - 옵션 C: queue priority 조정 — v3 매물 우선 claim (별도 wave, 큰 변경).

→ 사용자 결정 필요. 자율 X.

## retry helper 신설 (rematch-helpers.ts)

```ts
export async function retryStaleParserVersions(
  parserVersions: string[],
  reason: string,
  opts: RetryStaleOptions = {},
): Promise<RematchResult>
```

- max retry 3 (default), exponential backoff hint (1s/2s/4s).
- attempt > maxRetries 시 warning log + no-op.
- delegate to `triggerRematchForParserVersions` (`reason#attempt=N` 박힘 — audit log).
- additive — destructive UPDATE X. 호출자가 명시적으로 `dryRun: false` 박아야 PATCH.

## test 결과

| Suite | Tests | Pass | Fail | 비고 |
|-------|-------|------|------|------|
| `wave254-3-rest-paginated.test.ts` (신규) | 13 | 13 | 0 | restFetchAll/patchAllByPids/insertIgnoreRows + retry |
| `wave252-c-rematch-helpers.test.ts` (보강) | 12 | 12 | 0 | 기존 10 + retry 2 신규 |
| **test:core 전체** | 615 | 604 | 11 | baseline 11 fail 동일 (pre-existing /me UI) |

## 사용자 정책 준수 (memory)

- additive only (feedback_destructive_actions_require_explicit_confirm) ✓
- decision log 즉시 (feedback_decision_log_required) ✓
- test:core 회귀 검증 ✓
- destructive UPDATE 자율 X ✓
- 사용자 결정 필요한 정책 변경 (Wave 254.4 backfill 옵션) → 보고만 ✓
- systemic / 1타 2피 / whack-a-mole 종료 ✓ — 5곳 cap miss 패턴 1 helper 로 통합

## 변경 파일

- `mvp/src/lib/rest-paginated.ts` (신규 — 178 라인)
- `mvp/src/lib/tick-pipeline.ts` (refactor `loadParsedRowsByComparableKeys` + 1 import)
- `mvp/src/lib/rematch-helpers.ts` (refactor 4 함수 + retryStaleParserVersions 신설)
- `mvp/tests/wave254-3-rest-paginated.test.ts` (신규 — 13 tests)
- `mvp/tests/wave252-c-rematch-helpers.test.ts` (보강 — retry 2 tests)
- `mvp/docs/DECISIONS/2026-05-20-wave254-3-rest-paginated-helper.md` (본 log)

## 후속 (사용자 결정 후)

- Wave 254.4 — Wave 252.B silent miss 2,133건 backfill 옵션 (사용자 결정 후, 자율 X)
- 1h 후 모니터 — markRawScoreDirty 호출 비율 + v3 reparse 추이
- AI L2 24h shadow audit alert 시 별도 wave (병렬 자동)
