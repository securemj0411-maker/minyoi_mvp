# 2026-06-05 Wave 1109 - 당근 시세 표본 부족 시 stale 차익 차단

## 결정
- 애플워치 SE2 44mm 사례에서 당근 전용 daily 시세 row가 없는데 과거 `expected_profit` 스냅샷이 상세 화면에 남아 시세가 부풀어 보이는 경로를 확인했다.
- `/api/packs/me` 응답의 `expectedProfitMin/Max`를 과거 reveal 스냅샷이 아니라 현재 `marketGapKrw/Max` 기준으로 내려보내도록 바꿨다.
- 추천 피드 상세 lazy analysis에서도 당근 매물은 `medianPrice` 없음, `sourceSampleUsed=false`, source sample 3건 미만이면 기존 차익을 유지하지 않고 0으로 닫게 했다.

## 보류
- 과거 `mvp_pack_reveals.expected_profit_*` 스냅샷 일괄 정리는 별도 backfill로 처리한다.
- `mvp_market_price_daily_per_source`에 당근 row가 비어 있는 comparable key의 집계 원인 조사는 별도 worker audit로 남긴다.
