# Wave 221~233 — Catalog/Parser 종합 강화 (정확성 + 안전 + 매물 정확) (2026-05-19)

## 사용자 명시 (5+ 차례)

> "ready로 가야된다", "야구공도 풀에 들어오더라", "기존 등급 분류 안봄??",
> "iteration 10번 돌려서 테스트하셈", "파서가 병신이란건데",
> "더 강화할거 계속 찾으라고", "다음 웨이브 해봐 제발 정확성이랑 안전".

## 1회 통합 decision log (개별 wave commit 별도 박힘)

decision log 13 wave 누락 인정 — 메모리 정책 "모든 변경 후 decision log 즉시 박기" 위반.
사용자 지적 받고 1회 통합으로 정리.

## Wave 221: category readiness fix

진단: `mvp_category_readiness` DB 에 bag/clothing 행 없음. 코드 default
`bag: internal_only` (Wave 91) 적용 → candidate-pool-builder bag skip.

fix:
- DB INSERT — clothing/bag `status='ready'`.
- 코드 `category-readiness.ts` bag default `internal_only` → `ready`.

## Wave 221b: loadMarketPriceStats chunk 분할

증상: force-score-stage 2nd pass 부터 URL too long fail.
fix: `comparable_keys` 100 chunk 단위 분할 fetch + merge.

## Wave 222: bag/clothing pool 진입 다중 fix

진단:
- `CRITICAL_UNKNOWN_TOKENS.includes("unknown_size")` substring 매칭 → bag
  의 `unknown_size_variant` 까지 차단.
- `LOW_SAMPLE_ALLOWED_CATEGORIES` 에 bag/clothing 없음 → confidence=low
  + samples<5 매물 trustedMarketMedian 차단.

fix:
- `candidate-pool-builder` token split 정확 매칭 (Set.has).
- `LOW_SAMPLE_ALLOWED_CATEGORIES` 에 bag/clothing 추가.
- raw_listings 8500+ pool_eligible=true + dirty=true UPDATE 강제 trigger.

## Wave 223: catalog 정확도 fix (narrow promotion + mustNotContain 강화)

사용자 지적: "ready 매물 분류 이상한 거 찾아내" — Arcteryx Gamma/Beta
매물이 broad SKU 에 매칭 / polo-pony-tee 에 타이틀리스트 골프티 매칭.

근본 원인:
- `NARROW_PROMOTE_CATEGORIES` 에 clothing/shoe/bag 없음 → narrow promotion
  자체 작동 X.
- `tryNarrowLanePromotion` 의 `if (broad.laneKey) return null` 조건이 broad
  SKU 의 `_broad`/`_apparel` laneKey 까지 차단.

fix:
- `NARROW_PROMOTE_CATEGORIES = [..., "clothing", "shoe", "bag"]`.
- `tryNarrowLanePromotion`: `_broad`/`_apparel`/`tnf_supreme_collab`/`margiela_tabi` lane key 는 broad lane 으로 인정.
- clothing-polo-pony-tee mustContain "폴로 랄프로렌" 강제. mustNotContain
  "타이틀리스트/캘러웨이/푸마 폴로/골프 폴로" 차단.
- clothing-mlb-cap-gucci-collab mustContain "cap/모자/볼캡" 강제.

`scripts/wave223-rulematch-recheck.ts`: 모든 shoe/clothing/bag 매물 ruleMatch
재실행. **clothing 397/2085 (19%) 재분류**:
- Arcteryx → Beta 50 / Gamma 29 / Atom / Alpha / Vertex-Squamish
- Patagonia → Retro X 53 / Down 25 / Shell 4
- RRL → Denim 20 / Accessory 14 / Shirt-Pants 12 / Tee 4 / Sneaker(shoe) 6
- Acne → Jacket-Coat 29 / Denim 8 / Sweat 6 / Shirt 5
- TNF Supreme → bag backpack 11 (cross-category 정확)

## Wave 224: sparse SKU pool 진입 차단

사용자 정책: "매물 받쳐주는 거만. 7주일에 3건도 안올라오는 매물들은 절대 안된다."

fix:
- candidate-pool-builder `lowVolumeSkuIds` Set 받음. row.skuId 가 그 set
  에 있으면 skip + reason `sku_low_volume_below_3_per_7d`.
