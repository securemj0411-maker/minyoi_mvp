# Wave 54 — Executor seller_name 제거 + cap=16 dry-run (apply 대기)

> Status: **code patch applied, dry-run clean. apply는 owner 사인오프 대기.** DB write 0, candidate_pool write 0, public promotion 0, DDL 0. privacy policy 강화 — `seller_name` 어디에도 저장 안 함.

## 1. Privacy policy

owner 결정 (Wave 53 후속):
- `seller_name` (raw shop name) **top-level column 저장 금지**
- `raw_json.shop_name` 보존도 **금지**
- 허용되는 seller 식별: `seller_uid` / hashed id / `is_proshop` / review stats

## 2. 변경 내역

| 파일 | 변경 |
|---|---|
| `scripts/apply-internal-acquisition-executor.ts` line 214 | `seller_name: fresh?.shopName ?? null,` **제거**. raw_json에도 shop_name 추가 안 함. comment로 정책 명시. |

patched rawPayload spread (rebuildWithFreshDetail):
`description_preview, sale_status, shop_review_rating, shop_review_count, seller_uid, trade_data, trades_data, image_url_template, image_count, thumbnail_url, raw_json, updated_at`

12개 필드 모두 `mvp_raw_listings` schema와 일치 ✓.

부수 수정:
- `scripts/wave52-fresh-validation-probe.ts` — duplicate `pid` 키 tsc warning 정리 (Wave 52 probe diagnostic). runtime 무관.

## 3. 검증

| 항목 | 결과 |
|---|---|
| `grep seller_name scripts/apply-internal-acquisition-executor.ts` | comment 1줄 외 0 hit ✓ |
| `npx tsc --noEmit` | clean |
| `npm run test:core` | **133/133 pass** |

## 4. cap=16 dry-run 재실행

scope: monitor 8 (-1 drift) + JBL 6 + iPad 4 (-1 drift) = **16 rows** (Wave 52b drift 2건 영구 제외).

| Metric | Value |
|---|---:|
| mode | dry_run |
| rows | 16 |
| **failedRows** | **0** |
| rawUpsertRows / parsedUpsertRows | 0 / 0 |
| runtimeMutation / supabaseMutation / publicPromotion | false / false / false |
| candidatePoolWrites | 0 |
| poolEligibleDefault | false |
| scoreDirtyDefault | false |
| has_seller_name in any payload | **false** ✓ |

산출물: `reports/wave54-cap16-dryrun-latest.json`.

## 5. Apply 직전 안전 check

- preflight 원본 (12 lanes / cap 136) 복원 완료. Wave 54 scoped 파일은 별도 산출물에 보존.
- needs-owner 407 stale row untouched (Wave 51 보존).
- escrow held 8 보존 (Wave 47).
- candidate_pool 982, listings 9,783, escrow gate OFF 유지.
- Wave 51 Phase A backup table 보존 (2026-05-21 이후 검토).

## 6. Apply 시 절차 (owner 사인오프 후)
1. preflight subset 재작성 (Wave 54 scope 그대로 16 rows).
2. `INTERNAL_ACQUISITION_WRITE_APPROVED=1 npx tsx scripts/apply-internal-acquisition-executor.ts --apply=1 --fresh-refetch=1`.
3. 첫 시도: fresh-refetch가 추가 drift 발견 가능. drift 발생 시 pid 제외 → 재 dry-run → 재 apply.
4. apply 성공 시:
   - rows_applied 확인 (≤16)
   - candidate_pool delta = 0 확인
   - public delta = 0 확인
   - pool_eligible / score_dirty 모두 false 확인
   - pack-open-quality / db-hotpaths / current-state-board / source health 재측정
   - 16 target pid 중 자연 수집 안 된 pid가 신규 등록되었는지 확인

## 7. 원칙 ack
- seller_name 저장 금지 (top-level + raw_json 둘 다): ✓
- candidate_pool / public write 금지: ✓ (dry-run 0)
- DDL 금지: ✓
- needs-owner 407 untouched: ✓
- escrow gate 재활성 금지: ✓
- PS5 catalog/regex patch 금지: ✓ (Wave 55로 분리)
- 실제 apply는 owner 사인오프 후: ✓ (본 wave는 dry-run에서 멈춤)

## 8. 변경/검증/위험
- 변경: executor 1 line removal + 3 line comment + probe script tsc 정리
- 검증: tsc clean / test:core 133/133 / dry-run rows=16 failedRows=0 / no seller_name in payloads
- 위험: 없음 (apply 전)
- 다음: owner 사인오프 받으면 즉시 apply. 또는 별도 정책 추가 결정.

## 9. 남은 blocker
1. R3 contentHash 더블체크 path
2. needs-owner 407 stale row 사인오프
3. backup table DROP (2026-05-21+)
4. **Wave 54 cap=16 apply owner 사인오프 대기** (본 wave dry-run 완료)
5. PS5 lanes 21 rows owner decision (Wave 55)

→ **남은 blocker 5건.**
