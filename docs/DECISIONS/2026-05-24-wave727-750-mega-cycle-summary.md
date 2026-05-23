# Wave 727-750 Mega Cycle Summary — 단일 session 25+ waves

**날짜**: 2026-05-24
**Owner**: Claude (자율 + 사용자 명시 요청)
**Status**: cycle 자연 완성, 24-48h verification 대기

## 개요
사용자 명령 "계속 하셈" 다수 회 응답으로 단일 session에서 25+ waves 진행.
catalog 정비 + parser 보강 + drift gate fix + bias-free sweep 종합.

## 누적 회수 ~17,000+ 건/주

## Wave 727-733: 의류/신발 catalog 신설 cycle
| Wave | 작업 | 회수 |
|------|------|------|
| 727 | 골프 6 brand (Titleist/PXG/Malbon/G·FORE/J.Lindeberg/Mark&Lona) | 2,624 |
| 728 | Supreme×Dickies/MM6/Velvet + Arc'teryx Proton/Solano/Rampart | ~50 |
| 729 | Carhartt 4 broad + double-knee leak + matinkim 확장 | 127 |
| 730 | Nike apparel 5 broad (Dri-FIT/Windbreaker/Hoodie/Tee/Pants) | 175 |
| 731 | Adidas apparel 6 broad (Tracksuit/Tee/Windbreaker/Hoodie/Pants/Down) | 148 |
| 732 | Multi 6 + Stussy×Nike leak fix | 158 |
| 733 | 신발 broad 6 (Salomon/Hoka×2/On Running/Skechers/UA) | 190 |

## Wave 734-741: leak fix + small brand
| Wave | 작업 | 회수 |
|------|------|------|
| 734 | Mega brand 3 (Acne/Nanamica/Tommy) + FOG/Patagonia leak fix | 1,700+ |
| 735 | FootJoy/AmazingCree/Callaway 골프 추가 | 512 |
| 736 | MM6/Lacoste/MountainHardwear | 169 |
| 737 | Uniqlo broad + Polo Pique 462 + Polo Pony 726 leak fix | 1,249 |
| 738 | **Converse "70" 사이즈 차단 버그** + Arcteryx broad 확장 | 753 |
| 739 | NB 1906/USA-UK/Generic 3 SKU | 1,000 |
| 740 | Vans Vault/Generic + Asics "1130" 토큰 | 568 |
| 741 | TNF Nuptse "96" over-block 제거 | ~100 |

## Wave 742-745: parser + spread fix
- **Wave 742**: 의류 사이즈 추출 parser 신설 (sizeAlpha/sizeKr/waistInch)
- **Wave 743**: drift gate parser_version mapping (clothing v47, 전자기기 v55, 8 카테고리)
- **Wave 744**: retention audit closed (운영 15일, false alarm)
- **Wave 745**: Stussy hoodie collab + Jo Malone 향수 카피 차단

## Wave 746-749g: 작은 brand + 전자기기 deep sweep
- **Wave 746**: Neighborhood/Schott/Hunter 신설
- **Wave 747**: Dickies broad
- **Wave 748**: **Lego 12 lane blocked** (사용자 정책)
- **Wave 749**: Sony 이어폰 5 SKU (WF-1000XM/LinkBuds Open/MDR Pro)
- **Wave 749b**: Apple Watch Series 5-11 "시리즈N" no-space
- **Wave 749c**: iPhone 13/14/16/17 Pro mid-space
- **Wave 749d**: iPhone Pro Max/Plus 13/14/16/17 mid-space
- **Wave 749e**: iPhone 11/12 + AirPods Pro 1 "프로1" + Galaxy Buds 4 Pro "프로 4"
- **Wave 749f**: iPhone 15 Pro generated/catalog.ts
- **Wave 749g**: Bose Ultra Open Earbuds (2024 신상)

## Wave 750: Bias-free sweep 6 phases
| Phase | SKU | Spread Before | 차단 |
|-------|-----|---------------|------|
| 1 | mlb_apparel_broad | 10.8x | Majestic/Under Armour/뉴에라 |
| 1 | polo_bear_collab | 8.4x | 수면/스키 베어/노르딕/베어포트/희귀 |
| 2 | polo_apparel_broad | 6.8x | 80s vintage/매키노/인디언헤드/알파카/하운드투스/레인 자켓 |
| 3 | carhartt_apparel_broad | 6.7x | Awake/02s/단종/초어 코트/탱크 자켓/조거쉬·이미스 묶음 |
| 4 | stussy_apparel_broad | 6.9x | Nike/리바이스/Our Legacy/CPFM/Martine Rose/Beach Shell |
| 5 | fog_main_jacket | 11.1x | Mountain Fog/Notes from He/NFL/Eternal/Athletic Puffer |

