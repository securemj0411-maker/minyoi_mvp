# Wave 1206 — pool 진입 최소 순익 1원 → 1000원 (audit P0 #1)

날짜: 2026-06-06
관련: Wave 1205 audit, Wave 885(band 폐기), owner "ㄱㄱ"
파일: profit.ts, pool-policy.mjs (sync)

## 문제 (audit 발견)

`bandFromProfit`이 `avg = Math.round((profitMin+profitMax)/2)` 기준 `avg >= 1`로 통과.
→ profitMin=0, profitMax=1 매물이 `round(0.5)=1`로 **band 1 통과** → 수수료·배송·버퍼 다 뺀
순익 0~수백원 매물이 추천됨 ("득템" 무의미, 미뇨이 핵심가치 직격).

## owner 정책 재확인 (Wave 885 / Wave 90 주석)

- Wave 885: band 폐기, 1원 임계 — owner "band 개념 없앤 지 오래, 피드 가격필터로".
- **Wave 90 주석**: "차익 1천-9천원 매물 1,261건 차단됐던 걸 살리려" 10K→1.
- **owner 기준 명시**: "패키지 690/**990원**보다 차익 큼" → 990원 패키지보다 큰 차익이 의미 기준.

→ owner는 **1천원 이상 차익을 원함**. 1원은 과하게 낮춰 0~수백원 무의미 매물까지 통과시킨 것.

## fix

```
const MIN_MEANINGFUL_PROFIT_KRW = 1_000;
// avg 반올림 대신 profitMax(최선 순익) 기준
if (profitMax >= MIN_MEANINGFUL_PROFIT_KRW) return 1;
```

- **profitMax(최선 순익) 기준** — 최선이 1000원도 안 되면 차단 (avg 반올림 버그 제거).
- 1000원 = owner의 "990원 패키지보다 큰 차익" 기준과 일치.
- owner Wave 885 정신(작은 차익도 OK, band 폐기)은 유지 — 1천원~9천원 매물 그대로 살아있음.
- profit.ts + pool-policy.mjs 둘 다 sync (drift 방지).

## 영향

- 0~999원 순익 매물만 pool에서 빠짐 (무의미). 1000원+ 차익은 그대로.
- parser_version 무관 — candidate-pool-builder가 tick마다 pool 재빌드 시 자동 적용.

## owner 조정 가능
`MIN_MEANINGFUL_PROFIT_KRW` 상수 한 곳(+ pool-policy.mjs inline). 더 높이거나(5천원 등) 낮추려면 말해주세요.

## TS check
clean.
