# Smartphone — Human Review Queue (v3)

- category: smartphone
- generated_at: 2026-05-09T11:25:14.854Z
- 목적: AI가 만든 룰/SKU 후보 중 production 반영 전 사람이 승인할 것만 모음

## 승인 후보 Noise Rules

| approve | type | keyword | precision | hits | note |
|---|---|---|---:|---:|---|
| [ ] | buying | `매입합니다` | 0.80 | 101 | 총 5개 매물 중 4개가 'buying' 타입으로 적절하여 전체 정밀도는 0.8입니다. |
| [ ] | damaged | `파손` | 0.80 | 160 | 전체적으로 5개 중 4개가 'damaged' 타입으로 정확히 분류되어 정밀도는 0.8로 평가됩니다. |
| [ ] | buying | `삽니다` | 0.80 | 59 | 총 5개 매물 중 4개가 buying 타입으로 적절하여 전체 precision은 0.8임. |
| [ ] | noise | `맥북` | 1.00 | 43 | 모든 매물이 'noise' 타입으로 정확히 분류되어 정밀도는 1.0입니다. |
| [ ] | buying | `24시간` | 0.60 | 55 | 총 5개 매물 중 3개가 buying 타입에 부합하여 precision은 0.6으로 평가됩니다. |
| [ ] | buying | `최고가` | 1.00 | 98 | 모든 매물이 'buying' 타입에 부합하여 전체 정밀도는 1.0입니다. |
| [ ] | buying | `출장` | 1.00 | 50 | 모든 매물이 'buying' 타입으로 정확히 분류되어 전체 precision은 1.0입니다. |
| [ ] | buying | `아이패드` | 1.00 | 40 | 모든 매물이 'buying' 타입으로 정확하게 분류되어 있어 정밀도는 1.0입니다. |
| [ ] | buying | `미개봉` | 0.60 | 106 | 전체적으로 5개 중 3개가 'buying' 타입으로 적합하여 정밀도는 0.6입니다. |
| [ ] | buying | `견적` | 0.80 | 65 | 총 5개 매물 중 4개가 'buying' 타입으로 적절하여 정밀도는 0.8로 평가됨. |
| [ ] | noise | `안녕하세요` | 0.60 | 42 | 총 5개 매물 중 3개가 'noise' 타입으로 정확히 분류되어 정밀도는 0.6입니다. |
| [ ] | buying | `노트북` | 0.00 | 53 | 모든 매물이 '매입' 즉 구매 의뢰로, 'buying' 타입이 아니므로 전체 precision은 0.0입니다. |
| [ ] | noise | `업체입니다` | 0.40 | 38 | 전체 5개 매물 중 2개가 'noise' 타입으로 정확히 분류되어 정밀도는 0.4입니다. |
| [ ] | buying | `전문` | 1.00 | 56 | 모든 매물이 명확히 'buying' 타입으로 판단되어 전체 정밀도는 1.0입니다. |
| [ ] | noise | `서울` | 0.00 | 114 | 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다. |
| [ ] | buying | `프로` | 0.80 | 146 | 총 5개 매물 중 4개가 구매용 매물로 정확하여 전체 정밀도는 0.8입니다. |
| [ ] | noise | `빠르고` | 0.00 | 33 | 제공된 모든 매물이 'noise' 타입이 아니므로 precision은 0.0입니다. |
| [ ] | noise | `편하게` | 0.40 | 43 | 전체적으로 5개 중 2개 매물만 '편하게' 키워드를 포함하여 noise 타입으로 적절히 분류됨. |
| [ ] | noise | `경기` | 0.00 | 41 | 제공된 모든 매물은 'noise' 타입이 아니므로 전체 precision은 0.0입니다. |

## 승인 후보 SKU

| approve | sku_id | model_name | aliases | median | confidence |
|---|---|---|---|---:|---:|
| [ ] | 갤럭시-s23-s22-s10e-버디-등-다양한-모델 | 갤럭시 S23+, S22, S10e, 버디 등 다양한 모델 | 갤럭시 S23+, S22, S10e, 버디 등 다양한 모델, 공기계, 중고 휴대폰, 기기 단품상품, 정상작동 | - | 0.90 |
| BLOCK | 갤럭시-s25-256gb-512gb-1tb-모델별로-s25-s25-플러스-s25-엣지-s25-울트라-포함 | 갤럭시 S25 256GB, 512GB, 1TB (모델별로 S25, S25 플러스, S25 엣지, S25 울트라 포함) / risk=commercial_or_bait_terms | 갤럭시 S25 256GB, 512GB, 1TB (모델별로 S25, S25 플러스, S25 엣지, S25 울트라 포함), 갤럭시 S25, 미개봉, 정품, 삼성케어 | - | 0.90 |
| BLOCK | 갤럭시s22-256gb-갤럭시s7-32gb-아이폰6s-64gb-갤럭시z폴드7 | 갤럭시S22 256GB, 갤럭시S7 32GB, 아이폰6s 64GB, 갤럭시Z폴드7 / risk=commercial_or_bait_terms,multi_model_sku_hint,separator_with_multiple_models | 갤럭시S22 256GB, 갤럭시S7 32GB, 아이폰6s 64GB, 갤럭시Z폴드7, 중고, 실버, 64기가, 무잔상 | - | 0.90 |
| BLOCK | 아이폰se1-16gb-32gb-128gb | 아이폰SE1 16GB/32GB/128GB / risk=commercial_or_bait_terms | 아이폰SE1 16GB/32GB/128GB, sss급, 외관새상품급, 베터리성능100, 유심인식가능 | - | 0.90 |
| BLOCK | iphone-15-pro-256gb | iPhone 15 Pro 256GB / risk=commercial_or_bait_terms | iPhone 15 Pro 256GB, 아이폰15프로, 아이폰14플러스, 중고, 기기단품 | 636,000 | 0.90 |
| BLOCK | iphone-se1-128gb | iPhone SE1 128GB / risk=commercial_or_bait_terms | iPhone SE1 128GB, 아이폰 SE1 128GB, 아이폰13미니 128G, 중고 본체, 배터리 교체 | - | 0.90 |