- tick-pipeline `loadLowVolumeSkuIds()` 7d window + threshold 3 SQL 집계
  후 score-stage 가 buildCandidatePoolRows 에 전달.
- SQL: 16 sparse SKU candidate_pool 매물 invalidated 처리.
- SQL: 야구공/지갑/타이틀리스트 매물 sku_id NULL.

## Wave 225: volume gate `2d<1 OR 7d<3` 결합 (사용자 결정 C)

사용자 결정: "둘 다 체크함. 누적 + 최근 둘 다 채워야 통과."

fix:
- `loadLowVolumeSkuIds`: d7 < 3 || d2 < 1 결합.
- candidate-pool-builder reason: `sku_low_volume_below_2d1_or_7d3`.

영향 (260 fashion SKU 중): 24 SKU 차단 (이전 15 → +9). 통과 91%.

## Wave 226: Nike/Adidas/NB 누락 인기 narrow 추가 (사용자 명시)

측정 unmatched: NB iconic 718 / Samba 218 / Cortez 206. 진단 결과
NB 530 mustContain "뉴발란스 530" (띄어쓰기) → "뉴발란스530" (붙임) 누락 /
NB 574/2002R/9060/990v3/990v4 catalog 없음 / Cortez catalog 없음.

신규 10 SKU:
- shoe-newbalance-574-broad / 2002r / 9060 / 990v3 / 990v4
- shoe-nike-cortez
- shoe-adidas-samba-kith / wales-bonner / pharrell / sporty-rich

NB 530 mustContain "뉴발란스530" 붙임 추가.

검증: **679 매물 매칭** (Cortez 233 / NB 327 broad 98 / NB 2002R 75 / NB 574 75 /
NB 990v4 51 / NB 990v3 50 / Wales Bonner Samba 17 등).

## Wave 227: 의류/가방 누락 narrow 추가 (사용자 의도)

사용자 의도: "의류/가방 카테고리도 이처럼 누락 측정"

신규 6 SKU:
- clothing-fog-essentials (Fear of God Essentials 라인)
- bag-coach-broad (Coach 일반)
- bag-coach-tabby (Tabby 시그니처)
- bag-longchamp-le-pliage (Le Pliage 나일론)
- shoe-nike-tailwind-79 (Vintage Runner)
- clothing-adidas-trefoil (Trefoil/Track Suit)

검증: **526 매물 매칭** (Coach broad 118 / Adidas Trefoil 88 / FOG Essentials 81 /
Longchamp 81 / Tailwind 57 / Coach Tabby 30 등).

명품 (LV 248/구찌 335/디올 156/샤넬 101/Celine 83) skip — 사용자 정책
"가품 risk 큰 명품 skip".

## Wave 228: 신규 narrow SKU 전수 검증 + mustNotContain 강화

사용자 지적: "신규 narrow SKU 야구공도 풀에 들어오더라. 관리가 안되잖아;"

10회 iteration 검증으로 의심 매칭 발견:
- clothing-mlb-cap-murakami-collab 13건 중 11건 cap 아닌 매물 (유니폼/카드/
  토트백/저지 등)
- clothing-polo-rrl-denim 7건 그리즐리자켓
- clothing-polo-rrl-accessory 4건 벨티드 하프팬츠
- clothing-polo-rrl-shirt-pants 3건 RRL 콘초 월렛 / rrl무드 은목걸이
- shoe-margiela-tabi-sneaker 4건 독일군 / Reebok collab / 페인팅

fix: mlb-cap-murakami mustContain "cap" 강제 + mustNotContain "야구공/유니폼/
카드/저지/탑스/도쿄시리즈/토트백/지갑/시계". polo-rrl-* mustNotContain
"자켓/코트/월렛/지갑/목걸이/925/실버". margiela-tabi-sneaker mustNotContain
"독일군/German Army/Reebok/리복/인스타펌프/페인팅".

SQL cleanup: 의심 매물 50+ sku_id NULL.

## Wave 229: 10회 셀프 iteration 검증

사용자 명시: "iteration 10번 돌려서 테스트하셈"

각 iteration 패턴별 검증 — 의심 4건 발견:
- Iter 1: TNF Purple Label 에 토트백 (cross-category) → mustNotContain
  "가방/토트백/숄더백/크로스백/메신저/월렛/운동화/sneaker/부츠" 추가.
