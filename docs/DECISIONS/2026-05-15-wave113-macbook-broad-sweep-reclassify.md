# Wave 113 — macbook null + 광범위 brand sweep reclassify + LAPTOP_NOISE 강화

> Status: **applied (code + production).** Wave 112 catalog 추가 후속. cron tick 주기에 sku_id 동기화 안 된 raw 매물 일제 반영. LAPTOP_NOISE 부족 발견 → 대여/렌탈/임대/보호필름 추가.

CLAUDE.md 6 필드 포맷.

## 1. 진단 — macbook M3 narrow lane 매칭 실패 추적

- 시간: 2026-05-15
- 발견:
  - "맥북에어 M3 13인치 스그색상 16메모리 256GB S급 풀박스" 매물 (5/12, 5/15 둘 다) sku_id=null + score_dirty=true
  - **ruleMatch 직접 호출 → `macbook-air-m3-13-256` 정확 매칭 가능** (catalog 문제 X)
  - 즉 cron pipeline의 score_dirty=true 매물을 sku_id 채우는 stage가 누락되거나 timing 지연. 매물이 raw_listings 진입 후 catalog 매칭이 자동 트리거되지 않음.
- 변경: 측정만.
- 다음: 강제 reclassify script 광범위 실행.

## 2. macbook-air 30일 광범위 reclassify

- 시간: 2026-05-15
- 변경: **신규 [mvp/scripts/reclassify-macbook-m3.ts](mvp/scripts/reclassify-macbook-m3.ts)** — sku null + macbook 패턴 30일 sweep.
- 실행:
  - 200건 fetch
  - **156건 매칭 (78%)**:
    - macbook-air (broad): 145건 ⭐
    - macbook-air-m3-13-256 (narrow): 7건
    - macbook-air-m2-13-256 (narrow): 4건
- 위험: 매우 낮음. catalog 매칭 정확.

## 3. Apple/Samsung brand 7일 광범위 reclassify

- 시간: 2026-05-15
- 변경: **신규 [mvp/scripts/reclassify-laptop-tablet-phone-broad.ts](mvp/scripts/reclassify-laptop-tablet-phone-broad.ts)** — 맥북/아이패드/아이폰/갤럭시/에어팟/아이맥 패턴 7일 sweep.
- 실행:
  - 1000건 fetch (PostgREST max)
  - **184건 매칭 (18%)**, 누적 Wave 112 신상 SKU 효과 ⭐:
    - **galaxy-s23-fe: 26건** ⭐
    - airpods-pro-2-lightning: 17
    - airpods-pro-2-usbc: 11
    - airpods-3: 10
    - airpods-2: 10
    - **galaxy-s26-ultra: 9건** ⭐
    - ipad-pro: 7
    - ipad-air: 7
    - airpods-pro-1: 6
    - airpods-pro-3: 6
    - airpods-max: 5
    - iphone-14: 5
    - galaxy-s23: 5
    - galaxy-s23-ultra: 4
    - **galaxy-s24-fe: 4건** ⭐
    - galaxy-s24: 4
    - ipad-11: 4
    - **galaxy-s26: 4건** ⭐
    - iphone-15-pro: 3
    - galaxy-s24-plus: 3
- 위험: 매우 낮음. broad 매칭 정확.

## 4. LAPTOP_NOISE 강화 — 대여/렌탈/임대/보호필름

- 시간: 2026-05-15
- 발견: macbook-air reclassify 후 audit → 3건 noise 매물 잘못 매칭:
  - "[대여]맥북에어13 M3 1일 단기 렌탈 임대 화상면접 영상편집" → macbook-air-m3-13-256 (잘못)
  - "[대여]맥북에어15 M3 1일 단기 렌탈 임대" → macbook-air (잘못)
  - "맥북 에어 M칩 15인치 사생활 탈부착 보호필름" → macbook-air (잘못)
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts) LAPTOP_NOISE** 추가:
  - "대여", "렌탈", "임대"
  - "보호필름", "보호 필름", "사생활 필름", "사생활 보호필름", "사생활 보호 필름"
- 검증:
  - 139/139 test pass
  - 3건 매물 sku_id NULL invalidate (직접 SQL UPDATE)
- 위험: 매우 낮음. broad macbook-air/macbook-pro에 spread되어 future 같은 패턴 자동 reject.

## 5. Wave 112 + 이전 신상 SKU 7일 매칭 누적

| SKU | 7일 매물 | 비고 |
|---|---:|---|
| galaxy-s23-fe | **26건** | Wave 112 (5/15) |
| galaxy-s26-ultra | **10건** | Wave 112 (5/15, 2026 신상) |
| ipad-11 | 6 | Wave 111g |
| switch-2 | 6 | Wave 111i |
| galaxy-s26 | **6** | Wave 112 |
| iphone-air | 4 | Wave 111f |
| galaxy-s24-fe | **4** | Wave 112 |
| galaxy-buds-4-pro | 2 | Wave 111h |
| galaxy-z-flip-7 | 2 | Wave 111f |
| galaxy-s25-fe | **2** | Wave 112 |
| galaxy-s26-plus | **1** | Wave 112 |
| desktop-imac-m4-24 | **1** | Wave 112 |
| iphone-air-256-self | 1 | Wave 111f (narrow) |
| **총** | **71건** | |

## 6. Wave 113b — MacBook 인치 표기 NORMALIZATIONS (commit ec32944)

- 시간: 2026-05-15 (Wave 113 후속)
- 발견: macbook-air broad 145건 reclassify 후 audit. "맥북에어13 M3 실버 256GB sss급" 매물 → broad만 매칭, narrow lane "13인치" 토큰 매칭 실패. **근본 원인**: 모델명+숫자 붙어쓴 "맥북에어13"의 "13"이 catalog mustContain ["13인치", "13 인치", "13형", `13"`] 어느 것에도 안 들어감.
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)** NORMALIZATIONS 10 rule 추가 (Wave 111 iPhone Pro 동일 패턴):
  ```typescript
  [/맥북\s*에어\s*13(?!\d|\.|인치|in)/g, " 맥북 에어 13인치 "],
  [/맥북\s*에어\s*15(?!\d|\.|인치|in)/g, " 맥북 에어 15인치 "],
  [/맥북\s*프로\s*13|14|16(?!\d|\.|인치|in)/g, " 맥북 프로 N인치 "],
  // macbook air/pro 13/14/15/16 영문 동일 변형
  ```
- 검증:
  - 139/139 test pass
  - 4건 audit 매물 narrow lane 진입 (M3 매물 ✓, M4 매물 broad ✓)
  - **production 2건 broad → narrow 재배치** (macbook-air→m3-13-256 1건, galaxy-s25→galaxy-s25-fe 1건 보너스)
- 위험: 매우 낮음. 변형 흡수 (의미 완화 X). lookahead로 이중 변환 차단.

## 7. 거론 금지

- Pool ready 폭증 — cron tick + pool-warmer 주기 후 (즉시 X). 24h 후 측정 권고.
- macbook M3/M4 narrow lane storage/RAM 미강제 — 정책상 chip+size만. 추후 narrow strengthening 검토.
- "구해요" / "구합니다" — 매입 매물. macbook narrow lane mustNotContain에 이미 "삽니다" 있으나 "구해요" 가능. 추후 audit.
- 시계/가전/명품 명품 시계 (롤렉스/파텍필립) — 사용자 사업 범위 외 (일반인 친화). catalog 추가 안 함.
- 갤럭시북 시리즈 (3/4/5/6) — 매물 다수지만 사용자 운영 catalog에 LG Gram만. 정책 결정 후 추가.
