# Wave 769 — AI audit residue cleanup 카테고리 제한 제거

- 시간: 2026-05-27 KST
- 트리거: 사용자 "reject한게 올라온건 안되는듯" → Wave 768 audit에서 발견한 cleanup category bug fix.

## 발견 (Wave 768 → 769 root cause)

`tick-pipeline.ts:4872 invalidatePoolAiAuditResidues()`:
```ts
// before (버그)
`${tableUrl("mvp_candidate_pool")}?select=pid,ai_audit_status&status=in.(ready,reserved)&category=in.(clothing,shoe,bag)&limit=${limit}`
```

**카테고리 필터 `clothing,shoe,bag`로 제한** → smartphone/earphone/tablet/laptop의 AI reject 매물이 cleanup 못 됨. Wave 768 invalidate한 3건 모두 이 범위 밖:
- pid 9001445496708 (smartphone — 갤럭시 노트20)
- pid 407765720 (smartphone — Z플립6)
- pid 403421836 (earphone — galaxy-buds-3-pro로 박혔는데 실제 화웨이 프리버즈)

## 정책 확인 (사용자 의도)

사용자 정의: 
- **AI hold = OK** — "상태 파악 안되서 그런건데 상태 파악 안된 매물은 나름의 등급판정을 받고 false positive의 원리로 등급을 좀 낮게 함" → 현 shadow mode (status='ready' 유지 + 등급 낮춤) 유지.
- **AI reject = NOT OK** — "reject한게 올라온건 안되는듯" → 풀 진입 차단 필요.

`isAiAuditDefiniteNonPass()` 함수가 reject만 hard-block, hold/pending/null은 통과 — 정책 일치. 카테고리 제한만 제거하면 reject residue cleanup이 전 카테고리에 작동.

## 변경

### `src/lib/tick-pipeline.ts` (1-line fix)
- 4874 line: `&category=in.(clothing,shoe,bag)` 제거.
- 코멘트로 Wave 768 발견 매물 (note20/Z플립6/화웨이 프리버즈) + reasoning 명시.
- `isAiAuditDefiniteNonPass` 의 verdict 검사 로직은 카테고리 무관하므로 SQL filter만 풀면 전 풀에 cleanup 적용.

## 검증
- `npx tsc --noEmit` tick-pipeline.ts 에러 0건.
- 호출 위치 2곳 확인 (5874, 6382 line) — cleanup 한도 `Math.max(config.tickScoreLimit * 2, 1000)` 동일.

## 위험
- cleanup 범위 확장으로 1 tick당 invalidate 건수 증가 가능 — 단 reject 매물 자체가 적음 (Wave 768 측정 4건). 부담 X.
- false positive risk: `isAiAuditDefiniteNonPass()` 가 reject만 잡으므로 잘못된 invalidate 위험 X.

## 다음
- production replay (몇 시간 후 reject 매물 자동 cleanup 효과 측정).
- sku_median=0 매물 풀 진입 자체 차단은 이미 `candidate-pool-builder.ts:632` (Wave 249)에 박혀있음. 기존 stale 매물 4건은 Wave 768에서 정리 완료. **추가 코드 fix 불필요.**
