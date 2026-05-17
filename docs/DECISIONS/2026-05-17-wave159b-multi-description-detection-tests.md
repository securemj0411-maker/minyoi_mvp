# Wave 159b — description 다중상품 검출 + bunjang 매핑 회귀 test 추가

- 시간: 2026-05-17 KST
- 사용자 코멘트: "정책 결정 들어갈거 아니고 무조건 해야될 과정이면 다 자동으로"

## 발견

reveal_feedback 신규 코멘트 5건 검토:
- **pid 295882994** (갤럭시워치 울트라 "원초적 하자" 환불 불가): negation patch (id 148) 후 `unopened`로 정정 ✓
- **pid 408047887** (에어팟 프로2 "(없는수준)"): negation patch (id 146) 후 `normal`로 정정 ✓
- **pid 397901264** (갤럭시 S24 Ultra "테두리 미세 잔얼룩"): `worn` 정확 ✓
- **pid 364899054** (애플워치 10 미개봉 "42mm ML 60만 / 46mm 62만 / 46mm SM 64만"): **`normal`로 잘못 분류, 다중상품인데 안 거름**
- **pid 408329098** (iPhone 14 리퍼): `flawed` 정확 (시세 source는 별도 정책 결정 영역)

## 변경

### 1. description 다중상품 검출 ([pipeline.ts:430](mvp/src/lib/pipeline.ts:430))
```typescript
function descriptionMultiHits(desc: string): boolean {
  const priceMatches = desc.match(/\d{2,4}\s*만(?![원세일년])/g) ?? [];
  if (priceMatches.length < 3) return false;
  const optionPattern = /\d{1,3}\s*mm|블랙|화이트|골드|실버|로즈|블루|레드|퍼플|그린|핑크|네이비|티타늄|알루미늄|\d+세대|\d+gb|\d+tb|와이파이|wifi|셀룰러|cellular|gps|s\/m|m\/l|ml\b|sm\b|ll\b/i;
  const optionCount = (desc.match(new RegExp(optionPattern.source, "gi")) ?? []).length;
  return optionCount >= 3;
}
```

조건: 가격(만 단위) 3개 이상 + 옵션(사이즈/색상/세대 등) 3개 이상 → multi. 

기존 `multiModelHits`는 title 기반 — 같은 모델의 다른 옵션 묶음 (예: "42mm ML / 46mm SM") 못 잡음. description 기반으로 보강.

false positive 방지: "원/세/일/년" 뒤따르는 "만" 제외 (만원/만세 등 일반 표현).

### 2. ruleType에 descriptionMultiHits 통합 ([pipeline.ts:744](mvp/src/lib/pipeline.ts:744))
title multiHits + descriptionMultiHits 둘 다 체크.

### 3. 회귀 test 추가 (`tests/wave159-bunjang-mapping-and-multi.test.ts`)
- bunjang 영어 enum 매핑 6개 + 한글 fallback + null
- resolveConditionClass worse-of-rank 7개 시나리오
- 16/16 pass

### 4. pid 364899054 명시 reparse
- `detail_status='pending'` + `listing_type='unknown'` + `score_dirty=true` → detail-worker 다음 tick에 재처리 → 새 코드 적용

## 검증
- typecheck production clean.
- `npx tsx --test tests/wave159-*.test.ts` 16/16 pass.

## 위험
- false positive: 매물 본문에 정상적으로 가격 3개 이상 (예: "원가 100만 → 80만 / 안전결제 60만 / 직거래 55만") — option 3개 동반 조건이 mitigation.
- pid 364899054 외 backfill: 같은 패턴의 multi false negative 매물 존재 가능. cron 자연 흐름으로 점진 반영.

## 다음
- 정책 결정 필요 (사용자 답변 대기):
  - 다중상품 차단 정책 — 일괄 차단 vs N개 매물로 분리
  - iPhone 14 시세 source — 다나와 새 가격 vs 번개 중고 매물 (리퍼 매물용)
- 365번 매물 분류 변화 측정 (1분 후)
