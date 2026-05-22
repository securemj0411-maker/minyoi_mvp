# Wave 652 — TNF Nuptse broad + Adidas Trefoil outlier 차단 (clothing v24→v25)

## TNF Nuptse broad c_grade (spread 10x, 25건)

| pid | name | price |
|-----|------|-------|
| 315273167 | 노스페이스 눕시 /105선착순 폭탄세일 판매합니다 화이트라벨 | 399,999 |
| 387436331 | 노스페이스 노벨티 눕시 아이스그레이 s NJ1DP85L | 265,000 |
| 387523078 | 노스페이스 화이트라벨 노벨티 눕시 아이스그레이 S | 265,000 |
| 383925624 | [XXL] 노스페이스 화이트 라벨 노벨티 눕시 다운 자켓 아보카도 | 250,000 |
| 369973441 | 노스페이스 700필 눕시 카모 | 220,000 |
| 384661065 | 노스페이스 눕시 1992 화이트 xl | 180,000 |

Wave 633에서 "화이트라벨"/"노벨티 눕시" 차단했는데도 c_grade에 매물 흘러들어옴. 매물 parsed_at가 catalog 강화 시점 이후라 stale 매물 가능성. **parser bump (v24→v25)로 stale 강제 reparse**.

추가 차단어:
- `화이트레이블` / `whitelabel` / `wl 눕시` (변형)
- `노벨티 다운` / `노벨티 자켓` / `노벨티 아이스그레이` / `노벨티 아보카도` (variant)
- `1992 눕시` / `1992 화이트` (Wave 248은 1996 SKU만 차단, broad에 흘러옴)
- `700필 카모` / `800필 카모` / `카모 다운` / `카모 패딩`
- `에글론` / `aglon` (Eglon EX 별도 라인)

## Adidas Trefoil jacket b_grade (spread 13.3x, 20건)

| pid | name | price |
|-----|------|-------|
| 407184117 | 아디다스 포우 레더 아디컬러 3S 루즈 파이어버드 트랙수트 자켓 블랙 | 200,000 |
| 401328432 | [세트]아디다스 파이어버드 트랙수트 옐로우 | 97,500 |
| 354567750 | 아디다스 Adidas 트랙수트 상하의 세트 90 | 55,000 |

레더 자켓 + 트랙수트 상하의 세트 outlier.

추가 차단어:
- `포우 레더` / `레더 트랙` / `가죽 자켓` / `leather jacket` (가죽 라인 별도)
- `상하의 세트` / `[세트]` / `셋업` / `set up` / `트랙수트 세트` / `tracksuit set` (세트 매물은 자켓 단품 시세와 다름)

## 조치

1. **catalog**: `clothing-tnf-nuptse-broad` (catalog-wave266-clothing.ts) + `clothing-adidas-trefoil` (catalog.ts).
2. **parser**: `wave216-clothing-v24` → `v25`.
3. **tick-pipeline**: `LATEST_PARSER_VERSION_BY_CATEGORY.clothing` → `v25` (dup 줄 제거 + comment 추가).
4. **invalidate**: 2 comparable_keys priority 95~100.

## Why

Wave 633 보강 이후 c_grade에 동일 패턴 매물 발견 = catalog 강화 시점과 매물 parsed_at 간 race. parser bump로 강제 reparse.

## How to apply

`mustNotContain` 추가만으로 충분치 않을 때 = parser version bump + LATEST 동기화. 매물 parsed_at가 catalog 강화 직전이면 ruleMatch 통과한 stale row 됨.
