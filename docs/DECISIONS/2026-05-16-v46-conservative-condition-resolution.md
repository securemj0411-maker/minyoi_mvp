# 2026-05-16 v46 — Condition class conservative resolution policy

## 사용자 정책

> "메타데이터를 보내도 상세설명에 자기가 더 등급을 낮추는 말을 하면 그거 우선.
> 메타데이터가 사용감 없음인데 상세설명에 액정깨짐 이런거면 그게 우선.
> 사용감 많음인데 상태는 좋다 이런식으로 표현했을 때는 보수적으로 등급 낮추기."

**핵심**: metadata 와 description 둘 다 신호 있으면 **낮은 등급 (worse) 선택**. False positive 양방향 차단.

## 이전 정책 (#122 Wave 140) — 문제

```ts
const finalConditionClass = bunjangOverride ?? extractConditionClass(conditionNotes);
```

→ metadata 있으면 **무조건 강제 override**. description 신호 다 무시.

### 양방향 false positive

| meta | description | 기존 결과 | 사용자 의도 | 평가 |
|---|---|---|---|---|
| 사용감 없음 (clean) | 액정 깨짐 (flawed) | clean ❌ | flawed | 셀러 거짓말 못 잡음 |
| 사용감 많음 (worn) | "새상품" (셀러 인플레) | worn ✓ | worn | OK |
| 사용감 적음 (normal) | 기스 (worn) | normal ❌ | worn | description negative 무시 |

`extractConditionClass` 내부 ordering 도 문제:
- 기존: flawed > unopened > low_batt > clean > worn > normal
- `cosmetic_wear + good_condition` 동시 → clean (positive 우선)
- 사용자 의도: worn (negative 우선)
- pid 352131281 케이스 정확히 이 mismatch

## v46 변경

### 1. `extractConditionClass` ordering — negative 우선

```
flawed > low_batt > worn > unopened > clean > normal
```

- flawed: 강한 negative (액정 깨짐 등) — 항상 우선
- low_batt: special (가격 modifier — ordering 밖)
- **worn (cosmetic_wear): positive 신호 있어도 우선** — 셀러가 명시한 negative 신뢰
- unopened (new_or_open_box): positive 중 가장 강한
- clean (CLEAN_NOTES): 그 외 긍정
- normal: 무신호 default

### 2. `resolveConditionClass` — metadata + description 결합

```ts
function resolveConditionClass(fromMeta, fromNotes) {
  if (!fromMeta) return fromNotes;
  if (fromMeta === "low_batt" || fromNotes === "low_batt") return "low_batt";
  if (fromNotes === "normal") return fromMeta;  // description 무신호 → meta 신뢰 (#122 효과)
  return CONDITION_RANK[fromMeta] <= CONDITION_RANK[fromNotes] ? fromMeta : fromNotes;
}
```

CONDITION_RANK (낮을수록 낮은 등급):
- flawed: 0
- worn: 1
- normal: 2
- clean: 3
- unopened: 4

### 3. PARSER_VERSION v45 → v46

reparse-listings/route.ts CURRENT_PARSER_VERSION 도 v46.

## 매트릭스 검증

| meta | desc | 결과 | 사용자 의도 |
|---|---|---|---|
| 사용감 없음 (clean) | "액정 깨짐" (flawed) | flawed | ✓ |
| 사용감 없음 (clean) | 무신호 (normal) | clean (meta) | ✓ |
| 사용감 적음 (normal) | "기스" (worn) | worn | ✓ |
| 사용감 많음 (worn) | "새상품" (unopened) | worn (meta) | ✓ |
| 새상품 (unopened) | "S급+기스" (worn) | worn | ✓ |
| 새상품 (unopened) | 무신호 | unopened (meta) | ✓ |
| 미개봉 (unopened) | "박스 미개봉" (unopened) | unopened | ✓ |
| NULL | "S급+기스" | worn (v46 신규) | ✓ |
| NULL | "박스 미개봉" | unopened | ✓ |
| NULL | "배터리 낮음" + flawed | low_batt (special) | ✓ |

## 검증 결과 (24건 미해결 매물 reparse)

### 핵심 win

- **pid 352131281** (id 112): v45 clean → **v46 worn**.
  - description: "**S급** + 배터리 93% + **찍힘 하자 전혀없고**" + (사용자 사진 보고) "**측면 미세 점 까짐**"
  - conditionNotes: `[good_condition, cosmetic_wear]`
  - v45: clean (positive 우선) — AI 영역으로 추정했음
  - v46: worn (negative 우선) — **conservative ordering 으로 자동 fix**. AI 호출 불필요.

### 추가 worn 정정

- pid 406614375 (id 93): unopened (new_or_open_box + cosmetic_wear) → worn
- pid 402009410 (id 101): clean (good_condition + cosmetic_wear) → worn

### 변경 없음 / 정확 유지

- pid 334403685/334814973/403851792 (mint cases): v45 → clean (v46 동일)
- pid 377887597/389833231/398116411 등 worn 매물: 동일

### 미해결 (별도 fix)

- **pid 403616114** (id 124): display_defect → flawed. 사용자 의도 "미세 기스 거의 clean". display_defect regex 너무 aggressive — 별도 fix 필요.

## Trade-offs

1. **conservative ordering 으로 positive 신호 일부 lose**:
   - 셀러가 "박스 미개봉" + "약간 기스" 동시 적은 매물 → 기존 unopened, 새 worn
   - 모순 신호 → 사용자 정책 = worn (보수적). 정확.
2. **시세 sample 영향**:
   - 기존 unopened/clean 매물 일부 worn 으로 downgrade → 번개 worn pool 시세 약간 낮춤
   - 사용자 의도와 일치 (정확한 sample 분리)
3. **PARSER_VERSION v46 bump 시 옛 21K 매물 stale**:
   - 자동 cron reparse 없음 (확인됨)
   - mass reparse 또는 자연 누적 — 별도 결정

## 마킹

- pid 352131281 (id 112) — v46 conservative 자동 fix
- pid 406614375 (id 93) — 이전 batch 보류 풀림

## Test

- 258/258 pass
- 옛 expectation 2건 변경 (clean→worn for "good_condition+cosmetic_wear", unopened→low_batt for "new_or_open_box+low_battery_health")
