# Wave 731 — Adidas apparel broad 6 SKU 신설

**날짜**: 2026-05-24
**Owner**: Claude

## 배경
Wave 730 Nike apparel pattern과 동일. Adidas 3,071건 brand bucket 중 대부분 shoe noise.

apparel-only 정제 후 측정: 162건 unmatched.

## 발견 (filter: shoe noise 차단, 30-300k)

| Bucket | Cnt | p50 | 처리 |
|--------|-----|-----|------|
| 13_tee | 34 | 4.4만 | ✓ 신설 |
| 10_windbreaker | 32 | 7.7만 | ✓ 신설 (fleece 4건 통합) |
| 12_hoodie | 30 | 10.0만 | ✓ 신설 (sweat 12건 통합) |
| 16_pants_shorts | 18 | 14.5만 | ✓ 신설 |
| 11_sweat_crewneck | 12 | 13.7만 | hoodie 통합 |
| 03_trefoil_basic | 8 | 5.0만 | broad에서 catch — 별 vintage SKU는 별 wave |
| 14_down_padding | 7 | 6.3만 | ✓ 신설 |
| 02_tracksuit_other | 7 | 4.9만 | ✓ 신설 (firebird 4건 통합) |
| 01_firebird_tracksuit | 4 | 6.2만 | tracksuit 통합 |
| 15_fleece | 4 | 7.5만 | windbreaker 통합 |
| 05_y3 | 3 | premium tier 별 후속 |

## 결정
6 broad SKU 신설:
- `adidas_tracksuit_broad` (11건) — Firebird 시그니처 + 일반
- `adidas_tee_broad` (34건)
- `adidas_windbreaker_broad` (36건)
- `adidas_hoodie_sweat_broad` (42건)
- `adidas_pants_shorts_broad` (18건)
- `adidas_down_padding_broad` (7건)

총 ~148건 회수.

## Skip (별 wave)
- Y-3 premium 3건 → 별 SKU
- Gosha/Prada/Balenciaga/ThugClub collab → 차단 (이미 narrow SKU 존재)
- 빈티지 (trefoil archive 등) → Wave 715 narrow와 중복 방지 위해 broad에서 차단

## 정책 부합
- Adidas 일반 brand (사용자 정책 "일반인 친화")
- 가격대 4-15만 친화적
- shoe noise (Samba/Gazelle/Stan Smith 등 15+) 강력 차단
