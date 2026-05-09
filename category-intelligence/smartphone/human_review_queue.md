# Smartphone — Human Review Queue (v3)

- category: smartphone
- generated_at: 2026-05-09T07:59:39.789Z
- 목적: AI가 만든 룰/SKU 후보 중 production 반영 전 사람이 승인할 것만 모음

## 승인 후보 Noise Rules

| approve | type | keyword | precision | hits | note |
|---|---|---|---:|---:|---|
| [ ] | accessory | `케이스티파이` | 0.80 | 21 | 총 5개 중 4개가 액세서리 케이스로 정확하여 정밀도는 0.8입니다. |
| [ ] | accessory | `케이스입니다` | 1.00 | 16 | 모든 매물이 '케이스'로 명확히 액세서리 타입에 부합하여 정밀도는 1.0입니다. |
| [ ] | accessory | `맥세이프` | 0.80 | 27 | 총 5개 중 4개가 accessory 타입으로 적합하여 정밀도는 0.8임 |
| [ ] | noise | `싸게` | 0.20 | 18 | 전체적으로 대부분 매물이 정상적인 새상품 할인 판매로 노이즈 타입이 아니며, 한 매물만 노이즈 타입으로 판단되어 정밀도는 낮음. |
| [ ] | commercial | `할인가` | 0.60 | 22 | 전체적으로 할인가 및 재고정리 문구가 포함된 매물은 상업적 판매로 판단되나, 일부 매물은 개인 판매 성격이 강해 정확도는 60%임. |
| [ ] | noise | `실거래` | 0.00 | 13 | 모든 매물이 'noise' 타입이 아니므로 전체 precision은 0.0입니다. |
| [ ] | noise | `별점` | 1.00 | 13 | 모든 매물이 'noise' 타입으로 정확히 분류되어 정밀도는 1.0입니다. |
| [ ] | noise | `재고는` | 1.00 | 13 | 모든 매물이 'noise' 타입으로 정확히 분류되어 정밀도는 1.0입니다. |
| [ ] | noise | `새폰을` | 0.00 | 13 | 모든 매물이 정상가 대비 지나치게 저렴하여 'noise' 타입으로 판단되지 않음. |
| [ ] | noise | `사본` | 0.00 | 13 | 제공된 모든 매물이 'noise' 타입이 아니므로 precision은 0.0입니다. |
| [ ] | noise | `있나요` | 0.00 | 13 | 제공된 모든 매물이 'noise' 타입이 아니므로 전체 precision은 0.0입니다. |
| [ ] | noise | `이미` | 0.00 | 13 | 제공된 모든 매물은 noise 타입이 아니므로 precision은 0.0임. |
| [ ] | noise | `고객님들이` | 0.00 | 13 | 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다. |

## 승인 후보 SKU

| approve | sku_id | model_name | aliases | median | confidence |
|---|---|---|---|---:|---:|
| BLOCK | 갤럭시-s23-256gb | 갤럭시 S23 256GB / risk=commercial_or_bait_terms | 갤럭시 S23 256GB, 갤럭시S23, 256GB, 블랙, 무잔상 | - | 0.90 |
| BLOCK | 갤럭시-s23-fe-256gb | 갤럭시 S23 FE 256GB / risk=commercial_or_bait_terms | 갤럭시 S23 FE 256GB, 갤럭시S23, 중고폰, 공기계, 무잔상 | - | 0.90 |
| BLOCK | 갤럭시-s24-256gb | 갤럭시 S24 256GB / risk=commercial_or_bait_terms | 갤럭시 S24 256GB, 갤럭시 S24, 중고폰, 공기계, 제품등급 | - | 0.90 |
| BLOCK | 갤럭시s23-갤럭시s24-아이폰15-프로 | 갤럭시S23, 갤럭시S24, 아이폰15 프로 / risk=commercial_or_bait_terms,multi_model_sku_hint,separator_with_multiple_models | 갤럭시S23, 갤럭시S24, 아이폰15 프로, 새상품, 미개봉, 정품, 완납폰 | - | 0.90 |
| BLOCK | 갤럭시z플립4-256gb-갤럭시s23fe-256gb-갤럭시z플립3-256gb-갤럭시z플립6-256gb-갤럭시z플립5 | 갤럭시Z플립4 256GB, 갤럭시S23FE 256GB, 갤럭시Z플립3 256GB, 갤럭시Z플립6 256GB, 갤럭시Z플립5 512GB / risk=commercial_or_bait_terms,multi_model_sku_hint,separator_with_multiple_models | 갤럭시Z플립4 256GB, 갤럭시S23FE 256GB, 갤럭시Z플립3 256GB, 갤럭시Z플립6 256GB, 갤럭시Z플립5 512GB, 기기단품, 무잔상, 잔상없음, 통신사 무관 | - | 0.90 |
| [ ] | 아이폰13미니-128gb | 아이폰13미니 128GB | 아이폰13미니 128GB, 아이폰13미니, 128, 고장품 파손품 없음, 모든기능 정상 | - | 0.90 |
| [ ] | iphone-13-mini-128gb | iPhone 13 mini 128GB | iPhone 13 mini 128GB, 아이폰 13, 아이폰 13미니, 128GB, 배터리 효율 | 325,000 | 0.90 |
| [ ] | iphone-13-mini-128gb-256gb | iPhone 13 mini 128GB / 256GB | iPhone 13 mini 128GB / 256GB, 아이폰13미니, 128, 256, 배터리 | 325,000 | 0.90 |
| [ ] | iphone-14-pro-128gb | iPhone 14 Pro 128GB | iPhone 14 Pro 128GB, 아이폰 14 프로, 128GB, 배터리 효율, 정상 작동 | 520,000 | 0.90 |
| [ ] | iphone-15-pro-128gb-256gb | iPhone 15 Pro 128GB / 256GB | iPhone 15 Pro 128GB / 256GB, 아이폰15pro, 화이트, 256GB, 128GB | 820,000 | 0.90 |
| BLOCK | iphone-16-iphone-16-pro-iphone-17-iphone-17e | iPhone 16, iPhone 16 Pro, iPhone 17, iPhone 17e / risk=commercial_or_bait_terms,multi_model_sku_hint,separator_with_multiple_models | iPhone 16, iPhone 16 Pro, iPhone 17, iPhone 17e, 미사용, 선착순 한정판매, 정품, 미개봉 새상품 | 90,000 | 0.90 |
