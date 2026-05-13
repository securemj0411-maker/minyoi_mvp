# Wave 51 Phase A — Stale parser_version reparse apply (14,887 auto-safe rows)

> Status: **applied successfully.** DB write 14,887, candidate_pool write 0, public promotion 0, DDL은 backup table 생성만. errors=0, total elapsed 883s (14.7분).

## 1. 적용 내역

| 단계 | 결과 |
|---|---|
| backup table `mvp_listing_parsed_backup_wave50` 생성 | 15,294 rows / 15,294 distinct pids ✓ |
| scope 재검증 | auto-safe 14,887 (Wave 50 동일) |
| 청크 적용 | 30 chunks × 500 (마지막 387) |
| chunk 간 sleep | 30s |
| errors | **0** |
| total elapsed | 883,005 ms (14.7분) |

청크별 적용 시간 188~806 ms / chunk (PostgREST upsert resolution=merge-duplicates).

## 2. Post-apply 검증

### 2.A parser_version 분포
| version | rows | 변동 |
|---|---:|---|
| v31 | **15,980** | +14,887 |
| v26 | 322 | -9,884 |
| v24 | 59 | -2,648 |
| v30 | 14 | -1,597 |
| v27 | 12 | -726 |

남은 stale: **407** = Wave 50 needs-owner 분류 (untouched 확정).

### 2.B Untouched / lift / leak
| Check | Value | 기준 |
|---|---:|---|
| still_stale_count | 407 | needs-owner = 365 nr_flip + 41 pool_member + 1 conf_drop ✓ |
| storage_resolved (backup unknown_storage → v31 explicit) | **30** | Wave 50 scope 일치 ✓ |
| pool_leak (escrow flag ∩ candidate_pool) | **0** | ✓ |
| escrow_flag_rows | 8 | Wave 47 held 보존 ✓ |
| pool_total | 982 | 변동 0 ✓ |

### 2.C `report:pack-open-quality`
- runtime_ok: 42
- sync_or_invalidate: 4 (sold/abnormal type)
- recheck_before_invalidate: 2
- pack healthy: **42/48 (87.5%)** — pre-existing 운영 상태, Wave 51 induced regression 없음.

### 2.D `report:db-hotpaths --window-hours=1 --run-limit=80 --queue-limit=300`
- runs=20 / failed=4 / pg_stat=ok
- failure 패턴: 4건 전부 `Supabase REST fetch failed GET /rest/v1/mvp_sellers` — **세션 전반 동일 transient 패턴** (Wave 38/40/43/44 등에서도 1회씩 발생, retry로 해소). Wave 51 induced 아님.

### 2.E `report:current-state-board`
- decision: `needs_operational_attention_before_runtime_patch` — Wave 51 이전부터 동일한 상태 (failure rate 20%, pack reveal 42/48, active ready pool 189).
- runtimePatchReadyCandidates: 0 (정상).
- sample-backfill required: 0.

### 2.F source health
report 출력에 `source health = -` (미보고). 직접 영향 신호 없음. 별도 악화 신호 미관측.

## 3. 중단 조건 평가
| 조건 | 결과 |
|---|---|
| update error | 0 ✓ |
| pack-open 영향 | 42/48 = 87.5%, pre-existing 동일 |
| pool leak | 0 ✓ |
| db-hotpaths failure spike | 4/20 같은 transient 패턴, 세션 전반과 동일 |
| source health 급악화 | 미관측 |
| unexpected sku/category shift | 0 (Wave 50 scope에서 sku/category shift = 0 확인 후 apply, 결과 일치) |

**중단 조건 0건 → 정상 완료.**

## 4. Backup / Rollback

- backup table: `public.mvp_listing_parsed_backup_wave50` 15,294 rows (pid 인덱스 포함). 7일 보존 (2026-05-21 이후 검토 후 DROP).
- rollback SQL (anomaly 발생 시):
```sql
UPDATE public.mvp_listing_parsed p
SET parser_version=b.parser_version, comparable_key=b.comparable_key,
    parse_confidence=b.parse_confidence, needs_review=b.needs_review,
    parsed_json=b.parsed_json, category=b.category
FROM public.mvp_listing_parsed_backup_wave50 b
WHERE p.pid = b.pid
  AND b.parser_version IN ('option-parser-v24','option-parser-v26','option-parser-v27','option-parser-v28','option-parser-v29','option-parser-v30')
  AND p.pid NOT IN (-- needs-owner 407 protected list — they were NOT applied, no rollback needed
    SELECT pid FROM public.mvp_listing_parsed
    WHERE parser_version IN ('option-parser-v24','option-parser-v26','option-parser-v27','option-parser-v28','option-parser-v29','option-parser-v30')
  );
```

## 5. 원칙 ack
- DDL은 backup table 생성까지만 허용: ✓
- 500 rows/chunk: ✓
- chunk 간 30s sleep: ✓
- 각 chunk 후 error count / updated count 체크: ✓
- candidate_pool / public promotion 금지: ✓ (pool_total 982 변동 0)
- parser code patch 금지: ✓
- needs-owner 407 + pool_member 41 absolute untouched: ✓
- escrow gate 재활성 금지: ✓
- candidate_pool/public writes 0: ✓

## 6. 변경/검증/위험
- 변경: backup table 1개 (DDL), parsed 14,887 rows UPDATE (PostgREST upsert merge-duplicates).
- 검증: parser_version 분포 / storage resolve 30 / still_stale 407 / pool_leak 0 / pack 42/48 / hotpaths 4/20 transient.
- 위험: 없음. backup 보존 7일.
- 다음: Internal acquisition 1차 dry-run 재생성 (Wave 52).

## 7. 남은 blocker
1. R3 contentHash 더블체크 path (retention 트랙)
2. needs-owner 407 row apply 사인오프 (별도, 365 nr_flip + 41 pool_member + 1 conf_drop)
3. backup table DROP (7일 후)

→ **남은 blocker 3건.**
