# Wave 52b — Internal acquisition cap=18 apply (BLOCKED by executor schema drift)

> Status: **apply attempted, blocked atomically. DB writes 0, candidate_pool writes 0, public promotion 0.** Wave 52 dry-run clean이었으나 (1) fresh-refetch에서 2 drift 발견 → 제외 후 16 rows clean dry-run, (2) apply 시 executor의 rawPayload 스키마가 production `mvp_raw_listings`와 mismatch (`seller_name` 컬럼 부재) → PGRST204 pre-insert reject.

## 1. 진행 순서
1. preflight subset 작성 (3 lanes, cap 18) ✓
2. dry-run failedRows=0 ✓
3. apply 시도 → fresh-refetch 2 drift 차단 (407507139 SOLD_OUT, 407128952 fetch_failed) ✓
4. drift 2 pid 제거 → 16-row dry-run 재 PASS ✓
5. apply 재시도 → **PGRST204 schema drift, write 0**

## 2. 드러난 drift 종류

### 2.A Fresh-refetch drift (정상 안전망)
| pid | lane | error |
|---|---|---|
| 407507139 | monitor | SOLD_OUT |
| 407128952 | ipad_pro_11_m4 | fresh_detail_fetch_failed |

→ evidence 수집 이후 매물 상태 변경됨. executor가 정상적으로 차단.

### 2.B Executor schema drift (구조적 bug)
```
PGRST204: Could not find the 'seller_name' column of 'mvp_raw_listings' in the schema cache
```
- 현재 `mvp_raw_listings` 컬럼: `pid, url, name, price, num_faved, free_shipping, query, source, description_preview, sale_status, shop_review_rating, shop_review_count, trade_data, trades_data, listing_type, sku_id, sku_name, detail_status, detail_enriched_at, detail_error, raw_json, first_seen_at, last_seen_at, last_changed_at, created_at, updated_at, image_url_template, image_count, thumbnail_url, listing_state, missing_count, last_missing_at, sold_detected_at, disappeared_at, source_uploaded_at, source_updated_at, seller_uid, seller_source, score_dirty, pool_eligible`
- 누락된 executor expected 컬럼: `seller_name` (그리고 잠재적으로 더 있을 수 있음 — first failure가 seller_name이라 거기서 중단).
- 어느 시점에 schema가 변경됐고 executor는 옛 컬럼 셋을 가정.

## 3. DB state — 모두 untouched

| Check | Value | 의미 |
|---|---:|---|
| target_pids in mvp_raw_listings (count) | 15 / 16 | 자연 collection으로 대부분 이미 존재 |
| pool_eligible=true 비율 | 12 / 15 | 이미 pool 자격 |
| score_dirty=true 비율 | 0 | normal 상태 |
| latest_update | 2026-05-13 19:00 UTC | 본 apply 시도 전 시각, **PGRST204로 write 발생 안 함 확인** |
| target_pid이 candidate_pool에 | 1 / 16 | 이미 1건 자연 pool 진입 |
| candidate_pool total | 982 | 변동 0 |

## 4. 의미 — 본 acquisition path의 실제 가치 재평가

- 16 target pid 중 15건은 이미 raw 수집 + 12건은 pool_eligible=true.
- "internal acquisition apply"가 만들 lift는 사실상 **(16 - 15) + (15 - 12) = 1 신규 raw + 3 pool_eligible flip** 수준.
- 본 acquisition path가 만들 incremental value는 inventory가 자연 수집된 후엔 매우 작음.

## 5. 원칙 ack
- PS5 apply 금지: ✓ (분리됨)
- PS5 catalog/policy SKU patch 금지: ✓
- candidate_pool write 금지: ✓ (writes=0)
- public promotion 금지: ✓
- DDL/RPC 금지: ✓
- needs-owner 407 untouched: ✓
- escrow gate 재활성 금지: ✓
- executor 코드 patch 금지: ✓ (스키마 drift는 별도 wave)

## 6. Ops 상태 (apply 시도 후, 변동 없음)
- db-hotpaths: 3 fail / 18 runs (세션 패턴 동일)
- pack-open-quality: 42 / 4 / 2 (pre-existing)
- current-state-board: pre-existing `needs_operational_attention`
- candidate_pool: 982 (변동 0)
- source health: 신호 미보고, 악화 없음

## 7. Wave 53 분리 항목
1. **PS5 lanes 21 rows** (Wave 52 dry-run에서 발견): policy SKU 미등록 + needs_review + comparable_key mismatch root cause.
2. **executor schema drift** (본 wave 신규 발견): `seller_name` 등 옛 컬럼 참조 정리. rawPayload 빌더 schema-align.
3. (선택) 16 target pid의 잔여 lift 평가: pool_eligible flip 3건 / 신규 raw 1건 — 사실상 자연 수집으로 해소될 수 있음.

## 8. 변경/검증/위험
- 변경: 없음 (preflight subset 임시 작성/복원, 산출물 1개, probe 스크립트 1개)
- 검증: dry-run 16 clean / apply PGRST204 / DB 변동 0
- 위험: 없음
- 다음: Wave 53 — PS5 root cause + executor schema drift 정리 no-write 분석.

## 9. 남은 blocker
1. R3 contentHash 더블체크 path
2. needs-owner 407 stale row 사인오프
3. backup table DROP (7d)
4. PS5 evidence/SKU 정합화
5. executor schema drift (`seller_name` 등) 정리 — 본 wave 신규

→ **남은 blocker 5건.**
