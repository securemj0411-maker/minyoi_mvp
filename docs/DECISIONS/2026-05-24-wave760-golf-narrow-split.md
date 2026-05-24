# Wave 760 — 골프 narrow split 분석 (sub-model × condition × sex × shaft)

**날짜**: 2026-05-24
**Owner**: Claude (사용자 명시 "사용감/condition keyword 분석 X 가 핵심 지적")
**Status**: Sweep 완료, split 권장 fix 대기

## 배경

Wave 759 (commit 59ff1cd) 골프 44 SKU 신설 후 사용자 미진 지적:

> "C 시세에 사이즈 반영은 진짜 아니다. 같은 brand 같은 모델은 같은 SKU.
> But 가격 차이 큰 세분화 안 측정 — 남/여, 샤프트, generation, 사용감 등."

특히 사용감 / condition keyword (S급/A급/B급/사용감/흠집 등)는 Wave 759 v3 sweep에서 아예 측정 안 됨.

## Wave 760 sweep 방법

스크립트: `scripts/wave760-golf-narrow-deep-sweep.ts`

Wave 759 v3 동일 query 115개 (10 generic + 15 brand × 7 type).
각 query × 2 pages = 228 API calls.

**추가 추출 (regex만, ruleMatch 없음 — CPU busy loop 방지)**:
- Sub-model (Stealth/Qi10/G430/TSR3/T100/Beres 등 ~100 코드)
- Loft ("9도", "9.5도", "10.5도" 패턴)
- Shaft (스틸/그라파이트/투어AD/벤투스/디아마나/텐세이 등 16종)
- Generation (1세대/2세대/년도)
- Sex (남성용/여성용)
- Flex (R/S/SR/X/L/A)
- Condition (새제품/미개봉/S급/A급/B급/C급/사용감/흠집 등)

결과: 11,858 fetched → 10,626 unique (Wave 759 비슷)
실행 시간 56s, 0 errors.

JSON: `docs/AUDIT_LOG/wave760-golf-narrow-1779581576103.json`

## 추출 coverage

| 차원 | 커버 % | 비고 |
|------|--------|------|
| condition | 24% (2,516 / 10,626) | "Used" 2,099 + "New" 345 + S/A 71 |
| sex | 23% (2,400 / 10,626) | Men 1,516 + Women 884 |
| shaft | 14% (1,533 / 10,626) | TourAD/LightSteel/Steel/Graphite top |
| sub-model | 39% (4,169 / 10,626) | 일본 brand (Honma-Beres, Majesty-Maruman) top |

condition keyword가 24%만 잡혔다는 건 매물 title이 condition 명시 안 하는 경우 많음. 본문 description 까지 봐야 더 잡힘 (별도 단계).

## Top 20 split candidates (median 30%+ spread)

총 60개 발견 (subModel 30, shaft 11, condition 11, sex 8).

### 1. Ping iron sub-model spread **935%**
- G430 880K / i230 725K / G400 400K / G425 250K / i500 85K
- **추천**: G430/G425/G410/i500 별도 SKU. G430 = 신상 = 최고가, i500 = 구형 = 1/10

### 2. Majesty iron shaft spread **721%**
- Graphite 800K / LightSteel 97K
- **추천**: Majesty iron Graphite vs Steel 별도 (혼합 시 시세 8배 차이 노이즈)

### 3. Titleist iron sub-model spread **689%**
- T100 750K / T300 600K / T200 550K / AP3 460K / AP2 370K
- **추천**: T-series (T100/T200/T300) vs AP-series (AP1/AP2/AP3) 별도

### 4. Srixon iron sub-model spread **607%**
- ZX7 530K / ZX5 387K / Z355 290K / Z725 200K / ZX 150K
- **추천**: ZX-series vs Z-series 별도

### 5. Callaway fairway_wood sub-model spread **592%**
- Epic 207K / Rogue 172K / XR 110K / BigBertha 30K
- **추천**: 최소 Epic / Rogue / BigBertha 3개

### 6. Callaway wood_other sub-model spread **520%**
- Elyte 310K / Paradym 200K / Epic 150K / XR 117K / Legacy 79K

### 7. Honma wood_other condition spread **481%**
- New 465K / Used 80K
- **추천**: Honma 일본 brand 신상 vs 중고 가격 폭 거대 → 신/중고 분리 필요

### 8. Titleist driver sub-model spread **465%**
- GT2 650K / TSR2 423K / TSR3 389K / TSi3 283K / TSi2 280K
- **추천**: GT2/GT3 신상 / TSR-series / TSi-series 분리

### 9. TaylorMade wood_other shaft spread **463%**
- Ventus 225K / Steel 40K

### 10. Majesty fairway_wood sex spread **460%**
- Men 840K / Women 150K
- **추천**: Majesty wood/iron 남성용 vs 여성용 SKU 분리

### 11. Honma iron sub-model spread **424%**
- Beres 1,415K / TourWorld 270K
- **추천**: Honma Beres (5스타) 별도 SKU. 시세가 5배

### 12. Odyssey putter sub-model spread **420%**
- AiOne 260K / TripleTrack 145K / 2Ball/StrokeLab 85K / WhiteHot 68K

