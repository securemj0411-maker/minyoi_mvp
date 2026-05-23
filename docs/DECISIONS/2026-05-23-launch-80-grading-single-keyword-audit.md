# launch-80 — 의류/신발 grading: single-keyword false positive audit + 통합 fix

## 사용자 지시

> "우리 D급말고 우리 분류체계에 이런식으로 그냥 한단어로 완전 잘못 분류되는?? 그런거 의심 후보있음?? 의류나 신발 중에서??"

launch-79 의 빈티지/색감 false positive 발견 후 — 다른 키워드도 같은 패턴 있는지 체계적 sweep.

## Audit 방법

1. DB sweep: D/C tier 매물 중 `evidence.positive` + `evidence.negative` 합쳐서 1개뿐인 매물 정확히 count.
2. 키워드 별 분포 정리 → risky 순위.
3. Sample 5건 직접 description 확인 → 진짜 신호 vs false positive 판정.

## 발견 — 진짜 single-signal 매물 분포 (positive + negative 합 = 1)

### 의류
| tier | sole signal | n | 판정 |
|---|---|---|---|
| D | pos:**빈티지** | 192 | launch-79 부분 fix 됨 (색감 묘사만). 단독 매칭은 후속 |
| D | pos:**구제** | 18 | 진짜 빈티지/구제 의류 — 보존 |
| D | neg:색바램 | 8 | negation 작동 확인됨 (별 fix 없이도 8건 D 분류 = 진짜 신호) |
| D | neg:구멍 | 7 | sample audit 필요 (단춧구멍/디자인) |
| D | pos:**아카이브** | 5 | launch-80 마스킹 확장 적용 |
| D | neg:변색 | 5 | 진짜 신호로 보임 |
| D | pos:vintage | 5 | launch-80 마스킹 확장 적용 |
| C | neg:**늘어** | 5 | **4/5 false positive — fix 필수** |
| C | neg:X/10 | 58 | 정규식, false positive 적음 |
| C | neg:보풀 | 11 | 명확 |

### 신발
| tier | sole signal | n | 판정 |
|---|---|---|---|
| D | pos:**빈티지** | 151 | launch-79 부분 fix |
| D | neg:찢어짐 | 6 | sample audit 필요 (디스트로이드 디자인) |
| D | neg:터짐 | 5 | 진짜 신호로 보임 |
| D | neg:찢어진 | 4 | sample audit 필요 |
| D | neg:**접착** | 2 | **sample 확인 결과 진짜 신호 — 보존** |
| D | pos:**오래된** | 1 | launch-80 마스킹 확장 적용 |
| C | neg:마모 | 39 | 진짜 신호로 보임 (negation 작동) |
| C | neg:스크래치 | 32 | 진짜 신호 (negation 작동) |

### "보관만" 4건 D tier 의문 해결

`positive=["보관만"]` + `negative=["변색"]` 형태 — single positive 표시되지만 negative 동시 존재. damage=major 분기 통한 D. 진짜 매물 본문 (목 부분 변색 명시) 확인 — false positive 아님.

## 가장 큰 false positive — "늘어" sample 5건 audit

| pid | 본문 | 진짜 신호? |
|---|---|---|
| 404917522 | "보플 이염 **늘어남 없음** 공유가 입어서..." | ❌ negation 실패 |
| 402070134 | "하자 없습니다(**늘어남,헤짐 X**) 구성품" | ❌ list 끝 X 미처리 |
| 409252626 | "밴딩이있어**늘어나고** 바지채우는" | ⚠️ 디자인 묘사 (밴딩 신축) |
| 250299542 | "고무줄이 살짝 **늘어났는데**" | ✓ 진짜 |
| 270227917 | "대미지 **늘어남 등 없이** 깔끔" | ❌ list 끝 "등 없이" 미처리 |

**5건 중 3건이 negation 처리 실패**.

## 적용한 통합 fix (launch-80)

### 1. `text-sanitize.ts` — `maskVintageStyleDescriptions` 확장
```ts
const vintageWord = "(빈티지(한|스러운|의|풍|풍의|틱|틱한)?|vintage|아카이브|archive|오래된)";
const styleNoun = "(...|모델|디테일|소재|원단|라인|아이템|패턴|프린트|로고|마감|디자이너|...)";
const re = new RegExp(`${vintageWord}\\s*${styleNoun}`, "gi");
```
- launch-79 의 "빈티지+색상" 패턴을 영문 vintage / archive / 아카이브 / 오래된 까지 확장.
- styleNoun 도 "모델/디테일/소재/원단/라인" 등 의류·신발 reseller 용어 추가.

