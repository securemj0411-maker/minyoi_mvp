# Wave 780~794 — Catalog narrow split / dilution fix 일괄 정리

- 시간: 2026-05-27 KST
- 트리거: owner — "모든 ready SKU 다 조사하라니까" → 자율 진행 (Wave 778 이후 15 wave).
- ⚠ 사후 정리 — 개별 wave commit 시 decision log 누락. 메모리 룰 (즉시 박기) lapse. 다음부턴 매 wave 즉시 박기.

## 처리 요약

총 15 wave (780~794) + 50+ 신규 SKU + ~2,500건 DB rematch.

| Wave | 작업 | 영향 매물 | commit |
|---|---|---|---|
| 780 | Dunk Mid/High broad 2개 신설 (owner Hi/Low 패턴) | 183 흡수 | `4adb9083` |
| 781 | NB 1906R + 2010 narrow 신설 | 225 rematch | `deb8fef0` |
| 782 | Seiko Grand Seiko + Alba narrow (22배 차이) | 198 rematch | `14cf3013` |
| 783 | Thom Browne tee/pants/jacket narrow (broad 545 → narrow) | 188 rematch | `b55c187c` |
| 784 | Seiko Presage/Credor/Premier/Brightz/Astron narrow 5개 | hygiene | `1171ead7` |
| 785 | AJ3 Fragment / AJ4 Travis / SB Pine Green collab narrow | 12 매물 | `4b267cff` |
| 786 | Galaxy Watch Thom Browne narrow (Watch 4/6/7) | 5건 매물 | `f2311d65` |
| **787** | **sport-golf 전동공구 차단 P0 bug** (임팩드라이버 6건 흡수) | 6건 cleanup | `825cbd51` |
| **788** | **galaxywatch-6 워치8 차단 + airpods-max stale rematch** | 10건 cleanup | `d8ecb5c1` |
| 789 | Acne Cardigan narrow 분리 | 14건 | `4eb5bbbc` |
| 790 | Mizuno Alpha version (JP/2/3) + Polo minor patch | 33건 | `cfe48f9d` |
| 791 | Thom Browne Shirt Premium (히든삼선/4선) narrow | 13건 | `2bf4a29e` |
| 792 | iPad Pro 13" M5/M4 2TB Cellular narrow | 7건 | `8b7bea93` |
| 793 | Apple Watch SE2 40mm/44mm narrow + broad patch | 538건 | `755b10f6` |
| **794** | **Wave 777~793 검토 후 critical 실수 4건 fix** | substring bug, NB variant, Watch 8 leak | `8c47cb26` |

## Wave별 상세

### Wave 780 — Dunk Mid/High broad 신설
- DB 검증: Dunk Low narrow 36개 있는데 Mid/High broad SKU 자체 없음 → 매물 ~183건 null sku_id drop.
- owner 짚은 조던 Hi/Low 패턴 동일 누락.
- 신규: `shoe-nike-dunk-mid-broad` (₩159K), `shoe-nike-dunk-high-broad` (₩169K).

### Wave 781 — NB 1906R / 2010 신설
- DB 매물: 1906R 201건 (median ₩119K), 2010 24건 (₩262K). catalog 누락 → null drop.
- (NB 9060 은 이미 catalog 있음 — sweep agent 부정확).
- ⚠ Wave 794 에서 C3 fix: 1906A (러닝) / 1906L (로퍼) variant 누락 추가 신설.

### Wave 782 — Seiko Grand Seiko + Alba narrow
- DB 검증: Grand Seiko 141건 (median ₩2.4M) vs Alba 57건 (₩110K) — 시세 22배 차이.
- broad (₩250K) 와 큰 dilution.
- 신규: `watch-seiko-grand-seiko`, `watch-seiko-alba`.

### Wave 783 — Thom Browne tee/pants/jacket narrow
- thombrowne-apparel-broad 545건 audit: tee 87 / pants 56 / jacket 45 시세 dilution.
- 기존 shirt/sweat-hoodie/suit-coat/cardigan/knit/4bar 외 누락 product type 신설.
- ⚠ Wave 794 C1 fix: tee SKU mustNotContain "셔츠" 가 "티셔츠" substring 차단 (35% dead) → 토큰 정밀화.

### Wave 784 — Seiko 나머지 sub-line narrow 5개
- Wave 782 (Grand Seiko + Alba) 후속. 일관성 위해 나머지 sub-line.
- 신규: Presage / Credor / Premier / Brightz / Astron.
- 매물 4~28건 (적지만 owner "다 끝내" 요청).

### Wave 785 — AJ3/AJ4 collab narrow
- DB 매물: AJ3 Fragment 7건 / AJ4 Travis 3건 / AJ4 SB Pine Green 2건. broad mustNotContain 차단되어 null drop.
- 매물 적지만 시세 거품 큼 (AJ4 Travis ₩440K vs broad ₩300K).

### Wave 786 — Galaxy Watch Thom Browne narrow (4/6/7)
- Wave 778 mustNotContain patch 후속. narrow SKU 신설로 시세 정확.
- 매물 각 1~2건 (Watch 4 톰브라운 ₩1.18M).

### Wave 787 — sport-golf 전동공구 차단 (P0 catalog bug)
- 검증 sample 발견: "임팩 드라이버" (전동공구) 6건이 골프 풀세트 SKU 에 흡수.
- "드라이버" 토큰이 골프 클럽뿐 아니라 전동드릴/임팩드라이버도 매칭.
- mustNotContain 추가: "임팩"/"임펙"/"impact"/"전동", battery 표기, bosch/마끼다/디월트/밀워키 등.

