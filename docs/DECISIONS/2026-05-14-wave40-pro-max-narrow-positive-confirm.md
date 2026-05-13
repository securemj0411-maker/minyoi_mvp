# Wave 40 — pro_max narrow 편입 + positive confirmation

> Status: **applied (code + runtime). DDL 0, cron 0, cap 변경 0, parser 변경 0, conf floor 변경 0.** owner option A 사인오프 반영.

## 1. 변경 내역

| 파일 | 변경 |
|---|---|
| `src/lib/ai-l2-escrow.ts` | `SMARTPHONE_NARROW_PREFIXES`에 2개 prefix 추가: `iphone\|iphone_15_pro_max\|`, `iphone\|iphone_16_pro_max\|`. comment로 narrow 확장 (broad 아님) + AI 책임 차원(storage)만 명시. |
| (runtime) `mvp_raw_listings.score_dirty` | 8개 pro_max needs_review pid에 `score_dirty=true` 재마킹 (scoreStage 재진입 트리거. schema/policy 변경 아님, 정상 runtime 흐름). |

비변경 (원칙 ack):
- option-parser: 변경 0 (parser patch 금지)
- catalog: 변경 0 (정합성 확인만)
- pool-policy.mjs: 변경 0
- conf floor (0.55), per-run cap (2): 변경 0
- 새 prefix는 5개 → 7개로 **narrow whitelist 확장**, broad smartphone 추정 아님

## 2. Catalog 정합성 확인

- `catalog.ts:378` `iphone-15-pro-max` SKU 존재 (modelName "iPhone 15 Pro Max", msrp 1.9M, mustContain 매칭, mustNotContain plus/플러스 격리).
- `catalog.ts:473` `iphone-16-pro-max` SKU 존재.
- 두 SKU 모두 base SKU (laneKey 없음 — pro_max는 자체 카테고리 안에서 storage variant SKU가 별도). escrow는 storage 차원만 AI에 위임 → 정합.
- parser 측 comparable_key prefix와 Wave 38 실측 일치 (`iphone|iphone_{15,16}_pro_max|unknown_storage`).

## 3. tsc + test:core

- `npx tsc --noEmit` → clean
- `npm run test:core` → **120/120 pass**

## 4. Positive confirmation (1 tick fire)

Manual tick fire (`curl -X POST http://localhost:3000/api/cron/tick?force=1`):

| Metric | Value | Interpretation |
|---|---:|---|
| ok | true | runtime healthy |
| scored | 149 | 일반 scoreStage 정상 |
| score_phase2_escrow_gate_enabled | 1 | env 로딩 OK |
| **score_phase2_escrow_selected** | **2** | **cap=2 binding 도달 ✓** |
| score_needs_review_skipped | 1 | gate에서 차단된 1건 (narrow 외) |
| ai_review_requested | 5 | legacy + escrow 통합 review 호출 5건 |
| ai_api_calls | 2 | 신규 AI 호출 2건 |
| ai_cache_hits | 3 | 기존 cache 재사용 3건 |
| ai_filtered | 3 | AI가 noise 판정 3건 |
| ai_kept_low_conf | 2 | low-conf hold 2건 |
| escrow_resolved_pass / held / unavailable_retry | 0 / 0 / 0 | escrow row가 topN sort에서 밀려 이번 tick엔 AI까지 미도달 |

DB 측정 (tick 직후):

| Metric | Value | Interpretation |
|---|---:|---|
| analysis_pending | **2** | **escrow flag 실제 부여 ✓** |
| analysis_held | 0 | (transition은 다음 tick) |
| analysis_unavailable | 0 | (동일) |
| **pool_leak** | **0** | **pool-policy hard block 정상 동작 ✓** |
| cache_last_10m | 3 | AI cache write 재개 ✓ |

**positive confirmation 4종 모두 확보**: (1) selected>0, (2) flag DB 실측, (3) pool block 작동, (4) cache write 재개.

## 5. 남은 미세 관찰

`escrow_selected=2`인데 `escrow_pass/held/unavail` 모두 0 — 모순 아님. `applyAiReview`는 score 기준 정렬 후 `topN` slice → escrow row 2개가 이번 tick의 topN(=5)에서 밀려나면 AI까지 안 감. pending flag 그대로 유지 → pool block. 다음 tick (또는 score가 더 높은 신규 매물 부족 시)에서 transition 발생. **buggy 아님, 정상 정렬 동작.**

다음 wave에서 24h+ 자연 누적 시 transition 비율 측정 가능.

## 6. 원칙 ack
- broad smartphone widening 금지: ✓ (whitelist 5→7개 narrow 확장, broad 추정 아님)
- silent carrier 추정 금지: ✓ (conf floor 0.55 유지, 명시 token 게이트 그대로)
- conf floor 완화 금지: ✓
- parser 변경 금지: ✓
- DDL/apply 금지: ✓ (코드 1줄 patch + 8 row score_dirty 재마킹 = runtime trigger)

## 7. 변경/검증/위험
- 변경: ai-l2-escrow.ts 2 lines, 8 raw_listings score_dirty=true.
- 검증: tsc clean, test:core 120/120, tick ok=true, selected=2, leak=0, cache write 3건 신규.
- 위험: 없음. rollback은 prefix 2줄 제거 / env 1줄 unset 즉시 OFF.
- 다음: Wave 41 — 24h+ 자연 누적 후 escrow_resolved_pass/held/unavailable 분포 측정 + cron sign-off 자료 완성 + 재제출.

## 8. 남은 blocker
1. **escrow transition 측정 (selected=2 → pass/held/unavail 분포)**: 24h+ 자연 가동 또는 tick 반복으로 자료 누적 필요.
2. **housekeeper cron + live merge**: #1 자료 완성 후 재제출.

→ **남은 blocker 2건** (둘 다 자연 시간 경과로 해소).
