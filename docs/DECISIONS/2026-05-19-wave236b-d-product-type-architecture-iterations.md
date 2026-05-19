# Wave 236b~d (2026-05-19) — product-type architecture 4번 정정 (정직 로그)

## 발단

사용자 운영자풀 코멘트 25+ 건 (오늘 박힘) → Wave 236 (parser product-type 추출) 박은 후 **자율 심층 검증** 요구:

> "이제 이런 분류도 못하는 상황없을거 확실해?? 방금 내 코멘트만 해결하지말고 너가 직접 db매물 대량 조회해서 sample비교군 제대로되는지 파싱더 강화해야되는지 심층 다이브하고 검토 해야될거같지않아?? 자신 있어?"

자신 없음 인정 → in-memory simulate (`scripts/wave236-validate-product-type.ts`) 5000+ 매물:
- **clothing 17% type_unknown** (511/3000)
- **bag 22% type_unknown** (279/1281)
- **shoe 58% type_unknown** (1724/3000) — but shoe catalog 가 이미 model-level narrow → 영향 적음

누락 패턴 (clothing/bag):
- clothing: 반팔(단독)/남방/빈파포/눕시/터틀넥/탱크탑/트랙탑/윈드브레이커
- bag: 핸드백/호보백/버킷백/카메라백/슬링/탑핸들/포쉐트

## Architecture 4번 정정 (정직)

### Wave 236b — regex 보완 + `defaultProductType` fallback 도입

`Sku.defaultProductType` 필드 추가 + parser fallback (regex 실패 시 catalog default 사용).
clothing/bag regex 패턴 30+ 보완. 14 SKU 에 defaultProductType 박음.

→ **사용자 지적**: "모자인지 티셔츠인지 뭔지 단순 모델명?? 다른 힌트로 알수없으면 그냥 pool에 안들어와야되는거아님??"
→ fallback 이 너무 관대 — "노스페이스 빅샷 블랙" 같은 model 만 있는 매물도 통과시킴.

### Wave 236c — fallback 완전 제거 (너무 엄격)

`defaultProductType` 필드 + fallback 모두 제거. type_unknown 시 무조건 `needsReview=true` → pool 차단.

→ **사용자 정정**: "아니 노스페이스 빅샷 블랙 이런것만 보고 티셔츠인지 추정이 확실히 되면 그 이름이 티셔츠밖에 없는 이름이면 당연히 넣어야되는데 그런게 아닌 매물들은 탈락시켜야지"
→ 너무 극단 — Borealis/Nuptse 같은 model = product-type 1개 확정 SKU 도 차단됨.

### Wave 236d — Goldilocks policy (최종)

**catalog SKU 의 model 자체가 product-type 1개 확정인 경우만 defaultProductType 박힘** + parser fallback 복원.

| Catalog 상태 | text 추출 | 동작 |
|---|---|---|
| defaultProductType 미박힘 (broad SKU) | 성공 | text 값 사용 ✓ |
| defaultProductType 미박힘 (broad SKU) | 실패 | **needsReview=true → pool 차단** ✓ |
| defaultProductType 박힘 (narrow model) | 성공 | text 값 사용 (text 우선) ✓ |
| defaultProductType 박힘 (narrow model) | 실패 | catalog 값 fallback ✓ (모델명 자체로 확정) |

iPad 비유와 정확히 일치:
- `iphone-15-pro-128` narrow SKU 매칭 = 옵션 확정 → 통과
- `iphone` broad + 세대 미상 = 차단

## 박은 SKU 34개 (narrow model = product-type 확정)

**clothing (15):**
- Polo Pique Classic / Polo Pony Tee / Polo Oxford Shirt → polo_shirt / tee / shirt
- TNF Nuptse 1996 → down_jacket
- TNF Mountain Jacket → jacket
- TNF Denali Fleece → jacket
- Arcteryx Beta / Gamma / Alpha / Atom / Vertex-Squamish → jacket (각 라인 = 자켓)
- Patagonia Retro X → jacket / Patagonia Down → down_jacket
- Stussy Basic Tee → tee
- BAPE Shark Hoodie → hoodie
- Acne Tee → tee / Acne Denim → jeans / Acne Shirt → shirt

