# Wave 1209 — madTrim 5표본 outlier fix + sold blend 검증 (audit P1)

날짜: 2026-06-06
관련: Wave 1205 audit P1, Wave 798c (50% cutoff), owner "합리적으로 판단해라"

## 합리적 판단 (2개 P1 중 1개만 fix)

### 1번 sold 1건 30%/active 70% — 현행 유지 (안 건드림)
- tick-pipeline.ts:4979. 주석(4975-4976)에 이미 의도 명시: "sold 1건은 outlier 위험으로 active anchor 유지(Wave 221)".
- **통계적으로 합리적**: sold 1건은 불안정(그 1건이 우연히 떨이일 수도), active 다수가 안정적 표본 → 다수에 무게 두는 게 정석.
- sold 1건 과신하면 오히려 시세 튈 위험. agent의 "주석 모순" 지적은 과함 — 의도가 명확.
- → **유지가 더 안전**.

### 2번 madTrim 5표본 outlier — fix
- market-math.ts:119 `Math.max(5, ceil(n*0.5))`. 정확히 5표본일 때 outlier 1개 trim하면 4 survivor인데
  floor 5를 못 넘어 trim 통째 취소 → outlier가 median에 잔존(표본 적은 fashion/game에서 빈번).
- fix: floor `5 → 4`.
  - 5표본: outlier 1개 trim(4 survivor) 허용 ✓
  - 2개 이상 trim(3 survivor)은 여전히 차단 → over-trim(Wave 798c 50% cutoff 안전장치) 유지 ✓
- madTrim은 MAD(3×1.4826) 기반이라 정상값은 안 건드림 → 안전한 정확도 개선.

## 영향
- madTrim 쓰는 모든 시세(trimmedSellerMarket 등) 재계산 시 5표본 outlier 제거 → median 정확도↑.
- parser_version 무관 — market cron 재계산 시 자동 적용.

## TS check
clean.

## Sign-off
owner "합리적으로 판단" → 통계 버그(2번)만 안전하게 fix, 정책 trade-off(1번)는 합리적이라 유지.
