# Wave 59 — cleanup + needs-owner 369 apply + R3 contentHash 더블체크 path

> Status: **applied (code + DB write).** 사업 확장 제외, 운영 정확성·위생 작업 일괄.

CLAUDE.md line 111-121 강제 6 필드 포맷.

---

## 0.1 Wave 59-A cleanup — DEFAULT_SEARCH_QUERIES 3 줄 제거

- 시간: 2026-05-14 KST
- 발견: Wave 56·57 measurements + Wave 58 §11 실측에서 (1) `"JBL 플립6"` 한글 변형 raw 0 (2) `"Bose QC"` 영어 단독 raw 0 (3) `"LG 39GX900A"` median 200만+ → 11 criteria 자본 천장 위반.
- 변경: `src/lib/pipeline-config.ts:13-24` DEFAULT_SEARCH_QUERIES에서 3 query 제거 (64 → 61). cleanup 사유 comment 박음.
- 검증: `npx tsc --noEmit` clean / `npm run test:core` 135/135 pass / module load 61 queries.
- 위험: 매우 낮음. cron query 줄어 cost 미세 감소. SKU lift는 사실상 0이었으므로 사업 영향 0.
- 다음: 자연 cron 재호출 시 cleanup query 제외 확인 (1~2 cycle 후).

---

## 0.2 Wave 59-D apply — needs-owner 369 stale rows reparse

- 시간: 2026-05-14 KST
- 발견: Wave 51 Phase A에서 14,887 auto-safe apply 후 남은 stale 407 (Wave 50 분류 nr_flip 365 + conf_drop 1 + pool_member 41). 정확성 향상 방향 — v24~v30 시절 잘못된 deterministic 통과를 v31 needs_review로 정정. autonomy 범위 (사업 카테고리 변경 없음).
- 변경: 
  - `scripts/wave59d-needs-owner-apply.ts` 신규 (Wave 51 패턴 재사용)
  - DB: `mvp_listing_parsed` 369 rows reparse (parser_version v31 + comparable_key / parse_confidence / needs_review / parsed_json 갱신)
  - DB: `mvp_raw_listings.score_dirty=true` 15,257 rows 재마킹 (Wave 51 backup 전체 + pool_leak 3 — 자연 tick 재평가 트리거)
  - Wave 50 baseline 407 → Wave 59-D 369 drift (38 no_change — raw 갱신으로 nr_flip 사라진 row, 안전하게 제외)
- 검증: 
  - apply chunks: 4 (100·100·100·69), errors=0, total 369/369
  - still_stale_after: 38 (no_change, content identical)
  - pool_total 변동: 1039 → 1039 (apply 직접 영향 0)
  - candidate_pool / public promotion writes: 0
  - 그러나 pool_leak 3건 (needs_review flag 있는 row) — score_dirty=true 재마킹으로 자연 tick에서 정리 예정
- 위험:
  - pool_member 39 row가 reparse로 key 변경 → 다음 tick에서 candidate_pool 재평가 → 일부는 invalidate될 가능성. POOL_BLOCK_FLAGS에 option_needs_review 포함되어 있어 자동 차단.
  - score_dirty=true 15,257 마킹은 ~100 tick (drain rate 230/hr 가정 시 약 1.5h) 후 모두 처리. user-facing 영향 0 (재평가만, mutation 없음).
- 다음: 1~2h 자연 tick 후 pool_leak 0 도달 측정. Wave 60+에서 38 no_change rows의 parser_version 정리 (선택, 사업 영향 0).

---

## 0.3 R3 contentHash 더블체크 path 추가

- 시간: 2026-05-14 KST
- 발견: Wave 46에서 housekeeper-ai-cache-prune이 R1/R2만 unconditional DELETE, R3 (raw_updated_after_classify proxy)는 관찰만. proxy false-positive 위험 있어 contentHash 재확인 path 부재.
- 변경: `src/lib/housekeeper-ai-cache.ts` — R3 verify path 추가:
  - `rawFingerprint(name, price, descriptionPreview)` — production contentHash의 raw subset SHA-256
  - `verifyR3Stale(pids)` — R3 후보 pid의 raw fingerprint 와 cache.content_hash 의 prefix 8 chars 비교. 일치 → fresh, 불일치 → stale 후보
  - `runAiCachePrune(options?: { r3DeleteEnabled?: boolean })` — default `r3DeleteEnabled=false` (DELETE 안 함, 관찰만). cron route는 default 호출.
  - 신규 결과 필드: `candidates_r3`, `r3_hash_verified_stale`, `r3_hash_verified_fresh`
