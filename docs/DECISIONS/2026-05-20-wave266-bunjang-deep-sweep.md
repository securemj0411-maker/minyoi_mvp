# Wave 266 — 번개장터 raw deep sweep → fashion/shoe/bag catalog + parser 대폭 보강

**날짜:** 2026-05-20
**Owner:** MJ (사용자 명령)
**Trigger:** 사용자 "이제 우리 매물이 아니라 번개장터 deep sweep해서 더 살펴보자
우리 카탈로그나 파싱 더 강화해야됌. shoe랑 fashion ㄱㄱㄱ 존나 깊게 분석해야돼
그리고 진짜 한계도달이란말 적당히해라 할때 마다 문제점 나오는데 장난하니?"

## 발견 (SQL deep sweep)

번개장터 raw_listings에서 카테고리별 미매칭 분석 — sku_id NULL 비중:

### 신발 (category 405xxx)
- 총 23,177건 중 15,351건 미매칭 (66%)
- 큰 누락 풀 (n, avg_price):
  - 발렌시아가 신발 344건 (88만)
  - 살로몬 변형 109건 (29만) — XT-6만 catalog, X울트라/판타즘/RX슬라이드/ACS Pro 누락
  - 나이키 샥스 (R4/Z/TL/Ride2) 100건 (16만) — 전체 누락
  - 뉴발란스 1906 82건, 1300/1400/1500/1600/2002 다수 — 변형 누락
  - 아디다스 송포더뮤트 32건 (19만)
  - 컨버스 원스타 28건 (11만) — broad 누락
  - 디스커버리 디워커 24건 (5만) — 전체 누락
  - Y-3 54건 (19만) — 전체 누락
  - 나이키 축구화 17건, 코르테즈 13건, 문레이서 8건, 스피리돈 — 누락
  - 명품 신발 (LV/구찌/프라다/에르메스/디올) 600+건 — brand 자체 catalog 부재

### 옷 (category 320xxx)
- 폴로/랄프로렌 235건 (avg 31만) — RRL/Bear 외 일반 폴로 셔츠/맨투맨 누락
- 베이프 147건 — 자켓/트랙탑/저지/스노보드자켓 누락 (hoodie/tee 외)
- 스투시 110건 — basic-tee/hoodie 외 자켓/팬츠 누락
- 슈프림 60건 (avg 42만)
- 아크네 51건, 꼼데가르송 49건, 칼하트 14건, 톰브라운 25건
- 발토로 5건 (avg 122만!), 눕시 14건, 맥머도, 히말라야 — TNF 변형
- 아디다스 트랙수트 28건 (avg 77만) — 발렌시아가/웨일즈보너 콜라보 다수

### 가방 (category 430xxx)
- 루이비통 1042건 (avg 392만)
- 구찌 683건, 샤넬 521건, 디올 515건, 프라다 417건
- 셀린느 263건, 보테가 221건, 에르메스 171건
- 발렌시아가 162건, 버버리 153건, 코치 138건
- 마르지엘라 89건, 발렌티노 77건, MCM 74건, 페라가모 68건
- 미우미우 63건, 르메르 55건, 꼼데가르송 48건, YSL 48건
- → **총 4,250+건 명품 가방 미매칭** (가장 영향 큼)

## 결정

### Catalog 신규 (3 파일, 70+ SKU)

**`catalog-wave266-shoe.ts`** (30 SKU):
- Salomon 5: X 울트라, RX 슬라이드, 판타즘, XT-4, ACS Pro
- New Balance 5: 1300/1400/1500/1600/2002 (broad, 콜라보 차단)
- Nike Shox 4: R4/Z/TL/Ride 2
- Nike 기타 6: 코르테즈, 문레이서, 스피리돈, Superfly, Tiempo, Mercurial, SFB
- Adidas 추가 2: 송포더뮤트, Stan Smith broad
- Y-3 2: Qasa, broad
- Converse 1: One Star broad
- Discovery: 디워커
- Balenciaga 신발 4: Triple S, Speed, Track, Runner
- 명품 broad 5: LV, Gucci, Prada, Hermes, Dior

