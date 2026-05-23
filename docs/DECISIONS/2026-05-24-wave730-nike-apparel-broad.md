# Wave 730 — Nike apparel broad 5 SKU 신설

**날짜**: 2026-05-24
**Owner**: Claude

## 배경
Pareto sweep 결과 Nike 9,522건 unmatched (last 14d). 그 중 95%는 shoe noise (brand bucket이 카테고리 무관).

실 apparel unmatched는 326건 — Nike apparel broad SKU가 거의 없는 게 root cause.

## 발견 (filter: shoe noise 28+ 키워드 차단, 30-300k 가격대)

| Bucket | Cnt | p50 | 처리 |
|--------|-----|-----|------|
| 06_golf | 53 | 48k | Wave 727 golf cycle (별도) |
| 03_dri_fit_therma | 52 | 50k | ✓ 신설 |
| 04_stussy_collab | 51 | 140k | stussy_nike_collab leak (Wave 731) |
| 07_windbreaker_generic | 47 | 60k | ✓ 신설 (윈드러너 4건 포함) |
| 11_hoodie | 25 | 52k | ✓ 신설 (sweat 11과 합쳐서 36건) |
| 12_tee | 23 | 60k | ✓ 신설 |
| 05_other_collab | 19 | 105k | Wave 731 (Sacai/CDG/언더커버 narrow) |
| 15_pants_shorts | 16 | 117k | ✓ 신설 |
| 10_sweat | 11 | 43k | (hoodie와 합침) |
| 13_down_padding | 5 | 99k | broad에 포함 |
| 01_tech_fleece | 4 | 102k | tech_fleece signature 별 후속 |

## 결정
5 broad SKU 신설:
- `nike_dri_fit_therma_broad` (52건)
- `nike_windbreaker_broad` (47+4=51건, windrunner 포함)
- `nike_hoodie_sweat_broad` (36건)
- `nike_tee_broad` (23건)
- `nike_pants_shorts_broad` (16건)

총 175건 회수 예상.

## Skip (별 wave)
- Nike Golf 53건 → Wave 727 follow-up (nike_golf_broad)
- Stussy collab 51건 leak → Wave 731 (stussy_nike_collab mustContain 확장)
- Sacai/CDG/언더커버 collab 19건 → Wave 731+ narrow split
- Tech Fleece signature → premium SKU 후속

## 정책 부합
- Nike 일반 brand (사용자 정책 "일반인 친화" 부합)
- 가격대 50-117k 친화적
- shoe/bag/cap noise 강력 차단 (28+ shoe 모델명 + 가방/모자/시계)