## Critical Bug Fixes
1. **Converse "70" → 사이즈 270mm 차단 (519건 leak)** — 1 bare numeric token이 사이즈 표기 다 차단
2. **TNF Nuptse "96" → Korean 사이즈 95/96 차단** — 동일 패턴
3. **FOG Essentials FOG signal mandatory → essentials 단독 OK** (503건)
4. **Polo Pique/Pony group 2 over-block 제거** (1,188건)

## 잡은 은어/표현 (Catalog catch 완료)
- 한국 prefix compound: 아이폰13프로/갤럭시S23FE/워치10
- mid-space 변형: 아이폰 13프로/iphone13 pro/아이폰13 프로
- + 변형: 아이폰15+/iphone16+/iphone17+
- no-space 한국: 시리즈5/시리즈10/시리즈11/프로1/프로4
- 합성어: 나투시 (Nike×Stussy) / 버즈프로3 (Galaxy Buds 3 Pro)
- 카피 차단: type/퍼퓸홀릭/프리미엄 향 스프레이 (Jo Malone)
- false brand: Mountain Fog/Notes from He/London Fog (FOG main)
- 묶음 매물: 조거쉬·이미스·헤리티지플로스 (Carhartt)

## 새 SKU (~55+ 신설)
- 의류 30+: Nike 5, Adidas 6, Carhartt 4, 골프 9, Mega 5 (Acne/Nanamica/Tommy/MM6/Lacoste), FOG×MLB/Thisisneverthat/Uniqlo×2/Columbia/Blackyak/Barbour/Neighborhood/Schott/Dickies
- 신발 14: Salomon broad/Hoka Bondi+broad/On Running broad/Skechers/UA/Dr.Martens broad/Timberland/Keen/Fila shoe/Clarks/Clae/Vans Vault+Generic/NB 1906/USA-UK/Generic/Hunter
- 이어폰 5: WF-1000XM 4/5/6/LinkBuds Open/MDR Pro/Bose Ultra Open

## Parser/Infrastructure
- 의류 사이즈 추출 (sizeAlpha/sizeKr/waistInch) 신설
- Parser version: wave216-clothing-v46 → v47
- LATEST_PARSER_VERSION_BY_CATEGORY 매핑 8 카테고리 추가 (smartphone/tablet/laptop/smartwatch/earphone/watch 등)

## Pending verification (24-48h 후)
- 매물 매칭률 baseline → 회복 측정 (Nike 32.9% → 60%+ 예상)
- pool entry 증가 (현재 의류/신발 신설 SKU pool 진입 거의 0)
- spread 재측정 (Wave 750 차단 효과)
- 신규 SKU 시세 안정성

## Outstanding (Pareto long-tail 다음 작업)
- 큰 brand 추가 audit: Polo 매칭률, Newbalance, Asics, Stussy, TNF 더 깊이
- 작은 brand 누적 (수십 brand × 50-100건)
- Galaxy S 시리즈 자세히 (S23 1,271건 / 13.4% 매칭률 최저)
- iPhone "other" 825건 (모델 미명시)
- iPhone SE 17.2% 매칭률 (SE2/SE3 narrow 보강)

## Files Touched (주요)
- `src/lib/catalog.ts` — 다수 SKU 보강
- `src/lib/generated/catalog-wave266-clothing.ts` — broad SKU mustNotContain
- `src/lib/generated/catalog-712b-bias-free.ts` — FOG main + Vans + 신발 broad
- `src/lib/generated/catalog-712c-shoe-bulk.ts` — NB broad
- `src/lib/generated/catalog-729-carhartt-broad.ts` (신규)
- `src/lib/generated/catalog-730-nike-apparel-broad.ts` (신규)
- `src/lib/generated/catalog-731-adidas-apparel-broad.ts` (신규)
- `src/lib/generated/catalog-732-multi-brand.ts` (신규)
- `src/lib/generated/catalog-733-shoe-broad.ts` (신규)
- `src/lib/generated/catalog-734-mega-brand.ts` (신규)
- `src/lib/generated/catalog-735-golf-broad-2.ts` (신규)
- `src/lib/generated/catalog-736-mm6-lacoste.ts` (신규)
- `src/lib/generated/catalog-737-shoe-broad-2.ts` (신규)
- `src/lib/generated/catalog-746-neighborhood-schott.ts` (신규)
- `src/lib/generated/catalog-749-sony-electronics.ts` (신규)
- `src/lib/parsers/wave92-fashion-mobility.ts` — 의류 사이즈 추출
- `src/lib/tick-pipeline.ts` — drift gate mapping
- `src/lib/category-readiness.ts` — Lego blocked + 신설 SKU ready
