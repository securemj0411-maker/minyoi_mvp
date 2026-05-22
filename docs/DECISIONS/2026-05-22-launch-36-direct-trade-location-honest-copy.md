# 2026-05-22 — Launch fix: 직거래 위치 모달 카피 정직화 + 원본 보기 버튼

## 사용자 짚음 (반복)
> "원본에서 위치 확인 필요 — 왜 아직도 이래??"

직전 대화 (joongna detail 위치 송하동 케이스) 에서 옵션 위임했는데 사용자가 다시 짚음.

## 진단 (DB 확인)
- `mvp_raw_listings.raw_json` 안 location/region/tradeLocation/address 키 **전혀 없음** (joongna)
- 우리 중고나라 collector = list/search API 만 사용. detail HTML 파싱 X.
- 위치 정보는 매물 원본 페이지 (`web.joongna.com/product/{id}`) 에만 표시.

## fix (이번 wave — 카피 + UI)
`DirectTradeConfirmModal` (직거래 매물 클릭 시 띄우는 pre-modal):

1. **카피 정직화**:
   - "원본에서 위치 확인 필요" (fallback) → "직거래 동네는 매물 원본 페이지에 표시돼요"
   - 사용자가 "왜 우리가 위치 못 받는지" 의문 해소
2. **"원본에서 위치 확인 →" 버튼 추가**:
   - `state.item.listingUrl` 새 탭 open
   - 사용자가 직접 원본 가서 동네 확인 가능
3. directTradeLocation 있는 케이스는 그대로 (예: bunjang 일부 매물 위치 박혀 있으면 표시)

## 후속 (별 wave)
**진짜 fix = collector 보강**:
1. `parseJoongnaDetailHtml` 에 location 추출 추가 (HTML 안 키 식별 필요)
2. `JoongnaDetail` type 에 `tradeLocation` 필드 추가
3. `joongna-ingest` 가 detail fetch 시 raw_json.tradeLocation patch
4. `marketplaceLocationFromRawJson` 이 그 새 키 읽음

사용자 메모리 "파싱은 다른 세션" 룰 — 중고나라 detail HTML parser 보강이 그 영역인지
별 영역인지 검토 후 다른 세션에서 박기.

## 영향
- 코드: explore-client.tsx 1 파일
- DB / API: X
- 사용자: misleading 톤 ↓ + 행동 옵션 (원본 보기) ↑

## 메모리 룰
- 일반인 친화: 정직 카피 + 행동 옵션
- decision log: 이 파일
