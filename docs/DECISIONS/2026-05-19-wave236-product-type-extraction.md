# Wave 236 (2026-05-19) — product-type 추출 근본 fix + Global noise 확장

## 사용자 발단

운영자풀 코멘트 25+ 건 (오늘) — 사용자 분노:
> "아니 근본적으로 문제가 많은데?? 단순 클루지처럼 땜질하는게아니라 뭐떄문에 이런 오류들이 계속 발생하는지 근본적으로 해결해야됨"

> "단순히 이거만 고치는게 아니라 근본적으로 어떤 오류 때문에 이렇게 됐는지 궁금함"

## 코멘트 패턴 카테고리화 (확장 사고)

| 패턴 | 건수 | 사례 |
|---|---|---|
| product-type 미분리 (clothing) | 12 | "후드티랑 맨투맨 다른거 아닌가" / Stussy/RRL/Patagonia/Polo Pique/Acne/Arcteryx/Matin Kim |
| product-type 미분리 (bag) | 3 | "백팩이랑 숄더백이랑 다른거 아닌가" / TNF Supreme / Bottega Cassette |
| non-target brand 매칭 | 1 | Polo Pique 에 바나나리퍼블릭/타미/유니클로/나이키 골프 등 |
| condition 분류 오류 | 4 | AirPods/Apple Watch/DJI Pocket 리퍼/DJI Action 렌즈 |
| 역경매(구함) 통과 | 1 | "갤탭 s9 fe 플러스 구함" |

## 시스템 architecture 결함 진단 (5개 근본 원인)

### 결함 1: catalog model granularity 가 brand+모델 level → product-type 무시
의류/가방 brand 의 한 모델 라인 안에 후드/맨투맨/티/자켓/바지 다 묶임. **catalog 가 product-type tier 를 가짐 X**. 결과:
- `clothing-stussy-hoodie` SKU 에 후드/맨투맨/8볼/마틴로즈/워크샵/크롭 자켓 다 매칭
- `bag-tnf-supreme-backpack` SKU 에 백팩+숄더+토트+익스페디션 다 매칭

### 결함 2: parser 가 product-type tag 안 박음 → comparable_key 도 무시
기존 `comparable_key`: `{sku_id}|{condition_class}|{tier}` — product-type 없음. market_price_daily 가 sku+condition 으로만 묶이니 product-type 다른 매물 한 시세.

### 결함 3: ruleMatch 가 product-type 강제 X
mustContain 에 brand만 박힘 → 같은 brand 다른 product-type 다 매칭. Wave 235 까지 mustNotContain 매번 박는 게 땜질 패턴.

### 결함 4: Global noise scope 가 fashion 만 적용
GLOBAL_FASHION_NOISE 의 "구매 원함/구함" 패턴이 fashion 카테고리만 적용 → smartphone/tablet 등 누락 ("갤탭 s9 fe 플러스 구함" 통과).

### 결함 5: condition 분류 — bunjang_label 신뢰 too much
description text override 룰 약함. "본체 안 닫히고 떨어트림 많음" 매물이 bunjang label "사용감 적음" → 사용감 분류. 룰 매번 추가 (Wave 206) 가 땜질.

## fix (이번 wave)

### 1. parser product-type 추출 (가장 큰 근본 fix)

`src/lib/parsers/wave92-fashion-mobility.ts` — clothing/bag/shoe 별 helper 신규:

```ts
type ClothingProductType =
  | "hoodie" | "crewneck" | "tee" | "shirt" | "polo_shirt"
  | "jacket" | "coat" | "down_jacket" | "pants" | "jeans"
  | "shorts" | "skirt" | "dress" | "cap" | "belt" | "wallet"
  | "cardigan" | "vest" | "knit" | "type_unknown";

type BagProductType =
  | "backpack" | "shoulder" | "tote" | "crossbody" | "waist"
  | "clutch" | "messenger" | "duffle" | "wallet" | "pouch"
  | "card_holder" | "type_unknown";

type ShoeProductType =
  | "sneaker" | "boot" | "sandal" | "loafer" | "slipper" | "type_unknown";
```

