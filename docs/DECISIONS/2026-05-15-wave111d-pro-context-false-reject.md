# Wave 111d — "프로" 단독 mustNotContain false reject fix

> Status: **applied (code).** owner "vertical 끊지말고" 자율. iPad Air/Mini narrow lane mustNotContain "프로" 단독이 "**애플펜슬 프로**" 매물 false reject.

CLAUDE.md 6 필드 포맷.

## 1. iPad Air M2 audit — null 6건 분석

- 시간: 2026-05-15
- 발견: scripts/audit-ipad-air-m2.ts mining sample 42건 분석:
  - narrow 매칭 24건 (57.1%)
  - **null 6건** — 다 "애플펜슬 프로" 또는 "펜슬 프로" 같이 적힌 매물
  - 매물 sample:
    - "아이패드 에어 M2 11인치 실버 256기가 + 애플펜슬 프로"
    - "아이패드 에어11(m2)+애플펜슬 프로 스타라이트 256"
    - "급처 아이패드에어 M2 11 256GB WIFI A급 풀박스+애플펜슬프로"
  - **버그**: iPad Air M2/M3, iPad mini 7 lane mustNotContain `"프로", "pro"` 단독 — "애플펜슬 프로" / "magic keyboard pro" 같은 액세서리 표기에서 hit → narrow false reject
- 변경: 측정만.
- 다음: "프로" → context narrow.

## 2. iPad Air M2/M3/Mini 7 "프로" context narrow

- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)** 3 lane mustNotContain:
  - `"프로", "pro"` (단독) → `"아이패드 프로", "아이패드프로", "ipad pro"` (context 명시)
  - iPad Air M2: line 989
  - iPad Air M3: line 1238
  - iPad mini 7: line 1064
- 효과: "애플펜슬 프로" / "매직키보드 프로" / "펜슬프로" 등 액세서리 표기 false reject 차단. "아이패드 프로" 명시 매물만 reject (정확).
- 검증:
  - tsc clean, lint 0, 139/139 test pass
  - iPad Air M2 audit: 57.1% → **66.7%** (+9.6%p, null 6 → 2)
  - iPad mini 7 audit: 45% → **50%** (+5%p, null 26 → 17)
  - production reclassify: 6건 추가 narrow 흡수 (ipad-mini → mini 7: 5, ipad-air → M2: 1)
- 위험: 매우 낮음. 다른 "프로" 매물 (예: "iPad Pro 11 vs Air 11") 명시 안 한 매물은 영향 없음.
- 다음:
  - Galaxy Tab S10 Ultra (mustNotContain "프로", "pro") 같은 lane도 audit 검토
  - iPhone 일반 self (15/16) 다 "프로" 단독 mustNotContain — 단 "애플펜슬 프로" 표기 매물 iPhone에 거의 없어 risk 작음. 측정 후 결정.

## 3. 거론 금지

- 모든 narrow lane의 "프로" 단독 일괄 변경 — 각 카테고리별 false reject 비율 다름. lane별 audit 후 적용.
- iPad Pro mustContain "프로" 그대로 유지 (Pro lane이라 "프로" 필수).
