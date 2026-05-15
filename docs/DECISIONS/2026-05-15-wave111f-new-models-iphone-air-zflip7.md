# Wave 111f — 신상 catalog: iPhone Air + Galaxy Z Flip 7

> Status: **applied (code + production).** owner 지시 "학습용 sweep" → 30분 sweep null sku_id 매물 분석 결과 신상 모델 누락 발견.

CLAUDE.md 6 필드 포맷.

## 1. 진단 — null sku_id 매물 패턴 분석

- 시간: 2026-05-15
- 발견: 30분 휴대폰 sweep 96건 sku_id null 매물 중 우리 사업 관련 (옛 모델 / 액세서리 / 노이즈 필터링 후):
  - **"아이폰 에어 자급제 256 아이폰17 에어"** — Apple 2025 신상 iPhone Air
  - **"아이폰17에어"** / **"아이폰에어 256골드"** — 동일 신상 다수
  - **"SS급)갤럭시 Z플립7 쉐도우블랙 256G"** — Samsung 2025-07 신상 Z Flip 7
  - catalog 둘 다 누락 → ruleMatch null → sku_id null → narrow lane 진입 0건
- 변경: 측정만.
- 다음: 두 신상 catalog 추가.

## 2. iPhone Air broad + narrow lane (256/512 self)

- 시간: 2026-05-15
- 변경:
  - **broad SKU**: `iphone-air` (mustContain "아이폰 에어"/"아이폰17 에어" 변형 다수)
  - **narrow lane**: `iphone_air_256gb_self` / `iphone_air_512gb_self` (laneKey)
  - mustNotContain: 14/15/16 세대, Pro/Pro Max/Plus, 통신사 약정
  - LANE_READINESS ready 등록 (2 lane)
- 검증:
  - "아이폰 에어 자급제 256 아이폰17 에어" → `iphone-air-256-self` ✓
  - "아이폰에어 256골드" (자급제 X) → `iphone-air` broad ✓
- 위험: 낮음. iPhone Air는 2025 신상 라인 (별도). 기존 SKU 충돌 X.

## 3. Galaxy Z Flip 7 broad + narrow lane (256 self)

- 시간: 2026-05-15
- 변경:
  - **broad SKU**: `galaxy-z-flip-7` (mustContain "갤럭시 z플립7" 변형)
  - **narrow lane**: `galaxy_z_flip_7_256_self`
  - mustNotContain: Z Flip 3/4/5/6, 폴드, 통신사 약정
  - LANE_READINESS ready 등록 (1 lane)
- 검증:
  - "갤럭시 Z플립7 쉐도우블랙 256G" (자급제 X) → `galaxy-z-flip-7` broad ✓
  - "갤럭시 Z플립7 256GB SKT" (통신사) → broad ✓ (narrow reject)
- 위험: 낮음.

## 4. Production reclassify

- 시간: 2026-05-15
- 실행: scripts/reclassify-null-sku.ts (limit 2000, hours 24)
  - **13건 null sku_id → 신상 매칭**:
    - iphone-air: 3건
    - iphone-air-256-self: 1건 (narrow)
    - galaxy-z-flip-7: 1건
    - 기타 (iPhone 15/14, Apple Watch, gallaxy s24 등): 8건
- 위험: 매우 낮음. broad 매칭 정확.

## 5. 거론 금지

- iPhone Air 512GB self는 매물 측정 후 ready 유지 결정.
- Galaxy Z Flip 7 512GB self / Pro 모델 추가 — 매물 누적 후.
- iPhone 17 Pro / Pro Max — 아직 출시 안 됨. catalog 추가 보류.
