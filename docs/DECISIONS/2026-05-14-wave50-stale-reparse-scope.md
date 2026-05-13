# Wave 50 — Stale parser_version reparse dry-run scope

> Status: **read-only dry-run.** DB write 0, pool write 0, parser code 0, DDL 0. 전체 stale 모집단 15,294건 in-process replay 완료. apply는 owner 사인오프 별도.

상세 데이터는 `reports/wave50-stale-reparse-scope-latest.{md,json}` 참조.

## 1. 결과 요약

| 분류 | 수량 | 비중 |
|---|---:|---:|
| **auto_safe_no_change** | 14,857 | 97.1% |
| **auto_safe_storage_resolve** | 30 | 0.2% |
| needs_owner_pool_member | 41 | 0.3% |
| needs_owner_needs_review_flip_to_true | 365 | 2.4% |
| needs_owner_confidence_drop | 1 | 0.0% |
| sku_shift / category_shift / blocked | 0 | 0% |

→ auto-safe 합 **14,887 (97.3%)**, needs-owner **407 (2.7%)**, blocked **0**.

## 2. 핵심 패턴

- **97.1% no-change**: 대다수 stale row는 reparse 시 동일 결과. v26-v30 parser와 v31의 차이는 좁은 케이스에 한정.
- **storage resolve 30건**: 1024gb(27) / 2048gb(2) / 256gb(1). 주로 `1테라` glued 패턴. Wave 49 fixture가 확인한 패턴과 일치.
- **needs_review_flip_to_true 365건**: AirPods Max `lightning` silent inference 제거 (v31 stricter)가 주된 원인. **잘못된 deterministic을 needs_review로 바로잡는 정확성 향상**이지만 downstream 영향이 있어 owner review.
- **pool member 41건**: pool 980+ 중 reparse로 key/sku/category 변경되는 row. 사인오프 필수.

## 3. apply 적용 시 cap

- 청크 크기 500, 간격 30s.
- **Phase A (auto-safe 14,887)**: 일괄 적용 가능. pool 영향 없음.
- **Phase B (needs_owner 407)**: per-pid review.
- **Phase C (pool_member 41)**: pool 잠정 제거 → reparse → 재진입 평가.

## 4. Rollback 계획

backup 테이블 `mvp_listing_parsed_backup_wave50` 생성 → reparse → 7일 검증 → DROP. anomaly 발생 시 backup에서 복원 SQL 사전 정의 (md 산출물 §7).

## 5. 원칙 ack
- DB write 금지: ✓
- candidate_pool write 금지: ✓
- public promotion 금지: ✓
- parser code patch 금지: ✓
- escrow gate 재활성 금지: ✓
- DDL/RPC 금지: ✓

## 6. 변경/검증/위험
- 변경: `scripts/wave50-stale-reparse-scope.ts` (NEW, read-only)
- 검증: tsc clean, full replay 15,294 rows / 0 throw / 0 raw_missing
- 위험: 없음
- 다음: Wave 51 — owner 사인오프 후 Phase A 적용 (또는 보류)

## 7. 남은 blocker
1. R3 contentHash 더블체크 path (retention 트랙)
2. **stale reparse owner 사인오프** — 본 wave 데이터로 결정 가능

→ **남은 blocker 2건.**
