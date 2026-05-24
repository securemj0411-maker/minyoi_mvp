# Wave 765 — 의류 systemic cleanup (BAPE 통합 + sub-line audit + multi-size detection)

**날짜**: 2026-05-24
**Wave**: 765 (Wave 764 미해결 3개 후속)
**Owner**: Claude

## 사용자 요청

"미해결 (별도 wave 권장) — 이거 다해야되는거 아닌가?"

3개 처리:
1. BAPE 나머지 SKU 5개 sub-line 통합
2. 다른 brand kids/sub-line systemic audit
3. 묶음 매물 ("S / L") parser 자동 detection

## Step 1 — BAPE 공통 sub-line const + 7개 SKU 통합

### 공통 const 신설

`src/lib/generated/catalog-715-clothing-narrow.ts`:
```typescript
export const BAPE_SUBLINE_NOISE = [
  "apee", "에이피이",
  "bape baby", "babe bape", "베이프 베이비", "베이비 베이프",
  "bape kids", "베이프 키즈", "키즈 베이프", "bape jr", "베이프 jr",
  "키즈사이즈", "키즈 사이즈", "kids size", "아동사이즈", "아동 사이즈",
] as const;
```

### 적용 — 7개 BAPE SKU 모두

| SKU | 위치 | 적용 방법 |
|---|---|---|
| `bape_tee` | catalog.ts | `...BAPE_SUBLINE_NOISE` |
| `bape_hoodie` | catalog.ts | `...BAPE_SUBLINE_NOISE` |
| `bape_hoodie_zip` | catalog.ts | `...BAPE_SUBLINE_NOISE` |
| `bape_crewneck` | catalog.ts | `...BAPE_SUBLINE_NOISE` |
| `bape_shark_hoodie` | catalog.ts | `...BAPE_SUBLINE_NOISE` |
| `bape_varsity_jacket` | catalog-715-clothing-narrow.ts | `...BAPE_SUBLINE_NOISE` |
| `bape_coach_jacket` | catalog-715-clothing-narrow.ts | `...BAPE_SUBLINE_NOISE` |

장점: const 한 번 update 하면 7개 SKU 모두 자동 차단 (DRY).

## Step 2 — 다른 brand kids/sub-line systemic audit

지난 7일 의류 parsed 매물 22건 audit:
| 패턴 | 매물 수 | 처리 |
|---|---|---|
| BAPE APEE/BABY/MILO | 7 | 위 BAPE 통합 catalog 차단 |
| Polo 보이즈/보이즈 옥스포드 | 5 | Polo SKU mustNotContain "polo boys" / "폴로 보이즈" 추가 |
| 스투시 돌리/돌리 피그먼트 | 6 | 디자인 명 (Dolly) — 키즈 아님 → 차단 X |
| 폴로 베어 (곰돌이) | 4 | 별도 SKU `polo_bear_collab` 있음 → OK |

### DB 즉시 정리 — 1건 추가 invalidate

```sql
UPDATE mvp_candidate_pool SET status='invalidated', invalidated_reason='wave765_kids_subline_extra'
WHERE category='clothing' AND status='ready'
  AND name ~* '(APEE|BAPE BABY|폴로 보이즈|polo boys|...);
```

결과: pid `403560772` (BAPE APEE BABY 카모 반팔) — Wave 764 invalidate 후 다시 ready 됐던 매물 재차단.

### Polo SKU global 차단 강화

`catalog.ts` 의 모든 polo SKU (`mustNotContain` 에 `"키즈", "kids", "여아", "남아", "토들러"` 박힌 곳) 일괄 추가:
- `"polo boys"`, `"폴로 보이즈"`, `"폴로보이즈"`
- `"polo girls"`, `"폴로 girls"`, `"polo kids"`
- `"랄프로렌 보이즈"`, `"랄프로렌 키즈"`

`replace_all: true` 로 일괄 적용.

## Step 3 — Multi-size bundle parser 자동 detection

`wave92-fashion-mobility.ts` `parseClothingOptions` 의 `titleMultiItemBundle` 확장:

```typescript
const multiSizeAlpha = /\b(?:xs|s|m|l|xl|xxl|2xl|3xl)\s*[\/,]\s*(?:xs|s|m|l|xl|xxl|2xl|3xl)\b/i.test(title);
const multiSizeKr = /\b(?:90|95|100|105|110|115|120)\s*[\/,]\s*(?:90|95|100|105|110|115|120)\b/.test(title);
const titleMultiItemBundle = (기존) || multiSizeAlpha || multiSizeKr;
if (titleMultiItemBundle) {
  needsReview = true;
  criticalUnknown.push(multiSizeAlpha || multiSizeKr ? "clothing_multi_size_bundle" : "clothing_multi_item_bundle");
}
```

### 안전성 (false positive 차단)
- 청바지 "30/32" (W30 L32) → 매칭 X (90-120 한국 사이즈 단위만)
- 단일 사이즈 "S" → 매칭 X (split pattern 없음)
- "사이즈 M / L 둘 다 있어요" 같은 셀러 메모 → title-only 검사라 description 무시

### Test (6/6 pass)

| 매물 | block? |
|---|---|
| "스투시 맨투맨 S / L" | ✓ block (multi-size) |
| "톰브라운 가디건 XS, S" | ✓ block |
| "노스페이스 95 / 100" | ✓ block |
| "RRL 데님 30/32" | ✓ pass (false positive 차단) |
| "아크테릭스 베타 LT S" | ✓ pass (단일) |
| "베이프 티셔츠 2개 일괄" | ✓ block (기존 묶음) |

## PARSER_VERSION bump

`wave216-clothing-v49` → `wave216-clothing-v50`. drift gate trigger.

## 안전성

- BAPE_SUBLINE_NOISE 는 const → 향후 sub-line 추가/수정 단일 source
- Polo "보이즈" 차단 `replace_all: true` 로 brand 전체 일관성
- multi-size 청바지 30/32 false positive 차단 검증됨

## 미해결 (사용자 알림)

- 슈프림/톰브라운/아크테릭스 KIDS 라인 — 지난 7일 매물 0건 (없으면 추후 발견 시 보강)
- 폴로 베어 collab 가 별도 SKU 있어서 처리 — sub-line 별 narrow split 신설 권장
- 가품 marker (보세 brand, 11급, S급정품) systemic block — 별도 audit 권장

## 관련 commit

- `322df9f`: Wave 764 — 의류 deep sweep 1단계 (8건)
- 본 commit: Wave 765 — BAPE 통합 + Polo 보이즈 + multi-size detection
