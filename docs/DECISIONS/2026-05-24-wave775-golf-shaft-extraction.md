# Wave 775 — sport_golf shaft 추출 (Wave 760 sweep 데이터 활용)

**날짜**: 2026-05-24
**Wave**: 775 (사용자 #11 정당한 화)

## 사용자 화

"1만건 deep sweep 했는데 어떤거 분리해야될지 학습 안 한 거야? 나 골프몰라서 너한테 deep sweep 의뢰했잖아?"

Wave 760 sweep (10,628 매물) `byShaft / bySubModelLoft / bySex / byGeneration` 데이터 다 있는데, 18 SKU narrow split (sub-model 위주) 만 적용. 나머지 axis 미활용.

## Sweep 데이터 핵심

- Honma Beres 10도 ₩81K vs 10.5도 ₩690K (**8.5배 차이**)
- Shaft 의 시세 영향: TourAD/Speeder/Ventus/Diamana premium 1.5-2x
- Majesty wood Men 840K vs Women 150K (5.6배)

## Fix

### parser shaft 추출 (option-parser.ts)
- Premium: TourAD/Ventus/Speeder/Diamana/Fujikura/Atlas/TSP111
- 일반: Graphite/Steel/LightSteel (NS Pro/Dynamic Gold)

### loft 개선
- SKU id (`_driver`/`_wood`/`_hybrid`) 보고 driver context 인식
- text 에 "드라이버" 단어 없어도 추출

### comparable_key
- `sport_golf|titleist_tsr2_driver|loft_11|shaft_tsp111`
- 같은 SKU 안 loft + shaft 별 시세 분리

### parsedJson
- `golf_loft`: "9" / "10.5"
- `golf_shaft`: "TourAD" / "TSP111"

## PARSER_VERSION v58 → v59 (drift gate reparse)

## 검증 (7/7 pass)

| Test | loft | shaft |
|---|---|---|
| TSR2 11도 TSP111 | 11 | TSP111 |
| Beres 10도 카본 | 10 | Graphite |
| Beres 10.5도 TourAD | 10.5 | TourAD |
| PXG 0311 10.5 Ventus | 10.5 | Ventus |
| Stealth2 9도 Speeder | 9 | Speeder |
| Srixon ZX7 iron NS Pro | null | LightSteel |
| Callaway iron Dynamic Gold | null | Steel |

## 미해결 (sweep 데이터 추가 활용)
- Generation (Beres 신/구세대)
- Sex (Majesty Men 840K vs Women 150K = 5.6배)
- Flex (R/S/X)
- Iron loft set (5번~PW vs 7번~AW)
