# Wave 182 Phase 3 — Base option fallback

- 시간: 2026-05-17 KST
- 사용자 제안: "옵션 명시 안 한 매물 → base (가장 낮은 옵션) 가정 + base 시세 비교. false positive 발생 X, recall loss 만."
- §12b 정책 변경: base 추정 금지 → base 가정 허용 (UI 라벨 표시).

## 안전성 (false positive 0)

| 매물 옵션 | base 가정 옵션 | base 시세 | 매입가 | priceGap | 결과 |
|---|---|---:|---:|---:|---|
| 진짜 base (8GB) | 8GB | 180만 | 130만 | 0.28 | ✓ 추천 (정확) |
| 고옵션 (32GB) | 8GB | 180만 | 200만 | 음수 | recall loss (꿀매물 놓침 but OK) |
| 고옵션 (32GB) | 8GB | 180만 | 280만 | 음수 | ✓ 안 추천 (정확) |
| 진짜 base (8GB) | 8GB | 180만 | 200만 | 음수 | ✓ 안 추천 (정확) |

base 시세는 항상 underestimate → priceGap 보수적 → false positive 발생 X.

## 구현

### 새 파일
- **`src/lib/sku-base-options.ts`**: `SKU_BASE_OPTIONS` 매핑 (88 SKU + helper).
  - iPhone 27개 (모델별 base storage, 15/16 Pro Max = 256GB)
  - Galaxy 30개 (storage)
  - iPad 5개 (storage + connectivity)
  - Galaxy Tab 16개
  - Apple Watch 12개 (size + connectivity)
  - Galaxy Watch 6개
  - Desktop Apple Silicon 6개 (RAM + SSD)
  - **단일 옵션 / 자급제 변형 / broad SKU 는 박지 X** (이미 옵션 명시 or 시세 비교 의미 없음)

### Catalog type
- **`src/lib/catalog.ts`**: `Sku.baseOptions?` optional 필드 추가 (현재 unused — 별도 module 에서 매핑).

### Parser fallback
- **`src/lib/option-parser.ts`**:
  - `baseOptionsFor(skuId)` import
  - 옵션 추출 후 `finalStorageGb` / `finalRamGb` / `finalSsdGb` / `finalWatchSizeMm` / `finalConnectivity` / `finalCarrier` 변수 생성
  - null 옵션 + baseOptions 있으면 base 값 + `optionBaseAssumed` 에 axis 이름 push
  - `comparableParts` / `confidence` / parsed object 에 finalXxx 사용
  - `parsedJson.option_base_assumed` 박음 (UI 표시 용)

### UI 표시
- **`src/components/admin-pool-browser.tsx`**: `optionBaseAssumed` props + 매물 카드 "기본 옵션 가정" amber badge + tooltip.
- **`src/app/api/admin/pool-listings/route.ts`**: payload 에 `optionBaseAssumed` 노출.

### Test update
- `tests/iphone-storage-parser.test.ts`:
  - "no explicit token → null" → "→ SKU base fallback (storage=256)" 정정.
  - "typo 126gb → null" → "→ SKU base fallback (128GB)" 정정.
- `tests/core-rules.test.ts`:
  - "desktop Apple exact model SKUs" comparable_key expected `unknown_ram|unknown_ssd` → `8gb_ram|256gb_ssd` 정정.

### Policy update
- `LAUNCH_PLAN.md §12b`: base 추정 금지 → base 가정 OK (UI 라벨 표시, 정확도 risk 0).

## 검증

- `npx tsc --noEmit` clean
- `npm run test:core` 369/369 pass
- Wave 182 fixture test 41/41 pass

## 예상 효과

옵션 명시 안 한 매물 풀 진입 가능 → 풀 +100~200 잠재. UI 카드에 "기본 옵션 가정" amber badge 로 정직 표시.

## 한계 / 추후

- pack-reveal-modal + user-reveal-dashboard 도 동일 badge 박는 게 일관성 (사용자 메모리 §UI 변경 시 3화면 다 적용).
- 단 RevealMarketBasis 확장 + payload 추가 필요 — 별도 wave.
- MacBook narrow lane (M-series Pro/Max RAM/SSD) 은 catalog 가 이미 명시 → base fallback 발동 X (RAM 박혀있음).
