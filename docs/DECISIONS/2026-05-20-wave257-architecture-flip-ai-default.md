# Wave 257 (2026-05-20) — Architecture flip: AI default + regex whitelist fast-path

## 발단 (사용자 근원적 지적)

사용자 — Wave 256 patch 1 후 검증:
> "뭔말임?? 애초에 AI한테 넘기는거 아니였음?? 뭔 갑자기 regex검증이지?? 너말은 ai한테 넘기기전
> regex검증에 애매하게 통과해버려서 AI한테 넘기지 조차 않아서 반만 작동한다는건가??;;
> 그럼 우린 진짜 이런 정규식이면 100% 이런 의미다 이런 단어 나 콜로케이션조합이면 100%이거다
> 확신이 없는 기출 변형들은?? 다 AI한테 해야되는거아닌가..??"

**정확한 architectural insight**. 내 Wave 256 frame 정반대로 설계되어 있었음.

## 기존 (Wave 141B + Wave 256) — 잘못된 구조

```
text → regex → confident conditionClass ("normal"/"flawed"/etc) 박음
              → 일부 trigger 만족 시 AI escalation
              → 대부분 regex 결과 그대로 신뢰
```

**문제**: regex 가 "기스 진심 없" 같은 변형 못 잡으면 → AI 안 거치고 confident normal 박힘.
사용자가 직접 검증 안 했으면 발견 못 함. whack-a-mole 영원.

## 새 (Wave 257) — 올바른 구조

```
text → fast-path whitelist (6 case, 셀러 명시 명백) 통과 시 → regex 결과 신뢰
     → 그 외 모든 자연어 description → AI default 호출
```

**핵심**: regex 자신감 = whitelist 만. 그 외 자연어 → AI 가 결정.

## 6 fast-path whitelist (AI skip 정당 case)

| # | 조건 | reason 식별자 | 신뢰 근거 |
|---|---|---|---|
| 1 | `bunjangLabelMapped !== null` | `bunjang_label_explicit` | 셀러 직접 선택 (NEW/DAMAGED/etc) |
| 2 | "박스 미개봉" + battery measurement 없음 | `explicit_unopened_no_measurement` | Wave 203 — 객관적 모순 없음 |
| 3 | "공식 리퍼" / "Apple Refurbished" | `explicit_factory_refurbished` | Wave 205 — 정상 작동 명시 |
| 4 | strong flawed note (display_defect/water_damage/buying_post/etc) | `strong_flawed_note_regex_confident` | regex strict + negation 통과 |
| 5 | battery 95%+ 또는 <85% | `objective_battery_signal` | Wave 209 — 자연어보다 강함 |
| 6 | description < 20자 | `description_too_short` | AI 호출 비용 낭비 차단 |

위 6 case 만 AI skip. 그 외 모든 매물 → **AI default 호출**.

## 비용 추정 (실측 기반)

baseline:
- 일 detail parse: ~8,000건 (mvp_listing_parsed 24h 평균)
- whitelist 통과 추정: ~50-60% (cumulative)
  - bunjang label: ~37% (Wave 217 측정)
  - 박스 미개봉 명시: ~5%
  - 공식 리퍼: ~1%
  - strong flawed note: ~10%
  - 객관 battery: ~15%
  - 짧은 desc: ~2%

→ AI default 호출: ~3,500-5,000/day (40-50% 매물)

gpt-4o-mini (input 800 / output 50 tok):
- 5,000 × 30day = 150,000 calls/월
- input: 120M tok × $0.15/M = **$18**
- output: 7.5M tok × $0.60/M = **$4.5**
- cache hit ~50% (description hash 기준 dedup) → 실비용 **~$11-15/월**
- 비-cache scenario: **~$22/월**

→ 사용자 명시 "$24 매력" 범위 내.

## 운영자 추적 (parsedJson)

매 detail parse 시 박힘:
- AI skip 경우: `ai_skipped: true`, `ai_skipped_reasons: [...]` (6 fast-path 사유)
- AI default 호출 경우: `ai_default_invoked: true`, `ai_default_class: "..."`, `ai_default_reason: "whitelist_miss"`
- AI fail 경우: `ai_default_invoked: true`, `ai_default_failed: true` (network/budget/rate-limit)

SQL 1주 후 측정:
```sql
-- whitelist 통과 비율
SELECT 
  COUNT(*) FILTER (WHERE parsed_json ? 'ai_skipped') AS skipped,
  COUNT(*) FILTER (WHERE parsed_json ? 'ai_default_invoked') AS invoked,
  COUNT(*) FILTER (WHERE parsed_json->>'ai_default_failed' = 'true') AS failed
FROM mvp_listing_parsed
WHERE updated_at >= NOW() - INTERVAL '24 hours';

-- fast-path 사유 분포
SELECT 
  jsonb_array_elements_text(parsed_json->'ai_skipped_reasons') AS reason,
  COUNT(*) AS hits
FROM mvp_listing_parsed
WHERE updated_at >= NOW() - INTERVAL '24 hours' AND parsed_json ? 'ai_skipped_reasons'
GROUP BY reason
ORDER BY hits DESC;
```

## tests/wave257-ai-default-whitelist-fastpath.test.ts

**26 tests pass**:
- Fast-path 1: bunjang label (3 cases)
- Fast-path 2: 박스 미개봉 + measurement (3 cases — 모순 차단 검증)
- Fast-path 3: 공식 리퍼 (2 cases)
- Fast-path 4: strong flawed note (4 cases — cosmetic_wear 같은 weak signal AI default 검증)
- Fast-path 5: 객관 battery (3 cases — 모호 zone 90% AI default)
- Fast-path 6: 짧은 desc (2 cases)
- 사용자 검증 시나리오 (5 cases):
  - pid 405343339 → AI default ✓
  - "기스 진심 없습니다" → AI default ✓
  - "떨어뜨려서 충격받은적 전혀없습니다" → AI default ✓
  - "공식 리퍼 미개봉" → fast-path ✓
  - bunjang NEW + 자연어 → fast-path ✓
- 비용 시나리오 (4 cases — sanity check)

## 회귀
- `npx next build` ✅ pass
- `test:core` **832 pass / 11 fail** (pre-existing /me UI baseline, 0 regression)

## 폐기 정책

Wave 141B (line 1750 기존 logic), Wave 256 (5 trigger 옵션 A+B+C+D+E) — 모두 폐기.
새 단일 logic: 6 fast-path whitelist + AI default.

기존 Wave 256 patch 1 의 한국어 negation regex 확장 — Wave 257 에서는 직접 사용 안 함 (regex confidence 자체 폐기). 그러나 `conditionFromText` 내부의 negation 처리는 그대로 유지 (notes-level decision).

## lesson learned

내가 wave 256 박을 때 "regex 가 잡으면 confident, 못 잡으면 AI" 라는 잘못된 mental model.
사용자 의도 = "regex 가 100% 확신 못 하면 무조건 AI" 정반대.

→ **architecture flip 적용**. 미래 wave 마다 user 의 mental model 우선 확인 (frame 박기 전).

## 미완 (사용자 결정 대기)

1. Vercel deploy 발현 확인 (~10분)
2. 사용자 매물 (pid 405343339) re-parse 검증 — `ai_default_invoked: true` 박혔는지
3. 1주 실측:
   - 일 AI 호출 수 (목표: 3,500-5,000)
   - whitelist 통과 비율
   - 실제 비용 (gpt-4o-mini token usage)
   - false positive / false negative (사용자 검증)
4. UI reasoning 노출 wave (사용자 misperception 차단 — 별도)
