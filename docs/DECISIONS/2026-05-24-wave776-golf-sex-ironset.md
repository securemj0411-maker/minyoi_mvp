# Wave 776 — sport_golf sex + iron_set 추출 (Wave 760 sweep 데이터 활용 cont.)

**날짜**: 2026-05-24
**Wave**: 776 (사용자 #12: "너가 그렇게 해야된다 싶으면 다해 정밀한 가격측정")

## Wave 760 sweep 추가 axis 활용

### Sex (5.6배 차이!)
sweep 발견: Majesty wood Men ₩840K vs Women ₩150K (5.6배 차이).
같은 SKU 안 sex 안 분리하면 시세 부조리.

### Iron set 구성
풀세트 (5번~PW, ~9 클럽) vs 하프세트 (7번~PW, ~6 클럽) vs 스타터 (4-5 클럽).
시세 차이 큼.

## Fix (option-parser.ts)

### Sex 추출
```typescript
if (/여성용|레이디|lady|women|woman|wmn/i.test(text)) sex = "women";
else if (/남성용|men's|men\b/i.test(text)) sex = "men";
```

### Iron set 추출
```typescript
if (/iron|아이언/i.test(text)) {
  if (/5번?\s*[-~]\s*pw|풀세트/i.test(text)) iron_set = "full";
  else if (/7번?\s*[-~]\s*pw|하프세트/i.test(text)) iron_set = "half";
  else if (/스타터|starter|입문/i.test(text)) iron_set = "starter";
}
```

### comparable_key 확장
`sport_golf|<sku>|loft_<n>|shaft_<type>|sex_<gender>|set_<type>`

### parsedJson
- `golf_sex`: "men" / "women"
- `golf_iron_set`: "full" / "half" / "starter"

## PARSER_VERSION v59 → v60 (drift gate reparse)

## 검증 (7/7 pass)
- Majesty wood 여성용 → sex=women ✓
- XXIO 12 lady → sex=women ✓
- Iron 5-PW 풀세트 → set=full ✓
- Iron 7~PW 하프세트 → set=half ✓
- Iron 스타터 → set=starter ✓

## 누적 sport_golf axis (Wave 774-776)
| Axis | Wave | 효과 |
|---|---|---|
| loft (도/°) | 774 | TSR2 9도 vs 11도 52% 차이 |
| shaft (TourAD/Ventus/Speeder 등) | 775 | Beres 10도 81K vs 10.5도+TourAD 690K 8.5배 |
| sex (men/women) | 776 | Majesty wood Men/Women 5.6배 |
| iron_set (full/half/starter) | 776 | 클럽 수 차이 |

## 미해결 (sweep 추가 데이터 가능)
- Generation (Beres NX/BB / G425/G430 / Stealth1/2 — catalog narrow split 부분 처리)
- Flex (R/S/X) — 시세 영향 작음