**`catalog-wave266-clothing.ts`** (17 SKU):
- Polo Ralph Lauren broad (RRL/Bear 외)
- BAPE 자켓/트랙탑 broad
- Stussy 자켓/팬츠 broad
- Supreme broad (TNF/BAPE collab 외)
- Acne broad, CDG broad, Carhartt broad, Thom Browne broad
- Champion broad, MLB apparel broad, Discovery broad
- TNF 4종: 눕시/발토로/맥머도/히말라야
- Patagonia broad, Stone Island broad
- Moncler broad, Canada Goose broad

**`catalog-wave266-bag.ts`** (20 SKU — 명품 brand-broad fallback):
- LV/Gucci/Chanel/Dior/Prada/Celine/Bottega/Hermes(non-Birkin/Kelly)
- Balenciaga/Burberry/Coach broad/Margiela/Valentino/YSL
- MCM/Ferragamo/Miu Miu/Lemaire/CDG bag/Thom Browne bag
- 각 SKU에 `confusionNote: "broad — variant 가격대 wide. confidence_low"` 박음.

### Parser 보강 (v9 → v10)

**`parseShoeProductType`:**
- 등산화/트레킹화/hiking boot → `boot`
- 트레일러닝/러닝슈즈/스피드러너/골프화/테니스화/농구화/배드민턴화/볼링화/탁구화/태권도화 → `sneaker`
- 플립플롭/Ugg slipper/아디다스 슬리퍼 → `slipper`
- 아쿠아슈즈 → `sandal`
- 드라이빙슈즈/모카신 → `loafer`

**`parseClothingProductType`:**
- 베이스볼 저지/야구점퍼/바시티/코치자켓/하드쉘/소프트쉘/MA-1/레터맨/스타디움자켓/셰르파자켓 → `jacket`

**`parseBagProductType`:**
- 캔버스백/쇼핑백/마트백 → `tote`
- 데이팩/캠퍼백/책가방/학생가방 → `backpack`

**Parser version bump:**
- `wave92-shoe-v9` → `wave92-shoe-v10`
- `wave92-bag-v9` → `wave92-bag-v10`
- `wave216-clothing-v9` → `wave216-clothing-v10`

### 영향도 추정

- 신발 미매칭 (15,351) 중 **~800건** Wave 266 catalog로 매칭 가능 (5%↑)
- 가방 미매칭 (4,250 명품) 중 **~3,000건** broad SKU로 fallback 매칭 (70%↑)
  - 단 confidence_low — sample 신뢰도 낮음 (variant 50만~3000만 wide)
- 옷 미매칭 → 폴로/베이프/스투시/슈프림 등 ~500건 추가 catch
- type_unknown 매물 → 추가 ~500건 product_type 분류 정확화

### 다음 단계

1. **production reparse 모니터링 (7시간)** — Wave 255 parserDriftStage가 v10 stale row 자동 score_dirty=true → cron에서 점진 reparse
2. **sample contamination 검증** — broad SKU sample이 한정/콜라보 침범 시 mustNotContain 추가
3. **다음 Wave (267~)** — narrow split (broad SKU의 variant 분리), 명품 가방 price tier 분할

## 사용자 명령 정확 인용

1. "shoe랑 fashion ㄱㄱㄱ 존나 깊게 분석해야돼"
2. "카탈로그나 파싱 더 강화해야됌"
3. "DB다보라니까... sample들이랑 파싱 잘되는지 항상 잘 봐야된다"
4. "방대한 catalog 필요"
5. "한계도달이란말 적당히해라 — 할때 마다 문제점 나오는데 장난하니?"

→ 우리 매물 (mvp_listings) 검증이 아니라 **번개장터 raw_listings 직접 sweep**으로
   catalog 미매칭 패턴 추출. 6,000+ 미매칭 매물 → catalog 보강으로 catch.

## 테스트

- 832 pass / 11 fail (pre-existing /me UI baseline)
- 0 regression from Wave 266 changes
- typecheck clean (src/)
