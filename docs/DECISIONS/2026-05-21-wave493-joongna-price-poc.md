# Wave 493 — 중고나라 시세조회 PoC

## 확인한 것
- 중고나라 시세조회 웹은 `POST https://search-api.joongna.com/v4/analysis/product-price/scatter-plot`를 호출한다.
- `priceType=0`은 등록가, `priceType=1`은 판매가로 표시된다.
- 응답에는 `scatterPrices`, `linePrices`, `items`가 있고, 상태 등급/상품 옵션/SKU 단위 segmentation은 없다.
- `productPriceSize`로 예시 매물 수는 늘릴 수 있지만, 시세 산출 자체는 검색어 단위다.

## 샘플 결과
- `스투시`
  - 중고나라 등록가 median 80,000원, 판매가 median 70,000원.
  - 샘플 items에 티셔츠/모자/후드/기타가 섞임.
  - broad brand query는 trusted median으로 쓰기 부적합.
- `스투시 후드집업`
  - 중고나라 등록가 median 159,000원, 판매가 median 235,000원.
  - 우리 `clothing|stussy_hoodie|hoodie_zip|a_grade` active는 140,000~150,000원대지만 sample이 작다.
  - 판매가 median은 특정 날짜/가격 count cluster 영향이 커 보인다.
- `스투시 후드`
  - 중고나라 등록가 median 100,000원, 판매가 median 179,000원.
  - 후드/후드집업/맨투맨이 섞여, 우리 상태별 hoodie/crewneck lanes와 1:1 대응 어렵다.
- `에어팟 맥스`
  - 중고나라 등록가 median 350,000원, 판매가 median 325,000원.
  - items에 부품용, 이어컵 단품, 라이트닝, USB-C가 섞임.
  - 우리 데이터는 `airpods_max|lightning`과 `airpods_max|usbc`, 그리고 condition별로 명확히 갈라진다.
- `보스 사운드링크 플렉스`
  - 중고나라 등록가 median 109,000원, 판매가 표본 없음.
  - 우리 상태별 active median 100,000~125,000원과 대체로 같은 범위.
- `벤큐 XL2540K`
  - 중고나라 등록가 median 350,000원, 판매가 median 300,000원.
  - 우리 상태별 blended 294,400~344,500원과 대체로 같은 범위.

## 결정
- 추천/수익 계산의 primary truth는 계속 우리 `mvp_market_price_daily`의 SKU + condition median으로 둔다.
- 중고나라 시세조회는 당장 trusted median에 섞지 않는다.
- 대신 다음 구현 후보는 `external_reference` 레이어다.
  - 좁은 query + 충분한 표본일 때만 참고값으로 저장.
  - UI에는 “중고나라 검색어 기준 참고가” 정도로 보조 노출 가능.
  - 우리 median과 큰 차이가 나면 가격 검증 경고 또는 운영자 디버그 신호로만 사용.
- broad fashion query는 특히 위험하다. 스투시처럼 브랜드 query는 상품 타입이 섞이므로 우리 parser/catalog lane이 더 중요하다.

## 보류
- `mvp_market_price_daily`에 직접 blend하는 것은 보류.
- 중고나라 sold median을 profit 계산에 쓰는 것도 보류.
- 다음 단계에서 한다면 별도 테이블 또는 JSON cache에 `source=joongna_search_price`, `query`, `priceType`, `sampleCount`, `median`, `avg`, `querySpecificity`, `mappedComparableKey`, `mappedConditionClass=null`로 저장하는 방식이 안전하다.

## 산출물
- `scripts/report-joongna-price-poc.ts`
- `reports/joongna-price-poc-latest.json`
- `reports/joongna-price-poc-latest.md`
