# Wave 182 — Base option fallback (사용자 제안)

- 시간: 2026-05-17 KST
- 발견: Wave 181 broader median fallback revert 후, 사용자가 더 안전한 대안 제시.
  옵션 (RAM/SSD/storage) 명시 안 한 매물 → **base (가장 낮은 옵션) 가정 + base 시세 비교**.
  false positive 발생 X (base 시세 더 낮음 → priceGap underestimate → 추천 보수적).

## §12b 정책 변경 (사용자 결정)

### 기존
> base/default 옵션 추정 금지: "맥북에어 m3 13" → unknown_ram/unknown_ssd 유지 → 풀 진입 X
> 예외: "기본형/깡통/노옵션/베이스 모델/base model" 명시 매물만 default 매핑 OK

### Wave 182
> base/default 옵션 추정 **OK (보수적 시세 비교용)**. 단:
> 1. 가장 낮은 옵션만 적용 (혼합 median 금지)
> 2. parsed_json에 `option_base_assumed: ["ram", "ssd"]` 박음
> 3. UI 3화면 "기본 옵션 가정" 명시 (Wave 181 errors 학습)

### 안전성 증명

| 매물 옵션 | base 가정 옵션 | base 시세 | 매입가 | priceGap | 결과 |
|---|---|---:|---:|---:|---|
| 진짜 base (8GB) | 8GB | 180만 | 130만 | 0.28 | ✓ 추천 (정확) |
| 고옵션 (32GB) | 8GB | 180만 | 200만 | 음수 | recall loss (꿀매물 놓침 but OK) |
| 고옵션 (32GB) | 8GB | 180만 | 280만 | 음수 | ✓ 안 추천 (정확) |
| 진짜 base (8GB) | 8GB | 180만 | 200만 | 음수 | ✓ 안 추천 (정확) |

**모든 시나리오에서 false positive 발생 X**. recall loss만. §12b 정신 (precision > recall) 일치.

## 카테고리별 옵션 구조 + base 정의

### A. base 가정 적용 카테고리

| 카테고리 | 명시 필수 (식별용) | base 가정 가능 옵션 | base 정의 |
|---|---|---|---|
| iPhone | model (15/16 등) | storage | 모델별 최저 (대부분 128, 16Pro 시리즈는 256) |
| iPad | model (Pro/Air/Mini) + screen | storage + connectivity | 최저 storage + wifi |
| MacBook | chip (M2/M3) + screen (13/14/16in) | RAM + SSD | 8GB + 256GB (일부 모델 다름) |
| Apple Watch | model (SE/Series/Ultra) | size + connectivity | 41mm + gps (Ultra는 49mm 자동) |
| Galaxy S Ultra | model (S23/S24/S25) | storage + carrier | 최저 storage + 자급제 |
| Galaxy Tab | model + screen | storage + connectivity | 최저 storage + wifi |
| Galaxy Watch | model (4/5/6/7) | size + connectivity | 40mm + bt |
| Galaxy Z Flip | model | storage | 최저 storage |

### B. base 가정 불필요 (single option 또는 model로 완결)

- AirPods (Pro 3 USB-C / Max USB-C / 4 ANC 등 — 각자 single option)
- Beats Solo 4 / Studio Pro
- Sony WH-1000XM4 / CH520
- Bose QC Ultra / QC45
- Switch OLED / PS5 Slim / PS5 Disc
- Casio G-Shock (model 자체 완결)

## 구현 단계

### Step 1: catalog.ts 에 `baseOptions` 필드 추가
```typescript
{
  id: "macbook-air-m3-13",
  family: "macbook",
  model: "macbook_air",
  // ...
  baseOptions: { ramGb: 8, ssdGb: 256 }, // ← 추가
}
```

### Step 2: option-parser.ts 에 base fallback 박기
- 명시 필수 옵션 (chip/screen/model) 다 OK
- base 가정 가능 옵션 (RAM/SSD/storage 등) unknown → SKU의 baseOptions 적용
- `parsed_json.option_base_assumed: ["ram", "ssd"]` 박음
- needs_review=false 가능 (base 가정 적용했으니 comparable_key 완성)

### Step 3: UI 3화면 표시
- admin-pool-browser, pack-reveal-modal, user-reveal-dashboard
- "기본 옵션 가정" badge (amber 또는 blue tone)
- tooltip: "이 매물은 옵션 (RAM/SSD 등) 명시 안 됐어요. 기본 옵션 시세로 보수적으로 비교한 가격이에요."

### Step 4: LAUNCH_PLAN.md §12b update

### Step 5: 테스트
- Unit tests: parser가 base 가정 매물을 올바른 comparable_key로 만드는지
- Regression: 옵션 명시 매물은 기존 동작 유지하는지

## 예상 효과

- macbook (917 parsed → ready 3): 8GB/256GB base 가정 시 +30~80 ready 예상
- iPhone 16 Pro (자급제 외): base storage 가정 시 +10~30
- iPad / Apple Watch / Galaxy 동일 패턴 추가

총 잠재 **+50~150 ready** (정확도 손해 0).

## 위험

- 진짜 고옵션 매물 추천 안 됨 (recall loss). 사용자가 진짜 꿀매물 놓칠 수 있음.
  → 옵션 명시 매물은 정확히 추천하니 큰 손해는 아님.
- baseOptions 정의 잘못 박으면 (예: M3 Pro 14를 8GB로 잡음 — 실제 base 18GB) 부정확한 시세 비교.
  → 카테고리별 base 정의를 owner 검증 후 진행.

## 다음 step

사용자 확인 후 Step 1 (catalog baseOptions) 부터 박기.
