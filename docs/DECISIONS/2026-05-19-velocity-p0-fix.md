# 2026-05-19 — Velocity 측정 로직 P0 fix

## 결정

`/me` 매물 상세보기에서 표시되는 **"팔리는 속도 / 며칠 안에 팔림"** velocity 지표가
실제로는 production에서 거의 다 **거짓 폴백("약 2일 · 카테고리 평균")**으로 노출되고 있던 lapse를 즉시 fix.

## 발견 (Audit)

Agent 깊이 감사 + Supabase 실 데이터 확인 결과 P0 4개 + P1 다수:

### P0
1. **`UI_TEST_FALLBACK_VELOCITY_HOURS = 48` 폴백이 production에 활성** 상태.
   라벨 `약 2일 · 표본 적음 (카테고리 평균)` ([pack-reveal-modal.tsx:1142-1144](../../src/components/pack-reveal-modal.tsx#L1142))는
   거짓 — 실제로는 고정 상수 48h. Wave 297 결정 로그에서 "출시 전 feature flag로 격리해야 한다"고
   박혔는데 미반영.
2. **velocity 집계 cron이 vercel.json 어디에도 wiring 안 됨.**
   `scripts/sync-market-velocity.mjs`는 `npm run sync:market-velocity`로만 호출 가능했고,
   직전 실행 = **2026-05-11**. 8일째 stale 상태로 production 운영 중이었음.
3. **`pack-reveal-modal.tsx:524` 일관성 버그** — `sold7dCount > 0` 체크 누락.
   다른 모든 velocity 표시 지점은 같이 체크하는데 이 한 곳만 historical median만으로
   "팔리는 속도 약 N일" 출력 가능.
4. **카테고리 coverage 처참** — 직전 sync에서 119 row, 5 카테고리(smartwatch/laptop/earphone/smartphone/tablet)만.
   메모리 [Wave 90 source 다양화](../../../memory/project_wave90_source_diversification.md)
   카테고리(신발/의류/가방/스포츠)는 **velocity 0건**.
   → 단, mvp_listing_parsed에는 다 잘 들어있음 (신발 4656 키). cron 한 번 돌리면 해소되는 문제였음.

### P1 (출시 후 정비)
- `mvp_market_velocity_daily.condition_class`는 컬럼 추가됐는데 schema.sql 미반영, sync 함수는 항상 `'all'` 박음.
  사용자가 보는 카드 condition이 "중"인데 표시되는 회전은 신품+중고+불량 평균.
- 7d window median 따로 없음 — historical 누적 median을 "최근 7일" 카피와 섞어 표시.
- clock_basis = `first_seen_to_sold_detected` — crawler 인지 시점이지 실제 판매 시점 아님.
- medium 임계치 8 → 12~15로 상향 검토 (표본 부족 컷).

## 변경 (What)

### 1. Migration: `public.sync_market_velocity_daily()` RPC 함수
파일: `supabase/migrations/20260519...sync_market_velocity_rpc*.sql` (apply_migration MCP 박음)

- 기존 `sync-market-velocity.mjs`의 CTE upsert SQL을 그대로 `plpgsql security definer` 함수로 캡슐화.
- 결과는 `jsonb { upserted_rows, high, medium, low, sold_sample_total, computed_at }` 반환.
- `service_role`만 execute, `anon`/`authenticated`는 revoke.
- v1에서 PK 불일치 에러 발생 — 실제 PK가 `(date, comparable_key, condition_class)`였음 (schema.sql과 불일치).
  v2에서 `condition_class='all'` 박아서 fix. PK 통일은 P1.

### 2. Cron route 신설
파일: [src/app/api/cron/sync-market-velocity/route.ts](../../src/app/api/cron/sync-market-velocity/route.ts)

- `checkCronAuth` 적용 (다른 cron과 동일 패턴).
- RPC 호출 1회 후 결과 반환. Vercel cron 로그에서 history 추적 가능.
- `maxDuration = 90`.

### 3. `vercel.json` crons 등록
- 스케줄: `30 18 * * *` (UTC 18:30 = KST 03:30, daily-backup 직전).
- 다른 cron과 30분 간격 두어 부하 분산.

### 4. UI 코드 fix

| 위치 | 변경 |
|---|---|
| [pack-reveal-modal.tsx:116](../../src/components/pack-reveal-modal.tsx#L116) | `VELOCITY_UI_TEST_ENABLED = NEXT_PUBLIC_VELOCITY_UI_TEST==='1'` env 게이트 추가 |
| [pack-reveal-modal.tsx:928-951](../../src/components/pack-reveal-modal.tsx#L928) `saleSpeedDisplay` | 게이트 OFF면 hours=null → label = "수집 중", confidenceLabel = "데이터 수집 중" |
| [pack-reveal-modal.tsx:1138-1148](../../src/components/pack-reveal-modal.tsx#L1138) 상세 타일 | 폴백 운영 게이트 OFF면 value = "수집 중", sub = "회전 데이터 수집 중" (거짓 "카테고리 평균" 카피 제거) |
| [pack-reveal-modal.tsx:524-532](../../src/components/pack-reveal-modal.tsx#L524) 점수 근거 | `sold7dCount > 0` 가드 추가 |

## 검증 (Validation)

즉시 백필 실행 결과 (`SELECT public.sync_market_velocity_daily()`):

| 지표 | Before (8일 전) | After (오늘 백필) | 변화 |
|---|---|---|---|
| total rows | 119 | **645** | +5.4x |
| 진짜 데이터 (high+medium) | 13 | **94** | **+7.2x** |
| 카테고리 수 | 5 | **18** | +3.6x |
| sold_sample_total | ~120 | **3,416** | +28x |
| 신발 velocity rows | 0 | 117 | (low 위주, 표본 부족 정상) |
| 의류/가방 velocity rows | 0 | 8 + 7 | (sold 검출 적음 — P1 분석 대상) |

**카테고리별 진짜 데이터 (high+medium):**
- smartwatch 33 (이전 13, +153%)
- earphone 16 (이전 3, +433%)
- smartphone 17 (이전 0)
- tablet 16 (이전 0)
- laptop 3 (이전 0)
- game_console 4, watch 3, speaker 1, monitor 1

## 후속 (Follow-up)

### 즉시 (이번 PR과 같이)
- `NEXT_PUBLIC_VELOCITY_UI_TEST` env var를 Vercel project 환경변수에 **추가하지 않음** (운영 게이트 OFF 기본값 유지)
- Vercel prod 배포 후 매일 새벽 cron 자동 실행 확인

### P1 (출시 후 1~2주)
1. **condition_class 분리** — `mvp_market_velocity_daily.condition_class` 컬럼 활용해 신품/중고/하급 회전 분리. PK 일치.
2. **schema.sql 동기화** — `condition_class` 컬럼 + PK 변경 반영. 다른 migration 불일치도 같이 점검.
3. **`sync-market-velocity.mjs` 스크립트 deprecate** — 같은 SQL이 RPC 함수에도 있어 중복. 스크립트는 dev에서 RPC 호출하도록 변경 또는 삭제.
4. **7d window median 컬럼 분리** — `median_hours_to_sold_7d`. UI "최근 7일 N건" 카피와 일치.
5. **medium 임계치 8 → 12~15 상향** — 표본 부족 컷.
6. **신발/의류/가방 sold 검출 약함 원인 분석** — listing_state='sold_confirmed' 전환이 이 카테고리에 잘 안 잡히는지 (잡힘 로직? source 차이?).

## 관련

- 외부 검토: 본 세션 agent audit 보고서 ([report](../../../.claude/conversation-history) 참고)
- Wave 297 결정 로그: `2026-05-19-wave297-velocity-ui-test-fallback.md` (출시 전 feature flag 필요 명시 — 본 PR로 해소)
- 메모리: "운영자가 매번 짚어줘야 하는 lapse 차단" — cron wiring 없는 상태가 그 lapse의 전형
- 메모리: "DELETE/DROP 사전 영향 명시 필수" — 본 fix는 CREATE OR REPLACE FUNCTION 등 destructive 아님 (테이블 데이터는 UPSERT, 기존 row 다 보존)