### 2. `clothing-axes.ts` + `shoe-axes.ts` — `matchesKeyword` negation 보강

```ts
const NEGATION_SUFFIXES = [..., "없이", ...];  // "없이" 추가
const LIST_NEG_TERMINATORS = [
  /^[\s가-힣A-Za-z]*\s*등\s*(없음|없습|...|X|x|x\.|X\.)/,   // "X 등 없"
  /^[\s가-힣A-Za-z]*\s*외(에|로)?\s*(없|깨끗|괜찮)/,         // "X 외에 깨끗"
  /^[\s가-힣A-Za-z,]*\s*(없음|없습|...|없는)\b/,             // "X, Y, Z 없음"
  /^[\s가-힣A-Za-z,]*\s*(X|x)(\b|\.|\)|,|\s|$)/,            // "(X,Y X)" list 끝
];
```

keyword 직후 20자 안에 list 끝 부정 패턴 있으면 negation. 의류/신발 양쪽 동일.

### 3. `clothing-axes.ts` D_MINOR — "늘어" → 정확한 어형

```ts
// before: ["보풀", "보푸라기", "먼지", "오염 있음", "오염있음", "늘어", "줄어든"]
// after:  ["보풀", "보푸라기", "먼지", "오염 있음", "오염있음", "늘어남", "늘어난", "늘어진", "늘어졌", "늘어났", "줄어든"]
```

substring "늘어" 한 글자가 "늘어선/늘어가는/늘어나면" 같은 무관 텍스트와 매칭되던 fragility 차단.

## 검증 — 10-case test (Node REPL)

```
✓ "보플 이염 늘어남 없음" → false
✓ "하자 없습니다(늘어남,헤짐 X)" → false   ← launch-80b 괄호 list X 처리
✓ "밴딩이있어늘어나고" → true (디자인 묘사, 시세 영향 적음)
✓ "고무줄이 살짝 늘어났는데" → true (진짜)
✓ "대미지 늘어남 등 없이 깔끔" → false   ← "등 없이" 처리
✓ "스크래치 등 없이 깨끗" → false
✓ "이염 외에 깨끗합니다" → false
✓ "박음질 안 터짐" → false (기존 "안" prefix)
✓ "굽 닳음 있어요" → true
✓ "사이즈는 32x32" + kw="터짐" → false (false positive 회피)
```

10/10 통과.

## 보존 (false positive 아님 확인)

- **"구제"** (의류 D 18건) — 일본 빈티지샵 유통 진짜 신호. 보존.
- **"접착"** (신발 D 2건) — sample 확인: "걸을때 접히는부분 **접착 벌어짐**" — 진짜 본드 분리. 보존.
- **"색바램/변색/황변"** — 진짜 색 빠짐 신호.
- **"마모/스크래치/먼지/보풀/긁힘"** — negation 이미 작동 (단독 매칭 = 진짜).

## 미해결 / 후속 wave 후보

- **"빈티지" 단독 매칭 D 매물 343개** (의류 192 + 신발 151) — launch-79 색감 패턴으로 일부만 잡힘. 나머지 "빈티지" 단독 단어 매물 sample audit 필요 — 진짜 빈티지 vs marketing copy 분리. 더 광범위한 sweep wave 필요.
- **"구멍/찢어짐/찢어진" 의류 9건** — 디스트로이드/데미지 디자인 가능. sample 100건 audit 후 정책 결정 (디자인 신호 marketing vocab list 추가).
- **신발 "찢어짐/찢어진" 10건** — 운동화 측면 갈라짐 진짜 하자 vs 디자인. sample 보고.
- **Wave 714 Stage 5 시세 query 통합** (launch-78 에서 추적 중) — `band-aware-median` tier-aware 화.

## reparse 영향 예상

- production deploy + 자연 reparse cron (1.6~1.9일):
  - **vintage style desc 30+ 매물** D → 정상 tier 복귀 (launch-79 fix 포함)
  - **"늘어" sole signal 5건 (의류 C)** 중 negation 매물 ~3건 → C → B 복귀
  - **list 끝 negation 영향** 의류·신발 전체 — 측정 ID 후속
- 진짜 신호 매물 (접착 벌어짐, 굽 닳음 등) — 변동 없음.

## 관련 파일

- [src/lib/grading/text-sanitize.ts](../../src/lib/grading/text-sanitize.ts)
- [src/lib/grading/clothing-axes.ts](../../src/lib/grading/clothing-axes.ts)
- [src/lib/grading/shoe-axes.ts](../../src/lib/grading/shoe-axes.ts)
- launch-79 — vintage 색감 마스킹 (이 wave 의 직접 trigger)

Owner: caulee1227@gmail.com / 2026-05-23
