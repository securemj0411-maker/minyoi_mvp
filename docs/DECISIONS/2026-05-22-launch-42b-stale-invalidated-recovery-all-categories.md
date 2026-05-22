# 2026-05-22 — launch-42b: 회복 cron 카테고리 필터 제거 (전자기기 다 포함)

## 사용자 정정
> "뭔소리야 오히려 테크 기기들은 완벽히 더 강화할거 없는데 다른 카테고리는 fashion안에 세부 sku를 말한건데?"

launch-42 에서 사용자 의도 잘못 해석. 정정:
- 사용자 직전 "카테고리제한은 지금 의미가 있음 파서 강화중임" 발언의 의미:
  - **fashion 카테고리 내부 세부 SKU** 강화 진행중 (폴로 베어 collab, 파타고니아 retro x 등)
  - 전자기기 카테고리 (earphone/tablet/smartphone/smartwatch/laptop/watch 등) = 이미 안정
- 즉 카테고리 한정 = 전자기기까지 제한할 이유 X. 전자기기 회복 cron 적용해도 안전.

## fix
`markRecoveredMarketInvalidatedPoolRowsDirty` 의 query 에서 `category=in.(clothing,shoe,bag)` 절 제거:

```ts
// Before (launch-42)
`?select=pid&status=eq.invalidated&category=in.(clothing,shoe,bag)&${reasonsClause}&order=updated_at.desc&limit=${rowLimit}`

// After (launch-42b)
`?select=pid&status=eq.invalidated&${reasonsClause}&order=updated_at.desc&limit=${rowLimit}`
```

→ 모든 카테고리에서 회복 가능 사유 (22종 whitelist) 매물 재평가.

## 안전성 검증
- 함수 내부 검증 로직 (raw active+eligible + sku_median/comparable 회복) 카테고리 무관 작동
- `shoeSizeAgnosticComparableKey` 는 신발 only 인데, 다른 카테고리는 null 반환 → exactMedian 만 사용 (skip 안 함, 정상)
- 회복 후보 매물 → score_dirty=true 마킹 → candidate-pool-builder 재평가 → 차익 1만+ 만 ready
- fashion 내부 SKU 강화 진행 중 매물도 candidate-pool-builder 가 **최신 parser** 로 재평가 (transitional 시점도 안전)

## cron 빈도
`vercel.json`: `score-worker` schedule `* * * * *` = **매 1분**
→ 함수가 매 1분 마다 250 후보 limit 처리. fashion 한정 ~150 매물 → 한 번에 다 처리.
   전자기기 포함 시 후보 더 늘어남 (다음 검증 SQL 결과 따라).

## 영향 매물 예상 (24h+ stale + raw active + 회복 가능 사유 + 모든 카테고리)
launch-42 보고 시 685 (profit_below_pack_band 전체 카테고리) + 다른 회복 가능 사유 = 다 합쳐서 약 **970+ 회복 후보**.

단 ready 복귀 = 시세/가격 진짜 회복된 매물만. 실제 회복 카운트는 cron 1-2 tick (~2분) 후 측정.

## 영향
- 코드: `src/lib/tick-pipeline.ts` 1 곳 query 필터 제거 + comment update
- DB / API: X
- 사용자: 전자기기 카테고리 stale 매물도 자동 회복 → ready 풀 확장

## 메모리 룰
- 사용자 발언 신중하게 해석. "카테고리 제한" = fashion 내부 SKU 의미였음
- 회복 cron 매 1분 작동 — score-worker 빈도 (* * * * *)
- decision log: 이 파일