dispatcher 각 분기 (shoe/bag/clothing) 에서:
```ts
const productType = parseXxxProductType(text);
parsedJson.xxx_product_type = productType;
partsForKey.push(productType);  // comparable_key 자동 분리
if (productType !== "type_unknown") parseConfidence += 0.05~0.10;
```

`partsForKey` 가 comparable_key 의 부품 → product-type push 만으로 자동 시세 daily 분리.

### 2. parser_version v3 → v4 (자동 reparse trigger)

- `PARSER_VERSION_W92` → `wave92-fashion-mobility-v4`
- `PARSER_VERSION_W216_CLOTHING` → `wave216-clothing-v4`
- `LATEST_PARSER_VERSION_BY_CATEGORY` 동기 → tick-pipeline `ensureParsedRows` 가 자동 stale 인식 → 다음 cron 부터 모든 fashion 매물 자동 re-parse.

### 3. Global noise 모든 카테고리 적용

`src/lib/catalog.ts` `skuMatches` 안에 `UNIVERSAL_BUY_REQUEST_NOISE` 추가 — 모든 카테고리 (smartphone/tablet/laptop/etc) 적용. fashion-only 였던 게 system-wide.

```ts
const UNIVERSAL_BUY_REQUEST_NOISE = [
  "구함\\b", "구해요", "구합니다", "구해봅니다",
  "구매 원함", "구매원함", "(구매)", "구매희망",
  "사고 싶어요", "삽니다", "살게요", "매입", ...
];
```

### 4. Polo Pique brand 강제 (결함 3 즉시 fix 사례)

mustContain 에 brand 그룹 강제 추가 (랄프/ralph/pony/rl) + mustNotContain 에 비폴로 brand 명시:
- 바나나리퍼블릭/타미/유니클로/나이키 골프/아디다스 골프/스쿼드라
- DKNY/무스너클/라코스테/헤지스/빌보콰/폴스미스
- 세터/렉토/캐피탈/마뗑킴/마크 제이콥스/베이프/스투시

## 효과 예측

| 사용자 코멘트 | 이전 | Wave 236 후 |
|---|---|---|
| Stussy hoodie 매물 비교군에 맨투맨/티 섞임 | 후드/맨투맨/티/자켓 한 sku 시세 | product-type 별 분리 — 후드 매물은 후드만 시세 |
| RRL 자켓 비교군에 청바지/티 섞임 | broad 매칭 | jacket / jeans / tee 별 시세 |
| TNF Supreme 백팩 비교군에 숄더 | 한 SKU 시세 | backpack / shoulder 분리 |
| 갤탭 구함 매물 pool | 통과 | Global noise 차단 |
| 바나나리퍼블릭 피케 폴로 매칭 | clothing-polo-pique-classic | mustNotContain 차단 |

## 미해결 (다음 wave 237 후보)

- 결함 5 condition 재분류 — AI classifier 활성화 + description preview UI 표시 (땜질 키워드 추가 X)
- 결함 1 의 더 근본 fix — `Sku.productTypes: string[]` 필드 추가해서 catalog level 강제 (현재는 parser 만 의존)
- TNF Supreme / Stussy hoodie 같은 broad SKU 의 narrow split (product-type 별 별도 SKU)

## 파일

- `src/lib/parsers/wave92-fashion-mobility.ts` — product-type helper 3개 + dispatcher 박기 + version v4
- `src/lib/tick-pipeline.ts` — `LATEST_PARSER_VERSION_BY_CATEGORY` v4
- `src/lib/catalog.ts` — `UNIVERSAL_BUY_REQUEST_NOISE` + `skuMatches` 적용 + Polo Pique brand 강제

## next

- 다음 cron tick (60min) 부터 fashion 매물 자동 re-parse (parser_version drift)
- market_price_daily 자동 product-type 별 분리 (재계산)
- 24h 후 사용자 reveal 비교군 mismatch 측정 (코멘트 패턴 정량 검증)
- 결함 5 별도 wave 237 (condition AI classifier 활용)
