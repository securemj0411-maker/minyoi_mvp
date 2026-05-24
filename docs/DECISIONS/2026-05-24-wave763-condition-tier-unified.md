# Wave 763 — condition_tier (UI) ↔ comparable_key tier 통일 (systemic fragmentation fix)

**날짜**: 2026-05-24
**Wave**: 763 (사용자 #3 보고: "부끄러울정도로 너무 미스매칭")
**Owner**: Claude

## 사용자 보고

사용자 본 호카 마파테 매물:
- UI: `condition_tier=A`
- 시세 비교: `comparable_key=...|boot|b_grade` pool 과
- → "A급 표시되는데 왜 B급 시세 평균과 비교?"

추가 사용자 코멘트: "진짜 사용자한테 보여주기 부끄러울정도로 너무 미스매칭이랑 너무 많아 특히 의류"

## 진단

### 미스매치 광범위 (지난 7일)
- 신발: 13,206 매물 중 **7,606 (57.6%) 미스매치**
- 의류: 8,579 매물 중 **4,986 (58.1%) 미스매치**

### 근본 원인 (3 source 분리)
| Source | 위치 | 용도 |
|---|---|---|
| `condition_class` | option-parser `conditionFromText` → 7-tier (flawed/worn/normal/clean/mint/unopened/low_batt) | 내부 |
| `condition_tier` | `parsedJson.condition_grade.tier` (Wave 714 신 5-tier) | **UI 표시** |
| `comparable_key` 끝 token | `parseConditionTier(text)` (구 5-tier) | **시세 grouping** |

3개가 독립 로직 → 사용자: A급 매물이 b_grade pool 시세와 비교되는 부조리.

### Random sample 발견
- 톰브라운 새상품급: `class=mint`, `tier=C`, `comparable_key=a_grade` (3개 다 다름)
- 몽클레어 마야: `class=normal`, `tier=A`, `comparable_key=b_grade`
- 슈프림 발토로: `class=mint`, `tier=S`, `comparable_key=a_grade`

### Brand → SKU 매칭은 OK
의류 30개 random sample 모두 정상 (베이프/슈프림/아크/톰브라운/폴로 등). brand 미스매치 아님 — grading 분열이 진짜 문제.

## 사용자 결정

**UI 표시 tier 상태로 시세 grouping 통일** (Recommended).

이유: 사용자가 보는 등급과 시세 비교 풀이 같아야 매물 가치 판단 일관성 보장.

## Fix (shoe + clothing 만 — bag 은 condition_grade 없음, 사용자 정책 ready X)

### 1. helper 추가 — `gradeChipToComparableKeyTier`

```typescript
function gradeChipToComparableKeyTier(tier: ConditionGrade["tier"]) {
  switch (tier) {
    case "S": return "s_grade";
    case "A": return "a_grade";
    case "B": return "b_grade";
    case "C": return "c_grade";
    case "D": return "reject";
    default: return "unknown_condition";  // UNKNOWN
  }
}
```

### 2. shoe / clothing branch — fashionConditionGrade 미리 계산

```typescript
// shoe branch 끝
fashionConditionGrade = gradeShoeCondition({ name: title, description, enumLabel });

// clothing branch 끝
fashionConditionGrade = gradeClothingCondition({...});
```

### 3. `partsForKey[conditionKeyIndex]` swap (line 1327)

```typescript
if (conditionKeyIndex != null) {
  // Wave 763: UI tier (condition_grade) 우선 → 시세 grouping 통일.
  if (fashionConditionGrade && fashionConditionGrade.tier !== "UNKNOWN") {
    partsForKey[conditionKeyIndex] = gradeChipToComparableKeyTier(fashionConditionGrade.tier);
  } else {
    // fallback (bag, UNKNOWN 시): 기존 conditionClassResult 사용
    const comparableTier = conditionClassToComparableTier(conditionClassResult);
    if (comparableTier) partsForKey[conditionKeyIndex] = comparableTier;
  }
}
```

### 4. PARSER_VERSION bump
- `wave92-shoe-v40` → `wave92-shoe-v41`
- `wave216-clothing-v47` → `wave216-clothing-v48`

drift gate trigger → fashion 17K+ 매물 자동 reparse 큐 진입.

## 검증

`/tmp/wave763-tier-test2.ts` — 6/6 일관성 pass:

| 매물 | UI grade | comparable_key tier | 일치 |
|---|---|---|---|
| 조던1 시카고 박스미개봉 | A | a_grade | ✓ |
| 덩크 패ンda 1회 시착 KREAM | A | a_grade | ✓ |
| 이지부스트 사용감 많음 | D | reject | ✓ |
| 조던1 가수분해 부품용 | B | b_grade | ✓ |
| 슈프림 노스 발토로 택부착 | S | s_grade | ✓ |
| 아크테릭스 베타 1회 착용 | A | a_grade | ✓ |

## 영향

- 사용자가 보는 UI tier = 시세 비교 풀 동일 → "A급인데 왜 시세 낮지?" 부조리 제거
- 신발 7,600 매물 + 의류 5,000 매물 새 comparable_key 로 reparse → 자연스러운 transition
- 시세 sample 재분포 (UI 기준으로 재구성) — 일관성 향상

## 안전성

- bag 카테고리 변경 없음 (condition_grade 미구현, ready X)
- 전자기기/시계/모니터/카메라 등 fashion 외 카테고리 영향 0
- UNKNOWN tier 매물은 fallback (기존 동작) 유지

## 미해결

- bag 카테고리 condition_grade 미구현 — gradeBagCondition 신설 필요 (별도 wave)
- mvp_market_price_daily 의 구 comparable_key rows 자연 만료 (Wave 756 cron 이 자동 정리)
- 일부 매물 UNKNOWN tier (raw_text < 50 chars) — 그대로 fallback 사용

## 관련 commit

- `75a4d11`: Wave 762 — Hoka Mafate catalog leak fix
- 본 commit: Wave 763 — comparable_key tier 를 condition_grade (UI) 와 통일

## 사용자 코멘트 #4 직접 인용

"진짜 사용자한ㅌㅌ테 보여주기 부끄러울정도로 너무 미스매칭이랑 너무 많아 특히 의류"

→ 의류 brand mismatch 검증 결과 거의 없음 (30/30 정상). 진짜 문제는 grading 분열 = 본 wave fix.
