# Bunjang Detail API Rate Limit Probe — 실험 설계

> 2026-05-16. lifecycle-worker batch/concurrency 안전 한도 측정.

---

## 1. 목적

lifecycle-worker의 `fetchDetail` 호출을 **얼마나 공격적으로** 늘릴 수 있는가?
- 현재: batch 80 sequential = 시간당 686 calls
- 목표: backlog 2,659건 빨리 소화
- 미지수: Bunjang IP rate limit 임계점 (공식 spec 없음)

## 2. 가설

| 가설 | 근거 |
|---|---|
| H1: concurrency 5까지는 안전 (429 < 5%) | 인간 browse 패턴 (탭 5개 동시 열기) 흉내 |
| H2: concurrency 10에서 일부 429 발생 (5-15%) | aggressive scraper signal 시작 |
| H3: concurrency 20+ 에서 429 폭증 또는 burst block | abnormal pattern 감지 |
| H4: Bunjang은 429 후 자동 회복 (60초 안) | 영구 block 즉시 X (Firecrawl/ScrapingBee 일반 패턴) |

## 3. 측정 metric

각 phase마다:
- **Status code 분포**: 200 / 4xx / 5xx / 0 (network error)
- **429 비율**: rate limit hit %
- **평균 latency**: avg ms
- **P95 latency**: 95th percentile (burst spike 감지)
- **Throughput**: req/s 실측
- **Retry-After header**: 받았으면 값 기록

## 4. Phase plan

같은 100건 pid를 6 phase에서 반복 호출. 각 phase 사이 cool down.

| Phase | Concurrency | 예상 elapsed | 예상 throughput | Cool down 후 |
|---|---:|---:|---:|---:|
| 1 | 1 (baseline) | 20s | 5 req/s | 30s |
| 2 | 3 | 7s | 14 req/s | 30s |
| 3 | 5 | 4s | 25 req/s | 30s |
| 4 | 10 | 2s | 50 req/s | 60s |
| 5 | 20 | 1s | 100 req/s | 60s |
| 6 | 30 (aggressive) | 0.7s | 150 req/s | — |

**총 600 API calls / 7분**.

## 5. 안전장치

| 조건 | 액션 |
|---|---|
| 429 비율 ≥ 10% | 즉시 STOP. 이전 phase가 안전 한도. |
| Error 비율 ≥ 30% | 즉시 STOP. abnormal. |
| 5xx 비율 ≥ 5% | 즉시 STOP. Bunjang server 부담. |
| Retry-After ≥ 60s 응답 | 즉시 STOP. 강한 throttle 신호. |
| 시작 시점에 DB pid < 50 | 실행 거부. data 부족. |

## 6. 실패 대응

| 실패 | 대응 |
|---|---|
| Phase 2에서 429 폭증 | 현재 batch 80도 위험 가능. 즉시 batch 60으로 보수적 rollback. |
| 전체 phase 다 429 0% | 매우 안전. batch 400 + concurrency 10까지 즉시 적용 가능. |
| 특정 phase에서 423/451 등 (block) | Bunjang anti-bot 발동. IP rotation / 1주일 cool down 필요. |
| Network timeout 폭증 | Bunjang 자체 server issue. probe 재시도 1시간 후. |

## 7. 예상 결과 (가설 기반)

| Phase | 예상 429% | 결정 |
|---|---:|---|
| 1 (c=1) | 0% | baseline 확인 |
| 2 (c=3) | 0% | 안전 |
| 3 (c=5) | 0-2% | 적정 |
| 4 (c=10) | 5-15% | **경계** |
| 5 (c=20) | 20%+ | 위험 |
| 6 (c=30) | STOP 예상 | 한도 초과 |

**기대 결과**: Phase 3 (concurrency 5)가 sweet spot. batch 200 + concurrency 5 적용.

## 8. 의사결정 기준

probe 결과로 **3가지 시나리오**:

### 시나리오 A: Phase 5까지 429 < 5%
→ Bunjang lenient. **batch 400 + concurrency 10** 즉시 적용 가능. throughput 5배.

### 시나리오 B: Phase 3-4에서 429 5-15%
→ 예상 패턴. **batch 200 + concurrency 5** 적용. throughput 2.5배.

### 시나리오 C: Phase 2부터 429 5%+
→ Bunjang strict. **현재 batch 80 유지** + cron 7분 → 5분 (QStash 변경).

## 9. 실행 후 산출물

1. `docs/EXPERIMENTS/2026-05-16-bunjang-rate-limit-probe-results.md` — 보고서
2. `scripts/probe-bunjang-rate-limit-results.json` — raw data
3. 결정 사항을 `docs/DECISIONS/`에 박음
4. 안전 한도로 코드 fix → commit + push

## 10. 위험 / 영향

- **우리 IP** (현재 로컬 dev IP): 일시 throttle 가능. 5-10분 내 회복.
- **production Vercel IP**: 영향 없음 (다른 IP).
- **Bunjang 사용자**: 무관 (우리 600 calls 매우 작음).
- **사용자 사이트**: 무관 (probe는 별개 process).

---

## Approval gate

✅ 설계 검토 끝나면 사용자 OK → 실행.
