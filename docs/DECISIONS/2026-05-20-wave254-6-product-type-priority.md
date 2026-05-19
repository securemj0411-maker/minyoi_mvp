# Wave 254.6 (2026-05-20) — parseClothingProductType regex 우선순위 정정 (systemic root)

## 발단

사용자 직접 SQL 검증 발견 — pid 331382713 "빔즈 노스페이스 눕시 쇼츠 M":
- description: "제품 : 빔즈 노스페이스 Nuptse Short"
- 기존: `comparable_key: clothing|tnf_nuptse_1996|down_jacket|a_grade` ← 잘못
- root cause: `parseClothingProductType` 의 down_jacket 패턴 (눕시/nuptse) 이 shorts 보다 먼저 매칭 → 모델명이 product_type 키워드보다 우선순위 높음.

systemic 영향 사례 (production sample):
- `clothing-tnf-nuptse-1996` + 쇼츠
- `clothing-tnf-purple-label` + 쇼츠
- `clothing-tnf-supreme-collab` + 모자
- `clothing-polo-rrl-denim` + 쇼츠

## 1차 fix — parseClothingProductType regex 순서 정정

**기존 우선순위** (line 335-368):
```
1. down_jacket (눕시/nuptse/푸퍼...)
2. coat
3. cardigan/knit/vest/jacket/hoodie/crewneck/tee/polo_shirt/shirt
4. jeans/pants
5. shorts/dress/skirt/cap/belt/wallet  ← 모델명 패턴 매칭 후
```

**Wave 254.6 우선순위**:
```
PRIORITY 1: 명시적 product_type 키워드 (모델명 충돌 risk):
  - shorts (반바지/쇼츠/shorts/버뮤다)
  - dress (원피스/drss)
  - skirt
  - cap (볼캡/모자/비니/...)
  - belt
  - wallet (지갑/wallet/...)
  - jeans (청바지/jean/데님 팬츠/...)
  - pants (팬츠/pants/...)

PRIORITY 2: 모델명 기반 / 일반 product_type:
  - down_jacket (눕시/nuptse/푸퍼/...)
  - coat / cardigan / knit / vest / jacket / hoodie / crewneck / tee / polo_shirt / shirt
```

효과:
- "눕시 쇼츠" → **shorts** (기존: down_jacket)
- "마운틴 자켓 모자" → **cap** (기존: jacket)
- "RRL 데님 쇼츠" → **shorts** (기존: jeans → 또는 down_jacket?)
- "구찌 다운 베스트 지갑" → **wallet** (단품 지갑 매물 정확)

**부수 bug fix**:
- `모자\b` regex bug — JavaScript `\b` 가 Korean 한글 매칭 안 됨 ("모자" 단독 fail).
  fix: bare `모자` + `(?!이크|보호)` negative lookahead (false positive 차단).
- `폴로(?!\s*rrl|랄프)` lookahead group bug — alternation 우선순위 잘못.
  fix: `폴로(?!\s*(?:rrl|랄프|옥스포드|oxford|셔츠))` — 명시적 그룹화 + 옥스포드 셔츠 false positive 차단.

## 2차 fix — parseBagProductType backpack 모델명 false positive 차단

기존 backpack 패턴: `보레알리스|borealis(?!\s*sling)` — Borealis 단독 매칭 (키링/스트랩 등 false positive).

Wave 254.6 fix: PRIORITY 1 에 키링/스트랩/참 단독 매물 → `type_unknown` (backpack 매칭 차단).

효과:
- "Borealis 키링" → **type_unknown** (기존: backpack 잘못)
- "Borealis 백팩" → backpack (regression OK)

## 3차 fix — catalog intersect-aware safety net

`src/lib/catalog.ts` `skuMatches` 에 추가:
```ts
const CLOTHING_JACKET_PRODUCT_TYPE_MISMATCH_NOISE: string[] = [
  "쇼츠", "반바지", "shorts", "버뮤다", "bermuda", "쇼츠 m", "쇼츠 l", "쇼츠 s",
  "모자", "비니", "beanie", "볼캡", "ball cap", "야구모자", "버킷햇", "bucket hat",
  "벙거지", "스냅백", "snapback", "메쉬캡", "트러커캡", "trucker cap",
  "벨트", "belt",
  "지갑", "wallet", "월렛", "장지갑", "카드지갑", "반지갑",
  "스커트", "skirt", "원피스", "드레스",
];

// SKU defaultProductType in [jacket, down_jacket, coat] → 위 키워드 매물 reject (intersect-aware skip).
```

policy:
- SKU 의 `defaultProductType` 이 jacket/down_jacket/coat 인데 매물 text 에 명백 product_type 키워드 매치 시 reject
- `mustContain` 토큰에 있으면 skip (예: Polo RRL belt SKU 자체가 "벨트" 매칭 통과)

효과: 17 jacket SKU 일괄 보강 (per-SKU mustNotContain 17번 박는 대신 1번 박음 — **1타 N피**).
- clothing-tnf-mountain-jacket / denali-fleece / supreme-mountain-* / supreme-baltoro / supreme-denali-fleece / supreme-expedition
- clothing-arcteryx-beta/gamma/alpha/atom/vertex-squamish
- clothing-patagonia-retro-x/down/deep-pile

## tests

신규 `tests/wave254-6-product-type-priority.test.ts` — **23 tests pass**:
- user-reported root case (pid 331382713)
- systemic mismatch (9 cases — 눕시 쇼츠 / 마운틴 자켓 모자 / 데날리 모자 / Supreme 모자 / RRL 데님 쇼츠 / 폴로 벨트 / 구찌 지갑 / 스커트 / 원피스)
- 정상 매물 regression (7 cases — 눕시 단독 / 마운틴 자켓 단독 / 데날리 / 옥스포드 셔츠 / 후드 / 티셔츠 / 청바지)
- catalog 2차 safety (4 tests — nuptse-1996 reject / mountain-jacket reject / arcteryx-beta reject / 정상 nuptse 매물 매칭)
- bag backpack false positive (2 tests — Borealis 키링 / 백팩 regression)

`test:core`: **663 pass / 11 fail** (pre-existing /me UI baseline 동일, **0 regression**).

## 자율 진행 정책 준수

✅ **regex 순서 변경** — additive (신호 추가 X, 순서만)
✅ **catalog mustNotContain 보강** — additive (intersect-aware)
✅ **test fixture 추가** — systemic 검증
❌ **destructive UPDATE 안 함** — score_dirty 직접 트리거 안 함
❌ **DB DELETE / DROP 안 함**

## PARSER_VERSION 정책

- 사용자 결정: "v8 이 deploy 안 됐으면 그대로 + 코드 수정"
- 측정 결과: v8 records = 0건 (Wave 254.5 step 1+2+3 deploy 대기 중)
- → PARSER_VERSION bump 없음 (v8 유지). Wave 254.5 + 254.6 합쳐서 한 번에 deploy.

## 미완 후속

1. Vercel deploy 완료 확인 + v8 첫 record 발현 측정 (5-10분 후)
2. 사용자 매물 pid 331382713 재검증 (재parse 후 comparable_key 확인):
   - 기대: `clothing|unknown_model|shorts` 또는 broad clothing SKU
   - tnf_nuptse_1996 narrow 매칭 X
3. 다른 jacket SKU 영향 매물 sample 측정
4. Wave 252.B 식 manual rematch trigger 결정 (사용자 승인 필요):
   - clothing v3/v7 / shoe v3/v7/v2/v4 / bag v3/v7 매물 17,623건 score_dirty=true 강제
   - 한 번에 자연 reparse 발현
