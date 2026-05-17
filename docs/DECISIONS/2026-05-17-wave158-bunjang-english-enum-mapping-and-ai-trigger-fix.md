# Wave 158 — Bunjang 영어 enum 매핑 + condition AI trigger 조건 수정

- 시간: 2026-05-17 KST
- 사용자 코멘트: "상태가 매핑 안된게 있음?? 이유는 뭐지??? AI가 작동을 안한거야?? 결국 마지막에 AI를 돌려서 애매하면 작동을 해야되는데??"

## 발견

### 1. Bunjang label 매핑 100% 실패 (3,798건)
[option-parser.ts:120 `bunjangLabelToConditionClass`](mvp/src/lib/option-parser.ts:120) 는 한글 정규식 (`사용감많음|사용감없음|...`) 만 매칭. 실제 bunjang detail API 는 **영어 enum 응답**.

DB 분포:
| label | 건수 |
|---|---:|
| `LIGHTLY_USED` | 1,543 |
| `LIKE_NEW` | 1,274 |
| `NEW` | 708 |
| `HEAVILY_USED` | 237 |
| `DAMAGED` | 21 |
| `USED` | 15 |
| **합계** | **3,798** |

전부 한글 정규식 매칭 fail → `fromMeta = null` → metadata 무시 → description 단독으로 분류.

### 2. AI trigger도 동시에 죽어 있었음
[tick-pipeline.ts:1698](mvp/src/lib/tick-pipeline.ts:1698):
```typescript
if (ambiguousCondition && !hasStrongSignal && !detail.conditionLabel) {
  classifyConditionWithAi(...)
}
```

세 번째 조건 `!detail.conditionLabel` — 영어 enum 값 (`"LIGHTLY_USED"` 등) 이 **truthy** → AI skip. 매핑 실패로 metadata 무시당하는 매물도 AI 호출 못 받음. 사용자 의도 ("애매하면 AI") 100% 위반.

### 3. 사용자 실제 매물 검증 (운영자풀 코멘트 2개)
- **pid 405711280** (애플워치 Ultra 2 풀박스, bunjang label `LIGHTLY_USED`):
  - 현재 분류: `clean` (description "풀세트" 만으로 결정)
  - 매핑 박힌 후 기대: `LIGHTLY_USED → normal` + description `full_set → clean` → worse-of-rank → **normal** (보수적, 셀러 metadata 반영)
- **pid 408107338** (애플워치8 "미개봉" 배터리 89%, bunjang label `LIGHTLY_USED`):
  - 현재 분류: `worn` ← **시스템이 정확히 잡음** (description "미세한 생활기스" → cosmetic_wear → worn). 매핑 박혀도 동일 (worn < normal).

## 변경

### 1. `bunjangLabelToConditionClass` 영어 enum 매핑 추가 + export
[option-parser.ts:120](mvp/src/lib/option-parser.ts:120):
```typescript
DAMAGED       → flawed
HEAVILY_USED  → worn
USED          → worn   (15건만, 명시 "사용감 있음" — 보수적)
LIGHTLY_USED  → normal
LIKE_NEW      → clean
NEW           → unopened (다나와 새 가격 시세 비교)
```
한글 fallback 보존 (legacy/edge).
함수 `export` 추가 → tick-pipeline에서 import.

### 2. AI trigger 조건 수정
[tick-pipeline.ts:1698](mvp/src/lib/tick-pipeline.ts:1698):
```typescript
const bunjangLabelMapped = bunjangLabelToConditionClass(detail.conditionLabel);
if (ambiguousCondition && !hasStrongSignal && bunjangLabelMapped === null) {
  classifyConditionWithAi(...)
}
```

label 존재 여부 → 매핑 가능 여부 로 변경. 매핑되면 metadata 신뢰 → AI skip. 매핑 실패 (미지의 label) 또는 label 없음 → AI 호출.

### 3. PARSER_VERSION bump v46 → v47
새 detail fetch한 매물의 parser_version 추적용. 기존 매물 자동 reparse는 트리거 안 됨 — cron이 detail 새로고침할 때 자연 점진 반영.

## 검증
- `npx tsc --noEmit` production code clean.
- 78/78 condition tests pass (wave130/146/149/150/151-152/154).

## 위험
- **점진 반영 정책**: 기존 3,798건 매물은 detail 새로고침 (lifecycle worker) 시 점진적으로 v47 + 새 매핑 적용. 즉시 전체 반영 원하면 별도 backfill script 필요 (보류).
- **condition_class 변경 시 market 재집계**: `mvp_market_price_daily` PK가 `(date, comparable_key, condition_class)` — condition_class 바뀌면 다른 row로 reaggregate. 매물 새로고침 시 자동 처리되지만 시세 일시 변동 가능.
- **AI cost**: 매핑 실패 label 발생 시 (미지의 enum) AI 호출 증가. 현재 6가지 enum 다 매핑 → AI 호출 트리거는 label null 매물에만.

## 다음
- 24h 후 측정: `mvp_listing_parsed` 의 `condition_class` 분포 변화 + AI 호출 수 (`mvp_listing_ai_classifications` 에 condition 분류 결과 저장 컬럼 추가 필요).
- AI condition 결과 추적 컬럼 추가: `mvp_listing_ai_classifications`에 `condition_class`, `condition_reason` 컬럼 없음. 별도 wave에서 추가.
- 즉시 reparse backfill script 필요 시 owner 결정 후 추가.
