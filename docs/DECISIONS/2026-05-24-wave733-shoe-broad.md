# Wave 733 — 신발 broad 6 SKU 신설

**날짜**: 2026-05-24
**Owner**: Claude

## 배경
의류 cycle (Wave 727-732) 완료 → 신발 카테고리 Pareto sweep.

last 14d, sku_id NULL, shoe signal, 30-50만 price range.

## Pareto 결과

| Brand | 건수 | p50 | 처리 |
|-------|------|-----|------|
| nike | 1,377 | 6.2만 | (Wave 730 의류 broad → shoe broad는 별도) |
| adidas | 455 | 5.5만 | 동일 |
| newbalance | 300 | 7.2만 | 이미 Wave 698 25 SKU 박힘 |
| puma | 106 | 5.8만 | 이미 Wave 700 narrow 박힘 |
| converse | 101 | 5.3만 | 이미 catalog 있음 |
| asics | 92 | 7.4만 | 이미 Wave 701 13 SKU 박힘 |
| vans | 66 | 5.0만 | 이미 catalog 있음 |
| **skechers** | **50** | **5.0만** | ✓ broad 신설 |
| reebok | 44 | 4.5만 | apparel SKU 있지만 신발 broad 없음 — 별 wave |
| **salomon** | **43** | **14.0만** | ✓ broad (XT-6 narrow 이미 있음) |
| **hoka** | **39** | **12.5만** | ✓ broad + Bondi narrow |
| crocs | 39 | 3.8만 | 이미 Wave 700 narrow |
| **on_running** | **28** | **12.0만** | ✓ broad (narrow 4개 이미 Wave 712c) |
| **underarmour** | **27** | **4.8만** | ✓ broad |
| camper | 26 | 7.0만 | false positive (Adidas Campus) — 별 wave |
| drmartens | 23 | 8.0만 | 이미 catalog 있음 |

## 신설 6 SKU (~190건 회수)
- `salomon_broad` (Pulsar/Speedcross/Sense/Wings/XA Pro)
- `hoka_bondi` (시그니처 max cushion 러닝)
- `hoka_broad` (Anacapa/Challenger/Transport/Stinson/Clifton/Speedgoat)
- `on_running_broad` (Cloudflow/Cloudtec/Vista/Cloudventure/Cloudswift)
- `skechers_broad` (Go Walk/Ultra Go/Slip-Ins/D'Lites)
- `underarmour_broad` (Curry 농구화 + Charged 트레이닝)

## 정책 부합
- Skechers/Under Armour: 일반인 친화 가격대 4-10만
- Hoka/On Running: 12-20만 (premium 러닝 — 일반인도 사용)
- Salomon: 14-20만 (트레일 러닝 mainstream)
- bag/apparel 강력 차단 (가방, 후드, 자켓, 팬츠 등)
- 기존 narrow와 충돌 방지 (mustNotContain에 기존 narrow 모델명 차단)

## Skip
- Camper 26건 → false positive (Adidas Campus = "캠퍼스") 정제 후 별 wave
- Brooks 9건 / Mizuno 12건 — 풀 너무 작음
- Diadora 8건 / Kith 8건 — small
