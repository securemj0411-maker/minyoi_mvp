# 2026-05-16 — Lifecycle pool tier next_check_at 60분 → 15분 (5x throughput 후 단축)

## 트리거
사용자 코멘트 id 111 (pid 408149902, 갤럭시 S25 엣지):
> "이거 팔렸는데 life-cycle 병목있나?? 아니면 이게 14분전검증인데 조금만 아깝게 삭제 못한거임?? 우리 lifecycle 7분에다 배치 랑 동시 요청 대폭 개선한거같은데 뭐지?"

## 진단

DB 확인 (pid 408149902):
- `listing_state`: active, `sale_status`: SELLING (우리는 active로 알고 있음)
- `pool_verified` 5분 전 (사용자 코멘트 시점 기준 14분 전)
- `next_check_at`: 14분 후 (lifecycle 다음 cycle)
- `last_check_result`: null — 아직 lifecycle worker 안 잡음

원인:
- `lifecycleDelayMs(pool, active) = 60 * 60 * 1000` (60분)
- Wave (2026-05-15) backlog 14k 발견 시 완화. **pool tier도 60분으로 박혔던 거 발견**.
- 즉 사용자 노출 매물 최대 60분 stale 가능.

5x throughput 적용 후 capacity:
- 처리량 시간당 ~1,500-3,000건
- pool tier 매물 수 ~900건
- pool 15분 주기면 시간당 3,600건 필요 — 한계 근접
- pool 30분이면 시간당 1,800건 — 안전
- pool 15분 적극 (사용자 노출 매물 stale window 1/4로 단축)

## Fix

`src/lib/tick-pipeline.ts:578-579`:
```typescript
// Before:
if (tier === "pool") return 60 * 60 * 1000;       // 60분
if (tier === "near_pool") return 4 * 60 * 60 * 1000;  // 4h

// After:
if (tier === "pool") return 15 * 60 * 1000;       // 15분
if (tier === "near_pool") return 60 * 60 * 1000;  // 1h
```

또 즉시 fix: pid 408149902 next_check_at = now (다음 lifecycle tick 즉시 처리).

## 검증

- TypeScript: validator.ts 외 무에러
- Tests: 172/172 pass
- pool tier 매물 수 (현재 ~900건) × 시간당 4회 = 시간당 3,600 lifecycle calls 가능 (capacity 안)

## 영향

- 사용자 보는 매물 stale window 60분 → **15분**
- pool tier capacity 부담 4배 증가. 다만 5x throughput으로 처리 가능.
- detail-worker queue 부담 약간 ↑ (lifecycle이 detail enqueue 트리거).

## 위험 / 보류

- 실측 측정 후 backlog 누적 시 다시 30분으로 완화 가능.
- 사용자 100명+ 성장 시 capacity 재확인 필요.
- 진짜 sold 매물 차단까지의 latency = 15분. 즉 사용자가 15분 전 sold 매물 클릭 가능성.
- 완벽 해소는 lazy click verify (사용자 이전 거부) — pool tier 단축이 합리적 대안.

## 다른 세션 알아볼 키 포인트

1. **pool tier lifecycle 주기 = 15분** (2026-05-16 N4 batch).
2. near_pool = 1h.
3. exploration / market_sample / general 변경 없음.
4. 5x throughput (batch 400 + c=10) 적용 가정. throughput 부족 시 다시 30분.
