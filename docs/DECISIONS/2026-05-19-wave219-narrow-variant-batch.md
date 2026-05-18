# Wave 219 — broad SKU narrow variant 7 SKU batch 분리 (2026-05-19)

## 사용자 명시

> "당연히 좋은거면 묻지말고해라;"

→ Wave 218 후속 7 broad SKU narrow 분리 자율 진행.

## 진단 결과 (Wave 218 보류 후보)

| sku_id | CV | 문제 |
|--------|----|------|
| clothing-tnf-supreme-collab | 0.78 | 자켓/백팩/티/슬리퍼/지샥 collab 묶임 |
| clothing-acne-apparel | 0.73 | 티/맨투맨/자켓/데님/셔츠 묶임 |
| clothing-patagonia | 0.61 | Retro X/다운/Shell 묶임 |
| clothing-mlb-cap | 1.40 | 일반 vs Gucci(320K)/Nike(62K)/Murakami(180K) collab 묶임 |
| shoe-margiela-tabi | 1.84 | 스니커즈/부츠/슬리퍼 묶임 (가격 X 2) |
| shoe-nike-blazer-broad | 1.51 | Mid/Low/Hi/77/Platform 묶임 |
| shoe-nike-airforce-1-low-black | 1.68 | **catalog 없음 (orphan sku_id)** — 별도 cleanup |

## 신규 narrow SKU 박음 (20개)

### MLB collab 3 (가격 X 6.5)
- `clothing-mlb-cap-gucci-collab` — Gucci × MLB 480K
- `clothing-mlb-cap-nike-collab` — Nike × MLB 79K
- `clothing-mlb-cap-murakami-collab` — Murakami × MLB 9twenty 220K
- `clothing-mlb-cap` broad — mustNotContain 강화 (위 collab 키워드 제외)

### Patagonia 3 (모델별 가격대 다름)
- `clothing-patagonia-retro-x` — Retro X / Synchilla / Snap-T 199K
- `clothing-patagonia-down` — Nano Puff / Down Sweater 290K
- `clothing-patagonia-shell` — Torrentshell / 바람막이 199K
- `clothing-patagonia` broad — 위 키워드 mustNotContain

### Acne Studios 5 (product type 다양)
- `clothing-acne-tee` — Tee / Long-Sleeve 130K
- `clothing-acne-sweat` — Sweat / Hoodie (Fairview) 230K
- `clothing-acne-jacket-coat` — Jacket / Coat 590K
- `clothing-acne-denim` — Jean / Shorts 320K
- `clothing-acne-shirt` — Shirt 380K
- `clothing-acne-apparel` broad — 위 키워드 mustNotContain

### Supreme × TNF 3 + cross-category (자켓/백팩/슬리퍼/지샥)
- `bag-tnf-supreme-backpack` — Backpack/Shoulder/Tote 320K
- `shoe-tnf-supreme-slipper` — Mule/Slipper 350K (shoe 카테고리)
- `clothing-tnf-supreme-gshock` — G-Shock DW-6900 한정 320K
- `clothing-tnf-supreme-collab` broad — 자켓/티/맨투맨만

### Margiela Tabi 3 (product type)
- `shoe-margiela-tabi-sneaker` — Sneaker (Low/High) 1090K
- `shoe-margiela-tabi-boot` — Boot 1290K
- `shoe-margiela-tabi-slipper` — Slipper/Espadrille 690K
- `shoe-margiela-tabi` broad — 일반 타비

### Nike Blazer 3 (variant)
- `shoe-nike-blazer-mid` — Mid / Mid 77 119K
- `shoe-nike-blazer-low` — Low / Low 77 / Platform 99K
- `shoe-nike-blazer-high` — Hi / High 129K
- `shoe-nike-blazer-broad` — broad fallback

## LANE_READINESS 20 신규 등록 (다 ready)

mlb_cap_gucci_collab / mlb_cap_nike_collab / mlb_cap_murakami_collab
patagonia_retro_x / patagonia_down / patagonia_shell
acne_tee / acne_sweat / acne_jacket_coat / acne_denim / acne_shirt
tnf_supreme_backpack / tnf_supreme_slipper / tnf_supreme_gshock
margiela_tabi_sneaker / margiela_tabi_boot / margiela_tabi_slipper
nike_blazer_mid / nike_blazer_low / nike_blazer_high

기존 6 broad lane label 도 "broad fallback" 으로 업데이트.

## verify

- test:core **560/561 pass** (fail 1건 — `me-comment-count-gate-contract` 다른 wave 무관)
- ruleMatch `tryNarrowLanePromotion` (Wave 108) — narrow 우선 매칭

## skip

- `shoe-nike-airforce-1-low-black` — catalog 에 없는 orphan sku_id (raw_listings 79건). 별도 cleanup wave 처리.

## 다음 자연 처리

- 자연 cron 매물 reparse → 새 narrow SKU 매칭
- 시세 daily condition_class × variant 분리 → spread ratio 감소 측정 (Wave 220 후속)

## decision log

20 신규 narrow SKU + 20 LANE_READINESS + 6 broad mustNotContain 강화. catalog 완벽도 ↑↑.