**bag (19):**
- TNF Borealis / Hot Shot / Big Shot → backpack (TNF 백팩 모델명)
- Supreme Backpack / Supreme Shoulder → backpack / shoulder (mustContain 강제)
- Coach Tabby → shoulder / Coach Signature → tote / Coach Wallet → wallet
- Longchamp Le Pliage → tote
- Prada Galleria → tote / Prada Nylon Hobo → shoulder / Prada Saffiano Wallet → wallet
- Celine Trio → crossbody / Celine Macadam → shoulder
- Bottega Cassette Mini → crossbody
- MCM Visetos Stark → backpack (mustContain 강제)

## skip 사유 (broad SKU 의도적으로 안 박음)

- **Polo RRL** / **RRL Denim** / **RRL Accessory** — model = multi (jacket/jeans/tee/pants/belt/wallet)
- **TNF Supreme collab** / **TNF Purple Label** — 시즌별 multi product-type
- **FOG Essentials** — broad (hoodie/tee/pants/sweat 다 매물)
- **Stussy Hoodie** / **Acne Sweat** / **Acne Jacket-Coat** — multi (hoodie+crewneck, jacket+coat)
- **clothing-arcteryx (broad)** — broad catch-all
- **clothing-patagonia (broad)** — broad catch-all
- **clothing-polo-bear-collab** — multi (polo_shirt/knit/tee/hoodie)
- **clothing-bape-tee** — multi (tee + hoodie)
- **bag-coach-broad** — broad
- **bag-lv-monogram-pochette-accessoires / speedy / alma** 등 — LV pouch/tote 명확 X (model variant)

이런 broad SKU 매물은 **text 에 product-type 키워드 명시 없으면 pool 차단** = 사용자 의도.

## 파일 변경

- `src/lib/catalog.ts` — `Sku.defaultProductType?: string` 필드 + 25 SKU 박힘
- `src/lib/generated/catalog-bag-wave91.ts` — 9 SKU 박힘
- `src/lib/option-parser.ts` — `ParseInput.defaultProductType` 필드
- `src/lib/parsers/wave92-fashion-mobility.ts` — fallback 룰 + regex 보완 + parser version v4→v5→v6→v7
- `src/lib/tick-pipeline.ts` — `LATEST_PARSER_VERSION_BY_CATEGORY` v7 + caller 가 `sku.defaultProductType` 전달
- `scripts/wave236-validate-product-type.ts` — in-memory simulate + catalog fallback 시뮬레이션

## parser version 추적

```
v3 → v4 (Wave 236, product-type 추출 도입)
v4 → v5 (Wave 236b, regex 보완 + 첫 fallback)
v5 → v6 (Wave 236c, fallback 제거 — 너무 엄격)
v6 → v7 (Wave 236d, narrow model fallback 복원 — 최종)
```

## 효과

다음 cron tick (60min) 부터 fashion 매물 자동 re-parse (parser_version drift). 결과:
- text product-type 명시 매물 → 정확한 product-type 박힘 (comparable_key 분리)
- text 미명시 + narrow model SKU (34개) → catalog default fallback (안전 통과)
- text 미명시 + broad SKU → **pool 차단** (사용자 의도 — 애매한 매물 안 보임)

**예상**:
- 시세 daily product-type 별 분리 → 사용자 reveal 비교 매물 같은 product-type 만 나옴
- broad SKU 의 애매한 매물 pool 위축 (영향 측정 cron 후)

## 미해결 (next wave)

- Wave 237: condition 분류 — AI classifier 활용 + UI description preview (사용자 코멘트 4건)
- broad SKU narrow split — Stussy Hoodie split (hoodie / crewneck / 8 ball / 한정판 등)
- TNF Supreme collab split — 시즌별 한정 narrow
- 다른 카테고리 sample 검증 (시계/카메라/드론) — 사용자 코멘트 안 본 영역
