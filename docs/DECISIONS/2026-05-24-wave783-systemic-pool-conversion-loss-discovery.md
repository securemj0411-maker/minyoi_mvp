# Wave 783 — systemic pool conversion 99% loss 발견 (별도 wave 필요)

**날짜**: 2026-05-24
**Wave**: 783 (Wave 781 진단 중 발견)

## 발견 (Wave 781 진단 부산물)

Wave 781 sport_golf eligible→pool 누락 진단 중 **전체 카테고리** 측정:

| Category | eligible | ready_pool | 손실율 |
|---|---|---|---|
| shoe | 19,226 | 33 | **99.8%** |
| clothing | 15,341 | 79 | **99.5%** |
| smartphone | 6,060 | 82 | 98.6% |
| bag | 5,467 | 3 | **99.9%** |
| tablet | 3,692 | 62 | 98.3% |
| earphone | 3,735 | 94 | 97.5% |
| laptop | 2,175 | 10 | 99.5% |
| smartwatch | 2,225 | 46 | 97.9% |
| sport_golf | 1,422 | 0 | 100% (Wave 781-782 fix 중) |
| game_console | 1,372 | 2 | 99.9% (Wave 781-782 fix 중) |

= **~63,000 eligible 매물 중 ~470 ready (0.7%)**.

## candidate_pool 전체 상태

```sql
SELECT status, COUNT(*) FROM mvp_candidate_pool GROUP BY status;
→ invalidated: 5,517
→ ready: 479
→ spent: 21
```

= 만든 entry 총 6,017. eligible 63K 중 6K 만 candidate-pool-builder 까지 도달.
57K 는 entry 자체 생성 안 됨 (score-worker queue or build skip).

## 진단 (가설 — 검증 필요)

1. **score-worker batch 한도**: `PIPELINE_TICK_SCORE_LIMIT=300/cycle` × 12cycle/h × 24h = 86,400/day. backlog 38K dirty → 10h 처리. queue 처리 가능.
2. **AI review 실패**: `applyAiReview` 가 일부 매물 drop. ai_unavailable 매물 skip.
3. **need_review parser flag**: `parserNeedsReviewPoolInvalidations` 가 많이 차단.
4. **rawPoolIneligiblePids**: `loadRawPoolIneligiblePids` 가 추가 차단.
5. **strict gate cascade**: builder 안 negative_resell_gap / sku_low_volume / ad_pattern / fake_suspect / placeholder_price 등 누적.

## Wave 755 context (관련)

> Wave 755 — Pool ready % 개선 (의류 5.9% / 신발 15.2%)

→ 이전에 이미 한 사이클 진행. 현재 의류 0.5% / 신발 0.2% = **Wave 755 이후 더 악화**.

## 가설 — Wave 755 이후 regression?

- Wave 743 drift gate audit (v1→v2 parser bump) → stale matters reparse 큐 → score_dirty 폭증?
- Wave 752 cron NULL backlog fix 후 다량 matters 처리 시도 중?
- Wave 778-780 RPC backfill 로 20,969 + 715 = 21,684 매물 신규 dirty → score-worker 큐 폭발?

## 별도 wave 권장 (Wave 784+)

### Phase 1: 정확한 측정
- score-worker tick 마다 `score_dirty_processed`, `pool_entry_created`, `pool_entry_invalidated` 카운터 로그
- 각 invalidation reason 별 카운트 (이미 `skipReasonCounts` 있음 — 노출 확인)

### Phase 2: 가설 검증
- AI review unavailable rate 측정
- need_review skip rate 측정
- top 5 invalidation reason 식별

### Phase 3: gate 완화 (정확성 trade-off 합의 후)
- low_volume_sku 7d<3 → 7d<2 등 점진 완화 (Wave 224/225 정책 재검토)
- negative_resell_gap 0% → -5% 등 borderline 허용 (사용자 합의 필수)

## 즉시 처리하지 않은 이유

1. Wave 781-782 fix 가 직접 영향 영역 (game/golf) 처리 완료
2. shoe/clothing 99% loss 는 strict gate 의 의도된 결과일 가능성 — 검증 필요
3. 정확성 우선 (§12b) — gate 완화 사용자 합의 필요
4. score-worker queue 자연 소진 (10-30시간) 후 baseline 재측정 권장

## 사용자 alert

사용자 instruction "발견/정책 후보 fix 전에도 즉시 로그" 준수.
실제 fix 는 Wave 784+ 별도 cycle.

Wave 783 = **발견 로그만**.
