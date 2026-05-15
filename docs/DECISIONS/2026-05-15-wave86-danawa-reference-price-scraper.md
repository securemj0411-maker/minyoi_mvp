# Wave 86 — 다나와 reference price scraper (미개봉/새상품 매물 시세 anchor)

> 사용자 통찰 (2026-05-16 검토): "이거 이미 로직에 있는데 로그에 안나왔나??" — Wave 86에 박았지만 decision log 누락. 회고 작성.

## 1. 진단
- 시간: 2026-05-15 (회고: 2026-05-16)
- 발견: 미개봉/새상품 매물 시세를 중고 시세 (mvp_market_price_daily)와 같이 쓰면 호가 부풀어져 풀 진입 X → 진짜 꿀 매물 놓침.
- 베타테스터 통찰: 업자/일반인 모두 미개봉 선호 → 미개봉 매물 시세 정확해야.

## 2. 변경
- 시간: 2026-05-15
- 신규 파일:
  - **[mvp/src/lib/reference-price-scraper.ts](mvp/src/lib/reference-price-scraper.ts)** — 다나와 search HTML scrape:
    - URL: `https://search.danawa.com/dsearch.php?query=<keyword>`
    - 가격 추출 regex: `(?:최저가?|lowest|price_sect)[\s\S]{0,500}?([0-9]{1,3}(?:,[0-9]{3}){1,3})\s*원`
    - **outlier ±50% trim** (median 중심)
    - rate limit 보호: 요청 사이 1초 sleep, User-Agent 박음
    - timeout 10s (Vercel serverless 보호)
  - **[mvp/src/lib/reference-price-scraper-keys.ts](mvp/src/lib/reference-price-scraper-keys.ts)** — comparable_key → 검색어 매핑 (정확한 다나와 search query)
  - **[mvp/src/app/api/cron/reference-price-refresh/route.ts](mvp/src/app/api/cron/reference-price-refresh/route.ts)** — 자동 cron refresh (1초/요청 rate limit)
- 신규 테이블:
  - **mvp_reference_prices**: comparable_key, effective_price, source_urls (danawa URL + raw sample), coupang_price (다나와 합산 가격이라 별도 X), updated_at
- 변경:
  - **[mvp/src/lib/tick-pipeline.ts](mvp/src/lib/tick-pipeline.ts)** — 매물 시세 산정 시 condition_notes에 "미개봉/새상품" 있으면 reference_price 우선 사용

## 3. 작동 방식
1. cron이 주기적으로 catalog의 SKU comparable_key 다나와 검색
2. 결과 최저가 (outlier trim 후) `mvp_reference_prices`에 저장
3. tick-pipeline에서 매물 parse 시:
   - 미개봉/새상품 매물 → reference_price (다나와 = 쿠팡/네이버/G마켓 등 합산) 시세
   - 중고 매물 → mvp_market_price_daily (번개 sold) 시세

## 4. retention 연결 (보고서 Layer 3 multi-source)
- 사용자가 KREAM/다나와에서 직접 검색 가능
- 미뇨이 시세 = 다나와 anchor → 신뢰 ↑
- 따로 놀면 즉시 신뢰 잃음
- **시세 자체보다 시세의 출처를 보여주는 게 retention factor**

## 5. 거론 금지
- 다나와 HTML 구조 변경 시 regex 조정 필요 (모니터링: rawSample column이 디버그용)
- 당근 scraper 별도 — 다나와로 신품 시세 충분, 중고 시세는 번개장터 자체로.
- 단종/한정판 시세 — 다나와에 없음, KREAM에서 별도 fetch 필요 (Wave 별도).
