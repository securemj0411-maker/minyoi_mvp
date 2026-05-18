# Wave 209 — objective measurement 우선 (metadata worse-of 무시)

## 사용자 통찰 (재확인)

> "메타데이터는 신뢰도가 높지 않아서 ... 배터리 효율이나 사이클수가 압도적으로 새거면 달라야하지 않을까??"

## 진단 — Wave 203 만으로 부족

매물 pid 408845367 (사용자 코멘트 #159 재확인):
- description: "미개봉 + 배터리 97% + 풀박스"
- metadata: bunjang `LIGHTLY_USED` (사용감 적음) → `normal`
- Wave 203 fix 후 condition_notes: `[battery_high_health, full_set]` → extractConditionClass = `clean`
- `resolveConditionClass(normal, clean)` worse-of → **여전히 normal** ← 사용자 항의 그대로

→ Wave 203 가 description signal 까지는 맞췄지만 **worse-of 가 metadata 의 "사용감 적음" 우선해서 description clean 무시**.

## 두 가지 root cause

### 1. worse-of 가 객관적 신호 무시

`resolveConditionClass(metaNormal, notesClean)` → worse-of → normal. 사용자 정책 위반.

**fix**: `hasObjectiveCleanSignal` 가드 — `battery_high_health` 또는 `battery_perfect` 박힌 매물은 description 우선:
```ts
if (hasObjectiveCleanSignal && fromMeta !== "flawed" && CONDITION_RANK[fromNotes] >= CONDITION_RANK.clean) {
  return fromNotes; // 객관적 신호 우선
}
```

단 metadata "flawed" (DAMAGED) 는 안전 위해 예외 — 셀러 명시적 손상은 객관적 신호로도 override 안 함.

### 2. cosmetic_wear negation 미흡

description "사용감 적음" 셀러 명시적 부정인데도 line 1295 `/사용감|기스|.../` 매칭 → cosmetic_wear 박힘 → worn 분류 잘못.

**fix**: "사용감 적음/없음/거의 없음/미세" negation 보강:
```ts
const noUseFeeling = /사용감\s*(?:거의\s*)?(?:적음|적은|없음|없|매우\s*적|아주\s*적|덜|미세)/i.test(lower);
const hasUseFeeling = !noUseFeeling && /사용감/.test(lower);
const hasOtherWear = /기스|스크래치|찍힘|생활기스|흠집/.test(lower);
if (hasUseFeeling || hasOtherWear) add("cosmetic_wear", -0.1);
```

"사용감 적음" 단독 → cosmetic_wear 박지 X. "사용감 + 기스" 같이 → 박힘 OK.

## 효과 (사용자 매물 적용)

```
이전 (Wave 203 후):
  condition_notes: [battery_high_health, full_set]  ← Wave 203 fix 적용된 후 (cron tick 가정)
  notesClass: clean
  bunjangOverride: normal (LIGHTLY_USED)
  finalConditionClass: normal ← worse-of 잘못

Wave 209 후:
  condition_notes: [battery_high_health, full_set]
  notesClass: clean
  bunjangOverride: normal
  hasObjectiveCleanSignal: true (battery_high_health)
  finalConditionClass: clean ← 객관적 신호 우선 ✓
```

## PARSER_VERSION v53 → v54

cron tick 자동 재처리.

## test

`tests/wave209-objective-signal-overrides-metadata.test.ts` 10개 pass / 전체 545/545 pass.

## 비파괴

- objective signal 없는 매물 → 기존 worse-of 유지 (Wave 140 정책 보존)
- metadata flawed (DAMAGED) → 객관적 신호로 override 안 함 (false negative 차단)
- cosmetic_wear negation 만 보강 — 셀러 negative 명시 없는 매물 영향 X

## Linked

- Wave 140 (worse-of policy)
- Wave 203 (셀러 거짓 미개봉)
- Wave 204-208 (사용자 코멘트 fix 5개)
