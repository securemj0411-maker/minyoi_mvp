# Wave 885 Part 2b - AirPods Max routing 안전성 재검토 (사용자 우려 반영)

## 배경

사용자 코멘트:
> "이거 기존게 의미 있는 거 일수도 있는 1세대인가 2세대는 기본 아무것도 안 써도 라이트닝밖에 없던가 아무튼 그런 이유가 있을수도 있는데. 파괴적인거 막 한거 아니지...?? 로그 일단 작성도 하고"

= 기존 Lightning default 행동이 의도된 design 일수도 있다는 우려 + DB 파괴성 여부 확인.

## 안전성 점검 (1차)

**DB 변경**: 모두 비파괴적.
- `UPDATE mvp_raw_listings SET score_dirty = true` 만 실행.
- DELETE / DROP / status change ❌ — 아무것도 삭제 안 됨.
- 기존 mvp_listing_parsed / mvp_candidate_pool / mvp_raw_listings row 그대로.
- score_dirty=true 는 score worker 재처리 queue 마킹 — 비파괴, 단순 재계산 prime.

**Catalog 변경**: 신규 매물 routing 만 영향.
- 기존 매물은 drift gate reparse 가 돌기 전까진 그대로.
- reparse 시에도 parsed row 가 in-place update — DELETE/INSERT 없음.

## 사용자 우려 검증 (2차 — 실측)

사용자 우려 case 만들어 ruleMatch 돌려본 결과:

| Title | Wave 885 Part 2 직후 | 위험도 |
| --- | --- | --- |
| "에어팟 맥스" alone | airpods-max ✓ | OK (default 보존) |
| "에어팟 맥스 (1세대)" | airpods-max ✓ | OK |
| "에어팟 맥스 스카이블루" | airpods-max ✓ | OK (Lightning 전용 컬러) |
| "에어팟 맥스 2024년 1월 구매" | airpods-max-**usbc** ❌ | **위험** — Apple 9월까지 Lightning 판매 |
| "에어팟 맥스 스페이스그레이 2024년에 구매" | airpods-max-**usbc** ❌ | **위험** — 스페이스그레이 = Lightning 1세대 컬러 |
| "에어팟 맥스 실버 2024 새상품" | airpods-max-**usbc** ❌ | **위험** — 실버 = Lightning 1세대 컬러 |

**원인**: Part 2 직후 룰에서 "2024"/"2025"/"2026" year-only 토큰을 USB-C signal 로 박음.
But Apple 이 **2024년 9월까지 1세대 Lightning 판매** 했음 → "2024년 구매" 만으론 model year 판단 불가.

→ Lightning 1세대 + 2024년 구매 매물이 USB-C lane 으로 mis-routing.

## 수정 (Part 2b)

### `src/lib/catalog.ts`

1. **airpods-max mustNotContain** — year-only 토큰 (2024/2025/2026) 제거. "2024년형" 같은 **명시적 model year 패턴**만 차단.

```diff
- "2024", "2025", "2026",
+ "2024년형", "2025년형", "2024 모델", "2025 모델", "2024 신모델", "2025 신모델",
```

2. **airpods-max-usbc mustContain** — 동일하게 year-only 제거, model year 명시 토큰만 매칭.

3. **airpods-max-usbc mustNotContain** — 1세대 Lightning 전용 컬러 추가로 mis-routing 차단:

```diff
+ "스페이스그레이", "스페이스 그레이", "space gray", "space grey",
+ "스카이블루", "스카이 블루", "sky blue",
+ "1세대", "1 세대", "1st gen", "1st generation",
```

## 재검증

```
에어팟 맥스 → airpods-max ✓
에어팟맥스 새것 → airpods-max ✓
에어팟 맥스 (1세대) → airpods-max ✓
에어팟 맥스 스카이블루 → airpods-max ✓
에어팟 맥스 핑크 1세대 → airpods-max ✓
에어팟 맥스 그린 → airpods-max ✓
에어팟 맥스 2024년 1월 구매 → airpods-max ✓ (위험 case 안전화)
에어팟 맥스 스페이스그레이 2024년에 구매 → airpods-max ✓ (위험 case 안전화)
에어팟 맥스 실버 2024 새상품 → airpods-max ✓ (위험 case 안전화)
```

명확한 USB-C / 2세대 매물 routing 보존:
```
에어팟 맥스 스타라이트 → airpods-max-usbc ✓ (2024+ 전용 컬러)
에어팟맥스 미드나이트 새상품 → airpods-max-usbc ✓
에어팟 맥스 퍼플 USB-C → airpods-max-usbc ✓
에어팟 맥스2 미드나이트 2026 → airpods-max-usbc ✓
애플 에어팟맥스 2세대 c핀 → airpods-max-usbc ✓
에어팟 맥스 USB-C 2024년형 미드나이트 → airpods-max-usbc ✓
에어팟 맥스 스페이스 그레이 8핀 → airpods-max ✓ (Lightning 보존)
```

## 추가 regression test

`tests/wave885-broad-modelname-cleanup.test.ts` 에 3 신규 safety test:
- "기본 'AirPods Max' default routes to Lightning" — default 행동 보존 검증.
- "1세대 Lightning 전용 컬러 → Lightning lane" — 1세대 색 명시 시 mis-routing 차단.
- "year-only ('2024년 구매') 는 USB-C signal 안 됨" — 위험 case 안전화 검증.

11/11 tests pass.

## 결론

- **파괴 없음** — DB 변경 = score_dirty queue 마킹만. 데이터 보존.
- **사용자 우려 타당** — 1차 fix 의 year-only 토큰이 Lightning 1세대 + 2024년 매물 mis-routing 위험.
- **안전화 완료** — model year 명시 토큰 + 1세대 전용 컬러 차단으로 보정.

Default 행동 (에어팟 맥스 alone → Lightning 1세대) 은 **wave 885 part 2 직후도 보존** 되어 있었음 (사용자 우려한 부분은 OK 였음). 다만 year-only 토큰이 1세대 + 구매연도 매물 mis-routing 위험을 만들었기에 안전화 했음.

## What Not To Do

- year-only 토큰 (2024/2025/2026) 을 USB-C signal 로 박지 X — Apple 의 판매 이력 (2024년 9월까지 Lightning) 고려 시 구매연도와 model year 가 다를 수 있음.
- 1세대 Lightning default 행동 변경 X — "에어팟 맥스" alone = 의도된 fallback.