### 13. TaylorMade wood_other sex spread **420%**
- Women 260K / Men 50K (특이)
- Men에 옛 모델/연습용이 많이 들어간 듯. 분리 필요

### 14. XXIO driver sub-model spread **413%**
- XXIO13 385K / XXIO12 320K / MP100 220K / XXIO11 220K / XXIO10 217K
- **추천**: XXIO13/12 신세대 vs XXIO11/10 구세대 분리

### 15. Srixon wedge shaft spread **381%**
- LightSteel 337K / NSPro 70K

### 16. Honma fairway_wood condition spread **380%**
- New 369K / Used 77K

### 17. TaylorMade driver sub-model spread **378%**
- Qi35 428K / Stealth2 330K / Qi10 310K / SIM2 288K / Stealth 205K
- **추천**: Stealth (1세대) ≠ Stealth2 ≠ Qi10 ≠ Qi35 분리

### 18. Mizuno iron shaft spread **377%**
- Graphite 310K / Steel 65K

### 19. Titleist iron shaft spread **362%**
- Graphite 600K / Steel 373K / NSPro 370K / LightSteel 130K

### 20. Titleist putter condition spread **338%**
- New 1,350K / Used 308K

## 핵심 narrow split 권장 (즉시 fix 후보)

### Priority A — sub-model 분리 (가격 spread 400%+)
1. **TaylorMade driver**: Qi35 / Qi10 / Stealth2 / Stealth / SIM2 / SIM / R-series / Burner — 8개로 split
2. **Ping iron**: G430 / G425 / G410 / G400 / i230 / i500 — 6개
3. **Titleist iron**: T100 / T200 / T300 / AP1 / AP2 / AP3 — 6개
4. **Titleist driver**: GT2 / GT3 / TSR2 / TSR3 / TSi2 / TSi3 / TS2 / TS3 — 8개
5. **Srixon iron**: ZX5 / ZX7 / Z-series — 3개
6. **Honma iron**: Beres / TourWorld 별도 (5배 차이)
7. **XXIO driver**: XXIO 11~13 신세대 / XXIO 8~10 구세대 분리
8. **Callaway iron**: Rogue / Apex / Paradym / XR / BigBertha — 5개
9. **Callaway fairway_wood**: Epic / Rogue / Paradym / XR / BigBertha — 5개
10. **Odyssey putter**: AiOne / WhiteHot / 2Ball / Versa / TripleTrack — 5개

### Priority B — shaft 분리 (iron/wedge에서 큰 영향)
- **Majesty iron**: Graphite 800K vs LightSteel 97K (8배) → variant 분리
- **Titleist iron**: Graphite 600K vs LightSteel 130K (5배)
- **Mizuno iron**: Graphite 310K vs Steel 65K (5배)
- 일반화: iron/wedge 카테고리에 shaft variant 필수

### Priority C — sex 분리 (특정 brand)
- **Majesty fairway_wood**: Men 840K vs Women 150K
- **XXIO driver**: Women 320K vs Men 110K (특이 — Women 신상이 비쌈)
- **Majesty wood_other**: Women 650K vs Men 220K
- 일본 brand (Majesty/XXIO/Honma) 여성 라인업 가격 ↗

### Priority D — condition 분리
- **Honma wood/fw/iron/wedge**: New 4-5배 ↗ → 신상/중고 시세 별도
- **Titleist putter**: New 1.35M vs Used 308K (4배)
- **TaylorMade driver**: New 500K vs Used 150K (3배)

## 사용감 keyword 누락 점검

추출 못 잡힌 매물 8,110건 (76%). 매물 title이 condition 명시 안 하는 케이스 다수.

매물 title sample 보면:
- "골프 핑G440k 드라이버 10.5도 (벤투스블루플러스6X)" → condition 명시 X (그러나 가격 750K → New 추정)
- "정리]캘러웨이 벤투스 그린 중고 드라이버 샤프트 5S 남자 골프채" → "정리]" prefix, "중고" 키워드

**추가 keyword 후보 (다음 cycle)**:
- "정리]" prefix = 정리 매물 (가격 ↓ 경향)
- "박살" / "수리" / "헤드만" / "샤프트만" = 부품 매물 (가격 별도 카테고리)
- "피팅" / "리프팅" = 커스텀 가격 ↑
- 가격 자체로 band 추정 (description 미사용 시) — 50K 미만은 새것이라도 단품/액세서리

## 다음 단계

1. **CATALOG split** — 위 Priority A의 sub-model 별 SKU 추가 (먼저 TaylorMade driver / Ping iron / Titleist iron 부터)
2. **Variant column** — iron/wedge SKU에 shaft variant (스틸/그라파이트) 가격 분리
3. **condition column** — Honma/Majesty 등 일본 brand에 신/중고 가격 분리 (또는 SKU 자체 분리)
4. **여성 라인업** — Majesty/XXIO/Honma 여성용 별도 SKU
5. **본문 description 활용** — title-only 24% 커버 한계. Phase 2에서 detail.description 까지 보면 더 잡힘

## 산출물

- 스크립트: `scripts/wave760-golf-narrow-deep-sweep.ts`
- JSON: `docs/AUDIT_LOG/wave760-golf-narrow-1779581576103.json` (140KB)
- 본 decision: `docs/DECISIONS/2026-05-24-wave760-golf-narrow-split.md`
