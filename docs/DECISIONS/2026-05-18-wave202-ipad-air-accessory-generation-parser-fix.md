# Wave 202 — iPad generation parser fix (액세서리 "N세대" 노이즈 차단)

## 사용자 보고

> "지금 검토 중인 매물 ... 아이패드 에어4 64GB 스페이스 그레이
> comparable_key: ipad|ipad_air|2_gen|a8x|10_9in|64gb|wifi
> 시세 ₩506,000 (iPad Air 5 매물 2건 기준)
> 이거 왜 이러냐??"

## 원인

`parseTabletGeneration` (src/lib/option-parser.ts line 594~) 가:
```ts
const genWithMarker = lower.match(/(\d)\s*세대/);
if (genWithMarker?.[1]) return Number(genWithMarker[1]);
```

→ **model 분기 전에** "X세대" 패턴 우선 매칭.

매물명 "아이패드 에어**4** + 애플펜슬 **2**세대" → "2세대" 매칭 → generation **2** 박힘 → comparable_key `2_gen|a8x` (iPad Air 2의 chip) 잘못.

**영향 범위**: DB 조회 결과 **64건의 매물** (`comparable_key LIKE 'ipad|ipad_air|2_gen|%'` AND 이름에 "에어4/에어5" 포함) 잘못 박힘. iPad Air 4, 5 매물 다수.

부수 효과:
- 시세 산출 시 iPad Air 2 (2014, a8x, 9.7") 시세와 비교됨
- iPad Air 4/5 (2020/2022) 매물의 실제 시세보다 낮게 표시
- 사용자 화면에 잘못된 시세 (예: ₩506K) — Air 4 실제 시세 (약 30~40만대) 와 다름

## fix

### 1. `stripAccessoryGenerationMarker` 신설

```ts
function stripAccessoryGenerationMarker(text: string): string {
  return text.replace(
    /(?:애플\s*펜슬|애플펜슬|팬슬|애펜|apple\s*pencil|pencil|매직\s*키보드|매직키보드|magic\s*keyboard|폴리오|smart\s*folio)\s*\d+\s*세대?/gi,
    "",
  );
}
```

→ "애플펜슬 2세대" / "매직 키보드 N세대" / "smart folio" 등 액세서리 generation 표기 제거.

### 2. `parseTabletGeneration` 흐름 재배치

이전:
```
[X세대 marker 우선] → [model 분기]
```

새 흐름:
```
1. 액세서리 generation 제거 (cleaned text)
2. model 분기 (정확한 ipad_air/pro/mini 매칭) 우선
3. fallback: X세대 marker (cleaned text 기준)
```

→ 정확한 모델 매칭이 모호한 marker 보다 우선.

### 3. PARSER_VERSION bump `v48` → `v49`

cron tick / market-worker / housekeeper 가 `parsed.parser_version` 다르면 재처리 → 64건 잘못 박힌 매물 다음 사이클에 자동 재계산.

## Regression tests (`tests/wave202-ipad-air-accessory-generation-fix.test.ts`)

9개 test 케이스:
- iPad Air 4 + 애플펜슬 액세서리 (3건)
- iPad Air 5 + 애플펜슬 액세서리 (2건)
- 정상 (액세서리 없음) — Air 4/5 (회귀 검증) (3건)
- 다른 액세서리 (매직 키보드) (1건)

전 케이스 `4_gen|a14` / `5_gen|m1` 정확 매칭 확인.

### iPad Air 2 회귀 검증

```ts
it("진짜 iPad Air 2 → 2_gen|a8x", () => {
  const r = parse("아이패드 에어2 스페이스그레이 64기가/와이파이모델");
  assert.match(r.comparableKey ?? "", /\|2_gen\|a8x\|/);
});
```

→ "에어2" 진짜 매물은 그대로 2_gen 매칭 (회귀 없음).

## 비파괴 검토

- parser 함수 로직 변경 (model 분기 우선) — 기존 model 분기에서 매칭되던 매물은 그대로
- "X세대" fallback 유지 — 다른 카테고리 영향 없음 (iPad Pro / Mini 도 같은 흐름)
- 액세서리 regex 제거 — 액세서리 명시 없는 매물 영향 0
- DB 변경 X — parser_version bump 후 cron이 자동 재처리

## 영향받는 사이클

- next tick-pipeline run → 잘못 박힌 매물 재처리
- 그 후 candidate_pool 도 새 comparable_key로 갱신
- market_price_daily 도 정확한 그룹으로 매칭됨

## Test

`npm run test:core`: **446/447 pass** (1 fail은 다른 worktree pickByConditionFallback 변경 — 본 wave 무관).

## Follow-up

1. **다른 카테고리 동일 버그 검증** — smartphone / smartwatch 등 "X세대" marker 사용하는 곳에 같은 액세서리 noise risk
2. **즉시 강제 재처리** (optional) — `UPDATE mvp_listing_parsed SET parser_version = NULL WHERE comparable_key LIKE 'ipad|ipad_air|2_gen|%' AND name LIKE '에어4...'` (cron tick 보다 즉시)
3. **시세 재계산** — 풀 진입 시 expected_profit 재산출 (영향 큰 매물부터)

## Linked

- Wave 130 (condition별 시세) — 이번 버그와 관련된 background
- Wave 158 (Bunjang enum mapping)
