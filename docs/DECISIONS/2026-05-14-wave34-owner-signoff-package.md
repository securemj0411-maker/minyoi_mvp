# Owner sign-off package — AI L2 Phase 2 escrow (smartphone narrow lane)

> 2026-05-14 KST. 본 문서는 Phase 2 활성 결정을 위한 **단일 요약**. 결정 사항만 빠르게 보고 사인오프하기 위한 1-page.

## 1. 결정 요청
다음 3개를 한 번에 sign-off 또는 reject:

1. `AI_L2_ESCROW_PHASE2_ENABLED=1` 환경변수 production 적용 (smartphone narrow lane needs_review 매물의 AI L2 escrow 활성).
2. `supabase/migrations/20260514000300_ai_cache_retention_view.sql` apply (R3 retention view 배포).
3. `housekeeper-ai-cache-prune` cron 등록 (60분 주기, R1/R2/R3 후보 → contentHash 재확인 후 DELETE).

## 2. 무엇을 바꾸는가
- **활성 범위**: `parsed.needs_review=true` AND `category=smartphone` AND `comparable_key`가 `iphone|iphone_{15,16,14,13,12}_pro|` 로 시작 AND `parse_confidence >= 0.55` 인 row만.
- **per-run cap**: 5 rows / scoreStage 호출 (1분 주기 → 일 최대 약 7,200 회 호출 가능하나 매물 자체가 적어 현실치는 일 50건 이하 예상. Wave 31 baseline AI cache 일 199건 증가의 ~25% 수준).
- **pool 노출**: AI 결과 `pass + listing_type=normal + confidence=high + no hard-risk` 만 노출. hold/reject/unavailable은 hard block 유지.
- **rollback**: env var 1줄 unset 즉시 OFF. Wave 32 검증된 FK rollback SQL 별도 보유.

## 3. 비용 영향 (베이스라인 + tiny cap 기준)
- Wave 29 dry-run 측정: 평균 입력 ~800 tok, 출력 ~120 tok / 호출. `gpt-4.1-mini` 단가 $0.4/$1.6 per 1M.
- 일 50 호출 가정: 약 $0.026/day (월 $0.78).
- per-run cap 5로 도달이 cap-bound면 일 최대 7,200 호출 → 약 $3.74/day. 이는 상한이지 실측치 아님.
- Wave 27 ARPU 기준 팩 1팩 $1.09 매출 대비 AI 비용 비중 매우 낮음.

## 4. 정확성/안전 영향
- **broad smartphone widening 금지** 유지: catalog/comparable_key 변경 0. narrow 5 SKU whitelist만.
- **silent carrier 추정 금지** 유지: parse_confidence 명시 게이트. 자급제 무명시 row는 차단.
- pool-policy block 3개 신규: `ai_escrow_pending`/`ai_escrow_held`/`ai_escrow_unavailable`. 모두 hard block.
- AI pass 단독으로 deterministic block (buying/damaged/counterfeit/accessory/sold/category-readiness) 우회 불가 — pipeline.ts AI prompt에 명시.

## 5. 검증된 항목
- Wave 32 branch rehearsal: FK forward/rollback 5/5 PASS, rollback prerequisite 추가.
- Wave 33 code merge: tsc clean, test:core 120/120, gate matrix 5/5 PASS, env grep 0-hit.
- Wave 34 consumer path: 동일 verification 재통과.
- Wave 31 baseline: AI cache 529 rows, 5일 33~183/day, leak 없음.

## 6. 미해결/리스크
- R3 view는 *proxy*(raw 갱신 시간 기반). 정확한 hash drift는 production code에서 contentHash 재계산으로 1차 거른 뒤 DELETE. false-positive 가능성은 있으나 DELETE는 housekeeper에서만 수행.
- per-run cap (5) 의 일 누적 cap이 명시 enforce 되지 않음. 활성 후 24h baseline 측정해 일 cap 또는 DB count 게이트 추가 검토 (Wave 35 후속).
- AI L2 vendor 의존 (OpenAI / Anthropic). unavailable 시 `ai_escrow_unavailable` + score_dirty 재마킹으로 retry — 무한 retry 방지를 위한 cooldown은 현재 미구현.

## 7. Sign-off 옵션
- [ ] Approve all 3 (1+2+3)
- [ ] Approve 1+2, defer 3 (housekeeper cron은 따로)
- [ ] Approve 2 only (view만 배포, 활성은 보류)
- [ ] Reject — 추가 측정/완화 후 재제출

## 8. 다음 wave
승인 시 → Wave 35 (ramp + view apply + housekeeper cron). 반려 시 → 사유에 따라 Wave 35는 측정/완화 wave로 재설계.
