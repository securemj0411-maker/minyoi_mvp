# Wave 114 — iPhone Pro 256GB 자급제 narrow lane 3개

> Status: **applied (code + production).** Wave 113 macbook reclassify 후 iPhone broad → narrow audit에서 발견. iPhone Pro 256 자급제 narrow lane이 catalog에 없어 Pro 128 lane만 운영. 256은 broad에 흡수 중.

CLAUDE.md 6 필드 포맷.

## 1. 진단 — broad iphone-15-pro/16-pro 매물 audit

- 시간: 2026-05-15
- 발견:
  - 7일 broad SKU 매물 audit (iphone-15-pro/16-pro/14-pro/13-pro)
  - **자급제+256 명시 매물 16건 발견**, 그중 Pro Max 외 일반 Pro 5건+:
    - "아이폰 16프로 256 데저트티타늄 자급제 배터리100"
    - "아이폰 16프로 256기가 블랙 애플케어O 자급제"
    - "자급제) 아이폰 16프로 256 기가 판매합니다"
    - "아이폰 15프로 256 블랙티타늄 자급제"
    - "아이폰15프로 화이트 256기가 (자급제)"
    - "아이폰 16프로 256 블랙티타늄 자급제 풀셋"
  - **catalog 누락**:
    - iphone-15-pro-128-self ✓ / iphone-15-pro-256-self ❌
    - iphone-16-pro-128-self ✓ / iphone-16-pro-256-self ❌
    - iphone-14-pro-128-self ✓ / iphone-14-pro-256-self ❌
- 변경: 측정만.
- 다음: 3개 narrow lane 추가.

## 2. iPhone 15 Pro / 16 Pro / 14 Pro 256GB 자급제 narrow lane 3개

- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)** iphone-16e 직전에 3 SKU 추가:
  - `iphone-15-pro-256-self` (laneKey iphone_15_pro_256gb_self, msrp 1,700k)
  - `iphone-16-pro-256-self` (laneKey iphone_16_pro_256gb_self, msrp 1,850k)
  - `iphone-14-pro-256-self` (laneKey iphone_14_pro_256gb_self, msrp 1,550k)
- 공통 패턴:
  - mustContain: 모델명 + 256GB + 자급제
  - mustNotContain: Pro Max, Plus, 인접 세대 (-1/+1), 128/512/1TB, 통신사 약정
- **[mvp/src/lib/category-readiness.ts](mvp/src/lib/category-readiness.ts)** LANE_READINESS 3 entry 추가 (status: "ready").
- 검증:
  - 139/139 test pass
  - audit script 재실행: 3건 narrow lane 흡수 가능 매물 발견
  - production reclassify: **2건 iphone-16-pro → iphone-16-pro-256-self** 즉시 이동

## 3. 거론 금지

- iPhone 15/16 Pro 512GB / 1TB self narrow lane — 매물 누적 후 추가 검토. 현재 broad에서 reject (mustNotContain "512gb").
- iPhone 13 Pro 256 self — 매물 sample 적음. 더 누적 후 추가.
- Pro Max 256 self는 Wave 108에서 이미 추가 (iphone-15-pro-max-256-self, iphone-16-pro-max-256-self).
