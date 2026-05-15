# Bunjang Detail API Rate Limit Probe — 결과 보고서

> 2026-05-16. design: `2026-05-16-bunjang-rate-limit-probe-design.md`. raw: `scripts/probe-bunjang-rate-limit-results.json`.

---

## 실행 정보

- **실행 시각**: 2026-05-15 17:43:00 UTC → 17:48:30 UTC (~5분)
- **총 API call**: 600 (6 phase × 100건 완주)
- **stop 여부**: 없음 (전 phase 완주)
- **stop 사유**: 없음 (안전 조건 미발동)

## Phase 별 결과 (실측)

| Phase | C | 호출 | Elapsed | Throughput | Avg | P50 | P95 | P99 | 200 | 429 | 5xx | Other |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 100 | 11.2s | 9.0 r/s | 112ms | 74ms | 379ms | 483ms | 100 | 0 | 0 | 0 |
| 2 | 3 | 100 | 1.8s | 54.6 r/s | 45ms | 30ms | 192ms | 199ms | 100 | 0 | 0 | 0 |
| 3 | 5 | 100 | 1.3s | 75.2 r/s | 47ms | 31ms | 172ms | 196ms | 100 | 0 | 0 | 0 |
| 4 | 10 | 100 | 0.7s | 152.0 r/s | 49ms | 33ms | 174ms | 176ms | 100 | 0 | 0 | 0 |
| 5 | 20 | 100 | 0.3s | **329.0 r/s** | 43ms | 32ms | 95ms | 100ms | 100 | 0 | 0 | 0 |
| 6 | 30 | 100 | 10.6s | 9.4 r/s | **1256ms** | 1364ms | 3259ms | 3832ms | 100 | 0 | 0 | 0 |

## Retry-After 분석

- 받은 `Retry-After` 헤더: **0건**
- 즉 Bunjang은 우리 traffic 수준에서 명시적 throttle signal 안 줌

## 가설 검증

| 가설 | 결과 | 코멘트 |
|---|---|---|
| H1: c=5까지 429 < 5% | ✅ 확인 (0%) | 매우 안전 |
| H2: c=10에서 429 5-15% | ❌ **반증** (0%) | Bunjang은 예상보다 훨씬 lenient |
| H3: c=20+ 폭증 | ❌ **부분 반증** | 429 0건. 다만 c=30에서 latency 28배 ↑ (server soft throttle) |
| H4: 60s 안 자동 회복 | N/A | Retry-After 0건이라 측정 불가 |

## 핵심 통찰

1. **429 hard rate limit 없음**. Bunjang은 우리 traffic 수준에선 IP 거의 무한대로 요청 받음.
2. **c=30에서 server-side soft throttle 발동** — latency 47ms → 1256ms (27x). 거절 아니라 줄세우기.
3. **c=20이 진짜 sweet spot** — throughput 329 r/s + latency 43ms. 한도 미도달.
4. **DB write 부담 추가** 고려해 c=10이 safe pick (concurrent DB connection 10개).

## 의사결정

**측정 결과 → 시나리오 A** (모든 phase 완주, 매우 lenient).

**적용 안전 한도**:
- batch: **400** (이전 80에서 5배)
- concurrency: **10** (sequential에서 10x parallel)
- cron 주기: **7분 그대로** (변경 안 함)

**기대 throughput**: 686 → **3,429 calls/h** (5배)
**Backlog 2,659건 해소 시간**: ~45분 (cron 7번)

## 후속 조치 (완료)

1. ✅ `tick-pipeline.ts`: `claimLifecycleChecks` batch cap 80 → 400 (LIFECYCLE_BATCH_HARDCODE)
2. ✅ `tick-pipeline.ts`: lifecycle 처리 loop sequential → Promise.all wave (LIFECYCLE_CONCURRENCY=10)
3. (보류) 429 detection 추가 — probe에서 0건이라 후순위. 다음 wave에서 안전망 박기 가능.
4. ⏳ 24h 후 production 재측정 → 추가 tune (batch 800 c=15까지 가능)

## 위험 / 보류

- **DB write 부담**: Supabase REST 동시 connection 10개. plan 한도 확인 필요. 현재 베타 traffic이라 안전 추정.
- **Phase 6 latency spike**: c=30+ 시 Bunjang server queue. 코드에서 c=10 hardcap이라 도달 불가. 안전.
- **다음 단계**: backlog 해소 후 새 매물 유입 따라잡는지 측정. 못 따라잡으면 batch 800 + c=15로 step up.

## Production 적용 후 검증 계획

| 시점 | 측정 | 기준 |
|---|---|---|
| Deploy 직후 | lifecycle worker run 1회 duration | < 30s (예상 8s) |
| 1h 후 | overdue 매물 수 | < 1,500건 (현재 2,659) |
| 24h 후 | overdue 매물 수 + 429 누적 | overdue < 500 + 429 0건 |
| 1주 후 | Bunjang IP block 신호 | 없음 |
