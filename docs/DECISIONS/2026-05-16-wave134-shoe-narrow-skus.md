# Wave 134 — 신발 narrow SKU 30개 + parser condition_class 매핑 + Wave 133 broad 정리

> 2026-05-16. 사용자 명령: "다 해. 정확매칭이 제일중요. 10번 검토 반복".

---

## 진단 (Wave 134 variants probe 실측)

각 broad SKU 안 variant 가격 차이:

| Parent | Premium | 분리 필요 |
|---|---:|---|
| 호카 본디 8 vs X | +151% | 🔴 필수 |
| 페가수스 39 vs 41 | +115% | 🔴 필수 |
| AF1 화이트 vs 트리플화이트 | +92% | 🔴 필수 |
| 닥마 1460 체리 vs 블랙 | +47% | 🟡 |
| 어그 클래식 미니 vs 숏 | +36% | 🟡 |
| NB 990v5 vs 992 | +31% | 🟡 |
| 덩크 로우 컬러 | +29% | 🟡 |
| 컨버스 척70 컬러 | +28% | 🟢 |
| 푸마 팔레르모 컬러 | +20% | 🟢 |
| 닥마 첼시 vs 2976 | +14% | 🟢 |

**결론**: Wave 133 broad 5개 부정확 → Wave 134 narrow 30개로 교체.

## Fix

### 1. `src/lib/generated/catalog-shoe-narrow-wave134.ts` (신규, 30 SKU)

#### 호카 (5)
- `shoe-hoka-bondi-8` (msrp 219k, 2022)
- `shoe-hoka-bondi-9` (msrp 239k, 2024)
- `shoe-hoka-bondi-x` (msrp 270k, 2022)
- `shoe-hoka-clifton-9` (msrp 199k, 2023)
- `shoe-hoka-clifton-10` (msrp 199k, 2024)

#### 나이키 (5)
- `shoe-nike-pegasus-39` (msrp 119k, 2022)
- `shoe-nike-pegasus-40` (msrp 149k, 2023)
- `shoe-nike-pegasus-41` (msrp 169k, 2024)
- `shoe-nike-airforce-1-low-white` (msrp 139k)
- `shoe-nike-airforce-1-low-black` (msrp 139k)
- `shoe-nike-dunk-low-panda` (msrp 119k)
- `shoe-nike-dunk-low-black-white` (msrp 119k)

#### 어그 (3)
- `shoe-ugg-classic-short` (msrp 169k)
- `shoe-ugg-classic-mini` (msrp 149k)
- `shoe-ugg-classic-tall` (msrp 209k)

#### 닥터마틴 (3)
- `shoe-drmartens-1460-black` (msrp 219k)
- `shoe-drmartens-1460-cherry` (msrp 219k)
- `shoe-drmartens-2976-chelsea` (msrp 239k)

#### 푸마 (2)
- `shoe-puma-palermo-black` (msrp 119k)
- `shoe-puma-palermo-white` (msrp 119k)

#### 컨버스 (2)
- `shoe-converse-chuck70-black` (msrp 105k)
- `shoe-converse-chuck70-white` (msrp 105k)

#### 뉴발란스 (5)
- `shoe-newbalance-990v5` (msrp 269k, 2019)
- `shoe-newbalance-990v6` (msrp 289k, 2022)
- `shoe-newbalance-992` (msrp 249k, 2006)
- `shoe-newbalance-993` (msrp 249k, 2008)
- `shoe-newbalance-1906` (msrp 209k, 2023)

#### 기타 인기 (2)
- `shoe-asics-gel-1130` (msrp 149k)
- `shoe-adidas-gazelle-indoor` (msrp 159k)

각 SKU mustNotContain 매우 정밀:
- 다른 세대/모델 차단 (호카 본디 8 mustNotContain: "본디 9", "본디 x")
- 한정판 컬러 차단 (AF1: Off-White / Travis / Supreme / 루이비통)
- 가품 키워드 (`짭`, `replica`, `1:1`, `11급`, `미러`)
- 키즈 (`td`, `ps`, `키즈`, `유아`)
- 단품 (`한짝`, `한쪽만`, `파손`)
- 매입글 (`삽니다`, `구합니다`)

### 2. `src/lib/parsers/wave92-fashion-mobility.ts` (condition_class 매핑 추가)

