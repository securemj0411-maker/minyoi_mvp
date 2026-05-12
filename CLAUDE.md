@AGENTS.md

# 미뇨이 MVP — Claude Code 작업 가이드

> 갱신: 2026-05-12. 번개장터 리셀 후보 발굴 → 사용자가 "팩"을 열어 후보 카드를 확인하는 Next.js 16 + Supabase 앱.

## 데이터 플로우

```
Bunjang API
  └─► /api/cron/collect      → mvp_raw_listings
        └─► /api/cron/tick   → option-parser → mvp_listing_parsed → mvp_listing_analysis
              └─► market-worker → mvp_market_price_daily / velocity_daily
                    └─► pool-warmer + candidate-pool-builder → mvp_candidate_pool
                          └─► /api/packs/open → mvp_pack_opens / mvp_pack_reveals
```

각 단계는 별도 cron, 멱등성 가정. tick은 1분, 나머지는 더 길게.

## 디렉터리 맵

| 경로 | 역할 |
|---|---|
| `src/app/api/cron/*` | Vercel Cron 워커 (인증 + guard 필수) |
| `src/app/api/packs/*` | 팩 구매·오픈·공개 (사용자 인증) |
| `src/app/api/debug/*` | 운영 전용. 프로덕션 가드 없음 — 호출 주의 |
| `src/lib/pipeline.ts` | 수집·풍부화·점수 코어 (1409줄, God file) |
| `src/lib/tick-pipeline.ts` | tick/deep-crawl/market/lifecycle 전략 (3448줄, God file) |
| `src/lib/option-parser.ts` | 제목/설명 → comparable_key |
| `src/lib/catalog.ts` | SKU 카탈로그 |
| `src/lib/category-readiness.ts` | 카테고리 공개/내부/차단 정책 |
| `src/lib/candidate-pool-builder.ts` | pool 조립 |
| `src/lib/market-math.ts` | median/MAD/confidence |
| `src/lib/pack-open.ts` | 팩 오픈 트랜잭션 (race condition 주의 — §함정) |
| `src/lib/cron-guard.ts` | 크론 동시실행 방지 (DB lock 지원) |
| `src/lib/supabase-{rest,server-auth,browser}.ts` | 3중 클라이언트 — §클라이언트 가이드 |
| `supabase/schema.sql` | 전체 스키마 |
| `scripts/mine-category-intelligence-v3.mjs` | 마이닝 최신본 (v1/v2 레거시, 건들지 말 것) |
| `scripts/{diagnose,backfill,report}-*` | 진단/백필/리포트 (report-*는 398개, 보일러플레이트 86%) |
| `tests/*.test.ts` | tsx --test 코어 테스트 |

## Category Readiness (핵심 개념)

`category-readiness.ts`에서 세 상태:
- **ready**: 공개 후보팩 허용 (현재 `earphone`, `smartwatch`)
- **internal_only**: 시세 학습만, 사용자 노출 금지 (`smartphone`, `tablet`, `laptop`, `monitor`, `speaker` 등)
- **blocked**: 후보풀 진입 차단

**새 카테고리는 무조건 `internal_only`로 시작.** ready 승격은 `minReadyPool / minParseRate / minTrustedKeys` 통과 후 사람 결정.

## 새 카테고리 추가 절차

1. `npm run mine:category:v3 -- --category=<name>` → `category-intelligence/<name>/`
2. 파서 추가 (`option-parser.ts` 확장 또는 `game-console-parser.ts` 패턴)
3. `catalog.ts`에 SKU 등록
4. `category-readiness.ts`에 `internal_only` 등록
5. `npm run diagnose:parser` + `diagnose:readiness` 통과
6. 시세 충족 후 사람이 `ready` 승격

## 크론 워커

| 라우트 | 권장 주기 | 책임 |
|---|---|---|
| `tick` | 1분 | 점수 갱신, terminal recheck |
| `collect` | 5분 | 검색 페이지 수집 |
| `detail-worker` | 1분 | 상세 정보 큐 |
| `lifecycle-worker` | 2분 | 활성/만료 갱신 |
| `market-worker` | 10분 | 시세 집계 |
| `pool-warmer` | 5분 | candidate_pool 충원 |
| `housekeeper` | 60분 | TTL/정리 |
| `landing-showcases` | 5~10분 | 랜딩 캐시 |
| `deep-crawl` | 30~60분 | 깊은 페이지 크롤 |

모든 cron 라우트 공통: `checkCronAuth(req)` + `acquireCronGuard(mode, req)` + `export const maxDuration = 60` 필수. 프로덕션은 `CRON_GUARD_DB_LOCK_ENABLED=1`.

## Supabase 클라이언트 선택

| 상황 | 함수 | 키 |
|---|---|---|
| 브라우저 사용자 읽기 | `getSupabaseBrowserClient()` | anon |
| 서버 CRUD | `restFetch(url, { headers: serviceHeaders() })` | service_role |
| API 라우트 사용자 인증 | `requireSupabaseUser(req)` | bearer/cookie |
| RPC | `restFetch(rpcUrl("fn"), ...)` | service_role |

**service_role 키는 절대 클라이언트 코드에 노출 금지.** `NEXT_PUBLIC_` prefix는 anon 전용.

## 함정 (사고 예방)

- **Next.js 16** — 학습 데이터와 다름. `node_modules/next/dist/docs/` 확인 (AGENTS.md).
- **팩 오픈 race condition** — `spendUserCredits` + `openPack`이 분리돼 더블스펜드/환불실패 위험. 이 영역 수정 시 [packs/open/route.ts](src/app/api/packs/open/route.ts) + [pack-open.ts](src/lib/pack-open.ts) + [user-credits.ts](src/lib/user-credits.ts) 함께. 권장 해결: Supabase RPC로 원자화.
- **RLS 정책 미흡** — `enable row level security`만 있고 POLICY 없으면 기본 DENY. service_role 우회 중이지만 클라이언트 직접 쿼리 추가 전 점검 필수.
- **`/api/debug/reset-db`** — 14개 테이블 비움. `NODE_ENV` 가드 없음. 호출 전 환경 확인.
- **God file 금지** — `pipeline.ts`/`tick-pipeline.ts`에 더 쌓지 말고 작은 모듈로 분리.
- **report-*.ts 양산 금지** — 398개 이미 있음. 새로 만들 거면 공통 베이스부터.
- **mining v1/v2 수정 금지** — v3만 사용.
- **`pool-policy.mjs` + `.d.ts`** — 비표준 조합으로 동작 중. 통합 시 import 전수조사 필요.
- **`category-intelligence/`, `reports/`** — git에 포함됨. 새 산출물은 ignore 후보로.

## 운영 진단 (자주 쓰는 것)

`diagnose:{parser,pool,readiness,pack-open}`, `report:{db-hotpaths,unit-economics}`. 전체 명령은 `package.json` 참조.

## 참고 (루트 `../`)

`기술_엔진_운영맵_*.md` (운영 스냅샷), `30일_실행계획.md` (의사결정 히스토리), `미뇨이_외부감사.md` (감사 지적), `mvp/SUPABASE_SETUP.md` (Supabase 연결).
