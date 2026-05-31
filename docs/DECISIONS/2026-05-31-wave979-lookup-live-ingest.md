# Wave 979 — URL lookup DB 미존재 시 live fetch + ingest

- 시간: 2026-05-31 KST
- 트리거: owner — "시세 조회 DB에 없는건 조회안되서 불편하네 DB에 없어도 링크 붙여넣으면 우리 카탈로그랑 파서랑 아무튼 우리 지금 상품 DB에 다 분류되는거처럼 해서 조회되게 하면 안됌?? DB에 없는거만?? 회원이 검색한건 우리 DB READY에도 올라가는거지(단 조건 ready조건 만족해야)"
- 결정: source 범위 = 번장 + 중나 + 당근 한 번에 / 비용 = 기존 5회=1크레딧 그대로 (live ingest 와 DB조회 무차별)

## 변경 (3개 파일)

### 1. `src/lib/live-ingest.ts` (신규)

URL 입력 → `mvp_raw_listings` + `mvp_listing_parsed` upsert 까지 인라인 처리.
- `liveIngestFromParsedUrl({ source, key })` — 3 source 분기.
- 각 source 별 fetcher 재사용:
  - `bunjang.fetchDetail(pid)` (Wave 803m 에서 name/price/freeShipping/updateTime 박은 사전작업)
  - `joongna.fetchJoongnaDetail(url)` (JOONGNA_SOURCE_ID 사용)
  - `daangn.fetchDaangnLiveState(url)` (article 객체 반환, parseDaangnExternalId 로 externalId 추출)
- 공통: `classifyListing(title, desc, price)` → `parseListingOptions({...})` → `toParsedListingRow(pid, parsed)` → POST `mvp_raw_listings` (Prefer:resolution=merge-duplicates) → POST `mvp_listing_parsed`.
- `pool_eligible: true` 박힘 (단, listingType=normal + sku 매칭 시). candidate-pool-builder 가 ready 카테고리만 사용자 풀에 노출.
- internal_only / blocked 카테고리도 raw/parsed 는 박음 (시세 학습 가치 보존, 노출은 builder 가 거름).

### 2. `src/app/api/lookup/by-url/route.ts`

- 기존: DB 조회 0건 → 404 "새 매물이거나 아직 풀에 안 들어옴" 끝.
- 신규: DB 조회 0건 → `liveIngestFromParsedUrl` 시도 → 성공 시 `pid=eq.${ingestPid}` 재조회 후 기존 흐름 (parsed/market/comparable/priceDaily) 재개.
- ingest 실패 사유별 메시지 (`liveIngestFailureHint` 헬퍼):
  - `blocked` → "사이트 일시 차단"
  - `fetch_failed` → "페이지 못 불러옴"
  - `parse_failed` → "분석 실패"
  - `not_a_product` → "판매 종료/삭제됐을 수 있음"
  - `upsert_failed` → "등록 중 오류"
- ingest 직후 comparable_key 없음 (catalog 매칭 실패) → 기존 `parse_pending` 202 대신 `not_in_catalog` 422 신규 응답. 메시지: "지원 카테고리: 이어폰/스마트워치/태블릿/노트북/데스크탑/모니터/스피커/가전".
- 정상 응답에 `freshlyIngested: boolean` 박음 (UI 에서 "방금 새로 가져온 매물입니다" 배지 표시 가능).
- Wave 802 의 candidate_pool 자동 등록 로직 (route 하단 `register_to_pool`) 그대로 작동. live ingest 매물도 profit > 0 이면 ready 풀에 박힘.

### 3. `src/app/lookup/lookup-client.tsx`

- `LookupResponse.freshlyIngested?: boolean` 타입 추가.
- 매물 정보 카드 헤더에 "방금 등록" 초록 배지 (`freshlyIngested=true` 시) — source 배지 옆.
- `not_in_catalog` 422 응답은 기존 setError 흐름 그대로 처리 (route 의 한글 메시지 그대로 표시).

## 데이터 / 정책 영향

- **READY 풀 진입 조건** (owner 가 짚은 "sku가 ready" 등): 기존 룰 그대로.
  1. `listing_type = normal`
  2. `sku_id` 매칭 (카탈로그 등록 모델)
  3. `category_readiness = ready` (8 카테고리)
  4. profit > 0 (Wave 802 lookup 자동 등록 조건)
- raw/parsed 는 위 조건 미충족이어도 박음 — 시세 학습 데이터 가치. candidate-pool-builder + category-readiness 가 노출 게이트.
- `query='live_lookup'` 으로 marking → 추후 분석 (실제 사용자 검색 흐름과 cron 수집 흐름 분리 측정 가능).
- `raw_json.source='live_lookup'` 도 박음 — DB 에서 live ingest 매물만 골라보기 쉬움.

## 검증

- `npx tsc --noEmit`: 신규 파일 (`src/lib/live-ingest.ts`) + 수정 파일 (`src/app/api/lookup/by-url/route.ts`) 에러 0건. 기존 tests/ 파일의 미해결 에러는 본 wave 범위 밖.
- 런타임 검증 미실시: 실제 3 source 에서 URL 1건씩 lookup 시도 → 응답 확인 필요 (실 환경 secret 필요).

## 위험

- **rate-limit**: lookup 자체는 분당 10회/사용자 그대로. live fetch 가 외부 사이트 호출 추가 → 사이트별 분당 호출 cap 미적용 (count 합산 cap 만). bunjang/joongna 는 cron 에서 이미 호출 중이라 영향 미미. daangn 은 차단 risk 약간 ↑ → 차단 시 `blocked` 응답으로 graceful degradation.
- **daangn URL slug**: `lookup-by-url` 의 `resolveDaangnArticleSlug` 가 articles/{numeric} → buy-sell/{shortId} redirect 따라가는데, shortId 만으로 `https://www.daangn.com/kr/buy-sell/{shortId}` 호출이 작동하는지는 daangn 측 redirect 동작에 의존. 한국어 slug 일부 손실 가능 — 매물 못 찾으면 `fetch_failed` 응답.
- **upsert race**: 동일 시점 두 사용자가 동일 URL lookup → 둘 다 ingest 시도. PostgREST `Prefer: resolution=merge-duplicates` 로 안전 (한 row 만 남음). pid 같음.
- **카탈로그 미매칭 매물 적재**: listingType !== "normal" 또는 sku 매칭 실패 시 mvp_listing_parsed 박지 않음. raw 만 박힘 → 차후 cron 의 detail-worker 가 다시 분류 안 함 (detail_status=done 박혔으므로). 영향 미미 — 사용자한테 422 응답 즉시 반환, 시세 표시 불가하므로.

## 다음

- daangn slug resolution 정확도 검증 wave (실 환경 sample URL 로 검증).
- live ingest 매물 통계 — `query='live_lookup'` row 수 / source 별 성공률 / not_in_catalog 비율 모니터링 dashboard.
