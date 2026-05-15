# Wave 112 — 신상/누락 catalog: Galaxy FE + S26 + iMac M4

> Status: **applied (code + production).** session compact 후 첫 wave. sweep null sku 매물 분석으로 누락 broad catalog 7개 추가.

CLAUDE.md 6 필드 포맷.

## 1. 진단 — sweep null sku 매물 분포 측정

- 시간: 2026-05-15
- 발견:
  - 2시간 sweep null sku 매물 cat별:
    - category:405 (신발) 351, 600700 (휴대폰) 332, 600500 (오디오) 319, 430 (가방) 301, 700600 (골프) 297, 600600 (게임) 276, 600100 (PC) 264, 421 (시계) 262
    - brand keyword query null: 에어팟 21, 갤럭시 S25 14, 아이맥 10, 갤럭시 S23 9, 아이폰 16 6
  - brand keyword sample 분석 결과 catalog 누락 발견:
    - **Galaxy S23 FE** — "갤럭시S23FE 256기가 그라파이트" 등 8건+ (S23 FE 라인 별도 모델, 저가)
    - **Galaxy S24 FE** — "갤럭시S24FE 256기가 그레이" 등 3건
    - **Galaxy S25 FE** — "갤럭시 S25 FE 256GB 판매" 1건
    - **Galaxy S26 / S26 Ultra / S26 Plus** — "갤럭시 S26 울트라 512GB" 등 7건+ (2026-01 신상)
    - **iMac M4** — "아이맥 m4 256 기본형" 1건 (Apple 2024-10 신상)
- 변경: 측정만.
- 다음: 7개 SKU catalog 추가.

## 2. Galaxy S23/S24/S25 FE broad SKU 3개

- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)** galaxy-z-flip-5-256-self 직전에 3 SKU 추가:
  - `galaxy-s23-fe` — mustContain "s23 fe"/"s23fe"/"팬에디션", mustNotContain "울트라/플러스"
  - `galaxy-s24-fe` — mustContain "s24 fe"/"s24fe"/"팬에디션"
  - `galaxy-s25-fe` — mustContain "s25 fe"/"s25fe"/"팬에디션"
- 검증:
  - "갤럭시S23FE 256기가 그라파이트" → `galaxy-s23-fe` ✓
  - "(25년개통) 특S급 갤럭시S24FE 256기가 그레이" → `galaxy-s24-fe` ✓
  - "갤럭시 S25 FE 256GB 판매" → `galaxy-s25-fe` ✓
- 위험: 매우 낮음. FE는 일반/Ultra/Plus와 별도 token 매칭. 기존 narrow lane (galaxy-s23-256-self 등) mustNotContain "fe" 있어 충돌 없음.

## 3. Galaxy S26 broad + Plus + Ultra 3개 (2026 신상)

- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)** FE 시리즈 직후에 3 SKU 추가:
  - `galaxy-s26` — mustContain "s26", mustNotContain "울트라/플러스/fe/팬에디션"
  - `galaxy-s26-plus` — mustContain "s26 plus"/"s26+", mustNotContain "울트라/fe"
  - `galaxy-s26-ultra` — mustContain "s26 ultra", mustNotContain "플러스/fe"
- 검증:
  - "[미개봉] 갤럭시 S26 울트라 512GB 실버새도우" → `galaxy-s26-ultra` ✓
  - "갤럭시 S26 일반 256 화이트 초특가" → `galaxy-s26` ✓
  - "Kt 갤럭시 s26 256GB" → `galaxy-s26` ✓
- 위험: 매우 낮음. S25 broad mustContain "s25"는 S26 텍스트에 "s25" 미포함이라 충돌 X. 기존 S25 narrow self / S23/24 Ultra self mustNotContain에 "s26" 이미 박혀있음 (Wave 108).

## 4. iMac M4 24" (Apple 2024-10 신상)

- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)** desktop-mac-studio-m4-max-512 직전에 추가:
  - `desktop-imac-m4-24` — laneKey `desktop_imac_m4_24`, mustContain ["imac","아이맥"]+["m4"]
  - mustNotContain: M1/M2/M3, intel 21"/27", 다른 Mac 모델, 부품/단품, 매입
- 검증: "아이맥 m4 256 기본형" → `desktop-imac-m4-24` ✓
- 위험: 매우 낮음. M3 24" / M1 24" catalog는 chip 명시 매칭이라 격리됨.

## 5. Production reclassify

- 시간: 2026-05-15
- 실행: scripts/reclassify-null-sku.ts (limit 1000, hours 24)
  - 23건 null sku_id → 매칭
  - 누락 카테고리 매칭: galaxy-s25-fe (1), galaxy-s26-plus (1), switch-2 (2), 패션 (bag/shoe) 5건 등
- 검증: 139/139 test pass. tsc clean (`/plans` validator 함정만 — 알려진 별도 issue).
- 위험: 매우 낮음. broad 매칭만이라 narrow lane 정확성 영향 X.

## 6. 거론 금지

- S23/S24 broad SKU 추가 — 정책상 narrow lane (자급제 256 self)만 운영. broad는 의도적 누락. 현재 S25만 broad 존재. 일관성 유지.
- S26 256 self narrow lane — 매물 누적 1주 후 측정. 현재 broad만.
- iMac M4 narrow (RAM/storage 변형) — broad 1건 sample 부족. 24h+ 측정 후.
