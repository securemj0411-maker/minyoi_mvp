# Wave 760d — 게임/골프만 5-tier ConditionTier 추가 (전자기기는 7-tier 유지)

**날짜**: 2026-05-24
**Wave**: 760d (Wave 760c 후속 — 사용자 결정)
**Owner**: Claude

## 결정 사항

사용자 질문: "게임이랑 골프 condition 등급 의류/신발처럼 5등급? 아니면 카테고리 특화?"
사용자 결정 (#1 옵션, recommended): **게임/골프만 5-tier 통합. 전자기기는 그대로 7-tier.**

## 범위 (안전성 우선)

| 카테고리 | Tier system | 변경 여부 |
|---|---|---|
| **shoe / bag / clothing** | 5-tier (S/A/B/C/reject) | 기존 그대로 (fashion parser 자체 추출) |
| **game_console / sport_golf** | **5-tier 신규 추가** | Wave 760d ← 본 commit |
| **smartphone / tablet / laptop / earphone / smartwatch / watch / monitor / speaker / camera / desktop / home_appliance** | 7-tier ConditionClass only | **건드리지 않음** (옵션 축 많아 5-tier 무의미) |

## 변경 내용

### 1. `option-parser.ts` — ConditionClass → 5-tier 매핑 헬퍼

```typescript
const GAME_GOLF_TIER_CATEGORIES = new Set(["game_console", "sport_golf"]);

function conditionClassToFiveTier(conditionClass: ConditionClass) {
  if (conditionClass === "flawed") return "reject";
  if (conditionClass === "unopened") return "s_grade";
  if (conditionClass === "mint") return "s_grade";  // unopened tier
  if (conditionClass === "clean") return "a_grade";
  if (conditionClass === "worn") return "c_grade";
  if (conditionClass === "low_batt") return "c_grade";
  return "b_grade";  // normal default
}
```

### 2. `toParsedListingRow` — 카테고리 분기 (post-process only)

```typescript
condition_tier:
  grade?.tier
    ?? (parsed.category && GAME_GOLF_TIER_CATEGORIES.has(parsed.category)
          ? conditionClassToFiveTier(parsed.conditionClass)
          : null),
```

- fashion parser 가 `parsedJson.condition_grade.tier` 박은 경우 그대로 사용
- 안 박혔으면 game/golf 만 ConditionClass → 5-tier 매핑
- 그 외 (전자기기 등): `null` 유지 (기존 동작)

### 3. Wave 760 condition signal piggy-back 보강

`conditionFromText` 의 game/golf 블록에서 새 signal 추가 시 ConditionClass 흐름에 연결되도록 기존 note (`good_condition` / `cosmetic_wear` / `repair_or_defect_signal`) piggy-back 추가.

이전 (Wave 760b): `golf_grip_new` 단독 추가 → `extractConditionClass` 가 못 잡음 → `normal` → `b_grade` (잘못).
지금 (Wave 760d): `golf_grip_new` 추가 시 `good_condition` 도 push → `extractConditionClass` 가 `clean` 으로 분류 → `a_grade` ✓.

| Signal | Piggy-back note | 결과 ConditionClass | 결과 Tier |
|---|---|---|---|
| `game_label_or_disc_damage` | `repair_or_defect_signal` | flawed | reject |
| `game_limited_edition` | `good_condition` | clean | a_grade |
| `golf_grip_new` | `good_condition` | clean | a_grade |
| `golf_grip_worn` | `cosmetic_wear` | worn | c_grade |
| `golf_face_clean` | `good_condition` | clean | a_grade |
| `golf_face_worn` | `cosmetic_wear` | worn | c_grade |
| `golf_head_paint_damage` | `cosmetic_wear` | worn | c_grade |

### 4. PARSER_VERSION bump

`option-parser-v56` → `option-parser-v57`.
drift gate → game/golf 매물만 reparse 큐 진입. **다른 카테고리 영향 0** (parser_version unchanged for them, since same v57 produces same output).

## 측정 / 검증

`/tmp/wave760d-tier-test.ts` — 12/12 case pass:
- 게임 5 (s/a/reject/c/b)
- 골프 5 (s/a/reject/c/b)
- 전자기기 2 (null 유지 확인 — smartphone/earphone)

## 영향

### 사용자 UI
- 게임/골프 상세페이지에 5-tier chip 표시 가능 (S/A/B/C/reject)
- 의류/신발과 동일 chip → UX 일관성

### 시세 산정
- `condition_tier` 채워짐 → Wave 722 Stage 5 tier-aware median 자동 적용 가능 (game/golf 도 tier 별 시세 분리)
- 현재 tick-pipeline.ts 의 tier-bucketing 은 sentinel `""` 로 일괄 처리 중 (rollback 상태) → 추후 별도 wave 에서 game/golf 도 활성화 검토

### 안전성
- **전자기기 parsing 로직 변경 0** — 사용자 우려 ("파괴적이지 않나") 완전 회피
- `condition_tier` column 만 추가 채움. column 자체는 이미 존재 (Wave 714)
- DB schema 변경 없음

## 미해결

- 게임/골프 condition_chips (UI 친화 chip array — e.g. ["box:sealed", "grip:new"]) 는 추가 작업 필요 → 별도 wave
- tick-pipeline.ts 의 tier-aware median grouping 활성화 (현재 sentinel `""`) → 시세 sample 충분히 모인 후 검토

## 관련 commit

- `2cb5f25`: Wave 760 — 게임 카트리지 100+ SKU + 골프 narrow 18 SKU + 커버 substring fix
- `42d3e79`: Wave 760b — option-parser v56 — game/golf condition keyword 13 signal
- `1ef1740`: Wave 760c — game_console + sport_golf 카테고리 ready 풀기
- 본 commit: Wave 760d — option-parser v57 — game/golf 만 5-tier (전자기기는 7-tier 유지)
