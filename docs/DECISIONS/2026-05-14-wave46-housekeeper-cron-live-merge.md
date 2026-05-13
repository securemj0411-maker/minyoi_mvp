# Wave 46 — Housekeeper AI cache prune live merge + cron 등록

> Status: **applied (code + cron schedule). DDL 0, runtime 동작 검증 통과.** escrow 사업효과 판단과 분리된 retention 트랙. owner Wave 45 sign-off (housekeeper cron = POSSIBLE) 반영.

## 1. 변경 내역

| 파일 | 변경 |
|---|---|
| `src/lib/housekeeper-ai-cache.ts` | **NEW**. `runAiCachePrune()` — `mvp_listing_ai_cache_retention_v1` view 조회 → R1 (age >30d) ∪ R2 (raw_row_gone) pid 추출 → `mvp_listing_ai_classifications` DELETE. R3 (raw_updated_after_classify)는 **관찰만, 본 wave에서 DELETE 안 함** (proxy false-positive 방지, contentHash 더블체크 path 다음 wave). |
| `src/lib/cron-guard.ts` | `CronWorkerMode` union에 `housekeeper_ai_cache_prune` 추가 + DEFAULT_COOLDOWN_MS(30분) / DEFAULT_LEASE_MS(2분) entry. |
| `src/app/api/cron/housekeeper-ai-cache-prune/route.ts` | **NEW**. checkCronAuth + acquireCronGuard + `runAiCachePrune()` 호출. GET/POST 둘 다 처리. maxDuration 60. |
| `vercel.json` | `crons[]`에 `/api/cron/housekeeper-ai-cache-prune` schedule `"17 * * * *"` (hourly, +17분 offset로 다른 cron과 충돌 회피) 추가. |

## 2. 검증

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run test:core` | **120/120 pass** |
| Smoke fire (`curl http://localhost:3000/api/cron/housekeeper-ai-cache-prune`) | ok=true, view_available=true, r1=0, r2=0, observed_r3=0, deleted=0 |
| auth (no header) | 401 unauthorized (기존 checkCronAuth 동작 확인) |
| cron-guard 동작 | 30분 cooldown 적용됨 (시간/lease 합리적) |

## 3. 안전장치

1. **view-driven 후보 추출** — DDL view에서만 R1/R2/R3 후보 받음. 직접 join 안 함.
2. **R3는 DELETE에서 제외** — view R3는 proxy (`raw.source_updated_at > cache.classified_at + 14d`). false-positive 방지 위해 본 wave에서는 관찰만. 다음 wave에서 code-level `contentHash` 재계산 + 일치 시 보존 / 불일치 시 DELETE 로직 추가.
3. **DELETE chunk 100** — 대용량 prune 시에도 트랜잭션 폭증 방지.
4. **service_role 권한** — view는 service_role grant만, 라우트는 cron secret 인증.
5. **rollback** — vercel.json cron entry 1줄 제거 또는 view DROP (Wave 35 §10에 SQL 명시).

## 4. 운영 정책
- 주기: hourly (cron expr `17 * * * *`).
- 본 wave 기준 R1/R2/R3 = 0/0/0 → cron이 firing되어도 일정 시간 idle.
- 첫 R1 발화 예측: 2026-06-08 (oldest cache 2026-05-09 + 30d).
- R3 관찰값은 매 run마다 result에 포함되어 모니터링 가능.

## 5. Escrow 사업효과와 분리
- 본 wave는 **retention 트랙**. escrow gate/transition 분포와 독립.
- escrow gate(Wave 35 ON) + boost(Wave 44)는 그대로 유지.
- Wave 45에서 측정한 4-sample 100% held는 본 wave 결정과 무관.

## 6. 원칙 ack
- escrow gate 그대로 유지: ✓ (gate env 변경 0)
- broad smartphone widening 금지: ✓
- silent carrier 추정 금지: ✓
- 이번 wave는 cron live merge + 등록만: ✓
- escrow pass rate 해석은 미실시: ✓ (별도 트랙)

## 7. 변경/검증/위험
- 변경: 4 files (1 신규 lib, 1 신규 route, 1 cron-guard enum 확장, 1 vercel.json 등록)
- 검증: tsc clean, test:core 120/120, smoke fire ok=true deleted=0
- 위험: 매우 낮음. R3 DELETE 제외로 false-positive 차단. rollback 1줄.
- 다음: Wave 47 — (a) escrow 사업효과 soak 계속 N>50 자연 누적 측정, 또는 (b) R3 contentHash 더블체크 path 추가.

## 8. 남은 blocker

| # | blocker | 상태 |
|---|---|---|
| 1 | housekeeper cron + live merge | ✅ 본 wave 완료 |
| 2 | escrow 사업효과 판단 (N>50 자연 누적) | soak 계속 — 별도 트랙 |
| 3 | (신규) R3 contentHash 더블체크 path | retention 트랙 후속 |

→ **남은 blocker 2건** (#2, #3). #1 폐기.

## 9. Smartphone escrow 상태 한 줄
**continue soak** — N=4 baseline은 결정 불가, gate ON 유지하며 transition 누적 측정 계속.
