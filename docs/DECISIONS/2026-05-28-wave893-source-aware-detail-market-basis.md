# Wave 893 — 상세/쉬운모드 source-aware 시세 근거 정합성

## 문제

당근 매물 `9001572522315` (`애플 에어팟 프로 2세대 c타입`) 상세/쉬운모드에서:

- 매물 source 는 `daangn`
- 화면 시세는 `161,500원`, 비교 `152건`
- 그래프/라벨은 `번개장터 시세`, `번개장터 호가/거래가`
- 비교 매물은 번개장터 중심

사용자 기대는 당근 매물은 당근 표본이 충분하면 당근끼리 비교하는 것.

## 확인한 데이터

동일 comparable key `airpods|airpods_pro_2`, condition `clean` 기준:

- mixed latest row: active 87 + sold 31 + disappeared 35 = 153건, blended median 161,500원
- raw join 기준 source별 표본:
  - 번개장터 143건, median 160,000원
  - 중고나라 5건, median 170,000원
  - 당근 13건, median 145,000원
- `mvp_market_price_daily_per_source` 는 0건

따라서 이번 케이스는 "당근 표본 3개 이하라 mixed fallback" 이 아니라, per-source 통계 row 가 생성되지 않아 mixed row 로 fallback 된 상태.

## 원인

Wave 886 에서 per-source write 는 추가됐지만 `mvp_market_price_daily_per_source` PK 의 `condition_tier` 는 NOT NULL DEFAULT ''. 코드가 JSON `null` 을 명시해 보내면 DB default 가 적용되지 않고 insert/upsert 가 실패한다. 해당 실패는 mixed write 보호를 위해 catch/swallow 되어 cron 은 계속 돌지만 per-source table 은 비어 있었다.

또한 상세/쉬운모드 표시 레이어는 `fetchLatestMarketStats()` / `marketBasisForCandidate()` 의 mixed basis 만 사용하고 있어, per-source row 가 생겨도 UI evidence layer 가 source-aware basis 를 읽지 못하는 drift 가 있었다.

## 결정

- per-source market row write 시 `condition_class` / `condition_tier` null 을 빈 문자열로 정규화한다.
- `pack-open` 의 marketBasis 에 source-aware basis metadata 를 추가한다.
  - same-source active+sold sample >= 3 이면 source-specific row 사용
  - 부족하거나 fetch 실패 시 mixed fallback
  - fallback 여부를 `sourceFallbackUsed` 로 명시
- `/me`, reveal detail lazy analysis, pool analysis, market-source debug API 가 per-source basis 를 같이 읽는다.
- 상세/쉬운모드 그래프 라벨은 더 이상 번개장터 하드코딩을 쓰지 않고 `당근마켓`, `중고나라`, `번개장터`, `통합 중고` 중 실제 basis 를 따른다.
- source-specific basis 를 쓸 때 market-source 비교 매물 list 도 같은 source 로 필터한다.

## 보류

- 기존 mixed history row 를 per-source 로 과거 backfill 하는 작업은 보류. 다음 market-worker 이후부터 per-source history 가 쌓인다.
- per-source table 이 비어 있는 동안 기존처럼 mixed fallback 한다. 단 라벨은 "통합 중고" 로 보여 source 오인을 줄인다.
- 당근 거래완료/사라짐 표본의 장기 품질 보정은 별도 wave 에서 본다.

## 검증

- `npm run build` 통과.
- 배포 후 확인할 것:
  - `mvp_market_price_daily_per_source` row count > 0
  - AirPods Pro 2 clean/daangn row 가 active+sold >= 3 으로 생성되는지
  - 해당 매물 상세/쉬운모드가 당근 basis 로 바뀌는지
