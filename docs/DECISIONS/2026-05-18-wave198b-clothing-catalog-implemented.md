# Wave 198b — 의류 카테고리 + Tier 1 catalog 19 SKU 실제 박음 (2026-05-18)

## 사용자 결정 (자율 진행)

> "너가 다 검토하면서 진행해"

Wave 197 사전 sweep + Wave 198 audit 결과 기반 자율 박음.

## 변경 (7 files / 284 insertions)

### 1. Sku type 확장
`src/lib/catalog.ts:23` — `Sku["category"]` 에 `"clothing"` 추가.

### 2. catalog.ts SKU 19개

**Polo Ralph Lauren** (5):
- `clothing-polo-pique-classic` (broad — 피케 폴로셔츠)
- `clothing-polo-pony-tee` (broad — 포니 로고 반팔)
- `clothing-polo-oxford-shirt` (broad — 옥스포드, RRL 제외)
- `clothing-polo-bear-collab` (narrow — 한정판)
- `clothing-polo-rrl` (narrow — premium 라인 별도, msrp 59만)

**The North Face** (8):
- `clothing-tnf-nuptse-1996` (시그니처 다운)
- `clothing-tnf-mountain-jacket` (Gore-Tex)
- `clothing-tnf-denali-fleece` (시그니처 플리스)
- `clothing-tnf-purple-label` (일본 Nanamica)
- `clothing-tnf-supreme-collab` (한정판 collab)
- `bag-tnf-borealis` (대학생 시그니처)
- `bag-tnf-hotshot` (인기 백팩)
- `bag-tnf-bigshot` (대용량)
- `shoe-tnf-nuptse-mule` (슬리퍼)

**Stüssy** (6):
- `clothing-stussy-nike-collab` ⭐ (109건 압도적 매물량)
- `clothing-stussy-basic-tee` (8 Ball / World Tour / Stock)
- `clothing-stussy-hoodie` (Crewneck 포함)
- `bag-stussy-waist-bag` (시그니처 가방)
- `clothing-stussy-dior-collab` (FW21 한정판)

### 3. category-readiness
- `clothing` 카테고리 `internal_only` 등록 (label "Clothing", floor 0.30 명시)
- LANE_READINESS 19개 lane 모두 `ready` 등록

### 4. 시세 가품 floor (upsertMarketPriceDaily)
```ts
const FAKE_FLOOR_CATEGORIES_MARKET = new Set<string>(["shoe", "bag", "clothing"]);
const FAKE_FLOOR_RATIO_MARKET = (category: string) => category === "clothing" ? 0.30 : 0.25;
```
- shoe/bag: 0.25 (Wave 196)
- **clothing: 0.30** (의류 가품 시장 더 큼)

### 5. AD_PATTERNS 의류 6종 (candidate-pool-builder + market)
- `S급 미러/레플리카` — replica grade 표기
- `rep / replica / 미러급`
- `복각 / 이미테이션 / imitation`
- `고퀄리티 복각`
- `오프 화이트 공구` (가품 셀러)
- `택 그대로 보관` (광고 짧은 desc)

### 6. queryFamily 의류 brand 매핑
- 폴로 / Ralph Lauren / RRL / 더블 알엘
- 노스페이스 / North Face / TNF / 눕시 / Denali / Mountain Jacket / 퍼플라벨 / Nanamica
- Stussy / 스투시 / 8 ball / world tour
→ `clothing` 분류
- Borealis / Hot Shot / Big Shot → `bag` 분류

### 7. DEFAULT_SEARCH_QUERIES 의류 query 21개
Polo 5 + TNF 9 + Stüssy 7 = 21 query.

## 검증

### typecheck
- clean (catalog/readiness/tick-pipeline/candidate-pool-builder 직접 영향 0)
- pre-existing wave141/145 fixture error 무관

### test:core
**478/478 pass** (이전 451 + Wave 196 효과로 wave159h 같이 통과 + 19 SKU 신규 fixture 자동 통과)

### commit
- `c062069` Wave 198 코드

## production 검증 (14d sweep)

| brand | total raw | 주요 SKU |
|-------|-----------|----------|
| Polo | 419 | 반팔 130 / 셔츠 56 / 피케 18 / 가방 24 |
| TNF | 153 | Supreme collab 12 / Big Shot 7 / Purple Label 6 / Nuptse 4 / Hot Shot 4 / Borealis 3 |
| Stüssy | 195 | **Nike collab 109건 (56%)** / Dior 3 / Birken 1 |

## 다음 액션 (24h 측정)

1. clothing 카테고리 pool 진입 매물 수
2. 시세 정확도 (특히 한정판 vs 일반 라인 분리 효과)
3. 가품 차단율 (AD_PATTERNS 6종 + floor 0.30)
4. Nike×Stussy collab narrow lane 매물 분포
5. 추가 SKU 필요 시 발견 (예: Polo Sport / TNF Antarctica / Stussy Tribe)

## 알려진 한계 / 후속 wave 후보

1. **TNF Antarctica Parka / Himalayan Parka 누락** — 14d raw 검출 X. 시즌 (겨울) 후 추가 검토.
2. **Polo Sport / Polo 1992 retro 누락** — vintage 매니아 라인. 매물 검출 후 추가.
3. **Stüssy 한정판 다수 미분리** — 8 Ball Knit / Shadow Pants / Tribe 컬렉션 등. 측정 후 narrow lane 추가 검토.
4. **사이즈 narrow lane 보류** — 사용자 정책 "사이즈마다 가격 다르지 않다" broad 시작. 측정 후 narrow 승격 검토.

## 정책 정합성

- §12b 정확성 우선 충족 — 가품 floor 0.30 + AD 패턴 강화 + collab narrow 분리
- consumer_friendly — Polo 35K / TNF 50K / Stüssy 50K mainstream 가격대 우선
- decision_log_required — Wave 197/198/198b 3개 wave 모두 박음
