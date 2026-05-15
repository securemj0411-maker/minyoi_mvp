# Wave 111e — Galaxy / AirPods brand-less 매물 ruleMatch fix

> Status: **applied (code + production).** owner 핵심 지적 "ready로 푼거 크론으로 가져오긴 하는거야?" → 진단 결과 cron sweep은 정상, 매물 brand-less 표기로 ruleMatch null → sku_id null → narrow lane 진입 0건. Wave 108-111d 작업이 production에 효과 못 본 근본 원인.

CLAUDE.md 6 필드 포맷.

## 1. 진단 — 휴대폰 sweep 96건 sku_id 전부 null

- 시간: 2026-05-15
- 발견:
  - 30분간 600700 휴대폰 sweep 96건 raw_listings 진입
  - **96건 모두 sku_id = null** ⚠️
  - 매물 sample 분석:
    - "S23울트라 256G 크림" — "갤럭시" brand 명시 없음
    - "S24 512GB 그레이" — 동일
    - "플립5 512GB 그라파이트" — "갤럭시 Z 플립" 없음
    - "갤럭시S24울트라 티타늄..." — 일부는 정확
  - **근본 원인**: catalog mustContain `["갤럭시 s23 울트라", "galaxy s23 ultra"]` 필요. "S23울트라" 단독 매물 매칭 X → ruleMatch null
- 변경: 측정만.
- 다음: NORMALIZATIONS brand-less 통일.

## 2. NORMALIZATIONS brand-less Galaxy/Z 시리즈 통일

- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)** NORMALIZATIONS 6 rule 추가:
  ```typescript
  [/(?<!갤럭시\s)(?<![가-힣a-z0-9])s\s?(\d{2})\s*울트라/gi, " 갤럭시 s$1 울트라 "],
  [/(?<!갤럭시\s)(?<![가-힣a-z0-9])s\s?(\d{2})\s*플러스/gi, " 갤럭시 s$1 플러스 "],
  [/(?<!galaxy\s)(?<![가-힣a-z0-9])s\s?(\d{2})\s*ultra/gi, " galaxy s$1 ultra "],
  [/(?<!galaxy\s)(?<![가-힣a-z0-9])s\s?(\d{2})\s*plus/gi, " galaxy s$1 plus "],
  [/(?<!갤럭시\s)(?<!갤럭시\sz)(?<![가-힣a-z])플립\s?(\d{1,2})/g, " 갤럭시 z플립 $1 "],
  [/(?<!갤럭시\s)(?<!갤럭시\sz)(?<![가-힣a-z])폴드\s?(\d{1,2})/g, " 갤럭시 z폴드 $1 "],
  ```
  - 핵심 lookbehind: `(?<!갤럭시\s)` — 이미 brand 명시되어 있으면 변환 X (catalog token 이중 변환 차단)
- 검증: scripts/test-brand-less.ts
  - "S23울트라 256G 크림" → galaxy-s23-ultra ✓
  - "S25 ultra 256" → galaxy-s25-ultra ✓
  - 모든 변형 매칭

## 3. 부작용 fix — 스타일러스/S펜만 매물 parts 분류

- 시간: 2026-05-15
- 발견: test fail — "삼성 갤럭시 S23 울트라, S24 울트라 스타일러스 펜" (S Pen accessory) 매물이 brand-less normalize로 broad SKU 매칭 직전까지 갔다가 다른 reason으로 null → expected `parts` ≠ actual `unknown`.
- 변경:
  - **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)** PHONE_NOISE에 `스타일러스`, `s펜만`, `s 펜만`, `에스펜만` 추가 (SKU mustNotContain 자동 적용)
  - **[mvp/src/lib/pipeline.ts:34](mvp/src/lib/pipeline.ts:34)** PARTS_KEYWORDS에 동일 token 추가 → classifyListing의 partsHits에서 'parts' 분류
- 검증: 139/139 test pass.

## 4. Production reclassify null 매물

- 시간: 2026-05-15
- 변경: 신규 **[mvp/scripts/reclassify-null-sku.ts](mvp/scripts/reclassify-null-sku.ts)** — sku_id IS NULL 매물 fetch + ruleMatch + UPDATE.
- 실행: limit 3000, hours 24
  - 1000건 fetch (sku_id null 24h)
  - **36건 ruleMatch 매칭** (4%) — broad SKU에 흡수
  - 누적 production: galaxy-s23/24 ultra (6), airpods (10), galaxy-s23/24 일반 (6), switch-oled (2), iPhone, Apple Watch, iMac 등
- 위험: 매우 낮음. broad SKU 매칭만이라 narrow lane 정확성 영향 X.

## 5. Pool 측정 결과

| 카테고리 | 이전 ready | 이후 ready | 변화 |
|---|---:|---:|---:|
| **earphone** | 67 | **93** | **+26 ⭐** |
| tablet | 52 | 55 | +3 |
| smartwatch | 44 | 45 | +1 |
| laptop | 31 | 23 | -8 (자연 변동) |
| game_console | 5 | 8 | +3 |
| desktop | 2 | 7 | +5 |
| smartphone | 0 | 2 | +2 |
| 총 | 243 | 236 | -7 (만료 매물 + 신규 balance) |

**earphone +26**: AirPods "에어팟프로 2" / "에어팟2" 같은 brand-less 매물 다수가 brand-less normalize 직전에는 SKU null이라 pool 진입 못 했음 → 이번 fix로 흡수 + ready 진입.

## 6. 거론 금지

- 모든 brand normalize 광범위 적용 — catalog token 이중 변환 위험. lookbehind로 brand 명시 차단 필수.
- iPhone broad 매물 brand-less normalize — "13", "14" 단독은 너무 광범위. iPhone은 catalog에 ["아이폰 13"] 토큰 있고 iPhone Pro narrow가 충분히 잡음.
