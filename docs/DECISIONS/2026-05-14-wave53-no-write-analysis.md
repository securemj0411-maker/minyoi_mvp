# Wave 53 — Executor schema drift + PS5 root cause (no-write analysis)

> Status: **analysis only.** DB write 0, DDL 0, code/catalog/adapter patch 0. Wave 52b 발견 2종 blocker의 root cause 정리.

상세는 두 산출물:
- `reports/wave53-executor-schema-drift-analysis-latest.{md,json}`
- `reports/wave53-ps5-root-cause-analysis-latest.{md,json}`

## 1. Executor schema drift — 1-line fix

- 누락 컬럼: **`seller_name` 단 1개**. (`rebuildWithFreshDetail` line 214에서 `fresh?.shopName ?? null`로 spread.)
- production `mvp_raw_listings` schema에 `seller_name` 없음. PGRST204 atomic reject.
- parsedPayload는 drift 없음. mvp_listing_parsed schema 완벽 일치.
- 권고: **컬럼 spread에서 제거, raw_json.shop_name으로 보존** (1-line diff). Wave 54에서 별도 사인오프 후 patch + cap=16 apply 재시도.

## 2. PS5 root cause — 단일 원인, 3종 error 연쇄

- catalog에 등록된 SKU: `ps5-disc-standard`, `ps5-digital-standard`.
- evidence는 `policy-ps5-disc-basic`, `policy-ps5-digital-basic` synthetic id 참조 (adapter 합성, catalog 미등록).
- 3 errors가 단일 root에서 파생:
  1. `unknown_sku:policy-ps5-*-basic` — skuById null.
  2. `evidence_reparse_comparable_key_mismatch` — SKU 없어 parser가 다른 키 생성.
  3. `parsed_needs_review_from_evidence` — SKU 없어 needs_review default true.
- 추가 precision 우려: adapter regex가 풀박/Pro/CFI-7022 매물을 base_unit_only로 100% false-positive로 흡수 (sample n=21).
- owner 4 options (A catalog 등록 / B adapter regex 보강 / C A+B / D long-term hold) 기존 `report-owner-decision-unblock-ps5-catalog-vs-adapter-regex.ts`에서 정리됨.
- 권고: **본 wave에서 결정 안 함.** Wave 55에서 owner 결정.

## 3. 원칙 ack
- DB write 금지: ✓
- candidate_pool/public promotion 금지: ✓
- DDL/RPC 금지: ✓
- executor patch 금지: ✓
- catalog/runtime patch 금지: ✓
- needs-owner 407 untouched: ✓
- escrow gate 재활성 금지: ✓

## 4. 변경/검증/위험
- 변경: 없음 (분석 2건 + decision log)
- 검증: schema SQL + executor source grep + catalog grep + evidence sample
- 위험: 없음
- 다음:
  - **Wave 54** — executor `seller_name` 1-line patch + 16-row cap apply 재시도 (별도 사인오프).
  - **Wave 55** — PS5 owner 결정 (A/B/C/D).

## 5. 남은 blocker (재정렬)
1. R3 contentHash 더블체크 path (retention 트랙)
2. needs-owner 407 stale row 사인오프
3. backup table DROP (7d, 2026-05-21 이후)
4. **executor `seller_name` 1-line patch + Wave 52 16-row cap apply** (본 wave 분석 완료, Wave 54 적용 대기)
5. **PS5 lanes 21 rows owner decision** (본 wave 분석 완료, Wave 55 결정 대기)

→ **남은 blocker 5건.** #4, #5 모두 Wave 53에서 분석 끝, 결정/적용 대기.
