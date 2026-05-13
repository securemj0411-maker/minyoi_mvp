# Wave 54 — Internal acquisition cap=16 apply RESULT

> Status: **applied successfully.** rows=16 / failedRows=0 / raw 16 + parsed 16 upsert. candidate_pool write 0, public promotion 0, pool_eligible=false 전건, score_dirty=false 전건. seller_name 어디에도 저장 안 됨.

## 1. Apply 실행
- 명령: `INTERNAL_ACQUISITION_WRITE_APPROVED=1 npx tsx scripts/apply-internal-acquisition-executor.ts --apply=1 --fresh-refetch=1`
- preflight: Wave 54 scoped (3 lanes, 2 drift 영구 제외) = 16 rows
- 결과: `{"rows":16,"failedRows":0,"rawUpsertRows":16,"parsedUpsertRows":16}`
- fresh-refetch에서 추가 drift 발견 없음 (Wave 52b 시 2건 drift는 사전 제외 효과).

## 2. DB Verification

| Check | Value | 기대값 |
|---|---:|---|
| target raw rows | 16 / 16 | 16 ✓ |
| target parsed rows | 16 / 16 | 16 ✓ |
| parser_version='option-parser-v31' | 16 / 16 | 16 ✓ |
| pool_eligible=true (targets) | **0** | 0 ✓ |
| score_dirty=true (targets) | **0** | 0 ✓ |
| targets in candidate_pool | 1 (pre-existing) | apply 후 +0 |
| listing_state=active / detail_status=done | 16 / 16 | 16 ✓ |

## 3. Privacy / 정책 사이드 체크
- executor patch (Wave 54): `seller_name` rawPayload spread에서 제거, raw_json에도 shop_name 미포함.
- post-apply 16 raw rows의 schema 컬럼 셋: top-level에 `seller_name` 없음 (production schema 자체에 없음, drift 자동 차단). `raw_json` 내부 shop_name 0건.
- seller 식별 컬럼 보존: `seller_uid` ✓, `seller_source='bunjang'` ✓.

## 4. Out-of-scope 보존 (untouched)

| 항목 | Wave 51/47 baseline | Wave 54 후 |
|---|---:|---:|
| needs-owner 407 stale row | 407 | **407** ✓ |
| escrow held analysis | 8 | **8** ✓ |
| Phase A backup table rows | 15,294 | 15,294 ✓ |
| PS5 lane evidence/SKU 정합화 | open | open (Wave 55) |

## 5. 3 reports (재측정)

### 5.A pack-open-quality
| action | count |
|---|---:|
| runtime_ok | 42 |
| sync_or_invalidate | 4 |
| recheck_before_invalidate | 2 |

pre-existing 운영 상태 그대로. Wave 54 induced regression 없음.

### 5.B db-hotpaths (window 1h, run 80, queue 300)
- runs **34** / failed **3** / failure rate **8.8%** / pg_stat=ok
- top suspect: detail_worker 201.7s
- 동일 transient `mvp_sellers fetch failed` 패턴, 세션 전반 동등 수준 (Wave 52b 16.7% → 8.8% 정상화).

### 5.C current-state-board
- decision: `needs_operational_attention_before_runtime_patch` (pre-existing, Wave 54 induced 아님)
- source health: `-` (변동 없음)
- pack reveal: 42/48 (변동 없음)
- active ready pool: 345 (세션 중 자연 성장, Wave 54 apply가 pool_eligible=false라 직접 기여 0)

## 6. Pool / public delta (운영 안전 확인)
- candidate_pool 982 → 1015 (세션 중 자연 성장 +33, Wave 54 apply에서 targets 추가 0 — pool_eligible=false 정책으로 차단됨).
- target 16 row 중 candidate_pool 진입은 pre-existing 1건만, **Wave 54 apply 직접 효과 0** ✓.
- public/landing/pack reveal 영향 없음.

## 7. 원칙 ack
- fresh-refetch 필수: ✓ (`--fresh-refetch=1`)
- drift row 제외: ✓ (407507139, 407128952 영구 제외)
- seller_name 저장 금지: ✓ (top-level + raw_json 모두 0건)
- candidate_pool write 0: ✓ (targets 신규 진입 0)
- public promotion 0: ✓
- pool_eligible=false: ✓ (16/16)
- score_dirty=false: ✓ (16/16)
- needs-owner 407 untouched: ✓
- PS5 미포함: ✓ (Wave 55 분리)

## 8. 변경/검증/위험
- 변경: 16 raw upsert + 16 parsed upsert.
- 검증: rows=16/0 fail / DB 8 columns 정합 / pack 42 / hotpaths 8.8% / board pre-existing
- 위험: 없음
- 다음: PS5 owner decision (Wave 55).

## 9. 남은 blocker
1. R3 contentHash 더블체크 path
2. needs-owner 407 stale row 사인오프
3. Phase A backup table DROP (2026-05-21+)
4. **PS5 lanes 21 rows owner decision** (Wave 55 — A/B/C/D)

→ **남은 blocker 4건**. Wave 54 acquisition blocker 폐기.
