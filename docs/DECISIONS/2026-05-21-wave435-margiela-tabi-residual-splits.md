# 2026-05-21 Wave 435 — Margiela Tabi residual splits

## Context
- Bottega Cassette / Tabi flat wave 이후에도 `shoe-margiela-tabi` broad에 샌들, 로퍼, 힐, 리복 콜라보, 페인팅 스니커즈, 뮬/에스파드류, 컨버스형 스니커즈가 섞여 있었다.
- broad Tabi가 스니커즈로 기본 추론되던 흐름은 이미 막았지만, 잔여 narrow split이 없으면 비교매물 sample이 계속 다른 형태끼리 섞인다.

## Decisions
- `shoe-margiela-tabi` broad는 catch-all로 유지하되 다음 명시 형태는 broad에서 제외했다:
  - sandal / flip-flop / slide
  - loafer / derby
  - pump / heel
  - Reebok collaboration
  - painted / paint-drop sneaker
  - German Army / Replica Trainer Tabi
  - canvas / Converse-style Tabi sneaker
  - mule / espadrille / slipper
- 신규 Tabi lanes:
  - `shoe-margiela-tabi-sandal`
  - `shoe-margiela-tabi-loafer`
  - `shoe-margiela-tabi-pump`
  - `shoe-margiela-tabi-reebok`
  - `shoe-margiela-tabi-painted-sneaker`
  - `shoe-margiela-tabi-german-army`
- 기존 slipper lane은 `mule/mules`를 포함하고, `에스파드류 + 스니커즈` 검색어 혼재 매물도 slipper로 우선 분리한다.
- `ruleMatch`가 제목만으로 SKU를 잡을 때도 `(구매 43)` / `구매합니다` 같은 역매입 문구는 matching 전에 차단한다.
- 신발 사이즈 파서는 `EU/US/UK/cm` 같은 명시 체계를 bare 3자리 숫자보다 우선하되, `255mm`처럼 직접 mm가 있으면 mm를 최우선으로 본다. 이유: 설명 가격 `2,221,377원`의 `221`을 사이즈로 오인한 사례가 있었다.

## DB Writes
- 1차 sync: scoped 183 rows, parsed upsert 172, parsed delete 5, raw patch 24, pool delete 24.
- 2차 sync: `shoe-margiela-tabi -> shoe-margiela-tabi-german-army` 1건 추가.
- 3차 sync: scoped 181 rows, parsed upsert 173, raw patch 5, pool delete 5.
- Verified examples:
  - `408627145` → `shoe-margiela-tabi-sandal`, `shoe|tabi_sandal|sandal|275|unknown_condition`
  - `367494191` → `shoe-margiela-tabi-loafer`, `shoe|tabi_loafer|loafer|260|b_grade`
  - `261631460` → `shoe-margiela-tabi-pump`, `shoe|tabi_pump|pump|235|b_grade`
  - `350842541` → `shoe-margiela-tabi-reebok`, `shoe|tabi_reebok|sneaker|285|b_grade`
  - `285268072` → `shoe-margiela-tabi-painted-sneaker`, `shoe|tabi_painted_sneaker|sneaker|265|c_grade`
  - `387956716` → `shoe-margiela-tabi-german-army`, `shoe|tabi_german_army|sneaker|unknown_size|unknown_condition`
  - `283474495` → `shoe-margiela-tabi-slipper`, `shoe|tabi_slipper|slipper|275|b_grade`
  - `334881121` buy request → raw SKU null, parsed deleted

## Deferred
- Remaining `shoe-margiela-tabi` broad rows are intentionally left conservative:
  - `마르지엘라 타비 하이 블랙 41`
  - `마르지엘라 타비36사이즈`
  - `Maison Margiela tabi shoes`
  - `(새상품) 메종마르지엘라 타비 다크그린 카키 42사이즈 (270mm)`
  - `마르지엘라 타비 36반 여성용`
  - `크림 새상품 풀박스) 메종 마르지엘라 타비 팜`
  - `메종 마르지엘라 타비 러버 구두 41`
- These need either image confirmation or a more explicit model signal before being promoted to ready lanes.
- Size-dependent liquidity/rotation grouping remains a later wave; current work only prevents wrong product-shape comparables from mixing.

## Verification
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
