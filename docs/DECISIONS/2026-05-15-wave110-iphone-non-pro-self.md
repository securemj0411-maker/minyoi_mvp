# Wave 110 — iPhone 15/16 일반(Pro 아닌) 256GB 자급제 narrow lane

> Status: **applied (code + production reclassify).**

CLAUDE.md 6 필드 포맷.

## 1. iPhone 15/16 256 self lane 신설

- 시간: 2026-05-15
- 발견: 매물 측정 (7일):
  - iphone-16 자급제 + 256 명시: 8건
  - iphone-15 자급제 + 256 명시: 6건
  - iphone-13/14 자급제 + 256: 5건 (적음)
- 변경:
  - **[mvp/src/lib/catalog.ts:572-639](mvp/src/lib/catalog.ts:572)** 2 SKU 추가:
    - `iphone-15-256-self` (laneKey `iphone_15_256gb_self`)
    - `iphone-16-256-self` (laneKey `iphone_16_256gb_self`)
  - mustNotContain: Pro/Pro Max/Plus/16e, 인접 세대, 통신사
  - **[mvp/src/lib/category-readiness.ts](mvp/src/lib/category-readiness.ts)** LANE_READINESS 2 lane ready 등록
- 검증:
  - tsc clean, lint 0, 139/139 test pass
  - scripts/test-iphone-15-16.ts:
    - "아이폰 15 256기가 자급제" → `iphone-15-256-self` ✓
    - "아이폰 16 256gb / 자급제 풀박스" → `iphone-16-256-self` ✓
    - "아이폰 16e 256 자급제" → `iphone-16e` ✓ (16e 차단)
    - "아이폰 15 256기가 SKT" → `iphone-15` broad ✓ (통신사 차단)
  - production reclassify:
    - 277 매물 처리, 9건 narrow 흡수
    - iphone-15 → iphone-15-256-self: 6
    - iphone-16 → iphone-16-256-self: 3
- 위험: 낮음. mustNotContain 강력, Pro와 충돌 시 null 반환 (정확성 보존).
- 다음:
  - Pool-warmer 다음 사이클 (~5분) 후 narrow lane ready 진입 측정
  - 매물 누적되면 더 큰 narrow lane (iPhone 13/14 self) 검토

## 2. 거론 금지

- iPhone 13/14 256 self lane 즉시 추가 — 매물 5건. ROI 작음. 2주 후 누적 측정 후 결정.
- iPhone 15/16 128/512GB self lane — 매물 측정 후 결정. 일단 256만.
