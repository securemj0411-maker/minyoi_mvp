# Wave 257 spot rematch 측정 결과 (2026-05-20)

## 측정 시점 — 2분 후 (detail-worker tick 완료)

## 결과

### pid 408858108 (가젤 "새상품 + 약간 하자가있어")

| field | 기존 (잘못) | 새 (정확) ✅ |
|---|---|---|
| condition_class | mint | **flawed** |
| condition_score | 0.95 | **0.35** |
| condition_notes | `[]` | `["repair_or_defect_signal"]` |
| parser_version | wave92-fashion-mobility-v4 | **wave92-shoe-v8** |
| comparable_key | `gazelle_og_broad\|type_unknown\|240\|a_grade` | **`gazelle_og_broad\|sneaker\|240\|a_grade`** |
| ai_skipped | — | true (reason: `bunjang_label_explicit`) |

**완벽한 결과** — 사용자 매물 가장 큰 우려 (mint 잘못) 정확 해결.

flow trace:
- detail-worker 가 fetchDetail 다시 호출 → bunjang label "DAMAGED" 받음
- bunjangLabelToConditionClass("DAMAGED") → "flawed"
- Wave 257 fast-path 1 (bunjangLabelMapped !== null) → AI skip 정당
- resolveConditionClass(flawed, normal, false) → "flawed"
- conditionScore 0.75 → 0.35 (conditionScoreMap[flawed])

또 — Wave 254.5 step 1 (shoe-v8 parser + conditionFromTextFashion) 도 동시 발현 (parser_version v4 → v8, comparable_key product_type 정정).

### pid 331382713 (눕시 쇼츠)

| field | 기존 | 새 |
|---|---|---|
| condition_class | mint | **unopened** |
| comparable_key | `clothing\|tnf_nuptse_1996\|shorts\|a_grade` (Wave 254.6 정정) | **null** ⚠️ |
| parser_version | wave216-clothing-v8 | **option-parser-v54 (tech path)** |
| ai_skipped | — | true (reason: `bunjang_label_explicit`) |

**Wave 254.6 catalog mustNotContain "쇼츠" 정확 작동**:
- tnf-nuptse-1996 SKU mustNotContain "쇼츠" → narrow lane reject
- broad clothing SKU 없음 → SKU 매칭 자체 X → category null → tech path
- comparable_key=null → 시세 비교 안 됨 (**false matching 차단**)

이게 design choice — "눕시 쇼츠" 같은 mismatch 매물이 잘못된 시세 비교군 진입 차단. 별도 broad-clothing-shorts SKU 추가 시 정상 매칭 가능 (별도 wave).

### AI default 발화 0건 — 둘 다 fast-path 1 통과

| pid | fast-path reason | AI skip 정당 |
|---|---|---|
| 408858108 | bunjang_label_explicit (DAMAGED) | ✓ — 셀러 명시 DAMAGED |
| 331382713 | bunjang_label_explicit (NEW/LIKE_NEW) | ✓ — 셀러 명시 새상품 |

→ **사용자 의도 부합**: 셀러 직접 선택 (bunjang label) = 100% 신뢰. AI skip 정당.

## detail_queue 상태 확인 — picking up 성공

```
pid 408858108: status=done, attempts=2, queue_updated 2분 전
pid 331382713: status=done, attempts=2, queue_updated 2분 전
```

INSERT ON CONFLICT UPDATE → priority=50 → 다음 tick picking up → fetchDetail + parseListingOptions + Wave 257 logic 거침.

## ⚠️ 잠재 issue — fast-path 1 너무 관대?

현재 logic: `bunjangLabelMapped !== null` → fast-path → AI skip.

**risk case**: 셀러가 description "메인보드 손상" 명시했는데 bunjang label "USED" 박았으면:
- bunjangLabelMapped = "worn" (USED → worn 매핑)
- fast-path 1 발화 → AI skip
- condition_class = "worn" → **flawed 누락**
- 사용자에게 정상 (worn) 매물로 노출 → 손상 모르고 구매 → 손실

이건 Wave 256 옵션 D (bunjang label 불일치 → AI) 가 Wave 257 에서 폐기되어 발생.

→ **Wave 258 후보**: fast-path 1 tightening — bunjang label 있어도 description 에 강한 conflict signal (메인보드/침수/박살/충격/하자 + 부정) 있으면 AI default 호출.

또는 더 보수적: bunjang label 만 신뢰 X, 항상 AI 호출 + bunjang label 비교.

사용자 결정 필요.

## ai_default 발화 0 — 더 큰 sample 필요

현재 production sample 84건 중 ai_default_invoked=0. fast-path 통과율 너무 높을 수도. 또는 단순 sample 작아서.

→ **1h 후 sample 30건 측정** (별도 task).

## risk 평가

- ✅ spot rematch destructive UPDATE 2건 — 안전
- ✅ 사용자 매물 정확 분류
- ⚠️ fast-path 1 잠재 false negative — 별도 wave 검토
- ⚠️ AI default 실제 발화 검증 — 1h sample 측정 후

## 후속

1. **1h 후 sample 30건 측정** — Wave 257 rollout 완료 + ai_default_invoked 실제 발화 비율
2. **Wave 258 후보 결정** — fast-path 1 tightening (사용자 결정)
3. **17,623건 대량 rematch** — spot 결과 좋음 ✓, 사용자 결정 (destructive UPDATE)
4. **broad-clothing-shorts SKU 추가** — pid 331382713 같은 매물 정상 매칭 (별도 wave)
