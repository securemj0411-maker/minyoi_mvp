# Wave 137 — 신발 UK 사이즈 parser + 변형 모델 차단

> 2026-05-16. Wave 136 1시간 후 측정 결과 따라 parse_ready 78.5% → 90%+ 목표. LAUNCH_PLAN 12b/12c 적용.

---

## 발견 (Wave 136 1시간 후, 08:36 KST 측정)

**Wave 136 차단 효과 검증**:
- Wave 136 commit (22:36 UTC) **이후** parsed 신발 245건 중 collab 잘못 매칭 **0건** ✅
- Wave 136 commit **이전** parsed 신발 ~865건 중 47건 collab 박힘 (옛 매물 — 자연 expire 또는 reparse 결정)

**남은 issue (Wave 137 target)**:

1. **parse_ready 78.53%** (needs_review 21.5%). 가장 큰 모델별 needs_review:
   - 1460_cherry 46%
   - classic_mini 41%
   - classic_short 35%
   - 2976_chelsea 33%
   - gel_1130 33%
   - 1460_black 30%

2. **needs_review 매물 sample 분석 → 2개 패턴**:
   - 🔴 **UK 사이즈 (UK3, UK6, UK7, UK9)** — parser가 cm로 변환 안 함 → unknown_size
   - 🔴 **변형 모델** (울트라 미니, 플랫폼 미니, 파스칼 맥스, 트윈지퍼, 인페르노, 플로라 등) — 일반 narrow에 잘못 흡수

## Fix

### 1. `src/lib/parsers/wave92-fashion-mobility.ts` — UK 사이즈 변환

```typescript
// Wave 137: UK 사이즈 → mm 변환 (닥마식 기준)
// UK 3=220, 4=230, 5=240, 6=250, 7=260, 8=270, 9=280, 10=290, 11=300
const ukMatch = text.match(/(?:^|[^a-z0-9])uk\s*([3-9]|1[0-2])(?![\d.])/i);
if (ukMatch) {
  const uk = Number(ukMatch[1]);
  const UK_TO_MM = { 3:220, 4:230, 5:240, 6:250, 7:260, 8:270, 9:280, 10:290, 11:300, 12:310 };
  const mm = UK_TO_MM[uk];
  if (mm !== undefined && mm >= 230 && mm <= 309) return mm;
}
```

**범위 안전**:
- UK 3 = 220mm → 키즈 경계라 차단 (230~309만 통과)
- 부동소수점 (UK 7.5) 무시 (정확도 우선)
- "ADUK6" 같은 false positive 차단 (앞에 영문/숫자 없을 때만)

**기대 효과**: 닥마 매물의 UK 사이즈 표기 ~30% → cm 변환 성공 → variant_key 완성도 ↑.

### 2. `src/lib/generated/catalog-shoe-narrow-wave134.ts` — 변형 모델 차단

#### `shoe-ugg-classic-mini` mustNotContain 추가:
```typescript
"울트라 미니", "ultra mini", "울트라미니",
"플랫폼 미니", "platform mini", "플랫폼미니", "플랫폼",
"디스켓", "disquette", "디퍼", "dipper", "디스코",
"웨더하이브리드", "weather hybrid", "하이브리드",
"디퍼 레그워머", "레그워머", "legwarmer",
```

#### `shoe-ugg-classic-short` mustNotContain 추가:
```typescript
"웨더하이브리드", "weather hybrid",
"쇼트 ii", "short ii", "쇼트2", "short 2",
"플랫폼", "platform",
```

#### `shoe-drmartens-1460-black` mustNotContain 추가:
```typescript
"트윈지퍼", "twin zipper", "지퍼",
"쥬얼리", "jewel", "큐트",
"인페르노", "inferno", "플로라", "flora", "꽃",
"smooth", "스무스", "쿼드", "quad",
"vegan", "비건", "마돌리", "molly", "맥스",
"보이드", "void", "메가", "mega", "dmxl", "xl ", "엑스라지",
"코어", "core", "스튜디오", "studio",
```

#### `shoe-drmartens-1460-cherry` + `shoe-drmartens-2976-chelsea`: 동일 변형 차단 적용.

#### `shoe-nike-dunk-low-black-white` mustNotContain 추가:
```typescript
"잭팟", "jackpot", "말라카이트", "malachite",
"플럼", "plum", "라이트 스모크 그레이",
"sp", "스페셜 박스", "special box", "retro",
```

### 3. 신규 test — `tests/wave137-shoe-uk-size.test.ts`

10개 test case:
- UK 6/7/9/10 → mm 변환 정확
- UK 3 → 220mm → 키즈 차단
- UK 7.5 → null (부동소수점 무시)
- 기존 mm 패턴 호환성
- false positive 차단 ("ADUK6", "1UK7")
- 매물 title 다양한 패턴

## 검증

- TypeScript: 기존 dev cache + pipeline.ts:1270 외 무에러
- Tests: **187/187 pass** (10개 새 test)

## 영향 예측

| 지표 | Before (Wave 136) | After (Wave 137) |
|---|---|---|
| UK 사이즈 매물 unknown_size | ~30% (닥마) | <5% 예상 |
| classic_mini 변형 흡수 (parse_ready 59%) | 변형 매물 narrow 포함 | 변형 차단 |
| 1460_black 변형 흡수 | 트윈지퍼/인페르노/플로라 포함 | 차단 |
| narrow 시세 정확도 | 변형 가격 끌어올림 | 정확 |
| parse_ready 비율 | 78.5% | **85~90% 예상** |

## 옛 매물 처리 옵션 (사용자 결정)

47건 옛 collab 매물 (Wave 136 commit 이전 parsed):

| 옵션 | 방법 | 효과 | 위험 |
|---|---|---|---|
| A. 자연 expire | 1주 기다림 | 자동 정정 | 시세 정확도 1주간 부정확 |
| B. **즉시 reparse** | `mvp_listing_parsed` 47건 row DELETE → 다음 tick 재파싱 | 즉시 정정 (수 분) | row 삭제 destructive 살짝 |
| C. parser_version 강등 | 적용 안 됨 (코드에 runtime skip logic 없음) | — | — |

**추천: B**. content_hash 무효화는 row DELETE만 가능 (Explore agent 확인). 다음 tick에서 자동 reparse. wave134/136/137 catalog 적용된 새 결과 박힘.

## 다른 세션 알아볼 키 포인트

1. **Wave 137 (2026-05-16) 신발 UK 사이즈 + 변형 모델 차단**.
2. parser: `parseShoeSizeMm()` UK 사이즈 → mm 변환 추가 (닥마식 기준).
3. catalog: classic_mini, classic_short, 1460_black, 1460_cherry, 2976_chelsea, dunk_low_black_white 6 SKU에 변형 모델 차단.
4. **Wave 136 catalog 검증됨** — 22:36 UTC 이후 parsed 신발 245건 중 collab 매물 0건.
5. 옛 47건 reparse 결정 대기 (옵션 B 추천 — SQL row delete 후 자동 reparse).
6. test 187/187 pass (10개 새 UK 사이즈 test 포함).

## 다음 (사용자 결정)

1. 옵션 B reparse 진행 여부 (47건 row delete)
2. 1시간 후 측정 — Wave 137 효과 (UK 사이즈 잡힘 비율 + needs_review 감소율)
3. 가품 detection 강화 별도 wave (LAUNCH_PLAN §12c category-scoped negative)
