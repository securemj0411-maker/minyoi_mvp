# launch-79 — "빈티지한 그린" 색감 묘사가 wear=vintage 로 잘못 매칭되어 D tier 강제 분류

## 사용자 보고

> "RRL 필드치노(gas station green) ... 이 매물 왜 D급으로 분류된거야?? 이유 뭐임?"

매물 설명 (full description_preview, len=158):
> "RRL gas station green 색상 필드치노입니다. **빈티지한 그린계열 색상** 필드치노로 코디하기 쉬운 색감입니다. 핏은 기존 더블알엘 필드치노와 동일합니다.
>
> 워싱감 외 사용감 없습니다.
> 표기사이즈 32x32 …"

## DB evidence (pid 7000939590067)

| 필드 | 값 |
|---|---|
| condition_tier | **D** |
| condition_class | clean |
| condition_confidence | 0.7 |
| evidence.reason | `wear=vintage (~0.61x — 의류 빈티지 = 낡음)` |
| evidence.positive | **["빈티지"]** (단 1개) |
| evidence.axes.wear | vintage |

## 원인

`src/lib/grading/clothing-axes.ts:43`:
```ts
const A_VINTAGE = ["빈티지", "vintage", "archive", "아카이브"];
```

매물 첫 문장의 **"빈티지한"** 어미 형용사가 색감/스타일 묘사인데도 `"빈티지"` substring 매칭 → `wear=vintage` 라벨 → `clothing-condition.ts:113` 의 D tier 직행 분기:
```ts
if (axes.wear === "vintage") return { tier: "D", reason: "wear=vintage (~0.61x — 의류 빈티지 = 낡음)" };
```

의류 reseller들은 "빈티지 그린", "빈티지룩", "빈티지 무드", "빈티지한 색감/분위기/스타일/디자인" 같은 표현을 **색감/스타일 묘사**로 매우 자주 사용. 정작 의류 자체의 낡음/archive 와 무관한 marketing copy.

## 영향 범위 (DB sweep — 2026-05-23)

```sql
SELECT
  COUNT(*) FILTER (WHERE lp.condition_tier = 'D') AS d_total,
  COUNT(*) FILTER (... positive = ['빈티지'] only) AS d_with_only_vintage_signal,
  COUNT(*) FILTER (... regex 빈티지 + 색상/스타일 명사) AS d_with_vintage_color_pattern
```

| Metric | Count |
|---|---|
| D tier 전체 | 613 |
| **D 중에 positive 신호가 "빈티지" 1개뿐** | **401 (65%)** |
| D 중에 빈티지+색상/스타일 동반 패턴 | 30 |

D tier 매물 **65% 가 "빈티지" 단어 단독 매칭으로 D 분류** — 시스템적 false positive 큰 가능성.

## fix — sanitize 단계에 vintage 색감/스타일 묘사 마스킹

`src/lib/grading/text-sanitize.ts`:
```ts
function maskVintageStyleDescriptions(text: string): string {
  const styleNoun = "(그린|블루|네이비|카키|브라운|올리브|머스타드|버건디|레드|핑크|옐로우|와인|민트|코랄|아이보리|크림|차콜|그레이|베이지|블랙|화이트|퍼플|오렌지|색|색상|색감|컬러|톤|분위기|무드|감성|스타일|디자인|룩|핏|실루엣|미감|감각|매력|느낌)";
  const vintageWord = "빈티지(한|스러운|의|풍|풍의|틱|틱한)?";
  const re = new RegExp(`${vintageWord}\\s*${styleNoun}`, "g");
  return text.replace(re, "(style)");
}
```

pipeline 에 추가:
```ts
text = maskFalseDurabilityClaims(text);
text = maskVintageStyleDescriptions(text);  // ← 신규
text = stripMarketingBoilerplate(text);
```

### 마스킹 검증 (해당 매물 input):

```
INPUT:  "...빈티지한 그린계열 색상 필드치노로 코디하기 쉬운 색감입니다... 워싱감 외 사용감 없습니다."
AFTER:  "...(style)계열 색상 필드치노로 코디하기 쉬운 색감입니다... 워싱감 외 사용감 없습니다."
includes('빈티지') → false ✓
includes('사용감 없') → true ✓ (worn_3to5 매칭 가능)
```

## reparse 후 예상 결과

매물 pid 7000939590067:
- 이전: `wear=vintage` → **D tier**
- fix 후: 색감 묘사 마스킹 → `wear=worn_3to5` ("사용감 없" 매칭) → **A tier (strong_axes=1)** 예상.

D tier 중 vintage 색감 동반 패턴 30개 — production deploy + 자연 reparse cron 후 적절한 tier 복귀 기대.

## 안전 가드

- "빈티지 의류", "빈티지 매물", "빈티지 빈티지" 같은 진짜 wear=vintage 신호는 마스킹 X (색상/스타일 명사 동반만 차단).
- 정규식은 어미 "한 / 스러운 / 의 / 풍 / 풍의 / 틱 / 틱한" 한정 — "빈티지 거의" 같은 비-style 표현은 그대로 통과.

## 미해결 / 후속 wave 후보

- **D 중 "빈티지" 단독 401건** — 색상 패턴 매칭 30건 외 나머지 371건. 색상 동반 X 이지만 "빈티지" 단독 매칭으로 분류된 매물. 더 광범위한 sweep 필요 (e.g., wear=vintage 매물 sample 100건 audit → 진짜 빈티지 의류 비율).
- **A_VINTAGE 자체 보수화 검토** — "빈티지" 단독 매칭은 confidence ↓ + B fallback, "구제" 같은 명확 신호와 동급 취급 차단 — 별도 wave.
- **신발 axis 도 동일 점검 필요** — `shoe-axes.ts` 의 vintage 처리 (volume_vintage cluster 와 wear=vintage 혼동) 동일 false positive 가능.

## 테스트

- [x] Regex 패턴 unit test (Node REPL): "빈티지한 그린계열 색상" → "(style)계열 색상" ✓
- [x] "사용감 없" 보존 ✓
- [x] TS 컴파일 통과 — `text-sanitize.ts` / `clothing-axes.ts` 에러 0
- [ ] Production deploy + 24h reparse cron 후 pid 7000939590067 tier=A 복귀 확인 (후속)

Owner: caulee1227@gmail.com / 2026-05-23