이전 (Wave 92~130): 모든 신발 conditionClass = "normal" hardcoded.
변경 (Wave 134):
```typescript
const tierMap: Record<string, ConditionClass> = {
  s_grade: "unopened",   // 객관적 새상품 명시 (미개봉/봉인/택그대로)
  a_grade: "mint",       // 셀러 S급 / 거의 새거 (1-2번 신음)
  b_grade: "clean",      // 사용감 적음
  c_grade: "worn",       // 사용감 많음
  reject: "flawed",      // 파손/크랙/얼룩 심함
};
conditionClassResult = tierMap[opt.conditionTier] ?? "normal";

// 박스 미개봉 + s_grade → unopened 강제
if (opt.boxStatus === "with_box" && opt.conditionTier === "s_grade") {
  conditionClassResult = "unopened";
}
```

영향:
- 신발 시세 daily aggregate가 condition_class별 분리
- pack-reveal-modal에서 unopened vs mint vs worn 매물별 시세 비교
- 미개봉 매물 → 다나와 reference_price (있을 때) + 자체 시세 hybrid

### 3. `src/lib/generated/catalog-shoe-broad-wave133.ts` (정리)

Wave 133 5 SKU → **2 SKU 유지**:
- ❌ `shoe-nike-airforce-1-low-broad` 제거 (Wave 134 화이트/블랙 narrow와 충돌)
- ❌ `shoe-nike-dunk-low-broad` 제거 (Wave 134 판다/일반 narrow와 충돌)
- ❌ `shoe-newbalance-992-broad` 제거 (Wave 134 992 narrow와 충돌)
- ✅ `shoe-newbalance-530-broad` 유지 (variant 가격 차이 작음)
- ✅ `shoe-adidas-samba-og-broad` 유지 (variant 가격 차이 작음)

### 4. `src/lib/catalog.ts` import
```typescript
import { SHOE_NARROW_CATALOG } from "@/lib/generated/catalog-shoe-narrow-wave134";
// 기존 SHOE_CATALOG (39 한정판) + SHOE_BROAD_CATALOG (2 broad) 유지
```

CATALOG array:
```typescript
...SHOE_CATALOG,         // 39 한정판
...SHOE_NARROW_CATALOG,  // 30 narrow (Wave 134)
...SHOE_BROAD_CATALOG,   // 2 broad (NB 530 + 삼바)
```

총 **71 신발 SKU**.

## 검증

- TypeScript: validator.ts(`/plans` dev cache) 외 무에러
- Tests: **177/177 pass** (Wave 130 condition class test 포함)

## 영향 예측

| 지표 | Before (Wave 91 + 133) | After (Wave 134) |
|---|---|---|
| 신발 SKU 수 | 39 한정판 + 5 broad | 39 + 30 narrow + 2 broad = **71** |
| SKU 매칭 정확도 | broad는 variant 합쳐서 시세 부정확 | narrow 세대/컬러 분리 = **정확** |
| condition_class 분리 | 모든 신발 = normal | unopened/mint/clean/worn/flawed **5단계** |
| 매물 매칭율 (예상) | 1.3% | **20-40%** |

## 가품 detection (정직)

현재 (catalog mustNotContain):
- ✅ 명시 가품 키워드 (`짭`, `replica`, `1:1`, `11급`, `미러`, `샘플`)
- ✅ 키즈/단품/매입글
- ❌ 시세 floor 미적용 (시세 대비 너무 싼 매물 가품 의심)
- ❌ 셀러 신뢰도 검증 X
- ❌ AI L2 강제 X (정확성 §12b 위반 위험)

향후 보강 (별도 wave 135+):
- 모델별 시세 floor (예: 호카 본디 9 < 50k → 가품 의심)
- 셀러 review 0 + 신상품 → flag
- AI L2 강제 (신발 카테고리)
- mining 1-2주 후 가품 패턴 학습 → catalog 보강

## 다른 세션 알아볼 키 포인트

1. **Wave 134 신발 narrow SKU 30개 신설** (2026-05-16).
2. 파일: `src/lib/generated/catalog-shoe-narrow-wave134.ts`
3. **모든 신발 SKU는 세대/컬러 분리 narrow** — broad SKU 사용 시 시세 부정확.
4. **shoe condition_class = wave92 parser tier 매핑** (s_grade→unopened, a_grade→mint 등).
5. **category-readiness `shoe: internal_only`** — 사용자 노출 X.
6. Wave 133 broad 3개 (AF1/덩크/NB992) 제거됨. NB 530 + 삼바만 broad 유지.
7. 가품 detection 강화 필수 (현재 명시 가품만, 시세 floor + AI L2 별도 wave).

## 다음 (사용자 결정)

1. **즉시**: collect cycle (2분) 후 Wave 134 SKU 매물 매칭 시작.
2. **1-2시간 후**: SKU 매칭 수 측정. 30 narrow SKU 중 몇 개에 매물 잡혔는지.
3. **1주 후**: parse_ready 정확도 + condition_class 분포 측정.
4. **2주 후**: ready 승격 검토 (가품 detection 강화 wave 135 후).
