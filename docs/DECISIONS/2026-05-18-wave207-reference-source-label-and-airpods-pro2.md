# Wave 207 — 다나와 라벨은 실제 reference anchor일 때만 표시

## 배경

- 시간: 2026-05-18 15:52 KST
- 사용자 보고: AirPods Pro 2 미개봉 카드가 `📍 다나와` 라벨을 달고도 시세가 `192,640원`으로 표시됨.
- 기대: 미개봉/새상품이면 실제 다나와 새상품 reference price를 보여줘야 함.

## 확인

- 문제 PID 예시:
  - `405158000` 애플 에어팟 프로 2세대 미개봉 새상품
  - `405552553` [한국판]미개봉 상품 AirPods Pro 2 2025
- 두 row 모두:
  - `condition_class = unopened`
  - `comparable_key = airpods|airpods_pro_2`
  - `mvp_reference_prices`에는 해당 base key row가 없었음.
- reference table에는 connector-specific key만 존재:
  - `airpods|airpods_pro_2_usbc|usbc = 303,720원`
  - `airpods|airpods_pro_2_lightning|lightning = 303,720원`
- 결과적으로 API는 reference anchor를 못 잡고 Bunjang market median `192,640원`을 사용했는데, 프론트는 `conditionClass === "unopened"`만 보고 `📍 다나와` 라벨을 붙였다.

## 변경

### 1. 실제 source 필드 추가

`src/lib/pack-open.ts`

- `RevealMarketBasis.priceSource` 추가:
  - `reference`: 다나와/공식 새상품 reference anchor 사용.
  - `market`: 번개 market stats 사용.
- `marketBasisForCandidate()`가 `useRefAnchor` 결과에 따라 `priceSource`를 내려준다.

### 2. AirPods Pro 2 unified key alias

`src/lib/pack-open.ts`

- `fetchReferencePrices()`에서 요청 key에 `airpods|airpods_pro_2`가 있으면 connector-specific reference key도 함께 조회.
- base key row가 없어도 USB-C/Lightning reference price를 base key에 alias mapping.

`src/lib/reference-price-scraper-keys.ts`

- scraper fixed list에 `airpods|airpods_pro_2` base key 추가.

### 3. UI 라벨 조건 수정

`src/components/user-reveal-dashboard.tsx`

- `📍 다나와` 라벨은 `marketBasis.priceSource === "reference"`일 때만 표시.

`src/components/pack-reveal-modal.tsx`

- 모달의 `다나와 새 가격 기준` 안내도 `priceSource === "reference"`일 때만 표시.

## Production 보정

- `mvp_reference_prices`에 base key 즉시 upsert:
  - `comparable_key = airpods|airpods_pro_2`
  - `label = 에어팟 프로 2세대 USB-C`
  - `effective_price = 303,720`
- 이제 기존 parsed row가 reparse 없이도 reference anchor를 잡을 수 있다.

## 보류

- AirPods Pro 2 parser를 connector-specific key로 다시 분리하는 작업은 보류.
  - 기존 정책은 sample 확보를 위해 Lightning/USB-C를 통합했다.
  - 현재 다나와 reference price가 두 key 모두 동일하므로 base alias가 더 작은 수정이다.
- 기존 reveal의 `current_profit_min` DB 재계산은 보류.
  - `/api/packs/me`는 reference anchor 사용 시 DB current_profit을 무시하고 실시간 `referencePrice - price`를 표시한다.

## 검증

- `npm run build`: pass
- `npm run test:core`: 446/447 pass
  - 기존 실패 1건 유지: `tests/wave159h-condition-fallback.test.ts`
  - 실패 내용: `target sample 부족 → fallback chain 진행`, actual `flawed`, expected `worn`
