# Wave 236e~f (2026-05-19) — shoe sneaker default + ParseInput 통합 + audit fix

## 발단

Wave 236d 결과 측정 (`scripts/wave236-validate-product-type.ts`):
- clothing 차단 6.5% / bag 8.9% (적정 — 사용자 의도 그대로)
- **shoe 차단 57.7%** 🚨

shoe catalog 가 model-level narrow (Vans Old Skool / Nike Pegasus 등) → SKU 매칭 자체로 product-type 추론 가능. 단 매물 text 에 "스니커즈/운동화" 키워드 없어서 차단됨.

사용자 외부 audit (4개 위험/미완):
1. validate measurement 미확정
2. ParseInput drift (option-parser ↔ wave92-fashion-mobility 별도 정의)
3. broad SKU 추가 검토 미완 (Polo Pony Tee 카라티 혼동 등)
4. production impact 미측정

## fix (Wave 236e + 236f)

### 1. shoe parser: SKU 매칭 = sneaker default (Wave 236e)

`src/lib/parsers/wave92-fashion-mobility.ts` — shoe 분기:
```ts
let typeFromShoeDefault = false;
if (productType === "type_unknown" && input.defaultProductType) {
  productType = input.defaultProductType;
  typeFromCatalog = true;
} else if (productType === "type_unknown" && input.skuId) {
  // shoe + SKU 매칭 자체 = product-type 추론 가능 → "sneaker" default.
  productType = "sneaker";
  typeFromShoeDefault = true;
}
```

근거: shoe catalog 200+ SKU 99% 가 model-level narrow (sneaker). SKU 매칭 자체가 product-type 확정. boot/sandal/loafer/slipper SKU 만 catalog 명시 박힘 (15개).

### 2. 비-sneaker shoe SKU defaultProductType 명시 (15개)

- **boot (6)**: TNF Hiking Boots / Margiela Tabi Boot / Acne Bertin Boots / Supreme Timberland / Supreme Dr.Martens / Dr.Martens 1460-black/1460-cherry/2976-chelsea
- **sandal (3)**: Birkenstock Arizona / Zürich / Milano
- **slipper (8)**: Birkenstock Boston / Crocs Classic/Bayaband/Crush/Platform/Eco / Adidas Adilette / TNF Nuptse Mule / Supreme TNF Slipper / Margiela Tabi Slipper
- **loafer (1)**: Polo Leather Loafer

### 3. ParseInput drift fix (Wave 236f)

`src/lib/option-parser.ts` 가 source of truth. parser 가 import:
```ts
// option-parser.ts
export type ParseInput = { ... };

// wave92-fashion-mobility.ts
import type { ParseInput } from "@/lib/option-parser";
```

이전: 두 파일에 별도 ParseInput 정의 → silent drift risk.

### 4. Polo Pony Tee mustNotContain 강화 (Wave 236f)

audit 발견: "폴로 빅포니 반팔 카라티" 같은 polo_shirt 매물이 Polo Pony Tee SKU (라운드넥) 매칭 가능. fix:
```ts
mustNotContain: [..., "카라티", "카라 티", "카라넥", "collar tee", "단추", "카라 셔츠"]
```

### 5. BAPE Shark Hoodie defaultProductType 제거 (Wave 236f)

audit 발견: BAPE Shark 패턴이 hoodie/pants/tee/조거 multi-line 출시. defaultProductType "hoodie" 박힘이 잘못 (text 미명시 매물 = 잘못된 hoodie 분류). 제거 → text 미명시 매물 차단 (사용자 정책).

### 6. validate script commit + shoe default simulate

`scripts/wave236-validate-product-type.ts` untracked → commit. shoe sneaker default 룰 추가 (parser 정확 simulate).

## Wave 236e~f 측정 결과 (validate v6)

| 카테고리 | text 추출 | catalog default | shoe sneaker default | pool 차단 |
|---|---|---|---|---|
| clothing | 89.5% | 3.8% | - | **6.7%** |
| bag | 85.9% | 5.2% | - | **8.9%** |
| shoe | 42.1% | 3.7% | 54.2% | **0%** |

사용자 의도 정확:
- shoe: SKU 매칭 = product-type 확정 → 100% 통과 (boot/sandal/loafer/slipper 명시, 나머지 sneaker)
- clothing/bag: text 추출 + catalog narrow model fallback → 89~91% 통과. 그 외 6~9% **pool 차단** (애매한 매물)

## broad SKU 검토 (defaultProductType 박지 않음 — 정책 그대로)

multi-product-type 모델 (text 미명시 시 차단 의도):
- `clothing-polo-rrl` (jacket/jeans/tee/pants)
- `clothing-polo-bear-collab` (polo_shirt/knit/tee/hoodie)
- `clothing-tnf-supreme-collab` (multi-시즌)
- `clothing-tnf-purple-label` (multi)
- `clothing-stussy-nike-collab` (sweat/hoodie/track/windrunner)
- `clothing-stussy-dior-collab` (multi)
- `clothing-bape-tee` (tee+hoodie)
- `clothing-fog-essentials` (hoodie/tee/pants/sweat)
- `clothing-stussy-hoodie` (hoodie+crewneck)
- `clothing-acne-sweat` / `acne-jacket-coat` (multi)

## parser version 추적

```
v3 → v4 (Wave 236, product-type 추출 도입)
v4 → v5 (Wave 236b, regex 보완 + 첫 fallback)
v5 → v6 (Wave 236c, fallback 제거 — 너무 엄격)
v6 → v7 (Wave 236d, narrow model fallback — Goldilocks)
v7 (Wave 236e+f, shoe SKU sneaker default + audit fix)
```

## 파일 변경

- `src/lib/parsers/wave92-fashion-mobility.ts` — shoe sneaker default + ParseInput import
- `src/lib/option-parser.ts` — ParseInput export
- `src/lib/catalog.ts` — Polo Pony Tee mustNotContain 강화 + BAPE Shark default 제거 + 비-sneaker shoe SKU (15) defaultProductType
- `src/lib/generated/catalog-shoe-narrow-wave134.ts` — Dr.Martens 3 SKU defaultProductType: boot
- `scripts/wave236-validate-product-type.ts` — commit + shoe default simulate

## 미완 (다음 wave)

- production sweep — cron 후 (60min) 실제 raw_listings 의 needsReview 비율 측정 (현재 simulate)
- BAPE Shark 매물 sample 검증 — defaultProductType 제거 후 매물 차단 비율 확인
- Wave 237 — condition AI classifier + UI description preview (사용자 코멘트 4건)
