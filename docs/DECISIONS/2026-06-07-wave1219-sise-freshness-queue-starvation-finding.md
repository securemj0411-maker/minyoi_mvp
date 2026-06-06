# Wave 1219 — 시세 freshness 근본 원인: market-key 재계산 큐 starvation (발견 로그)

날짜: 2026-06-07 (KST) / DB UTC 2026-06-06 17:44
상태: **근본 fix 적용 완료 (stale lane 정렬 변경, TS clean). 버즈 검증 재계산 트리거됨 (다음 market-worker run).**
배포: 아직 push 안 함 — Vercel 배포돼야 큐 fix가 prod cron에 적용됨. (버즈 검증은 priority bump로 현재 prod에서 즉시 확인.)
계기: owner 질문 "이제 시세 잘 잡혀? 버즈만 병신같이 고친거 아니지? 근본적으로 잡은건가?" → Wave 1218 검증.

## TL;DR
- **Wave 1218 FE 매칭 fix는 진짜 systemic (✓)** — `tokenHit` 핵심 generic 함수 1줄. FE 들어간 모든 SKU(S20FE/S23~25FE/갤탭 S9 FE)에 적용, 버즈 전용 아님.
- **그러나 버즈3프로 시세 "숫자"는 아직 안 바뀜.** 화면 시세(06-03 dated)는 **06-02 16:12 UTC 계산값** = reparse(06-06 17:23)보다 4일 전. FE 오염 제거가 시세에 미반영.
- **근본 원인 = market-key 재계산 큐(`mvp_market_key_invalidation`) starvation.** 이전 세션의 "daangn cron 죽음/05-31 frozen" 진단은 **틀림** (실측: 3 source 전부 fresh, pipeline now()-기준 32초 전까지 살아있음).

## 실측 증거
- 파이프라인 생존: `now()=06-06 17:44:50 UTC`, last_obs=17:44:19(32초 전), last_market=17:42, last_pool=17:44. tick `*/2`, market-worker `2,12,22,32,42,52` 정상.
- 큐 backlog: **pending 12,324 / done 32,016.** 그중 never-computed 3,036 + 매우오래됨(<05-25) 717 + 오래됨(05-25~31) 6,017 + stale(06-01~03) 1,191 + recent 1,363. **locked = 0** (락 문제 아님, 순수 throughput/ordering).
- 버즈3프로 큐: `status=pending, last_recomputed_at=06-02 16:12, locked_until=null` — 4일째 claim 안 됨. 단, raw 관측은 매일 신선(06-04/05/06 각 50~90건).
- 노출 pool SKU(2,697개) 시세 신선도: fresh 615(23%) / recent 503 / **stale 3~6일 390 / 6일+ 444 / mixed 시세 없음 745**. (745는 per_source 시세 있을 수 있어 과대해석 금지.)

## 근본 메커니즘 (tick-pipeline.ts `loadPendingMarketInvalidations` ~3558)
- claim 500/run = priority lane(~460, `priority.desc,last_event_at.asc`, top-3000 window) + **stale lane 40/run(`last_event_at.asc`)**.
- **버그: stale lane이 `last_event_at`(이벤트 오래된 순) 기준.** → 이벤트가 오래 끊긴 키(=죽은/비활성 키)를 우선 빼냄.
- **버즈처럼 매일 가격이 바뀌는 활성 키는 last_event_at이 항상 최신** → stale lane에서 영원히 뒤로 밀림. 그리고 priority가 top-3000 밖이면 priority lane에서도 탈락 → **양쪽 lane에서 starvation.**
- 즉 freshness 지표는 "재계산이 얼마나 묵었나(`last_recomputed_at`)"인데, stale lane은 "이벤트가 얼마나 묵었나(`last_event_at`)"로 골라서 **활성·노출 SKU일수록 굶는** 역설.

## 적용한 fix (Wave 1219)
1. **(근본·적용) stale lane 정렬 `last_event_at.asc` → `last_recomputed_at.asc.nullslast`** — `loadPendingMarketInvalidations` (tick-pipeline.ts ~3580). 4곳 coordinated edit: 타입 필드 `last_recomputed_at` 추가 / fetch columns 추가 / 서버 fetch order / 클라 staleEnriched sort. 컴퓨트가 가장 오래 묵은 키부터 drain → 버즈 같은 활성 stale 키 정확히 타깃. **nullslast** 채택(nullsfirst는 처리 불가 null 키가 lane churn → 재-starvation 위험). 공식(blend/outlier) 무관, claim 순서만. TS clean.
2. **(검증·적용) 버즈3프로 priority 100→100000 bump** — 현재 prod의 다음 market-worker(≤10분)가 claim → FE 제거된 데이터로 재계산. 결과 숫자 확인 예정. (일회성 검증, 영구 패치 아님 — 근본은 #1.)
3. **(미적용·옵션) `PIPELINE_MARKET_INVALIDATION_STALE_LANE_LIMIT` 40→상향** — #1로 ordering이 정확해지면 40/run × 144 = 5,760/day로 활성 stale(~834개) drain 충분. limit 상향은 backlog 가속용이나 run time/REST cost 트레이드오프 → 일단 보류, 측정 후 판단.

## 검증 (예정/진행)
- 버즈3프로 재계산 후 시세 숫자 + FE 오염 제거 반영 확인.
- 배포 후 pending backlog(특히 활성·노출 stale 키) drain 추세 모니터.

## 미해결/주의
- #1 적용 전 "활성+노출+stale" 키의 정확한 규모 측정 권장 (죽은 키 backlog와 분리).
- 시세 공식(blend/outlier/decayTrim) 절대 미변경 (Wave 798c 교훈).
