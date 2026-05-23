# Wave 754 — PlayStation + Seiko 신설 (1,764 매물 Pareto)

**날짜**: 2026-05-24
**Owner**: Claude (사용자 명시 "남은거 ㄱㄱ")
**Status**: 24-48h verification 대기

## 개요
Wave 727-733 verification + Wave 41 Wave 713+ 12 brand 재검증 + 새로운 null sku_id 큰 brand catalog 작업.

## Wave 727-733 deploy verification 결과

### 매칭 성공 SKU (Wave 727-733)
| SKU | raw_count | avg_price | 비고 |
|-----|-----------|-----------|------|
| clothing-nike-dri-fit-therma | 99 | 65K | Wave 730 Nike apparel broad |
| clothing-carhartt-double-knee-pants | 55 | 149K | Wave 729 Carhartt broad |
| clothing-carhartt-detroit-jacket | 52 | 364K | Wave 729 |
| clothing-schott-broad | 49 | 287K | Wave 746 |
| clothing-nike-windbreaker | 44 | 64K | Wave 730 |
| clothing-nike-tee-broad | 39 | 45K | Wave 730 |
| clothing-nike-pants-shorts | 39 | 109K | Wave 730 |
| clothing-neighborhood-broad | 33 | 443K | Wave 746 |
| clothing-nike-hoodie-sweat | 33 | 50K | Wave 730 |
| clothing-uniqlo-broad | 29 | 27K | Wave 737 |
| dyson-v8-v11-vacuum-broad | 22 | 127K | Wave 751d |
| bose-ultra-open-earbuds | 22 | 221K | Wave 749g |
| shoe-skechers-broad | 17 | 55K | Wave 733 |
| sony-wf-1000xm5 | 14 | 196K | Wave 749 |
| sony-wf-1000xm6 | 13 | 394K | Wave 749 |

### 매칭 0건 (parser drift)
- shoe-ua-broad, shoe-salomon-broad, shoe-hoka-bondi-broad (Wave 733)
- dyson-v15-detect 1건만 (Wave 751d, 1일 됨)

원인: parser drift — 매물이 stale parser_version으로 detail-enrich 안 됨. Wave 752 v3 bump cron이 점진 처리.

## Wave 41 — Wave 713+ 14 brand 재검증
현재 spread (Wave 712a 후 7일 됨):

| Brand SKU | Current Spread | 상태 |
|-----------|----------------|------|
| clothing-adidas-trefoil | 154x | parser drift 잔존 (Wave 215+ Bape 차단이 안 먹힘) |
| clothing-stussy-apparel-broad | 74x | 안정 |
| clothing-patagonia-synchilla | 72x | Wave 800에서 fix |
| clothing-polo-bear-collab | 68x | Wave 800에서 fix |
| clothing-tnf-supreme-collab | 62x | 자연 spread |
| clothing-nike-pants-shorts | 47x | 자연 |
| clothing-supreme-apparel-broad | 46x | Wave 751c에서 fix |
| clothing-mlb-cap | 44x | 자연 |
| clothing-tnf-nuptse-broad | 30x | OK |
| clothing-mlb-apparel-broad | 19x | OK! |

**결론**: 대부분 안정. Adidas Trefoil 154x만 parser drift 잔존 — Wave 752 reparse로 회복 예정.

## Wave 754 신규 catalog (1,764 매물)

### PlayStation 3 SKU (773 매물)
- **ps5-broad** (msrp 630K): PS5 base 526 unmatched. disc/digital 명시 안 된 generic catch-all.
- **ps4-broad** (msrp 398K): PS4 base 210 unmatched.
- **ps4-pro** (msrp 498K): PS4 Pro 37 unmatched.

각 SKU 단품/액세서리/구매글/타기종 격리. PS2 일련번호 false match 차단 (Wave 753c galaxy-s22와 동일 패턴).

### Seiko 3 SKU (991 매물)
- **watch-seiko-5-broad** (msrp 250K): Seiko 5 79 unmatched (SRPD/SBSA narrow 외).
- **watch-seiko-prospex-broad** (msrp 800K): Prospex 40 + Turtle/Alpinist/Samurai/Speedtimer/Diver 70 = 110.
- **watch-seiko-broad** (msrp 400K): "seiko_other" 762 unmatched (model 미명시 catch-all).

명품 정책 (Grand Seiko/King Seiko/Rolex/Omega/Tudor) 차단.

## Wave 752 v3 bump 상태 (verification 측정)

### Title triage 분포 (7일)
- title_triage_v1: 109,246 (가장 오래된 stale)
- title_triage_v2: 24,719 (Wave 713 후 추가)
- title_triage_v3: 1,329 (Wave 752 이후 NEW)

총 135,294 매물. Cron이 점진적으로 v1/v2 → v3 reparse 중.
24h 진행 후 진행률 작음 — 48h 더 필요.

### Matching rate (7일 전체)
- matched: 50,763 (24.4%)
- null: 157,246 (75.6%)

Wave 752 진행 중. 48h 후 30%+ 회복 예상.

## Files Touched
- `src/lib/catalog.ts` — PS5 broad / PS4 broad / PS4 Pro / Seiko 5 broad / Seiko Prospex broad / Seiko broad
- `src/lib/category-readiness.ts` — 6 entry 등록

## Pareto 정리
- **이번 cycle 임팩트**: 1,764 매물 catalog 회수 + verification 데이터 수집
- **다음 24-48h**: Wave 752 cron 처리 (135K reparse) + Wave 754 신규 SKU pool entry 측정
- **Skip continued**: Logitech/Xiaomi small fragment, Rolex/Omega/Grand Seiko 명품
