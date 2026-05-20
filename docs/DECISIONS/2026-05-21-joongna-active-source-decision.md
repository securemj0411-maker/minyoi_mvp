# 2026-05-21 Joongna Active Source Decision

## 결정

- 중고나라는 단순 실험 소스가 아니라 번개장터와 함께 상시 편입할 marketplace source로 가져간다.
- 번개장터를 대체하지 않는다. 번개장터는 전자기기/브랜드 패션/리셀형 SKU의 주 source로 유지하고, 중고나라는 pool 보강과 sparse lane 확장 source로 붙인다.
- 기존 catalog, mining, option parser, candidate pool, market math, lifecycle 파이프라인을 새로 만들지 않는다. 중고나라 payload를 기존 내부 listing contract로 정규화하는 source adapter를 추가하는 방식으로 간다.
- DB/API/UI 전 구간에서 marketplace source를 first-class 필드로 유지한다. 사용자와 운영자가 나중에 "번개장터 매물인지 / 중고나라 매물인지"를 구분할 수 있어야 한다.

## 현재 코드/스키마 확인

- `mvp_raw_listings`에는 이미 `source text default 'bunjang'`, `seller_source text default 'bunjang'`가 있다.
- `mvp_listing_observations`에도 `source text default 'bunjang'`가 있다.
- `src/lib/joongna.ts`에는 shadow guard, block signal detection, transparent probe, deterministic internal pid mapping(`joongnaInternalPid`)이 이미 있다.
- 현재 큰 제약은 `mvp_raw_listings.pid bigint primary key` 단일 PK 구조다. 중고나라 원본 id를 그대로 쓰면 번개장터 pid와 충돌할 수 있으므로, 단기에는 source별 내부 pid 매핑이 필요하다.

## 구현 방향

- `MarketplaceSourceAdapter` 계층을 둔다.
  - `bunjang` adapter: 기존 `SearchItem`/`DetailData`를 거의 그대로 통과.
  - `joongna` adapter: 중고나라 검색/상품 payload를 title, price, url, thumbnail, seller, comment/chat count, observed/update time, raw_json으로 정규화.
- ingest/upsert 시 `source='joongna'`, `seller_source='joongna'`를 반드시 쓴다.
- 원본 id는 단기적으로 `raw_json.sourceExternalId`에 보존하고, 가능하면 후속 migration에서 `source_external_id text` 컬럼과 `(source, source_external_id)` unique index를 추가한다.
- 사용자/운영자 표시 URL은 `pid` 하드코딩 대신 source-aware link builder로 바꾼다.
  - 번개장터: `https://m.bunjang.co.kr/products/{external pid}`
  - 중고나라: 원본 상품 URL
- pool, market-source, /me, admin views는 출처 뱃지/필터를 표시할 수 있게 응답에 `source`를 포함한다.

## 보류/주의

- 중고나라 active write는 adapter contract, source-aware URL builder, 최소 no-write 샘플 리포트가 통과한 뒤 켠다.
- schema를 곧바로 `(source, external_id)` 복합 PK로 갈아엎지는 않는다. 현 구조 영향 범위가 크므로 단기 내부 pid mapping 후, 별도 migration으로 점진 전환한다.
- 차단/429/비정상 접근 신호가 감지되면 회피하지 않고 즉시 중고나라 source를 끈다.
- 중고나라 물량은 전체 플랫폼으로는 크지만, 전자기기/브랜드 SKU 검색에서는 번개장터보다 적은 케이스가 많다. 따라서 기대치는 "pool 2배"가 아니라 sparse lane 보강과 카테고리 확장으로 둔다.

## 다음 작업

1. 중고나라 no-write search/detail sample runner를 만든다.
2. 중고나라 payload를 내부 listing contract로 정규화하는 adapter를 만든다.
3. source-aware URL/link builder를 추가하고 기존 번장 하드코딩 지점을 교체한다.
4. DB migration 후보를 검토한다: `source_external_id`, source별 unique index, source-aware indexes.
5. `/me`, 상세, admin pool에서 출처 뱃지/필터를 노출한다.

## 2026-05-21 현재 상태 확인

- `vercel.json`에는 아직 중고나라 전용 cron route가 없다.
- `mvp_raw_listings`에서 `source='joongna'` row는 0건이다.
- `mvp_collect_runs`에서도 중고나라 관련 cron/collect run은 0건이다.
- `mvp_source_health`에도 `source='joongna'` row는 아직 없다.
- no-write probe는 성공했다:
  - robots.txt 200
  - `sitemap-recent-product-index.xml.gz` 200
  - recent product sitemap 1개에서 상품 URL 10개 샘플 확인
  - 차단/429/CAPTCHA 신호 없음
- no-write 상세 HTML 샘플도 200으로 읽혔고, Next payload에서 `productTitle`, `productPrice`, `categoryName`, `productStatus`, `parcelFeeYn`를 추출할 수 있었다.
- 결론: 중고나라는 아직 cadence를 타고 DB에 들어오는 상태가 아니다. 현재는 안전장치와 no-write probe 단계이며, 다음 구현은 shadow ingest route + adapter + source-aware upsert다.