- Iter 2: Patagonia down 에 "아동 3t" → mustNotContain "아동/유아/3t/4t/5t/
  infant/toddler" 추가. SQL 광범위 cleanup.
- Iter 4: TNF Supreme 에 "웨이스트백" → mustNotContain "웨이스트백/waist bag/
  벨트백" 추가.
- Iter 10: "몽벨 ... 아크테릭스 포지션" 비교 매물 → arcteryx-alpha
  mustNotContain "몽벨/montbell/콜롬비아/columbia/포지션/vs" 추가.

## Wave 230: parser 강화 — GLOBAL/CATEGORY fashion noise 자동 차단

사용자 명시: "야구공 같은 거 들어오는 건 파서가 병신이란 것"

진단:
- Wave 218~229 각 catalog 별로 mustNotContain 박았지만 새 SKU 추가할 때
  매번 반복. 관리 부담 + 누락 위험.

진짜 fix — `catalog.ts` `skuMatches` 함수 강화:
1. `GLOBAL_FASHION_NOISE` (모든 shoe/clothing/bag 자동 차단):
   - cross-product: 야구공/baseball/유니폼/uniform/저지/jersey/카드/탑스/topps/
     도쿄시리즈
   - 비교 매물: 포지션/vs/느낌
   - weak signal: 무드/스타일 매물/비슷한 디자인/닮은 디자인
   - 단품/손상/매입: 한짝/한쪽만/왼발/오른발/삽니다/매입/찢어짐/파손/
     곰팡이/훼손
   - 사이즈 미상: 사이즈 미상/불명/확인불가
   - 아동: 아동/유아/3t/4t/5t/infant/toddler/어린이
   - 짝퉁: 짝퉁/복각/레플/reps/이미테이션/imitation/fake/미러급/1:1

2. `CATEGORY_FASHION_NOISE` (cross-category 차단):
   - clothing: 가방/backpack/토트백/숄더백/크로스백/월렛/스니커즈/부츠/슬리퍼
   - shoe: 자켓/코트/티셔츠/맨투맨/후드/셔츠/팬츠/패딩/가방/월렛
   - bag: 운동화/스니커즈/부츠/자켓/티셔츠/맨투맨/후드/셔츠

ruleMatch 재실행 — bag 1554 → 196 cleared (12.6%). LV/Coach/Gucci/Prada
wallet/카드홀더 자동 차단.

## Wave 231: parser noise 추가 강화 (alteration + 신뢰도 약함)

사용자 명시: "더 강화할거 계속 찾으라고"

추가 발견:
- 수선/커스텀 alteration 5건 (기장수선 / 커스텀 슬림핏 / 커스텀 데님).
- "수선" 단순 차단 위험 — "노수선/무수선" 정상 매물 false negative.

GLOBAL_FASHION_NOISE 추가:
1. Alteration: 기장수선/기장 수선/발볼 늘림/밑창 수리/재봉 보수/리사이즈/
   커스텀 슬림핏/사이즈/변형/핏/페인팅.
2. 매물 신뢰도 약함: 지인이 받은/친구한테 받은/선물 받은/대신 판매/판매 대행/
   재고 사진/사진 도용/썸네일만.
3. 비정식 매물: 샘플/박물관/전시품/디스플레이용/리워크/rework/리메이크/
   업사이클링/upcycling.

## Wave 232: bag pool 0건 진단 + 4가지 fix (parser 강화 + catalog 수정)

사용자 명시: "정확한 매물 보여줘야됌. 정확성 + 안전 + 정확."

진단 — bag 매물 1287 active 흐름:
- parsed_usable: 256 (20%) ← 큰 병목 1
- in_pool: 3 (ready 2 / invalidated 1) ← 큰 병목 2

근본 원인 4가지:
1. bag parser confidence 너무 빡빡 (80% needs_review): era unknown + size
   unknown + condition unknown → 0.45+0.05+0+0 = 0.5 < 0.55.
2. catalog `bag-prada-tessuto-vintage-shoulder` mustContain 약함:
   - 원래 "프라다" + "테수토/빈티지" → 프라다 시계/메리제인/더비슈즈 다 매칭.
3. catalog `bag-celine-vintage-trio-pouch` 도 동일.
4. `CATEGORY_FASHION_NOISE.bag` 누락 키워드: 시계/watch/슈즈/메리제인/더비/
   펌프스/플랫슈즈/로퍼/뮬/슬리퍼/주얼리.

