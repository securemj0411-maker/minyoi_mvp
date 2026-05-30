# Wave 798b — Systemic outlier filter (madTrim 강화)

- 시간: 2026-05-30 KST
- 트리거: Wave 798a 후속. barbour case 같은 outlier 비율 50%+ 매물 group 도 처리 가능하게.

## 배경

Wave 798a 에서 barbour 한 case 만 catalog 차원 fix. **systemic 측면** outlier filter 강화 필요.

기존 `madTrim` 동작 (`src/lib/market-math.ts:101`):
- min sample 5 건
- threshold 3 × 1.4826 × MAD (median absolute deviation)
- trim 결과 cutoff: max(5건, 50%)

문제: outlier 가 sample 의 50%+ 인 case 처리 못 함:
- barbour 6건 중 4건 outlier → trim 결과 2건 (33%) → 50% cutoff fail → trim 안 함 → 모든 6건 유지 → median 350K

## 변경

`src/lib/market-math.ts` `madTrim`:

| 항목 | Before | After |
|---|---|---|
| min sample | 5 | **4** |
| threshold multiplier | 3 × 1.4826 | **2.5 × 1.4826** |
| trim 결과 cutoff | max(5, 50%) | **max(3, 30%)** |

효과 (barbour 6건 case 시뮬):
- min sample 4 통과 ✓
- 2.5 × MAD 더 엄격 → outlier 1~2건 trim
- 30% cutoff → trim 결과 ~2건 (33%) 통과
- → median 진짜 시세 (~₩150K) 반영

## Trade-off

- ✅ outlier 비율 50%+ case 처리 가능 (barbour 같은)
- ✅ 작은 sample (4건) 도 outlier trim
- ⚠ 정상 매물도 더 적극적으로 trim 될 risk
- ⚠ sample 작은 SKU 일수록 시세 신뢰도 ↓ — confidence "low" 표시 해도 좋음 (별도 wave)

## 예상 결과

다음 cron tick (~17h) 후 `mvp_market_price_daily` 재계산:
- barbour 퀼팅 clean median ₩350K → ₩150K (실제 시세)
- 다른 SKU 들도 outlier 영향 감소
- p75/p25 ratio 큰 SKU 의 confidence 자동 "low" (sample 적어짐)

## Follow-up

- **owner 모니터링**: 며칠 후 잘못 trim 된 case 보고 받으면 threshold 미세 조정
- **confidence "low_disagreement"** 표시 — p75/p25 > 2.0 인 SKU 는 시세 사용 안 함 표시 (별도 wave)
- **Tukey IQR fence** 추가 검토 (Q3 + 1.5×IQR cap) — 다중 cluster 케이스
- **cluster detection** — sample 안 가격 cluster 2개 면 더 큰 cluster median 사용
