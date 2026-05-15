# Wave 114c — iPad Pro 12.9 → 13인치 NORMALIZATIONS

> Status: **applied (code + production).** 사용자 precision 우려 ("세대 옵션 모델명 스페셜에디션 고급모델 파서 정확한거 확실함?") → 체계적 audit 실시 → 발견.

CLAUDE.md 6 필드 포맷.

## 1. 진단 — precision audit 70 test case

- 시간: 2026-05-15
- 발견:
  - audit-precision-wave114.ts 39 test: 35 pass (4 fail = 정책 의도 3 + broad noise 1)
  - audit-special-editions.ts 31 test: 30 pass (1 fail = iPad 12.9 표기)
  - **1 fail**: "아이패드 프로 12.9 M4 256 와이파이" → broad ipad-pro (expected ipad-pro-13-m4-256-wifi)
- 변경: 측정만.
- 다음: 12.9 → 13인치 변환.

## 2. Production 매물 빈도 측정 — 12.9 vs 13인치

- 시간: 2026-05-15
- 발견: 7일 iPad Pro 매물 1,204건 중
  - **"12.9" 표기: 315건 (26%)** ⭐
  - **"13인치" 표기: 86건 (7%)**
  - 12.9가 4배 많음. Apple은 M4 (2024)부터 12.9 → 13인치 명칭 변경했으나 매물 표기는 12.9 압도적.
- 변경: 측정만.
- 다음: NORMALIZATIONS 추가.

## 3. NORMALIZATIONS 추가 — "아이패드 프로 12.9" → "아이패드 프로 13인치"

- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)** NORMALIZATIONS 추가:
  ```typescript
  [/(아이패드\s*프로)\s*12\.9/g, " $1 13인치 "],
  [/(ipad\s*pro)\s*12\.9/gi, " $1 13in "],
  ```
  - M2/M4 모두 같은 12.9인치 디스플레이라 narrow lane 매칭 가능 (변형 흡수, 의미 동일).
  - LAUNCH_PLAN 12b 정책 부합: "변형 흡수는 OK (같은 의미 다른 표현)".
- 검증:
  - 31/31 audit pass
  - 139/139 test pass
  - production reclassify (ipad-pro broad 12.9 매물 164건 sweep): 1건 narrow 매칭 (storage/connectivity 다양해 대부분 narrow strict reject — 정상)

## 4. Precision audit 종합 결과 (사용자 우려 응답)

| 영역 | Pass | 결과 |
|---|---:|---|
| 세대 격리 (M1/M2/M3/M4, S22~S26, iPhone 13~16) | 100% | ✓ |
| 옵션 격리 (storage 128/256/512, RAM, cellular/wifi) | 100% | ✓ |
| 모델명 (Pro vs Pro Max vs Plus vs Ultra) | 100% | ✓ |
| 스페셜에디션 (Edge, FE, 한정판, Jennie) | 100% | ✓ |
| 고급 모델 (Ultra, Pro Max, 13인치) | 100% | ✓ |
| 자급제 vs 통신사 noise | narrow 100% / broad 약점 | broad에 통신사 reject 없음 (정책 question) |

## 5. 거론 금지

- broad SKU 통신사 reject 정책 — 7일 production 1건만 발견 (매우 적음). owner decision: broad에 통신사 noise 추가 vs 현 상태 유지.
- M2 narrow lane RAM 8GB 명시 강제 — M3 narrow는 RAM 자유. 일관성 X. LAUNCH_PLAN 1.6e 의도 정책이나 일관성 검토 필요.
- iPad Pro M2 narrow lane "ipad-pro-13-m2-256-wifi" — M2는 사실 12.9인치 모델인데 SKU id는 13. catalog는 명칭만 통일 (Apple과 동일).
- 13 Pro 256 self / 12 Pro 256 self — catalog X (sample 부족, AI L2 후보).
