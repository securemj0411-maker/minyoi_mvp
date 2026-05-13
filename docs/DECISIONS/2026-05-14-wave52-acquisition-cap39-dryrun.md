# Wave 52 — Internal acquisition 1차 dry-run (cap 39)

> Status: **dry-run only, NOT CLEAN.** apply=0, candidate_pool write=0, public promotion=0, DDL=0. 5 lanes × 39 rows 평가 결과 **PS5 lanes 21 rows 구조적 fail**, 나머지 3 lanes 18 rows clean.

## 1. Scope

| lane | cap | proposedCount | evidence |
|---|---:|---:|---|
| monitor_exact_model_code | 8 | 8 | reports/monitor-exact-no-write-detail-verification-latest.md |
| speaker_jbl_flip6 | 6 | 6 | reports/jbl-flip6-no-write-detail-verification-latest.md |
| ipad_pro_11_m4_256_wifi | 4 | 4 | reports/ipad-pro-11-m4-no-write-detail-verification-latest.md |
| ps5_disc_basic | 10 | 10 | reports/ps5_disc_basic-no-write-detail-verification-adapter-latest.md |
| ps5_digital_basic | 11 | 11 | reports/ps5_digital_basic-no-write-detail-verification-adapter-latest.md |
| **total** | **39** | **39** | |

## 2. dry-run 결과

| Metric | Value |
|---|---:|
| mode | dry_run |
| runtimeMutation / supabaseMutation / publicPromotion | false / false / false |
| candidatePoolWrites | 0 |
| poolEligibleDefault | false |
| scoreDirtyDefault | false |
| rows | 39 |
| **failedRows** | **21** |
| rawUpsertRows / parsedUpsertRows | 0 / 0 |

산출물: `reports/wave52-acquisition-dryrun-cap39-latest.json`.

## 3. failure 분류 (PS5 21건)

| lane | count | errors_unique |
|---|---:|---|
| ps5_digital_basic | 11 | `unknown_sku:policy-ps5-digital-basic`, `parsed_needs_review_from_evidence`, `evidence_reparse_comparable_key_mismatch` |
| ps5_disc_basic | 10 | `unknown_sku:policy-ps5-disc-basic`, `parsed_needs_review_from_evidence`, `evidence_reparse_comparable_key_mismatch` |

### 해석
- `unknown_sku:policy-ps5-*-basic`: evidence가 catalog에 없는 synthetic policy SKU id 사용. catalog 등록 부재 또는 SKU id mismatch.
- `parsed_needs_review_from_evidence`: evidence 자체가 needs_review=true. apply 시 internal에도 needs_review 진입 → 구조적 hold.
- `evidence_reparse_comparable_key_mismatch`: evidence 시점 comparable_key vs 현재 parser 재실행 결과 mismatch. Wave 51 parser 정합화 영향 가능성 + game-console 전용 parser 영향.

**PS5 lanes는 본 dry-run에서 apply 자격 없음.** evidence 재생성 + catalog SKU 등록 또는 정책 재정의 사전 필요.

## 4. clean subset (apply 자격 18 rows)

| lane | rows | status |
|---|---:|---|
| monitor_exact_model_code | 8 | clean ✓ |
| speaker_jbl_flip6 | 6 | clean ✓ |
| ipad_pro_11_m4_256_wifi | 4 | clean ✓ |
| **total clean** | **18** | |

## 5. 현재 ops state snapshot (apply 결정 참고)

- `report:db-hotpaths --window-hours=1 --run-limit=80 --queue-limit=300`: **runs=20 / failed=4**, pg_stat=ok. failure pattern 동일 transient `mvp_sellers fetch failed` — Wave 51 후 동일, 신규 spike 아님.
- `report:pack-open-quality`: 42 runtime_ok / 4 sync_or_invalidate / 2 recheck = 48 total. pre-existing 운영 상태.
- source health: 직접 신호 미보고, 별도 악화 없음.
- candidate_pool 982 (Wave 51 후 변동 0).
- needs-owner 407 stale parser_version row 그대로 untouched.

## 6. 원칙 ack
- apply 금지 (이번 wave): ✓
- candidate_pool write 금지: ✓ (dry-run 0)
- public promotion 금지: ✓
- DDL 금지: ✓ (preflight subset 작성/복원 file-level만)
- RPC/raw-touch batching 금지: ✓
- needs-owner 407 reparse rows 건드리지 않음: ✓ (acquisition pid set과 분리)

## 7. Owner 결정 옵션

A. **clean 18 apply, PS5 21 보류** — 1차 apply 즉시 진행 가능. PS5 root cause는 별도 wave (catalog SKU 등록 또는 evidence 재생성).

B. **전체 보류, PS5 root cause 먼저 해결** — Wave 53에서 catalog 등록 + evidence 재생성 + dry-run 재실행.

C. **scope 축소: monitor+JBL+iPad만 cap=18로 재정의** — 옵션 A와 동일 결과.

추천: **A** (clean 18 apply, PS5 분리 wave). lift 즉시 확보 + 위험 분리.

## 8. Apply 시 필요한 절차 (A 선택 시)
1. preflight 재작성: 5 lanes → 3 lanes (monitor 8 + JBL 6 + iPad 4 = 18).
2. dry-run 재실행 → failedRows=0 확인.
3. `INTERNAL_ACQUISITION_WRITE_APPROVED=1` env + `--apply=1 --fresh-refetch=1` 로 executor 실행.
4. apply 후 검증: pack-open / db-hotpaths / pool leak / source health / candidate_pool 변동 0.

## 9. 변경/검증/위험
- 변경: 없음 (preflight subset 임시 작성/복원, 산출물 1개)
- 검증: dry-run rows=39 / failed=21 / writes 0
- 위험: 없음 (read-only)
- 다음: Wave 53 — owner 옵션 선택 (A/B/C).

## 10. 남은 blocker
1. R3 contentHash 더블체크 path
2. needs-owner 407 stale row 사인오프
3. backup table DROP (7d)
4. PS5 lanes evidence/SKU 정합화 (본 wave 신규 발견)

→ **남은 blocker 4건.**
