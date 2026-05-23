# Wave 441 — Acne broad cross-category cleanup

## 결정

- `clothing-acne-apparel`은 정상 의류 catch-all로 유지하되, 신발/가방/스카프/머플러/향수/화장품/굿즈처럼 명확한 cross-category bait만 차단한다.
- Acne 데님 라인은 broad와 충돌하지 않도록 `데님/denim/청바지/jean` 및 Max/Bla Konst/Super Baggy/Overall 신호를 broad must-not에 추가했다.
- Acne PVC tote도 `여드름/진정패치/포켓몬/클렌저/화장품` 같은 비가방 bait를 차단한다.
- `아크네스` 단독 차단어는 사용하지 않는다. `아크네스튜디오` 정상 브랜드 표기를 같이 먹는 substring false positive가 생겨서, 화장품은 `클렌저/폼클렌징/여드름/진정패치` 등 구체 신호로만 차단한다.
- sync 정책은 보수적으로 적용했다. ruleMatch가 Acne SKU를 다시 찾으면 복구/재파싱하고, 기존 Acne SKU인데 애매한 행은 유지했다. 다만 제목이 명백 비의류이고 clothing SKU로만 잡히는 경우는 null 처리했다.

## 구현

- `src/lib/catalog.ts`
  - Acne apparel broad의 must-not을 cross-category 중심으로 재정리.
  - Acne PVC tote의 화장품/굿즈 bait 차단 추가.
  - Acne jacket/coat에 JW Anderson/Loewe bait 차단 추가.
- `src/lib/parsers/wave92-fashion-mobility.ts`
  - `스키니진/블랙진/화이트진`, `트라우저`, `무스탕` product-type 파싱 보강.
- `src/lib/tick-pipeline.ts`
  - clothing parser version을 `wave216-clothing-v15`로 유지.
- `tests/wave254-6-product-type-priority.test.ts`
  - Acne 스카프/머플러/향수/신발/가방/화장품/타브랜드 bait reject 회귀 테스트 추가.
  - 후리스/럭비티/스키니진/트라우저/무스탕 product-type 회귀 테스트 추가.
  - `부츠컷` 데님은 신발 부츠로 오인하지 않는 회귀 테스트 추가.

## DB 반영

- 초기 sync에서 `아크네스` substring이 `아크네스튜디오` 정상 매물을 막는 문제가 발견되어 즉시 제거하고 재복구했다.
- 전체 Acne SKU scope 재동기화 후, stale clothing 오염을 제거하고 정상 데님/스웨트/티/셔츠/자켓/가방/신발 SKU는 재파싱했다.
- 최종 검증:
  - Acne SKU에 남은 `스틸레토/바디백/로퍼/겔제/클렌저/스카프/머플러/페리/진정패치/JW 앤더슨`: 0건.
  - `부츠컷` Acne 데님은 `clothing-acne-denim`으로 복구 확인.

## 보류

- Acne broad 내부의 `type_unknown` 잔여 행은 별도 wave에서 실제 SKU 후보를 보고 쪼갠다.
- Acne scarf/muffler는 인기/거래량이 충분하면 별도 accessory SKU로 분리 검토한다.
- 사이즈별 회전률 보정은 별도 wave로 진행한다.