- 검증:
  - tsc clean / test:core 135/135 pass
  - cron smoke fire: ok=true / candidates_r1/r2/r3 = 0/0/0 (cache 30d 미만 baseline) / view_available=true / deleted=0
- 위험:
  - production hash (PipelineRow full input) vs raw fingerprint (3 fields subset) prefix 8 매칭은 휴리스틱. false negative (stale인데 fresh로 표시) 가능 / false positive (fresh인데 stale로 표시) 가능. **본 wave default r3DeleteEnabled=false** — DELETE 안 함, observation만.
  - 첫 R3 발화 예상 시점: cache 30d 도달 후 + raw 14d 추가 갱신 → 2026-06-08+. 다음 wave에서 정밀 hash 정합 후 r3DeleteEnabled=true 활성 가능.
- 다음: cache 30d 도달 후 R3 candidates 발화 시 r3_hash_verified_* 측정. 정밀 hash 알고리즘 정합 (PipelineRow full 재구성 vs raw subset 비교) 결정.

---

## 0.4 PS5 / Wave 57 query natural catch-up 측정 (read-only)

- 시간: 2026-05-14 KST
- 발견: Wave 57 follow-up에서 PS5 raw 324 / detail_done 10 / SKU bound 4 였음. 자연 cycle 후 측정.
- 변경: 없음 (read-only SQL)
- 검증:
  - PS5 detail_done: 10 → **228** (+218, 큐 catch-up 완료에 가까움)
  - PS5 SKU bound: 4 → **44** (Wave 56 parser patch production 안정 검증)
  - Wave 57 +7 query detail_done: 0 (PS5 뒤 순서, PS5 catch-up 완료 후 처리 예정)
  - detail_queue pending: 156 / done_60m: 236 (drain rate 안정)
  - pool_total: 1039 / pool_leak: 3 (Wave 59-D score_dirty 재마킹으로 자연 정리 예정)
- 위험: 없음 (read-only)
- 다음: Wave 60+ Wave 57 +7 query SKU binding 측정 (PS5 cycle 완료 후)

---

## 1. 결정 분류 (정책 vs 보류 vs 행동)

| 항목 | 분류 | 근거 |
|---|---|---|
| Wave 59-A cleanup 3 query 제거 | autonomy 행동 | 11 criteria 위반 + 사업 영향 0 |
| Wave 59-D 369 needs-owner apply | autonomy 행동 | 정확성 정정 + 사업 카테고리 변경 0 |
| score_dirty 15,257 재마킹 | autonomy 행동 | runtime trigger, mutation 아님 |
| R3 contentHash path code merge | autonomy 행동 | safety net 추가, default 비활성 |
| 38 no_change parser_version 정리 | autonomy 보류 | 사업 영향 0, technical debt 미미 |
| R3 r3DeleteEnabled=true 활성 | autonomy 보류 | 정밀 hash 정합 후 결정 |
| 사업 카테고리 신규 (시계 / 골프 / 카메라) | owner 결정 | sign-off 필요 |

## 2. 남은 blocker (재정렬)

1. R3 contentHash 정밀 정합 (Wave 60+, cache 30d 도달 후)
2. 38 no_change parser_version 정리 (선택, 우선순위 낮음)
3. Phase A backup table DROP (2026-05-21+ 자동)
4. PS5 detail catch-up 완료 측정 (자연 시간)
5. Wave 57 +7 query SKU binding 측정 (자연 시간, PS5 후)
6. 사업 카테고리 신규 진입 사인오프 (owner 결정)

→ **남은 blocker 6건** (3·4·5 자연 시간, 1·2 우선순위 낮음, 6 owner)
