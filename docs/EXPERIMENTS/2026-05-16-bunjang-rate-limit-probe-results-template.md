# Bunjang Detail API Rate Limit Probe — 결과 보고서

> 실행 후 이 template에 결과 채움. design 문서: `2026-05-16-bunjang-rate-limit-probe-design.md`.

---

## 실행 정보

- **실행 시각**: <시작 → 종료>
- **총 API call**: <600 또는 stop 지점까지>
- **stop 여부**: <완료 / Phase X에서 stop>
- **stop 사유**: <429 rate / error rate / 5xx rate / Retry-After>

## Phase 별 결과

| Phase | C | 호출 | Elapsed | Throughput | Avg | P50 | P95 | P99 | 200 | 429 | 5xx | Other |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 (c=1) | 1 | 100 | <s> | <r/s> | <ms> | <ms> | <ms> | <ms> | <n> | <n> | <n> | <n> |
| 2 (c=3) | 3 | 100 | <s> | <r/s> | <ms> | <ms> | <ms> | <ms> | <n> | <n> | <n> | <n> |
| 3 (c=5) | 5 | 100 | <s> | <r/s> | <ms> | <ms> | <ms> | <ms> | <n> | <n> | <n> | <n> |
| 4 (c=10) | 10 | 100 | <s> | <r/s> | <ms> | <ms> | <ms> | <ms> | <n> | <n> | <n> | <n> |
| 5 (c=20) | 20 | 100 | <s> | <r/s> | <ms> | <ms> | <ms> | <ms> | <n> | <n> | <n> | <n> |
| 6 (c=30) | 30 | 100 | <s> | <r/s> | <ms> | <ms> | <ms> | <ms> | <n> | <n> | <n> | <n> |

## Retry-After 분석

<해당 phase에서 받은 Retry-After 값 list. 빈도 + 분포>

## 가설 검증

| 가설 | 결과 | 코멘트 |
|---|---|---|
| H1: c=5까지 429 < 5% | <확인 / 반증> | <측정값> |
| H2: c=10에서 429 5-15% | <확인 / 반증> | <측정값> |
| H3: c=20+ 폭증 | <확인 / 반증> | <측정값> |
| H4: 60s 안 자동 회복 | <확인 / 반증> | <Retry-After 분석> |

## 의사결정

**측정 결과 → 시나리오**: <A / B / C / D>

**권장 안전 한도**:
- batch: <80 / 150 / 200 / 400>
- concurrency: <1 / 3 / 5 / 10>
- cron 주기: <7분 그대로 / 5분>

**기대 throughput**: <686 / 1029 / 1715 / 3430> calls/h
**Backlog 2,659건 해소 시간**: <X시간>

## 후속 조치

1. tick-pipeline.ts: claimLifecycleChecks batch cap 80 → <X>
2. lifecycle worker 처리 loop: sequential → Promise.all wave (concurrency <C>)
3. (필요 시) 429 detection 코드 추가 — `fetchDetail` 안 status 체크
4. 24h 후 production 재측정 → 추가 tune
5. Decision log 박기: `docs/DECISIONS/2026-05-16-lifecycle-throughput-tune.md`

## 위험 / 보류

<측정 중 발견한 추가 이슈 또는 follow-up 필요 사항>
