# Wave 159m — stale sku_median 일괄 정리 (60건)

- 시간: 2026-05-17 KST
- 사용자 코멘트 pid 340669075: "아이패드미니6 64기가 차익 +67,785원 도대체 왜 차익인거지???"

## 발견

매물 pid 340669075 분석:
- 매물: 아이패드미니6 64GB worn / 매입 550K
- 화면 표시 시세: 382K (worn 6건 median, 정확)
- **풀 박힌 sku_median: 649K** (msrp 750K × 0.87 — stale fallback)
- expected_profit_min 67,785 = (649K - 550K - sellingFee - shipping - buffer) — 잘못된 시세 기반
- 진짜 차익: 382K - 550K = **-168K 손해 매물**

원인:
- Wave 159f 박은 후 score_dirty=false → 새 fallback chain 안 적용
- last_verified_at은 detail-worker가 갱신해도 sku_median 안 건드림
- 옛 시점 (Wave 159f 이전) sku_median이 stale로 남음

## 변경 (backfill 만, code X)

condition별 시세 + 20% 이상 부풀려진 sku_median 매물 일괄 식별 + score_dirty=true:

| condition | 매물 수 | Top 부풀림 |
|---|---:|---|
| worn | 26건 | +143% (pid 407958799 358K vs 147K) |
| flawed/low_batt | 0건 | — |
| mint/clean/normal | 34건 | +207% (pid 400534587 650K vs 211K) |
| **합계** | **60건** | — |

다음 tick scoreStage가 새 fallback chain (Wave 159f/g/h) + 현재 시세로 재집계 → 정확한 sku_median 박힘 → 진짜 차익 X 매물은 풀에서 빠짐.

## 위험
- score_dirty 처리 약 4분~ (PIPELINE_TICK_SCORE_LIMIT=800, tick 1분, 60건 매우 적음)
- 정정 후 사용자 풀에 보였던 매물 일부 사라짐 — Wave 159e candidate_pool auto invalidate 작동 시 풀에서 자동 제거.

## 다음
- 24h 후 재측정 — sku_median +20% 부풀린 매물 0건 되는지 확인.
- 측정 SQL 동일 패턴 자동화 (별도 cron 또는 housekeeper에 추가 가능).
