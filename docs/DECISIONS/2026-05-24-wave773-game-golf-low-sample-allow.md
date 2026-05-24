# Wave 773 — game/golf low_sample 허용 + DB 복원 + score_dirty 재처리

**날짜**: 2026-05-24
**Wave**: 773 (사용자 #9 보고: "6시간 지났는데 골프 하나도 게임기도 뭐 없음")

## 진단

| 카테고리 | parsed | pool_eligible=true | pool ready | invalidated |
|---|---|---|---|---|
| game_console | 1522 | 897 | 2 | 60 |
| sport_golf | 1382 | 1238 | 0 | 18 |

= pool_eligible fix 효과 있음 (Wave 772 의 1347건 처리).
= 그러나 pool 진입 거의 0.

### invalidate 사유: 일부 wave99/106 thin_sample (n<5 차단).
= score-worker 가 narrow SKU 시세 sample n<5 → "thin market" → pool entry 미생성.

## Fix

### 1. Code: `tick-pipeline.ts` LOW_SAMPLE_ALLOWED_CATEGORIES 확장
```typescript
const LOW_SAMPLE_ALLOWED_CATEGORIES = new Set<string>([
  "shoe", "drone", "lego", "kickboard", "perfume", "bag", "clothing",
  "game_console", "sport_golf",  // Wave 773
]);
```

Wave 222 (의류/가방) 검증된 패턴 — n>=2 ready 허용.

### 2. DB: invalidate 7건 ready 복원
```sql
UPDATE mvp_candidate_pool SET status='ready'
WHERE category IN ('sport_golf', 'game_console')
  AND invalidated_reason IN ('category_sport_golf_blocked_2026_05_15', 'wave99_thin_market_n_lt_5', 'wave106_low_confidence_thin_sample', 'sku_median_unavailable');
```

### 3. DB: score_dirty=true 재설정
2135건 score-worker 재처리 큐 진입.

## 영향
- 다음 score-worker cron (5분) 처리 시작
- 10-20분 후 사용자 풀에 game/golf 매물 다수 진입 예상

## 관련 commit
- `4133952c`: Wave 772 — pool_eligible 누락 fix (DB)
- 본 commit: Wave 773 — low_sample 허용 + 복원
