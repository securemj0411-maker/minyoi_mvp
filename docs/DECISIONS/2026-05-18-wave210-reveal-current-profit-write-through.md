# Wave 210 — reveal과 /me의 현재 차익 write-through

## 배경

- 시간: 2026-05-18 17:05 KST
- 사용자 질문:
  - `/me` 갱신이나 reveal에서 얻은 판매완료/삭제/시세/차익 사실을 한 사용자 프론트에만 적용하지 말고 DB에도 반영해야 하지 않나?
  - 크론만 기다리지 말고 사용자 요청이 자연스럽게 최신 상태를 시스템 전체에 되먹이는 구조가 더 좋지 않나?

## 기존 상태 확인

판매완료/삭제/숨김:

- 이미 `/api/packs/me` live verify가 DB write-through를 하고 있었다.
- 터미널 상태 감지 시:
  - `mvp_raw_listings.listing_state`
  - `mvp_lifecycle_checks`
  - `mvp_candidate_pool.status = invalidated`
- 즉 pool에서도 내려가고, 한 사용자 화면만 보정하는 구조가 아니다.

시세/차익:

- Wave 208 이후 `/me` 표시는 request-time `marketBasis.medianPrice - price`를 쓴다.
- 하지만 그 request-time 계산값을 `mvp_pack_reveals.current_profit_*`에 즉시 되먹이는 경로는 없었다.
- cron의 `recompute_reveal_current_profits`가 갱신하긴 하지만, 사용자 요청에서 이미 계산한 값을 DB에 공유하지 못했다.

## 결정

1. 새 reveal row는 처음부터 현재 차익 cache를 같이 저장한다.
   - `current_profit_min`
   - `current_profit_max`
   - `market_invalidated_at`
2. `/me`에서 visible page slice의 현재 차익을 계산하면 DB에 write-through 한다.
   - 단일 RPC로 `pid`별 업데이트를 전달.
   - 같은 `pid`를 reveal 받은 모든 사용자 row를 갱신.
   - 값이 바뀐 row만 update.
3. 판매완료/삭제 live verify는 기존처럼 즉시 global DB/pool 상태를 수정한다.

## 변경

- `supabase/migrations/20260518074500_sync_reveal_current_profits_from_json.sql`
  - `sync_reveal_current_profits_from_json(p_updates jsonb)` RPC 추가.
  - `current_profit_*`, `market_invalidated_at` 컬럼과 index를 `if not exists`로 보강.
- `src/lib/pack-open.ts`
  - 일반 pack reveal insert 시 current profit cache도 함께 저장.
- `src/app/api/me/hotdeal/open/route.ts`
  - hotdeal reveal insert 시 current profit cache도 함께 저장.
- `src/app/api/packs/me/route.ts`
  - `/me` visible page의 `marketGapKrw`를 RPC로 write-through.
  - 실패해도 사용자 응답은 막지 않는 non-fatal sync.

## 운영 해석

- 크론은 여전히 전체 sweep의 안전망이다.
- 사용자 트래픽은 최신 상태를 발견하는 opportunistic updater 역할도 한다.
- 판매완료/삭제는 global listing/pool 상태를 갱신한다.
- 시세/차익은 market table 자체를 재집계하지 않고, 이미 읽은 current basis를 reveal cache에 공유한다.
  - 따라서 정확성과 효율 사이의 균형을 유지한다.

## 보류

- `/me` 요청에서 raw listings 전체를 즉석 재집계해 `mvp_market_price_daily` 자체를 갱신하는 것은 보류.
- 더 큰 규모에서는 `sync_reveal_current_profits_from_json` 호출을 queue/batch로 넘기는 구조를 검토할 수 있다.

## 검증

- `npm run build`: 통과
- `npm run test:core`: 446/447 통과
  - 기존 실패 유지: `tests/wave159h-condition-fallback.test.ts`의 `target sample 부족 → fallback chain 진행` 케이스가 expected `worn`, actual `flawed`로 실패.
- production DB:
  - `sync_reveal_current_profits_from_json` migration 적용 확인.
  - REST RPC smoke test `p_updates=[]`: `updated_count=0`, `invalidated_count=0`.