### Wave 788 — galaxywatch-6 워치8 차단 + airpods-max stale rematch
- P0 bug: galaxywatch-6 에 워치 8 매물 3건 흡수.
- P1 stale: airpods-max 10건 중 7건이 USB-C 2세대 (Wave 765/885 catalog patch 후 rematch 미됨).
- ⚠ Wave 794 C4 fix: galaxywatch-4/5/7 SKU 에 "Watch 8" 차단 안 박혀서 36건 leak — 추가 patch.

### Wave 789 — Acne Cardigan narrow
- sample 발견: clothing-acne-knit 에 RAYA 모헤어 가디건 흡수 (₩105K).
- 가디건 별도 SKU + knit mustNotContain 에 가디건 차단.
- ⚠ Wave 794 C2 fix: cardigan SKU mustNotContain "니트/knit" 가 "니트 가디건" 차단 (22% dead) → 제거.

### Wave 790 — Mizuno Alpha version + Polo minor patch
- Mizuno Alpha 9건 (Alpha JP MD ₩150K vs Alpha3 ₩71K) version dilution.
- 신규: alpha-japan / alpha-2 / alpha-3 narrow.
- Polo Pique Classic: "몽벨 재팬" 차단 (1건 흡수)
- Polo Pony Tee: 디젤/콜핑/pearly gates/듀빅 차단 (sample 4건 흡수)

### Wave 791 — Thom Browne Shirt Premium 분리
- sample 발견: 히든삼선 ₩350K vs 옥스포드 ₩130K (2.7배 차이).
- basic (shirt) vs premium (히든삼선/4선) 분리.
- 신규: `clothing-thombrowne-shirt-premium` (msrp ₩850K).

### Wave 792 — iPad Pro 13" 2TB Cellular narrow
- ipad-pro broad 12건 잔존 sample: M5 13" 2TB Cell 6건 + M4 13" 2TB Cell 1건 ₩3.3~3.99M.
- premium tier (top spec) 가 256GB narrow 와 별도 시세군이라 분리.
- 신규: ipad-pro-13-m5-2tb-cellular / m4-2tb-cellular.

### Wave 793 — Apple Watch SE2 40mm/44mm narrow
- SE2 9 ready 사이즈 dilution.
- 신규: applewatch-se2-40mm (₩329K), applewatch-se2-44mm (₩359K).
- ⚠ Warning W3: broad mustNotContain 에 "40mm/44mm" 추가하면서 broad 매물 13% 만 잡힘 (의도된 분리).

### Wave 794 — 검토 후 critical 실수 4건 fix
- 검토 agent 가 Wave 777~793 변경 정밀 점검 → critical 4건 발견.
- C1: Wave 783 TB tee "셔츠" substring 차단 → 35% dead → mustNotContain 토큰 정밀화.
- C2: Wave 789 Acne Cardigan "니트" 차단 → 22% dead → 제거.
- C3: Wave 781 NB 1906A/1906L variant 누락 → 신규 SKU 2개.
- C4: Wave 788 galaxywatch-4/5/7 에 Watch 8 차단 누락 → 추가 patch.

## 검증 시점

24h 후 cron tick 완료. 신규 SKU 매물 분포 확인 query:
```sql
SELECT sku_id, COUNT(*) FROM mvp_raw_listings 
WHERE sku_id IN (
  'shoe-nike-dunk-mid-broad', 'shoe-nike-dunk-high-broad',
  'shoe-newbalance-1906r', 'shoe-newbalance-1906a', 'shoe-newbalance-1906l', 'shoe-newbalance-2010',
  'watch-seiko-grand-seiko', 'watch-seiko-alba', 'watch-seiko-presage', 'watch-seiko-credor',
  'clothing-thombrowne-tee', 'clothing-thombrowne-pants', 'clothing-thombrowne-jacket',
  'clothing-thombrowne-shirt-premium', 'clothing-acne-cardigan',
  'shoe-mizuno-alpha-japan', 'shoe-mizuno-alpha-2', 'shoe-mizuno-alpha-3',
  'shoe-nike-airjordan-3-fragment', 'shoe-nike-airjordan-4-travis-scott', 'shoe-nike-airjordan-4-sb-pine-green',
  'galaxywatch-4-thombrowne', 'galaxywatch-6-thombrowne', 'galaxywatch-7-thombrowne',
  'ipad-pro-13-m5-2tb-cellular', 'ipad-pro-13-m4-2tb-cellular',
  'applewatch-se2-40mm', 'applewatch-se2-44mm'
) AND listing_state='active'
GROUP BY sku_id ORDER BY 2 DESC;
```

## Follow-up

- ⚠ **decision log 즉시 박기 룰 lapse** 재발 방지 — 다음부터 각 wave commit 직전 docs/DECISIONS/ 박기.
- W4 (MBP16 Max msrp ₩5.49M → ₩6.49M) / W6 (Seiko Premier msrp ₩500K → ₩290K) — 정가 확인 후 patch.
- W2 (Seiko broad 에 sub-line 차단 누락) — hygiene patch.
- sweep agent 자료 부정확 패턴 — 매 wave DB query 검증 필수 (NB 9060 / PS5 standard 등 이미 catalog 있는데 "누락" 보고).
- substring tokenHit 패턴 (셔츠 → 티셔츠, 니트 → 니트 가디건) 운영 룰: mustNotContain 토큰 추가 시 mustContain 토큰의 substring 인지 검증.