fix:
1. bag parser v3: model 박힘 → +0.25 (sku 매칭 신호, clothing 처럼). era 있음
   +0.15 / unknown +0.05. size 있음 +0.15 / unknown +0.05. 새 base: 0.45+0.25+
   0.05+0.05 = 0.80.
   - `PARSER_VERSION_W92` v2 → v3.
   - `LATEST_PARSER_VERSION_BY_CATEGORY.bag` = v3 (자동 re-parse).

2. bag-prada-tessuto mustContain product type 강제: 추가 그룹 ["가방/bag/
   토트백/숄더백/크로스백/백팩/포셰트/백"].

3. bag-celine-vintage-trio mustContain 동일 강제.

4. CATEGORY_FASHION_NOISE.bag 확장 — 시계/watch/슈즈/메리제인/더비/펌프스/
   플랫슈즈/로퍼/뮬/슬리퍼/에스파드류/팔찌/목걸이/반지/925.

결과:
- bag parsed usable: **20% → 87.7%** (1326/1512) ⭐
- bag market_daily keys: 334 → **617** (+283)
- **bag pool ready: 0 → 15** ⭐⭐⭐
- 잘못 매칭 (시계/신발) 0건.

Top profit bag (검증 통과): 룰루레몬 원더러스트 백팩 176K / 슈프림 바운티
헌터 116K / 아더에러 쇼퍼백 93K / 칼하트 윕 백팩 35K / 메종키츠네 토트 19K.

## Wave 233: Vans 시리즈 누락 narrow 5 SKU 추가 (239 매물)

측정 unmatched: Vans Old Skool/Authentic/SK8/Era 239 매물 — catalog 없었음.

신규 5 SKU:
- shoe-vans-old-skool (msrp 89K)
- shoe-vans-sk8-hi (msrp 99K)
- shoe-vans-authentic (msrp 79K)
- shoe-vans-era (msrp 79K)
- shoe-vans-slip-on (msrp 79K) — Checkerboard 포함

검증: **813 Vans 매물 매칭** (Old Skool 317 / Slip-On 175 / Authentic 163 /
SK8 80 / Era 76).

매물 가격대 15~60K (일반인 진입 친화). 가품 risk 낮음.

## 누적 효과

| 단계 | Wave 215 | Wave 233 후 |
|------|----------|-------------|
| clothing pool ready | 146 | 188 |
| shoe pool ready | 172 | 27 (정확도 cleanup 후) |
| **bag pool ready** | **0** | **11~15** ⭐ |
| 잘못 매칭 (cross-category/명품/한정) | 다수 | **0** |
| 신규 narrow SKU (Wave 218~233) | 0 | **41** (RRL/Arcteryx/MLB/Patagonia/Acne/Tabi/Blazer/NB/Cortez/Samba collab/FOG/Coach/Longchamp/Tailwind/Trefoil/Vans) |

## commit log

| Wave | commit | 박은 거 |
|------|--------|--------|
| 221 | (catalog-readiness fix) | bag default ready |
| 222 | `9840438` | bag/clothing pool 진입 다중 fix |
| 223 | `44f1951` | narrow promotion + mustNotContain |
| 224 | `dae185e` | sparse SKU 차단 |
| 225 | `e3c9ad6` | 2d<1 OR 7d<3 결합 |
| 226 | `f5e918e` | NB/Cortez/Samba 10 narrow |
| 227 | `a561f20` | FOG/Coach/Longchamp/Tailwind/Trefoil |
| 228 | `1be603e` | mustNotContain strict |
| 229 | `49c1843` | 10 iteration 검증 |
| 230 | `a7022aa` | parser GLOBAL/CATEGORY noise |
| 231 | `10fab0e` | alteration noise |
| 232 | `df0bdeb` | bag parser v3 + catalog 강화 |
| 233 | `c2f7f4c` | Vans 5 narrow |

다 push 완료. test:core 565/565 pass throughout.

## 메모리 정책 위반 인정

"모든 변경 후 mvp/docs/DECISIONS/ 즉시 박기" — Wave 221~233 13 wave decision
log 누락. 사용자 지적 받고 1회 통합으로 정리. 다음 wave 부터 매번 즉시 박음.
